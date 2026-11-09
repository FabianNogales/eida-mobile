import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { getStateFromPath, type Options, type ResultState } from 'expo-router/build/fork/getStateFromPath'
import { TabActions, TabRouter, type TabNavigationState } from 'expo-router/build/react-navigation/routers/TabRouter'
import { StackActions, StackRouter, type StackNavigationState } from 'expo-router/build/react-navigation/routers/StackRouter'
import * as CommonActions from 'expo-router/build/react-navigation/routers/CommonActions'
import { mainTabs, selectTab } from '../src/navigation/mainTabs'
import { pendingSummary } from '../src/ui/pendingSummary'
import { canAccessPrivate } from '../src/features/auth/guards'
import type { SessionSnapshot } from '../src/features/auth/contracts'

// Discover the real route files. Group segments are retained, as Expo does in
// getReactNavigationConfig, then the installed path matcher resolves each Href.
interface RouteConfig { path: string; screens?: Record<string, RouteConfig> }
function routeFiles(directory: string): Record<string, RouteConfig> {
  const screens: Record<string, RouteConfig> = {}
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) screens[entry.name] = { path: entry.name, screens: routeFiles(join(directory, entry.name)) }
    else if (entry.name.endsWith('.tsx') && !entry.name.startsWith('_') && !entry.name.startsWith('+')) {
      const name = entry.name.slice(0, -4)
      screens[name] = { path: name === 'index' ? '' : name }
    }
  }
  return screens
}
const config: Options<Record<string, object | undefined>> = {
  screens: routeFiles(fileURLToPath(new URL('../src/app/', import.meta.url))),
}
function activeNames(state: ResultState | undefined): string[] {
  if (!state) return []
  const route = state.routes[state.index ?? state.routes.length - 1]
  if (!route) return []
  return [route.name, ...activeNames(route.state)]
}

test('existing qualified Hrefs and public URLs still resolve through the pathless tab group', () => {
  for (const name of ['exams', 'profile']) for (const href of [`/(private)/${name}`, `/${name}`, `/(private)/(tabs)/${name}`]) {
    assert.deepEqual(activeNames(getStateFromPath(href, config)), ['(private)', '(tabs)', name], href)
  }
  assert.deepEqual(activeNames(getStateFromPath('/(private)', config)), ['(private)', '(tabs)', 'index'])
  assert.deepEqual(activeNames(getStateFromPath('/(private)/pending', config)), ['(private)', '(tabs)', 'pending'])
  assert.deepEqual(activeNames(getStateFromPath('/login', config)), ['login'])
})
test('detail and protected offline routes remain outside the tabs with their original parameters', () => {
  const paths = [
    ['/(private)/offline-distribution?examId=12', ['(private)', 'offline-distribution']],
    ['/(private)/incident?incidentId=9', ['(private)', 'incident']],
    ['/offline/list?packageId=package-A&search=Alvarez', ['offline', 'list']],
    ['/offline/scan?packageId=package-A', ['offline', 'scan']],
    ['/offline/sync', ['offline', 'sync']],
    ['/offline/incidents', ['offline', 'incidents']],
  ] as const
  for (const [href, names] of paths) assert.deepEqual(activeNames(getStateFromPath(href, config)), names, href)
  const state = getStateFromPath('/offline/list?packageId=package-A&search=Alvarez', config)
  const leaf = state?.routes[0]?.state?.routes[0]
  assert.deepEqual(leaf?.params, { packageId: 'package-A', search: 'Alvarez' })
})

test('actual TabRouter history returns to visited tabs and keeps each route context', () => {
  const router = TabRouter({ initialRouteName: 'index', backBehavior: 'history' })
  let state: TabNavigationState<Record<string, object | undefined>> = {
    stale: false, type: 'tab', key: 'main-tabs', routeKeySeq: 4, index: 0,
    routeNames: mainTabs.map((tab) => tab.name),
    routes: mainTabs.map((tab) => ({ name: tab.name, key: `tab-${tab.name}`,
      params: tab.name === 'exams' ? { view: 'upcoming', offset: 120, examId: '12' } : undefined })),
    history: [{ type: 'route', key: 'tab-index' }],
  }
  const originalExams = state.routes[1]
  assert.ok(originalExams)
  const dispatch = (action: Parameters<typeof router.getStateForAction>[1]) => {
    const result = router.getStateForAction(state, action, { routeNames: state.routeNames, routeGetIdList: {} })
    assert.ok(typeof result === 'object' && result !== null && 'state' in result)
    state = result.state
  }
  // The installed navigateToTab forwards the existing route.params to actions.navigate.
  dispatch(TabActions.jumpTo('exams', originalExams.params))
  dispatch(TabActions.jumpTo('pending'))
  dispatch(TabActions.jumpTo('pending'))
  assert.equal(state.routes.length, 4)
  assert.equal(state.history?.length, 3)
  dispatch(CommonActions.goBack())
  assert.equal(state.routes[state.index]?.name, 'exams')
  assert.deepEqual(state.routes[state.index], originalExams)
  dispatch(CommonActions.goBack())
  assert.equal(state.routes[state.index]?.name, 'index')
})
test('tab presses respect preventDefault and do not navigate again when selected', () => {
  const visited: string[] = [], emitted: string[] = []
  const allow = (key: string) => { emitted.push(key); return { defaultPrevented: false } }
  selectTab('tab-exams', false, allow, (key) => visited.push(key))
  selectTab('tab-exams', true, allow, (key) => visited.push(key))
  selectTab('tab-pending', false, () => ({ defaultPrevented: true }), (key) => visited.push(key))
  assert.deepEqual(visited, ['tab-exams'])
  assert.deepEqual(emitted, ['tab-exams', 'tab-exams'])
})
test('pending overview keeps both queues independent and preserves conflicts/rejections', () => {
  const entries = [{ state: 'PENDING' }, { state: 'SENDING' }, { state: 'CONFIRMED' },
    { state: 'DUPLICATE' }, { state: 'CONFLICT' }, { state: 'REJECTED' }] as const
  const incidents = [{ state: 'PENDING' }, { state: 'REGISTERED' }, { state: 'REJECTED' }] as const
  const before = JSON.stringify({ entries, incidents })
  assert.deepEqual(pendingSummary(true, entries, incidents), {
    entry: { pending: 1, sending: 1, conflicts: 1, rejected: 1 },
    incident: { pending: 1, sending: 0, conflicts: 0, rejected: 1 }, pending: 3, attention: 3,
  })
  assert.equal(JSON.stringify({ entries, incidents }), before)
  assert.equal(pendingSummary(false, entries, incidents), null)
  const reviewOnly = pendingSummary(true, [{ state: 'CONFLICT' }], [{ state: 'REJECTED' }])
  assert.equal(reviewOnly?.pending, 0)
  assert.equal(reviewOnly?.attention, 2)
  assert.deepEqual(pendingSummary(true, [], []), {
    entry: { pending: 0, sending: 0, conflicts: 0, rejected: 0 },
    incident: { pending: 0, sending: 0, conflicts: 0, rejected: 0 }, pending: 0, attention: 0,
  })
})

test('losing private authorization removes the entire nested tabs subtree from root history', () => {
  const session: SessionSnapshot = { status: 'authenticated', user: { id: 7, display_name: 'Synthetic',
    email: 'user@example.test', status: 'ACTIVE', must_change_password: false, roles: ['DOCENTE'] },
    message: null, busy: false, hasCredential: true, logoutPending: false, expiresAt: null, deviceId: 11, validatedAt: null }
  assert.equal(canAccessPrivate(session), true)
  const router = StackRouter({ initialRouteName: 'login' })
  const state: StackNavigationState<Record<string, object | undefined>> = {
    stale: false, type: 'stack', key: 'root', routeKeySeq: 2, index: 1,
    routeNames: ['login', 'offline', '(private)'], routes: [
      { key: 'login', name: 'login' },
      { key: 'private', name: '(private)', state: { routes: [{ name: '(tabs)', state: {
        index: 1, routes: [{ name: 'index' }, { name: 'pending' }],
      } }] } },
    ],
  }
  assert.equal(canAccessPrivate({ ...session, logoutPending: true }), false)
  assert.equal(canAccessPrivate({ ...session, status: 'unauthenticated', user: null, hasCredential: false }), false)
  const allowed = ['login', 'offline']
  const next = router.getStateForDeclaredRoutes({ ...state, routeNames: allowed }, allowed)
  assert.equal(next.routes.some((route) => route.name === '(private)'), false)
  assert.equal(next.routes[next.index]?.name, 'login')
  const attempted = router.getStateForAction(next, StackActions.push('(private)'), { routeNames: allowed, routeGetIdList: {} })
  assert.equal(typeof attempted === 'object' && attempted !== null && 'state' in attempted, false)
  assert.equal(next.routeNames.includes('offline'), true)
})
