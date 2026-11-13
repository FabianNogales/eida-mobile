import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/services/http/errors'
import { canAccessPrivate } from '../src/features/auth/guards'
import { nextResumeState, shouldRestoreOnResume } from '../src/features/auth/resume'
import { loginFields } from '../src/features/auth/loginFeedback'
import { loginPresentation } from '../src/ui/generalScreens'
import { BASE, harness, loginResponse, PASSWORD, response, signIn, user } from './support/authFixtures'
import type { ResponsePort } from '../src/services/http/client'

function deferred<T>() {
  let complete: (value: T) => void = () => { throw new Error('Deferred not initialized') }
  const promise = new Promise<T>((resolve) => { complete = resolve })
  return { promise, resolve: (value: T) => complete(value) }
}

test('logout immediately hides identity and makes one protected-to-public transition, including duplicate taps', async () => {
  const started = deferred<void>(), remote = deferred<void>()
  const h = harness(async (path, _init, url) => {
    if (path === 'auth/logout') { started.resolve(undefined); await remote.promise; return response(url, { message: 'Session revoked successfully' }) }
    return response(url, path === 'me' ? { success: true, data: user } : loginResponse())
  })
  await signIn(h)
  const transitions = [canAccessPrivate(h.session.getSnapshot())]
  const statuses: string[] = []
  const stop = h.session.subscribe(() => {
    const snapshot = h.session.getSnapshot(), allowed = canAccessPrivate(snapshot)
    if (transitions.at(-1) !== allowed) transitions.push(allowed)
    statuses.push(snapshot.status)
    assert.equal(snapshot.user, null)
    assert.equal(loginPresentation(snapshot, true).destination, null)
  })
  const closing = h.session.logout()
  assert.equal(h.session.getSnapshot().user, null)
  assert.equal(h.session.getSnapshot().logoutPending, true)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
  await started.promise
  await h.session.logout()
  await assert.rejects(h.session.request('teacher/exams'), { status: 401 })
  remote.resolve(undefined); await closing; stop()
  assert.deepEqual(transitions, [true, false])
  assert.ok(!statuses.includes('initializing'))
  assert.equal(h.calls.filter((call) => call.path === 'auth/logout').length, 1)
  assert.equal(h.session.getSnapshot().hasCredential, false)
  // The root Protected guard owns history removal; no screen redirect is needed.
})

test('logout blocks private access even while a security boundary is still closing', async () => {
  const h = harness(); await signIn(h)
  const boundary = deferred<void>()
  h.session.onSecurityBoundary(() => boundary.promise)
  const closing = h.session.logout()
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
  assert.equal(h.session.offlineBinding(), null)
  assert.equal(h.calls.filter((call) => call.path === 'auth/logout').length, 0)
  boundary.resolve(undefined); await closing
  assert.equal(h.session.getSnapshot().status, 'unauthenticated')
})

test('failed logout persistence remains blocked in memory and never silently restores on resume', async () => {
  const h = harness(); await signIn(h)
  h.driver.setItem = async () => { throw new Error('secure persistence failure') }
  await h.session.logout()
  const snapshot = h.session.getSnapshot()
  assert.equal(snapshot.status, 'unauthenticated')
  assert.equal(snapshot.logoutPending, true)
  assert.equal(snapshot.user, null)
  assert.equal(shouldRestoreOnResume('background', 'active', snapshot), false)
  assert.match(snapshot.message ?? '', /antes de reiniciar/)
  await assert.rejects(h.session.request('teacher/exams'), { status: 401 })
})

for (const status of [200, 401]) test('old async response after logout cannot populate or invalidate the second account: ' + status, async () => {
  const oldResponse = deferred<ResponsePort>()
  let actor = user
  const h = harness(async (path, _init, url) => {
    if (path === 'teacher/exams') return oldResponse.promise
    if (path === 'auth/logout') return response(url, { message: 'Session revoked successfully' })
    return response(url, path === 'me' ? { success: true, data: actor } : loginResponse(actor))
  })
  await signIn(h)
  const pending = h.session.request('teacher/exams')
  const rejected = assert.rejects(pending, ApiError)
  await h.session.logout()
  actor = { ...user, id: 8, display_name: 'Segunda cuenta sintética' }
  await h.session.login('second@example.test', PASSWORD)
  oldResponse.resolve(response(BASE + '/teacher/exams', { data: ['old account synthetic data'] }, status))
  await rejected
  assert.equal(h.session.getSnapshot().user?.id, 8)
  assert.equal(h.session.getSnapshot().status, 'authenticated')
})

test('resume ignores transient inactive states and closed sessions but revalidates real background returns', async () => {
  const h = harness(); await signIn(h)
  const snapshot = h.session.getSnapshot()
  assert.equal(shouldRestoreOnResume('inactive', 'active', snapshot), false)
  assert.equal(shouldRestoreOnResume('background', 'active', snapshot), true)
  assert.equal(shouldRestoreOnResume(nextResumeState('background', 'inactive'), 'active', snapshot), true)
  assert.equal(nextResumeState('active', 'inactive'), 'active')
  assert.equal(shouldRestoreOnResume('active', 'active', snapshot), false)
  assert.equal(shouldRestoreOnResume('background', 'active', { ...snapshot, busy: true }), false)
  await h.session.logout()
  assert.equal(shouldRestoreOnResume('background', 'active', h.session.getSnapshot()), false)
})

test('login fields show individual validation without sending empty credentials', async () => {
  assert.ok(loginFields('', PASSWORD).identifier)
  assert.equal(loginFields('', PASSWORD).password, null)
  assert.ok(loginFields(user.email, '').password)
  assert.equal(loginFields(user.email, '').identifier, null)
  assert.ok(loginFields(user.email, 'short').password)
  assert.deepEqual(loginFields('  ' + user.email + '  ', PASSWORD), { identifier: null, password: null })
  const h = harness(); await h.session.restore(); await h.session.login('', '')
  assert.equal(h.calls.length, 0)
})

for (const status of [401, 422]) test('rejected credentials have a safe generic login message: ' + status, async () => {
  const h = harness(async (_path, _init, url) => response(url, { errors: { identifier: ['Synthetic rejection'] } }, status))
  await signIn(h)
  assert.match(h.session.getSnapshot().message ?? '', /Revisa tu correo o código y tu contraseña/)
  assert.doesNotMatch(h.session.getSnapshot().message ?? '', /estudiante|existe|inactiva/)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
})

test('only an explicit mobile access code identifies the authorization restriction', async () => {
  const h = harness(async (_path, _init, url) => response(url, { code: 'MOBILE_OPERATOR_REQUIRED' }, 403))
  await signIn(h)
  assert.match(h.session.getSnapshot().message ?? '', /examen propio o una colaboración vigente/)
  const unknown = harness(async (_path, _init, url) => response(url, {}, 403))
  await signIn(unknown)
  assert.match(unknown.session.getSnapshot().message ?? '', /servidor no autorizó/)
  assert.doesNotMatch(unknown.session.getSnapshot().message ?? '', /estudiante|examen propio/)
})

test('network and server login failures remain distinct without disclosing response contents', async () => {
  const network = harness(async () => { throw new TypeError('connection lost') })
  await signIn(network)
  assert.match(network.session.getSnapshot().message ?? '', /conectar|conexión/)
  const server = harness(async (_path, _init, url) => response(url, { message: 'DO_NOT_DISPLAY_SERVER_DETAILS' }, 503))
  await signIn(server)
  assert.match(server.session.getSnapshot().message ?? '', /temporalmente/)
  assert.doesNotMatch(server.session.getSnapshot().message ?? '', /DO_NOT_DISPLAY/)
})

