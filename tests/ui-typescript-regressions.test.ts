import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { isValidElement, type ReactElement } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'
import type { ChoiceChips } from '../src/components/operations/ChoiceChips'
import { theme } from '../src/config/theme'
import { incidentTypes, infractionTypes, type InfractionType } from '../src/features/incidents/contracts'
import { queueKnown } from '../src/ui/operations'

// Read the real JSX guards without mounting screens or opening native services.
// These are source-level presentation checks, not an Android/FlatList renderer.
type ListSlot = 'ListEmptyComponent' | 'ListFooterComponent'
function listSlot(screen: string, slot: ListSlot) {
  const path = new URL(`../src/screens/${screen}.tsx`, import.meta.url)
  const source = ts.createSourceFile(path.pathname, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function visit(node: ts.Node): ts.Expression | undefined {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === slot) {
      const initializer = node.initializer
      if (initializer && ts.isJsxExpression(initializer)) return initializer.expression
    }
    return ts.forEachChild(node, visit)
  }
  const expression = visit(source)
  assert.ok(expression && ts.isConditionalExpression(expression), `${screen}.${slot} must keep its conditional JSX`)
  assert.equal(expression.whenFalse.getText(source), 'undefined')
  assert.ok(ts.isJsxElement(expression.whenTrue) || ts.isJsxSelfClosingElement(expression.whenTrue))
  const condition = expression.condition.getText(source)
  return (scope: Record<string, unknown>): boolean => {
    const visible: unknown = runInNewContext(`Boolean(${condition})`, scope, { timeout: 1000 })
    assert.equal(typeof visible, 'boolean')
    return visible === true
  }
}

test('exam empty state waits for a successful resolved query; footer retains its original pagination guard', () => {
  const empty = listSlot('ExamsScreen', 'ListEmptyComponent'), footer = listSlot('ExamsScreen', 'ListFooterComponent')
  const data = { data: [] }
  assert.equal(empty({ query: { data, loading: false, error: null } }), true)
  for (const query of [
    { data: null, loading: true, error: null },
    { data, loading: true, error: null },
    { data, loading: false, error: 'network error' },
    { data: null, loading: false, error: null },
  ]) assert.equal(empty({ query }), false)
  assert.equal(footer({ query: { data: null } }), false)
  assert.equal(footer({ query: { data, loading: true, error: 'refresh error' } }), true)
})

test('official incident empty and footer slots preserve authorization, loading and error conditions', () => {
  const empty = listSlot('IncidentsScreen', 'ListEmptyComponent'), footer = listSlot('IncidentsScreen', 'ListFooterComponent')
  const data = { data: [] }, resolved = { data, loading: false, error: null }
  assert.equal(empty({ allowed: true, query: resolved }), true)
  assert.equal(footer({ allowed: true, query: resolved }), true)
  for (const allowed of [false, undefined]) {
    assert.equal(empty({ allowed, query: resolved }), false)
    assert.equal(footer({ allowed, query: resolved }), false)
  }
  for (const query of [
    { ...resolved, loading: true }, { ...resolved, error: 'forbidden' }, { ...resolved, data: null },
  ]) assert.equal(empty({ allowed: true, query }), false)
  // Footer visibility still depends on authorization/data, not refresh success.
  assert.equal(footer({ allowed: true, query: { ...resolved, loading: true } }), true)
  assert.equal(footer({ allowed: true, query: { ...resolved, data: null } }), false)
})

test('local search does not show an empty result before settling, during loading or after an error', () => {
  const empty = listSlot('OfflineListScreen', 'ListEmptyComponent')
  assert.equal(empty({ loading: false, settled: true, error: null }), true)
  for (const scope of [
    { loading: true, settled: true, error: null },
    { loading: false, settled: false, error: null },
    { loading: false, settled: true, error: 'protected data unavailable' },
  ]) assert.equal(empty(scope), false)
})

test('offline queues hide their empty slots while locked or awaiting their first protected read', () => {
  const runtime = {}, otherRuntime = {}
  for (const screen of ['OfflineIncidentsScreen', 'OfflineSyncScreen']) {
    const empty = listSlot(screen, 'ListEmptyComponent')
    assert.equal(empty({ known: queueKnown(null, runtime, false) }), false)
    assert.equal(empty({ known: queueKnown(runtime, null, true) }), false)
    assert.equal(empty({ known: queueKnown(runtime, otherRuntime, true) }), false)
    assert.equal(empty({ known: queueKnown(runtime, runtime, false) }), true)
    assert.equal(empty({ known: queueKnown(runtime, runtime, true) }), true)
  }
})

// Execute the actual stateless ChoiceChips function. Only React Native host
// primitives, StyleSheet and the AppText leaf are replaced; JSX uses real React.
// No native hooks, authentication, databases or HTTP are loaded.
const componentSource = readFileSync(new URL('../src/components/operations/ChoiceChips.tsx', import.meta.url), 'utf8')
const componentCode = ts.transpileModule(componentSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText
const componentExports: Record<string, unknown> = {}
runInNewContext(componentCode, {
  exports: componentExports,
  require(name: string) {
    if (name === 'react/jsx-runtime') return jsxRuntime
    if (name === 'react-native') return { View: 'View', Pressable: 'Pressable', StyleSheet: { create<T>(styles: T) { return styles } } }
    if (name === '../../config/theme') return { theme }
    if (name === '../AppText') return { AppText: 'AppText' }
    throw new Error(`Unexpected dependency in ChoiceChips test: ${name}`)
  },
}, { timeout: 1000 })

function renderChips<const Value extends string>(props: Parameters<typeof ChoiceChips<Value>>[0]) {
  const component = componentExports.ChoiceChips
  assert.ok(typeof component === 'function')
  const tree: unknown = component(props)
  assert.ok(typeof tree === 'object' && tree !== null && isValidElement<Record<string, unknown>>(tree))
  const children: unknown = tree.props.children
  assert.ok(Array.isArray(children))
  return Array.from(children, (child: unknown) => {
    assert.ok(typeof child === 'object' && child !== null && isValidElement<Record<string, unknown>>(child))
    return child
  })
}
function accessibility(chip: ReactElement<Record<string, unknown>>) {
  const state = chip.props.accessibilityState
  assert.ok(typeof state === 'object' && state !== null && 'checked' in state && 'disabled' in state)
  return state
}
function press(chip: ReactElement<Record<string, unknown>>) {
  const handler = chip.props.onPress
  assert.ok(typeof handler === 'function')
  handler()
}

test('ChoiceChips renders the real domain options as labelled radios with one selected value', () => {
  function checkOptions<const Value extends string>(options: readonly { value: Value; label: string }[]) {
    const first = options[0]
    assert.ok(first)
    const selected = first.value
    const chips = renderChips({ options, value: selected, onChange() {} })
    assert.equal(chips.length, options.length)
    chips.forEach((chip, index) => {
      const option = options[index]
      assert.ok(option)
      assert.equal(chip.key, option.value)
      assert.equal(chip.props.accessibilityRole, 'radio')
      assert.equal(chip.props.accessibilityLabel, option.label)
      assert.equal(accessibility(chip).checked, option.value === selected)
      assert.equal(accessibility(chip).disabled, false)
      assert.equal(chip.props.disabled, false)
    })
  }
  checkOptions(incidentTypes)
  checkOptions(infractionTypes)
})

test('ChoiceChips emits the option literal and reflects selection only after the controlled value changes', () => {
  let selected: InfractionType = 'COPYING'
  const changes: InfractionType[] = []
  const onChange = (value: InfractionType) => { changes.push(value); selected = value }
  const before = renderChips({ options: infractionTypes, value: selected, onChange })
  const next = before[1]
  assert.ok(next)
  press(next)
  assert.deepEqual(changes, ['CHEATING'])
  // Existing elements remain controlled by their original value.
  assert.equal(accessibility(next).checked, false)
  const after = renderChips({ options: infractionTypes, value: selected, onChange })
  assert.equal(after.filter((chip) => accessibility(chip).checked).length, 1)
  assert.equal(after.find((chip) => accessibility(chip).checked)?.key, 'CHEATING')
})

test('ChoiceChips forwards disabled to every native Pressable and its accessibility state', () => {
  const changes: InfractionType[] = []
  const chips = renderChips({ options: infractionTypes, value: 'COPYING', disabled: true,
    onChange(value) { changes.push(value) } })
  for (const chip of chips) {
    assert.equal(chip.props.disabled, true)
    assert.equal(accessibility(chip).disabled, true)
  }
  assert.equal(chips.filter((chip) => accessibility(chip).checked).length, 1)
  assert.deepEqual(changes, [])
  // Native Pressable suppresses disabled presses. Do not invoke onPress manually
  // on a disabled host and mistake that for a real Android interaction.
})

