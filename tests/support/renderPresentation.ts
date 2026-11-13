import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { isValidElement, type ReactElement } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

// Stateless presentation only. Native host primitives and explicitly listed
// leaf components are replaced, not business services or authorization helpers.
export function renderPresentation(path: string, name: string, props: unknown, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const exported: Record<string, unknown> = {}
  runInNewContext(code, { exports: exported, require(id: string) {
    if (id === 'react/jsx-runtime') return jsxRuntime
    if (id === 'react-native') return {
      View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create<T>(styles: T) { return styles } },
    }
    if (Object.hasOwn(dependencies, id)) return dependencies[id]
    throw new Error('Unexpected presentation dependency: ' + id)
  } }, { timeout: 1000 })
  const component = exported[name]
  assert.ok(typeof component === 'function')
  const tree: unknown = component(props)
  assert.ok(typeof tree === 'object' && tree !== null && isValidElement<Record<string, unknown>>(tree))
  return tree
}
export function elements(tree: unknown) {
  const found: ReactElement<Record<string, unknown>>[] = []
  function visit(node: unknown) {
    if (Array.isArray(node)) { for (const child of node) visit(child); return }
    if (typeof node === 'object' && node !== null && isValidElement<Record<string, unknown>>(node)) {
      found.push(node); visit(node.props.children)
    }
  }
  visit(tree)
  return found
}
export function renderedText(tree: unknown): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map((child: unknown) => renderedText(child)).join(' ')
  if (typeof tree === 'object' && tree !== null && isValidElement<Record<string, unknown>>(tree)) return renderedText(tree.props.children)
  return ''
}

