import test from 'node:test'
import assert from 'node:assert/strict'
// Pure reducer actually installed with Expo Router 58; no simulated navigation state machine.
import { StackActions, StackRouter, type StackNavigationState } from 'expo-router/build/react-navigation/routers/StackRouter'
import * as CommonActions from 'expo-router/build/react-navigation/routers/CommonActions'
import { createExitConfirmation, goBack, type BackPort } from '../src/navigation/back'
import { canAccessPrivate } from '../src/features/auth/guards'
import type { SessionSnapshot } from '../src/features/auth/contracts'

function harness(routeNames = ['index', 'list', 'scan', 'sync', 'incidents', 'report-incident', 'infraction-draft'], initialRouteName = 'list') {
  const router = StackRouter({ initialRouteName })
  let state: StackNavigationState<Record<string, object | undefined>> = {
    stale: false, type: 'stack', key: 'offline-stack', routeKeySeq: 1, index: 0,
    routeNames,
    routes: [{ key: `${initialRouteName}-original`, name: initialRouteName,
      params: initialRouteName === 'list' ? { packageId: 'package-A', search: 'Álvarez', offset: 50 } : undefined }],
  }
  const dispatch = (action: Parameters<typeof router.getStateForAction>[1]) => {
    const result = router.getStateForAction(state, action, { routeNames: state.routeNames, routeGetIdList: {} })
    if (typeof result !== 'object' || result === null || !('state' in result)) return false
    state = result.state; return true
  }
  return { router, dispatch, state: () => state, removePrivate() {
    const allowed = state.routeNames.filter((name) => name !== '(private)')
    state = router.getStateForDeclaredRoutes({ ...state, routeNames: allowed }, allowed)
  } }
}
for (const detail of ['report-incident', 'scan']) test(`forward navigation and real Back preserve the original list/exam context after ${detail}`, () => {
  const h = harness(), original = h.state().routes[0]
  assert.equal(h.dispatch(StackActions.push(detail, { packageId: 'package-A', studentId: '101' })), true)
  assert.equal(h.state().index, 1)
  const port: BackPort = { canGoBack: () => h.state().index > 0,
    back: () => { h.dispatch(CommonActions.goBack()) }, replace: () => { throw new Error('Back must not replace the list') } }
  assert.equal(goBack(port), true)
  assert.equal(h.state().index, 0)
  assert.deepEqual(h.state().routes[0], original) // Same key and original search/page params.
  assert.equal(h.state().routes.length, 1)
})
test('root Back does not push or replace home; direct-entry fallback is explicit', () => {
  const replacements: unknown[] = []
  const port: BackPort = { canGoBack: () => false, back: () => { throw new Error('No history') }, replace: (href) => { replacements.push(href) } }
  assert.equal(goBack(port), false); assert.deepEqual(replacements, [])
  const fallback = { pathname: '/offline/list', params: { packageId: 'package-A' } }
  assert.equal(goBack(port, fallback), true); assert.deepEqual(replacements, [fallback])
})
test('cancelling form exit preserves context; confirming retries the original action only once', () => {
  const h = harness(), original = h.state().routes[0], decision = createExitConfirmation()
  h.dispatch(StackActions.push('report-incident', { packageId: 'package-A' }))
  const repeat = () => { h.dispatch(CommonActions.goBack()) }
  assert.equal(decision.request(repeat), true)
  assert.equal(decision.request(repeat), false) // One confirmation dialog at a time.
  decision.cancel(); assert.equal(h.state().index, 1)
  decision.confirm(); assert.equal(h.state().index, 1) // Back/cancel never accepts.
  decision.request(repeat); decision.confirm(); decision.confirm()
  assert.equal(h.state().index, 0); assert.deepEqual(h.state().routes[0], original)
})
test('session guard removal prevents Back or direct navigation from restoring a private route', () => {
  const session: SessionSnapshot = { status: 'authenticated', user: { id: 7, display_name: 'Synthetic', email: 'teacher@example.test', status: 'ACTIVE',
    must_change_password: false, roles: ['DOCENTE'] }, message: null, busy: false, hasCredential: true, logoutPending: false,
    expiresAt: null, deviceId: 11, validatedAt: null }
  const h = harness(['index', 'login', 'offline', '(private)'], 'index')
  assert.equal(canAccessPrivate(session), true)
  h.dispatch(StackActions.push('(private)'))
  assert.equal(canAccessPrivate({ ...session, status: 'unauthenticated', user: null, hasCredential: false }), false)
  h.removePrivate()
  assert.equal(h.state().routes.some((route) => route.name === '(private)'), false)
  assert.equal(h.dispatch(StackActions.push('(private)')), false)
  const decision = createExitConfirmation(); let repeated = false
  decision.request(() => { repeated = true }); decision.clear(); decision.confirm()
  assert.equal(repeated, false) // Pending form action cannot outlive a lost authorization.
  assert.equal(canAccessPrivate({ ...session, logoutPending: true }), false)
  assert.equal(canAccessPrivate({ ...session, user: { ...session.user!, must_change_password: true } }), false)
})
