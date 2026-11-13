import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { StoredSession } from '../src/features/auth/contracts'
import { anchoredNow } from '../src/features/offline/clock'
import { checkOfflineGrant, checkPreviousVault, onlineGrant, previousVaultServices, vaultStorage } from '../src/features/offline/vaultAccess'
import { binding } from './support/offlineFixtures'

const now = Date.parse('2030-01-01T00:00:00Z')
const sample = { boot: '1', elapsed: 1000 }
const credential: StoredSession = {
  version: 1, apiBase: binding.apiBase, token: 'synthetic-session', expiresAt: '2030-01-01T00:01:00Z',
  serverOffsetMs: 0, userId: Number(binding.userId), deviceId: Number(binding.deviceId),
  installationId: binding.installationId, logoutPending: false,
}
const grant = onlineGrant(binding, credential, sample, now, null)

test('the local grant opens only for the original signed-in account and installation', () => {
  assert.equal(checkOfflineGrant(grant, credential, sample), 60_000)
  for (const other of [null, { ...credential, logoutPending: true }, { ...credential, userId: 80 },
    { ...credential, deviceId: 80 }, { ...credential, installationId: 'different' }, { ...credential, apiBase: 'https://other.test' }]) {
    assert.throws(() => checkOfflineGrant(grant, other, sample), { code: 'SESSION_REQUIRED' })
  }
  assert.throws(() => checkOfflineGrant(null, credential, sample), { code: 'SESSION_REQUIRED' })
})

test('reopening in the same boot keeps the original expiry even after the wall clock moves backwards', () => {
  const later = { ...sample, elapsed: sample.elapsed + 30_000 }
  assert.equal(checkOfflineGrant(grant, credential, later), 30_000)
  const renewed = onlineGrant(binding, credential, later, now - 3_600_000, grant)
  assert.equal(checkOfflineGrant(renewed, credential, later), 30_000)
  assert.throws(() => checkOfflineGrant(renewed, credential, { ...later, elapsed: later.elapsed + 30_000 }), { code: 'SESSION_REQUIRED' })
  assert.throws(() => checkOfflineGrant(grant, { ...credential, expiresAt: '2030-01-02T00:00:00Z' }, sample), { code: 'SESSION_REQUIRED' })
})

test('an offline reboot denies the old grant and online validation does not extend old package anchors', () => {
  const reboot = { ...sample, boot: '2' }
  assert.throws(() => checkOfflineGrant(grant, credential, reboot), { code: 'SESSION_REQUIRED' })
  const validated = onlineGrant(binding, credential, reboot, now + 10_000, grant)
  assert.equal(checkOfflineGrant(validated, credential, reboot), 50_000)
  assert.throws(() => anchoredNow(grant.anchor, reboot), /reinició/)
})

test('both legacy stores are detected by marker only and keep their separate keys', async () => {
  for (const legacy of previousVaultServices) {
    const reads: string[] = []
    await assert.rejects(checkPreviousVault(async (service) => {
      reads.push(service)
      return service === legacy ? '1' : null
    }), { code: 'PREVIOUS_VAULT' })
    assert.ok(reads.includes(legacy))
  }
  await assert.rejects(checkPreviousVault(async () => { throw new Error('native details') }), { code: 'SECURE_STORE_ERROR' })
  await checkPreviousVault(async () => null)
  assert.equal(vaultStorage.requireAuthentication, false)
  assert.equal(vaultStorage.databasePrefix, 'eida-v2-')
})

test('automatic reopening uses the same policy in every build and closes access at the session boundary', () => {
  const source = (path: string) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
  const vault = source('features/offline/nativeVault.ts'), provider = source('features/offline/OfflineProvider.tsx')
  assert.doesNotMatch(vault, /__DEV__|authenticationPrompt|canUseBiometricAuthentication/)
  assert.match(vault, /checkPreviousVault[\s\S]*const key = await protectedKey[\s\S]*await initializeCipher/)
  assert.match(provider, /onSecurityBoundary[\s\S]*await vault.closeAccess/)
  assert.match(provider, /attempted.current = key\s+void open\(\)/)
  for (const file of ['PrepareOfflineScreen', 'OfflineListScreen', 'OfflineScannerScreen', 'PendingOverviewScreen']) {
    assert.match(source('screens/' + file + '.tsx'), /<OfflineAccessStatus/)
  }
})
