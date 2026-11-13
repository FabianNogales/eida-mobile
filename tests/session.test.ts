import test from 'node:test'
import assert from 'node:assert/strict'
import { harness, signIn, user, PASSWORD, INSTALLATION, BASE, NOW, loginResponse, response, stored } from './support/authFixtures'
import { INSTALLATION_KEY, SESSION_KEY, createSessionStorage } from '../src/features/auth/storage'
import { canAccessPrivate } from '../src/features/auth/guards'
import type { ResponsePort } from '../src/services/http/client'
import type { SessionStatus } from '../src/features/auth/contracts'

test('valid login persists only minimal secure session and validates me', async () => {
  const h = harness(); await signIn(h)
  assert.equal(h.session.getSnapshot().status, 'authenticated')
  assert.equal(h.session.getSnapshot().user?.id, user.id)
  assert.equal(h.calls.filter(c => c.path === 'auth/mobile/login').length, 1)
  assert.equal(h.calls.filter(c => c.path === 'me').length, 1)
  const saved = JSON.parse(h.values.get(SESSION_KEY)!)
  assert.equal(saved.apiBase, BASE)
  assert.equal(saved.userId, user.id)
  assert.equal(saved.deviceId, 11)
  assert.equal(saved.installationId, INSTALLATION)
  assert.ok(!h.writes.some(write => write.value.includes(PASSWORD)))
  assert.equal(saved.roles, undefined)
  assert.equal(saved.email, undefined)
  assert.equal('token' in h.session.getSnapshot(), false)
})
test('incomplete fields never issue login', async () => {
  const h = harness(); await h.session.restore()
  await h.session.login('', '')
  await h.session.login(user.email, 'short')
  assert.equal(h.calls.length, 0)
  assert.equal(h.session.getSnapshot().status, 'unauthenticated')
})
test('credentials cannot overwrite a session before storage was checked', async () => {
  const h = harness()
  await h.session.login(user.email, PASSWORD)
  assert.equal(h.calls.length, 0)
  assert.equal(h.session.getSnapshot().status, 'recoverable-error')
})
test('incorrect login does not persist a token', async () => {
  const h = harness(async (_path, _init, url) => response(url, { errors: { identifier: ['Las credenciales no son válidas.'] } }, 422))
  await signIn(h)
  assert.equal(h.session.getSnapshot().status, 'unauthenticated')
  assert.equal(h.values.has(SESSION_KEY), false)
})
test('legacy inactive validation fields do not turn a generic rejected login into an account disclosure', async () => {
  const h = harness(async (_path, _init, url) => response(url, { errors: { identifier: ['La cuenta se encuentra inactiva.'] } }, 422))
  await signIn(h)
  assert.match(h.session.getSnapshot().message!, /Revisa tu correo o código y tu contraseña/)
  assert.doesNotMatch(h.session.getSnapshot().message!, /inactiva|estudiante/)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
})
test('initial password and missing operator permission do not grant a session', async () => {
  for (const code of ['PASSWORD_CHANGE_REQUIRED', 'MOBILE_OPERATOR_REQUIRED']) {
    const h = harness(async (_path, _init, url) => response(url, { code }, 403))
    await signIn(h)
    assert.equal(h.session.getSnapshot().status, 'unauthenticated')
    assert.equal(h.values.has(SESSION_KEY), false)
  }
})
test('UUID installation is stable and distinct from user and device IDs', async () => {
  const h = harness()
  assert.equal(await h.storage.installationId(), INSTALLATION)
  assert.equal(await h.storage.installationId(), INSTALLATION)
  assert.equal(h.writes.filter(w => w.key === INSTALLATION_KEY).length, 1)
})
test('secure storage failure never enables a plaintext fallback', async () => {
  const h = harness()
  const broken = createSessionStorage({ getItem: async () => null, setItem: async () => { throw new Error('unavailable') }, deleteItem: async () => {} }, async () => INSTALLATION)
  await assert.rejects(broken.save(stored()), { kind: 'storage' })
  h.values.set(INSTALLATION_KEY, INSTALLATION)
  h.driver.setItem = async () => { throw new Error('unavailable') }
  await signIn(h)
  assert.equal(h.calls.filter(c => c.path === 'auth/mobile/login').length, 1)
  assert.equal(h.values.has(SESSION_KEY), false)
  assert.equal(h.session.getSnapshot().status, 'recoverable-error')
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
})
test('restoration checks me instead of trusting cached roles', async () => {
  const h = harness(); h.values.set(SESSION_KEY, JSON.stringify(stored()))
  await h.session.restore()
  assert.equal(h.session.getSnapshot().status, 'authenticated')
  assert.equal(h.calls[0]?.path, 'me')
})
test('known expiry deletes the credential before attempting me', async () => {
  const h = harness(); h.values.set(SESSION_KEY, JSON.stringify(stored({ expiresAt: '2029-12-31T23:59:59.000Z' })))
  await h.session.restore()
  assert.equal(h.session.getSnapshot().status, 'expired')
  assert.equal(h.calls.length, 0)
  assert.equal(h.values.has(SESSION_KEY), false)
})
test('network failure during restoration preserves the secure credential without access', async () => {
  const h = harness(async () => { throw new TypeError('offline') })
  h.values.set(SESSION_KEY, JSON.stringify(stored()))
  await h.session.restore()
  assert.equal(h.session.getSnapshot().status, 'offline')
  assert.equal(h.values.has(SESSION_KEY), true)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
  assert.equal(h.session.getSnapshot().user, null)
})
test('revoked token or inactive account clears the session on 401', async () => {
  for (const code of ['MOBILE_DEVICE_REVOKED', 'ACCOUNT_INACTIVE', 'MOBILE_TOKEN_INVALID']) {
    const h = harness(async (_path, _init, url) => response(url, { code }, 401))
    h.values.set(SESSION_KEY, JSON.stringify(stored()))
    await h.session.restore()
    assert.equal(h.session.getSnapshot().status, 'expired')
    assert.equal(h.values.has(SESSION_KEY), false)
  }
})
test('successful logout removes local token and identity but keeps installation ID', async () => {
  const h = harness(); await signIn(h); await h.session.logout()
  assert.equal(h.session.getSnapshot().status, 'unauthenticated')
  assert.equal(h.session.getSnapshot().user, null)
  assert.equal(h.values.has(SESSION_KEY), false)
  assert.equal(h.values.get(INSTALLATION_KEY), INSTALLATION)
  assert.ok(h.calls.some(c => c.path === 'auth/logout' && c.init.method === 'POST'))
})
test('offline logout retains a revocation-only token and never retries POST on startup', async () => {
  const h = harness(async (path, _init, url) => {
    if (path === 'auth/logout') throw new TypeError('offline')
    return response(url, path === 'me' ? { success: true, data: user } : loginResponse())
  })
  await signIn(h); await h.session.logout()
  assert.equal(h.session.getSnapshot().status, 'unauthenticated')
  assert.equal(h.session.getSnapshot().logoutPending, true)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
  assert.equal(JSON.parse(h.values.get(SESSION_KEY)!).logoutPending, true)
  const count = h.calls.length
  await h.session.restore()
  assert.equal(h.calls.length, count)
  await h.session.forgetLocal()
  assert.equal(h.values.has(SESSION_KEY), false)
})
test('changing backend never sends an old token to the new origin', async () => {
  const h = harness(); h.values.set(SESSION_KEY, JSON.stringify(stored({ apiBase: 'https://other.example.test/api/v1' })))
  await h.session.restore(); await h.session.logout()
  assert.equal(h.calls.length, 0)
  assert.equal(h.session.getSnapshot().logoutPending, true)
})
test('me returning another identity cannot authenticate the cached user', async () => {
  const h = harness(async (_path, _init, url) => response(url, { success: true, data: { ...user, id: 8 } }))
  h.values.set(SESSION_KEY, JSON.stringify(stored()))
  await h.session.restore()
  assert.equal(h.session.getSnapshot().status, 'recoverable-error')
  assert.equal(h.session.getSnapshot().user, null)
})
test('expiry while open removes private access', async () => {
  const h = harness(); await signIn(h)
  h.clock.now = NOW + 3600000
  await h.session.checkExpiry()
  assert.equal(h.session.getSnapshot().status, 'expired')
  await assert.rejects(h.session.request('teacher/exams'), { status: 401 })
})
test('navigation cannot be enabled by cached roles during pending validation', () => {
  const h = harness()
  for (const status of ['initializing', 'unauthenticated', 'authenticating', 'expired', 'offline', 'recoverable-error'] as SessionStatus[]) {
    assert.equal(canAccessPrivate({ ...h.session.getSnapshot(), status, user }), false)
  }
})

test('concurrent login submissions issue only one POST', async () => {
  const h = harness(); await h.session.restore()
  await Promise.all([h.session.login(user.email, PASSWORD), h.session.login(user.email, PASSWORD)])
  assert.equal(h.calls.filter(c => c.path === 'auth/mobile/login').length, 1)
})
test('network failure before token issuance leaves no credential and permits a manual login retry', async () => {
  const h = harness(async () => { throw new TypeError('offline') })
  await signIn(h)
  assert.equal(h.session.getSnapshot().status, 'offline')
  assert.equal(h.session.getSnapshot().hasCredential, false)
  assert.equal(h.values.has(SESSION_KEY), false)
})
test('network failure after issuing a token preserves it for me validation', async () => {
  const h = harness(async (path, _init, url) => {
    if (path === 'me') throw new TypeError('offline')
    return response(url, loginResponse())
  })
  await signIn(h)
  assert.equal(h.session.getSnapshot().status, 'offline')
  assert.equal(h.session.getSnapshot().hasCredential, true)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
})
test('a server 5xx during restoration retains the credential for recovery', async () => {
  const h = harness(async (_path, _init, url) => response(url, {}, 503))
  h.values.set(SESSION_KEY, JSON.stringify(stored()))
  await h.session.restore()
  assert.equal(h.session.getSnapshot().status, 'recoverable-error')
  assert.equal(h.values.has(SESSION_KEY), true)
})
test('required password change reported by me blocks restored access', async () => {
  const h = harness(async (_path, _init, url) => response(url, { success: true, data: { ...user, must_change_password: true } }))
  h.values.set(SESSION_KEY, JSON.stringify(stored()))
  await h.session.restore()
  assert.equal(h.session.getSnapshot().status, 'expired')
  assert.equal(h.values.has(SESSION_KEY), false)
})
test('a failed secure deletion blocks access while leaving a recoverable error', async () => {
  const h = harness(); await signIn(h)
  h.driver.deleteItem = async () => { throw new Error('secure deletion unavailable') }
  h.clock.now = NOW + 3600000
  await h.session.checkExpiry()
  assert.equal(h.session.getSnapshot().status, 'recoverable-error')
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
})
test('pending remote logout can be retried explicitly', async () => {
  let fail = true
  const h = harness(async (path, _init, url) => {
    if (path === 'auth/logout') {
      if (fail) throw new TypeError('offline')
      return response(url, { message: 'Session revoked successfully' })
    }
    return response(url, path === 'me' ? { success: true, data: user } : loginResponse())
  })
  await signIn(h); await h.session.logout()
  assert.equal(h.session.getSnapshot().logoutPending, true)
  fail = false
  await h.session.logout()
  assert.equal(h.values.has(SESSION_KEY), false)
  assert.equal(h.calls.filter(c => c.path === 'auth/logout').length, 2)
})
test('an unexpected login body never grants private access', async () => {
  const h = harness(async (_path, _init, url) => response(url, { data: { unexpected: true } }))
  await signIn(h)
  assert.equal(h.session.getSnapshot().status, 'recoverable-error')
  assert.equal(h.values.has(SESSION_KEY), false)
  assert.equal(canAccessPrivate(h.session.getSnapshot()), false)
})
for (const oldStatus of [200, 401]) {
  test('late response ' + oldStatus + ' from user A cannot affect user B', async () => {
    let finish!: (value: ResponsePort) => void
    let actor = user
    const h = harness(async (path, _init, url) => {
      if (path === 'teacher/exams') return new Promise<ResponsePort>(resolve => { finish = resolve })
      return response(url, path === 'me' ? { success: true, data: actor } : loginResponse(actor))
    })
    await signIn(h)
    const old = h.session.request('teacher/exams')
    const rejection = assert.rejects(old)
    await h.session.forgetLocal()
    actor = { ...user, id: 8 }
    await h.session.login('other@example.test', PASSWORD)
    finish(response(BASE + '/teacher/exams', {}, oldStatus))
    await rejection
    assert.equal(h.session.getSnapshot().user?.id, 8)
    assert.equal(h.session.getSnapshot().deviceId, 12)
    assert.equal(h.session.getSnapshot().status, 'authenticated')
  })
}
