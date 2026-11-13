import test from 'node:test'
import assert from 'node:assert/strict'
import { OfflineProtectionError, inspectProtection, protectedKey, protectionFailure, requireStrongBiometry, type ProtectedKeyPort } from '../src/features/offline/protection'
import { initializeCipher, ProtectedStorageError, type SqlPort } from '../src/features/offline/repository'

// Synthetic key material and test ports only; never imported by application code.
const KEY = 'ab'.repeat(32)
function keyPort(marker: string | null = '1', key: string | null = KEY) {
  const state = { marker, key, writes: 0, marks: 0, generated: 0 }
  const port: ProtectedKeyPort = {
    marker: async () => state.marker,
    read: async () => state.key,
    write: async (value) => { state.key = value; state.writes++ },
    mark: async () => { state.marker = '1'; state.marks++ },
  }
  return { state, port, generate: () => { state.generated++; return KEY } }
}
const check = () => {}

test('when biometrics are required, no availability blocks keys and database access', async () => {
  const h = keyPort(null, null)
  let databaseOpened = false
  await assert.rejects(async () => {
    requireStrongBiometry(() => false)
    await protectedKey(h.port, true, h.generate, check)
    databaseOpened = true
  }, { code: 'BIOMETRY_UNAVAILABLE' })
  assert.equal(databaseOpened, false)
  assert.equal(h.state.generated, 0)
  assert.equal(h.state.writes, 0)
})

test('native hardware and enrollment reasons are distinguished only when native errors explicitly supply them', () => {
  for (const [message, code] of [
    ['Hardware not present.', 'BIOMETRY_UNSUPPORTED'],
    ['No biometrics are currently enrolled', 'BIOMETRY_NOT_ENROLLED'],
    ['Hardware unavailable.', 'BIOMETRY_UNAVAILABLE'],
  ]) assert.equal(protectionFailure({ code: 'ERR_AUTHENTICATION', message }).code, code)
  assert.throws(() => requireStrongBiometry(() => { throw new Error('native module unavailable') }), { code: 'NATIVE_CONFIGURATION' })
})

test('biometric cancellation preserves the existing key and permits a new authentication attempt', async () => {
  const h = keyPort()
  let cancelled = true
  h.port.read = async () => {
    if (cancelled) throw { code: 'ERR_AUTHENTICATION', message: 'Could not authenticate the user: User canceled the authentication.' }
    return h.state.key
  }
  await assert.rejects(protectedKey(h.port, true, h.generate, check), { code: 'AUTH_CANCELLED' })
  assert.equal(h.state.key, KEY)
  assert.equal(h.state.writes, 0)
  assert.equal(h.state.generated, 0)
  cancelled = false
  assert.equal(await protectedKey(h.port, true, h.generate, check), KEY)
})

test('lockout is not reported as cancellation or as a SQLCipher failure', () => {
  assert.equal(protectionFailure({ code: 'ERR_AUTHENTICATION', message: 'Lockout. Native details.' }).code, 'AUTH_LOCKED')
  assert.equal(protectionFailure({ code: 'ERR_AUTHENTICATION', message: 'Unknown error (code: 5)' }).code, 'INTERRUPTED')
})

test('a null invalidated or lost protected key with an existing marker is never regenerated', async () => {
  const h = keyPort('1', null)
  await assert.rejects(protectedKey(h.port, true, h.generate, check), { code: 'KEY_UNAVAILABLE' })
  assert.equal(h.state.generated, 0); assert.equal(h.state.writes, 0); assert.equal(h.state.marks, 0)
  assert.equal(protectionFailure({ code: 'ERR_KEY_PERMANENTLY_INVALIDATED', message: 'Synthetic invalidation' }).code, 'KEY_UNAVAILABLE')
})

test('SecureStore errors are sanitized, retain data and are retryable without replacing keys', async () => {
  const h = keyPort()
  h.port.read = async () => { throw { code: 'ERR_DECRYPT', message: 'DO_NOT_DISPLAY_KEYCHAIN_OR_SENSITIVE_DETAILS' } }
  await assert.rejects(protectedKey(h.port, true, h.generate, check), (error: unknown) => {
    assert.ok(error instanceof OfflineProtectionError)
    assert.equal(error.code, 'SECURE_STORE_ERROR')
    assert.doesNotMatch(error.message, /DO_NOT_DISPLAY/)
    return true
  })
  assert.equal(h.state.key, KEY); assert.equal(h.state.generated, 0)
  h.port.read = async () => KEY
  assert.equal(await protectedKey(h.port, true, h.generate, check), KEY)
})

test('missing marker after interrupted provisioning must be repaired before returning an existing key', async () => {
  const h = keyPort(null, null)
  let failMarker = true, databaseOpened = false
  h.port.mark = async () => {
    if (failMarker) throw new Error('marker write unavailable')
    h.state.marker = '1'; h.state.marks++
  }
  await assert.rejects(async () => {
    await protectedKey(h.port, true, h.generate, check)
    databaseOpened = true
  }, { code: 'SECURE_STORE_ERROR' })
  assert.equal(databaseOpened, false)
  assert.equal(h.state.key, KEY)
  failMarker = false
  assert.equal(await protectedKey(h.port, true, h.generate, check), KEY)
  assert.equal(h.state.marker, '1')
  assert.equal(h.state.generated, 1)
  assert.equal(h.state.writes, 1)
})

test('no online authorization and no protected key never provisions a new key', async () => {
  const h = keyPort(null, null)
  await assert.rejects(protectedKey(h.port, false, h.generate, check), { code: 'KEY_UNAVAILABLE' })
  assert.equal(h.state.generated, 0); assert.equal(h.state.writes, 0)
})

test('an account/lifecycle boundary while reading prevents the old key flow from continuing', async () => {
  const h = keyPort()
  let locked = false
  h.port.read = async () => { locked = true; return KEY }
  await assert.rejects(protectedKey(h.port, true, h.generate, () => {
    if (locked) throw new OfflineProtectionError('INTERRUPTED')
  }), { code: 'INTERRUPTED' })
  assert.equal(h.state.writes, 0); assert.equal(h.state.marks, 0)
})

test('diagnostics separate biometrics from the SQLCipher response and always close the probe', async () => {
  let closed = 0
  // Deliberately synthetic unit port. The native adapter opens a real :memory:
  // SQLite connection; this fixture is not evidence of SQLCipher on Android.
  const report = await inspectProtection(() => false, async () => ({
    version: async () => ({ cipher_version: '4.6.1 community' }), close: async () => { closed++ },
  }))
  assert.equal(report.biometric, 'unavailable')
  assert.equal(report.cipher, 'available')
  assert.equal(report.cipherVersion, '4.6.1')
  assert.equal(closed, 1)
})

test('missing cipher, missing native integration and failed probe remain separate from biometric cancellation', async () => {
  let closed = false
  const missing = await inspectProtection(() => true, async () => ({
    version: async () => null, close: async () => { closed = true },
  }))
  assert.equal(missing.biometric, 'available'); assert.equal(missing.cipher, 'missing'); assert.equal(closed, true)
  const failure = await inspectProtection(() => true, async () => { throw new Error('DO_NOT_DISPLAY_NATIVE_DETAILS') })
  assert.equal(failure.cipher, 'error'); assert.equal(failure.cipherVersion, null)
  assert.doesNotMatch(JSON.stringify(failure), /DO_NOT_DISPLAY/)
})

test('the actual initializeCipher guard refuses all DDL and personal writes if cipher_version is missing', async () => {
  const writes: string[] = []
  const db: SqlPort = {
    execAsync: async (sql) => { writes.push(sql) }, runAsync: async (sql) => { writes.push(sql) },
    getFirstAsync: async () => null, getAllAsync: async () => [],
    transactionAsync: async (action) => { await action(db) }, closeAsync: async () => {},
  }
  await assert.rejects(initializeCipher(db, KEY), ProtectedStorageError)
  assert.deepEqual(writes, [])
})

