import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'
import { theme } from '../src/config/theme'
import { canAccessPrivate } from '../src/features/auth/guards'
import { ApiError, errorMessage } from '../src/services/http/errors'
import { user } from './support/authFixtures'

function source(file: string) {
  return readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
}

function loadModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const { outputText } = ts.transpileModule(source(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } })
  const exports = {}
  runInNewContext(outputText, { exports, AbortController, require(name: string) {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  } })
  return exports as T
}

test('gesture and TalkBack invoke the same refresh callback and forward the controlled loading indicator', () => {
  const { screenRefreshProps } = loadModule<typeof import('../src/components/screenRefresh')>('components/screenRefresh.tsx', {
    'react/jsx-runtime': jsxRuntime, 'react-native': { RefreshControl: 'RefreshControl' }, '../config/theme': { theme },
  })
  let calls = 0
  const options = { enabled: true, refreshing: true, onRefresh() { calls++ } }
  const native = screenRefreshProps(options)
  assert.equal(native.refreshControl?.type, 'RefreshControl')
  assert.equal(native.refreshControl?.props.refreshing, true)
  native.refreshControl?.props.onRefresh()
  assert.equal(native.accessibilityActions?.[0]?.label, 'Actualizar contenido')
  native.onAccessibilityAction?.({ nativeEvent: { actionName: 'refresh' } })
  assert.equal(calls, 2)
  const disabled = screenRefreshProps({ ...options, enabled: false, refreshing: false })
  disabled.onAccessibilityAction?.({ nativeEvent: { actionName: 'refresh' } })
  assert.equal(disabled.refreshControl?.props.enabled, false)
  assert.equal(disabled.refreshControl?.props.refreshing, false)
  assert.equal(calls, 2)
})

test('a gesture joins the active read, clears errors on retry and aborts when leaving the screen', async () => {
  // Run the hook's effect and clean-up without mounting a native screen.
  let cleanup: (() => void) | undefined
  const published: { result: { loading: boolean; error: string | null; data: unknown } }[] = []
  const { useRemoteQuery } = loadModule<typeof import('../src/hooks/useRemoteQuery')>('hooks/useRemoteQuery.ts', {
    react: {
      useState: (initial: unknown) => [initial, (value: (typeof published)[number]) => published.push(value)],
      useRef: (current: unknown) => ({ current }),
      useEffect: (effect: () => () => void) => { cleanup = effect() },
    },
    '../services/http/errors': { ApiError, errorMessage },
  })
  const requests: { signal: AbortSignal; resolve(data: string): void; reject(error: Error): void }[] = []
  const query = useRemoteQuery((signal) => new Promise<string>((resolve, reject) => requests.push({ signal, resolve, reject })))
  const first = query.reload()
  assert.equal(first, query.reload())
  await Promise.resolve()
  assert.equal(requests.length, 1)
  assert.equal(published.at(-1)?.result.loading, true)
  requests[0]!.reject(new ApiError('protocol', 'Respuesta incompleta'))
  await first
  assert.equal(published.at(-1)?.result.error, 'Respuesta incompleta')
  const retry = query.reload()
  assert.equal(published.at(-1)?.result.error, null)
  await Promise.resolve()
  requests[1]!.resolve('consulta válida')
  await retry
  assert.equal(published.at(-1)?.result.data, 'consulta válida')
  const leaving = query.reload()
  await Promise.resolve()
  cleanup?.()
  assert.equal(requests[2]?.signal.aborted, true)
  requests[2]!.resolve('respuesta de la pantalla anterior')
  await leaving
  assert.equal(published.at(-1)?.result.data, null)
})

test('private refresh checks the live session before reading and releases its lock after completion', async () => {
  const states: boolean[] = []
  const screenRefresh = loadModule<typeof import('../src/hooks/useScreenRefresh')>('hooks/useScreenRefresh.ts', {
    react: { useState: (initial: boolean) => [initial, (value: boolean) => states.push(value)],
      useRef: (current: boolean) => ({ current }) },
  })
  const session = { status: 'authenticated', user, busy: false, logoutPending: false }
  let live = session, remaining = 100
  const { usePrivateRefresh } = loadModule<typeof import('../src/hooks/usePrivateRefresh')>('hooks/usePrivateRefresh.ts', {
    '../features/auth/AuthProvider': { useAuth: () => ({ session, controller: {
      getSnapshot: () => live, remainingMs: () => remaining,
    } }) },
    '../features/auth/guards': { canAccessPrivate },
    './useScreenRefresh': screenRefresh,
  })
  let reads = 0, finish: (() => void) | undefined
  const refresh = usePrivateRefresh(() => {
    reads++
    return new Promise<void>((resolve) => { finish = resolve })
  })
  live = { ...session, status: 'expired' }
  refresh.onRefresh()
  live = { ...session, busy: true }
  refresh.onRefresh()
  live = session
  remaining = 0
  refresh.onRefresh()
  assert.equal(reads, 0)
  remaining = 100
  refresh.onRefresh()
  refresh.onRefresh()
  assert.equal(reads, 1)
  assert.deepEqual(states, [true])
  finish?.()
  await Promise.resolve()
  assert.deepEqual(states, [true, false])
  refresh.onRefresh()
  assert.equal(reads, 2)
  finish?.()
})

test('the exam and home screens keep navigation available and attach refresh to their existing scroll containers', () => {
  const exams = source('screens/ExamsScreen.tsx'), home = source('screens/HomeScreen.tsx')
  assert.match(exams, /<ListScreen[^\n]*refresh=\{refresh\}/)
  assert.match(exams, /label="Mis colaboraciones" onPress=\{\(\) => router.push/)
  assert.match(home, /<Screen refresh=\{refresh\}>/)
  assert.match(home, /Promise.all\(\[exams.reload\(\), assignments.reload\(\)\]\)/)
  assert.match(home, /label="Mis exámenes"[\s\S]*?onPress=\{\(\) => router.push/)
  assert.doesNotMatch(exams, /ScrollView|label="Actualizar"/)
  assert.doesNotMatch(home, /label="Actualizar"/)
})
