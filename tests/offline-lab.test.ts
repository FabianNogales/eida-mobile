import test from 'node:test'
import assert from 'node:assert/strict'
import { offlineProtectionPolicy } from '../src/config/offlineLab'
import { protectedKey, requireStrongBiometry, type ProtectedKeyPort } from '../src/features/offline/protection'
import { initializeCipher, ProtectedStorageError, type SqlPort } from '../src/features/offline/repository'

// Synthetic material for policy tests, never used in the native application.
const KEY = 'ab'.repeat(32)

test('temporary exception needs both a development bundle and the explicit switch', () => {
  for (const [development, enabled] of [[false, false], [false, true], [true, false]]) {
    const policy = offlineProtectionPolicy(development === true, enabled === true)
    assert.equal(policy.laboratory, false)
    assert.equal(policy.requireAuthentication, true)
    assert.equal(policy.keychainService, 'bo.eida.control.offline.v1')
    assert.equal(policy.databasePrefix, 'eida-')
  }
  const lab = offlineProtectionPolicy(true, true)
  assert.equal(lab.laboratory, true)
  assert.equal(lab.requireAuthentication, false)
})

test('lab storage never reads, overwrites or removes the biometric namespace', async () => {
  const normal = offlineProtectionPolicy(false, true), lab = offlineProtectionPolicy(true, true)
  assert.notEqual(lab.keychainService, normal.keychainService)
  assert.notEqual(lab.databasePrefix + 'same-scope.db', normal.databasePrefix + 'same-scope.db')
  const stored = new Map<string, string>([
    [normal.keychainService + ':key', 'cd'.repeat(32)], [normal.keychainService + ':marker', '1'],
  ])
  const original = new Map(stored)
  const port: ProtectedKeyPort = {
    marker: async () => stored.get(lab.keychainService + ':marker') ?? null,
    read: async () => stored.get(lab.keychainService + ':key') ?? null,
    write: async (value) => { stored.set(lab.keychainService + ':key', value) },
    mark: async () => { stored.set(lab.keychainService + ':marker', '1') },
  }
  // The same policy branch used by NativeOfflineVault: no biometric request in
  // lab, but the key must still be saved by its secure-storage adapter.
  if (lab.requireAuthentication) requireStrongBiometry(() => false)
  assert.equal(await protectedKey(port, true, () => KEY, () => {}), KEY)
  for (const [name, value] of original) assert.equal(stored.get(name), value)
  assert.equal(stored.get(lab.keychainService + ':key'), KEY)
})

test('lab cannot continue if secure key storage fails', async () => {
  let openDatabase = false
  const port: ProtectedKeyPort = {
    marker: async () => null, read: async () => null,
    write: async () => { throw new Error('secure store unavailable') }, mark: async () => {},
  }
  await assert.rejects(async () => {
    await protectedKey(port, true, () => KEY, () => {})
    openDatabase = true
  }, { code: 'SECURE_STORE_ERROR' })
  assert.equal(openDatabase, false)
})

test('lab still requires online authorization to provision its first key', async () => {
  let generated = false
  const port: ProtectedKeyPort = {
    marker: async () => null, read: async () => null, write: async () => {}, mark: async () => {},
  }
  await assert.rejects(protectedKey(port, false, () => { generated = true; return KEY }, () => {}), { code: 'KEY_UNAVAILABLE' })
  assert.equal(generated, false)
})

test('lab policy does not permit plaintext SQLite or any DDL without real cipher availability', async () => {
  assert.equal(offlineProtectionPolicy(true, true).laboratory, true)
  const writes: string[] = []
  const db: SqlPort = {
    getFirstAsync: async () => null, getAllAsync: async () => [],
    execAsync: async (sql) => { writes.push(sql) }, runAsync: async (sql) => { writes.push(sql) },
    closeAsync: async () => {}, transactionAsync: async (action) => { await action(db) },
  }
  await assert.rejects(initializeCipher(db, KEY), ProtectedStorageError)
  assert.deepEqual(writes, [])
})

test('production mode never falls back to lab when biometrics are unavailable', () => {
  const normal = offlineProtectionPolicy(false, true)
  assert.equal(normal.requireAuthentication, true)
  assert.throws(() => {
    if (normal.requireAuthentication) requireStrongBiometry(() => false)
  }, { code: 'BIOMETRY_UNAVAILABLE' })
  assert.equal(normal.laboratory, false)
})

