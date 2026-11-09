import test from 'node:test'
import assert from 'node:assert/strict'
import vectors from '../src/features/qr/fixtures/php-vectors.json'
import { parseEnvelope, parseManifest } from '../src/features/offline/manifest'
import { anchoredNow } from '../src/features/offline/clock'
import { PackageDownloader } from '../src/features/offline/download'
import { initializeCipher, OfflineRepository } from '../src/features/offline/repository'
import { captureProvisional, identifyQr } from '../src/features/offline/identity'
import { OfflineApi } from '../src/features/offline/api'
import { HttpClient } from '../src/services/http/client'
import { ApiError, httpError } from '../src/services/http/errors'
import { SerializedSql } from '../src/features/offline/serializedSql'
import { harness, signIn, NOW } from './support/authFixtures'
import { anchor, binding, digest, envelope, harnessOffline, manifest, mockApi, packageId, provider, sample } from './support/offlineFixtures'

const clock = { sample: async () => sample }
const keys = async () => {}
const stableUuid = () => 'abcdef01-2345-4678-9abc-def012345678'

test('valid complete manifest has independent schema, and duplicate members or foreign photo paths fail closed', () => {
  const m = manifest(), e = envelope(m)
  assert.equal(parseEnvelope({ data: { mobile: e } }, digest).manifest.schema_version, 1)
  assert.throws(() => parseManifest({ ...m, students: [...m.students, ...m.students] }))
  assert.throws(() => parseManifest({ ...m, students: [{ ...m.students[0], identity_number: '' }] }))
  m.students[0]!.photos[0] = { kind: 'profile', state: 'PRESENT', size: 3, mime: 'image/png', sha256: digest('abc'), revision: '1', path: 'https://foreign.example.test/photo' }
  assert.throws(() => parseManifest(m))
})
test('manifest hash tampering is rejected before persistence', () => {
  const e = envelope(manifest())
  assert.throws(() => parseEnvelope({ data: { mobile: { ...e, manifest_json: e.manifest_json + ' ' } } }, digest), /Integridad/)
})
test('missing SQLCipher never issues key, DDL, recovery or personal writes', async () => {
  let writes = 0
  const db = { getFirstAsync: async () => null, execAsync: async () => { writes++ }, runAsync: async () => { writes++ } }
  await assert.rejects(initializeCipher(db as unknown as Parameters<typeof initializeCipher>[0], 'ab'.repeat(32)), /SQLCipher/)
  assert.equal(writes, 0)
})
test('server-anchored time ignores editable phone clock and detects device reboot', () => {
  assert.equal(anchoredNow(anchor, { ...sample, elapsed: sample.elapsed + 60000 }), anchor.serverMs + 60000)
  assert.throws(() => anchoredNow(anchor, { ...sample, boot: '4' }), /reinició/)
  assert.throws(() => anchoredNow(anchor, { ...sample, elapsed: 0 }), /reinició/)
})
test('preparation with legitimate photo absence publishes an exact local list', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(), api = mockApi(m)
  await new PackageDownloader(api, h.repo, clock, keys).run('42')
  const p = await h.repo.usable(packageId, sample)
  assert.equal(p.state, 'PREPARADO'); assert.equal(p.active, true)
  assert.equal((await h.repo.search(packageId, '')).length, 1)
  assert.equal(await h.repo.photo(packageId, '101', 'profile'), null)
})
test('interrupted download preserves old valid snapshot; retry reuses staged photos and members', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const old = manifest(); await new PackageDownloader(mockApi(old), h.repo, clock, keys).run('42')
  const next = manifest({ package_id: stableUuid() }), bytes = new Uint8Array([1, 2, 3])
  next.students[0]!.photos = ['profile', 'historical'].map((kind) => ({ kind: kind as 'profile' | 'historical', state: 'PRESENT', size: bytes.length,
    mime: 'image/png', revision: '1', sha256: digest(bytes), path: `exams/42/offline/packages/${next.package_id}/photos/101/${kind}` }))
  let requests = 0, interrupted = true
  const api = { ...mockApi(next), photo: async () => { requests++; if (interrupted && requests === 2) throw new Error('offline'); return bytes } }
  const downloader = new PackageDownloader(api, h.repo, clock, keys)
  await assert.rejects(downloader.run('42'), /offline/)
  assert.equal((await h.repo.package(old.package_id)).active, true)
  assert.equal((await h.repo.package(next.package_id)).state, 'INCOMPLETA')
  interrupted = false
  await downloader.run('42', next.package_id)
  assert.equal(requests, 3) // one downloaded, one interrupted, one retried
  assert.equal((await h.repo.package(old.package_id)).active, false)
  assert.equal((await h.repo.usable(next.package_id, sample)).active, true)
  assert.equal((await h.repo.search(next.package_id, '')).length, 1)
  const n = await h.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM photos WHERE package_id=?', next.package_id)
  assert.equal(n?.n, 2)
})
test('failed hash leaves package incomplete and never publishes altered bytes', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(), expected = new Uint8Array([1, 2])
  m.students[0]!.photos[0] = { kind: 'profile', state: 'PRESENT', size: 2, mime: 'image/png', revision: '1', sha256: digest(expected),
    path: `exams/42/offline/packages/${packageId}/photos/101/profile` }
  await assert.rejects(new PackageDownloader({ ...mockApi(m), photo: async () => new Uint8Array([9, 9]) }, h.repo, clock, keys).run('42'), /Hash/)
  assert.equal((await h.repo.package(packageId)).active, false)
  assert.equal((await h.repo.package(packageId)).state, 'INCOMPLETA')
})
test('photo HTTP download checks exact byte count and digest', async () => {
  const bytes = new Uint8Array([1, 2, 3]), m = manifest()
  const photo = { kind: 'profile' as const, state: 'PRESENT' as const, mime: 'image/png', size: 3, sha256: digest(bytes), revision: '1', path: 'exams/42/offline/packages/'+packageId+'/photos/101/profile' }
  const session = { request: async () => bytes } as unknown as ConstructorParameters<typeof OfflineApi>[0]
  const api = new OfflineApi(session, digest)
  assert.deepEqual(await api.photo(photo), bytes)
  await assert.rejects(api.photo({ ...photo, size: 2 }), /fotografía/)
  await assert.rejects(api.photo({ ...photo, sha256: digest('wrong') }), /fotografía/)
})
test('local search finds names with accents, SIS and CI; wildcard characters remain literal', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(); await new PackageDownloader(mockApi(m), h.repo, clock, keys).run('42')
  for (const word of ['alvarez', 'ANA', '203000101', 'CI-101']) assert.equal((await h.repo.search(packageId, word))[0]?.student_id, '101')
  assert.equal((await h.repo.search(packageId, '%')).length, 0)
  assert.equal((await h.repo.search(packageId, "' OR 1=1 --")).length, 0)
  await assert.rejects(h.repo.student(packageId, '999'), /fuera/)
})
test('new repository instance restores packages and stable pending events without network', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, clock, keys).run('42')
  const e = await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, stableUuid, provider)
  const restarted = new OfflineRepository(h.db, binding, digest)
  assert.equal((await restarted.usable(packageId, sample)).manifest.students[0]?.student_id, '101')
  assert.deepEqual(await restarted.event('42', '101'), e)
})
test('another user/device cannot decode or stage packages from a different binding', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(); await h.repo.stage(envelope(m), m, anchor)
  for (const scope of [{ ...binding, userId: '8' }, { ...binding, deviceId: '12' }, { ...binding, installationId: stableUuid() }, { ...binding, apiBase: 'https://other.example.test/api/v1' }]) {
    const other = new OfflineRepository(h.db, scope, digest)
    await assert.rejects(other.package(packageId), /otra cuenta/)
    await assert.rejects(other.stage(envelope(m), m, anchor), /otra cuenta/)
  }
})
test('immutable snapshot ID cannot silently accept a changed manifest', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(); await h.repo.stage(envelope(m), m, anchor)
  const changed = manifest({ version: 2 })
  await assert.rejects(h.repo.stage(envelope(changed), changed, anchor), /inmutable/)
  assert.equal((await h.repo.package(packageId)).manifest.version, 1)
})
test('expiry prevents consultation/capture while preserving pending events', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, clock, keys).run('42')
  await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, stableUuid, provider)
  const expired = { ...sample, elapsed: sample.elapsed + 3600000 }
  await assert.rejects(h.repo.usable(packageId, expired), /vigencia/)
  await assert.rejects(captureProvisional(h.repo, packageId, '101', 'MANUAL', expired, stableUuid, provider))
  assert.equal(await h.repo.pendingCount(), 1)
})
test('only public key capability material that is complete may be announced', () => {
  const m = manifest()
  assert.throws(() => parseManifest({ ...m, qr: { ...m.qr, keys: [] } }))
  assert.throws(() => parseManifest({ ...m, qr: { ...m.qr, keys: [{ ...m.qr.keys[0], pem: '-----BEGIN PRIVATE KEY-----' }] } }))
})
test('publication checks actual member count and never replaces a complete snapshot with incomplete rows', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const old = manifest(); await new PackageDownloader(mockApi(old), h.repo, clock, keys).run('42')
  const next = manifest({ package_id: stableUuid() }); await h.repo.stage(envelope(next), next, anchor)
  await h.db.runAsync('DELETE FROM students WHERE package_id=?', next.package_id)
  await assert.rejects(h.repo.publish(next.package_id, sample), /incompleta/)
  assert.equal((await h.repo.usable(old.package_id, sample)).active, true)
})
test('an interrupted staging transaction does not leave half a member list', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  let calls = 0
  const repo = new OfflineRepository(h.db, binding, digest, () => { if (++calls === 3) throw new Error('locked') })
  await assert.rejects(repo.stage(envelope(manifest()), manifest(), anchor), /locked/)
  assert.equal((await h.repo.list()).length, 0)
})
test('remote known stale response blocks the old snapshot but never deletes its pending evidence', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(); await new PackageDownloader(mockApi(m), h.repo, clock, keys).run('42')
  await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, stableUuid, provider)
  const api = { ...mockApi(m), resume: async (): Promise<never> => { throw new ApiError('http', 'stale', 409, 'DISTRIBUTION_STALE') } }
  await assert.rejects(new PackageDownloader(api, h.repo, clock, keys).run('42', packageId), /stale/)
  assert.equal((await h.repo.package(packageId)).state, 'DESACTUALIZADO')
  assert.equal(await h.repo.pendingCount(), 1)
})
test('restart recovers unfinished preparation without changing an active snapshot', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(); await h.repo.stage(envelope(m), m, anchor)
  await initializeCipher(h.db, 'ab'.repeat(32))
  assert.equal((await h.repo.package(packageId)).state, 'INCOMPLETA')
})
test('one keyed connection serializes outside writes after transaction rollback', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const sql = new SerializedSql(h.db)
  await sql.execAsync('CREATE TABLE queue_test(value TEXT NOT NULL)')
  let enter!: () => void, release!: () => void
  const entered = new Promise<void>((resolve) => { enter = resolve })
  const gate = new Promise<void>((resolve) => { release = resolve })
  const transaction = sql.transactionAsync(async (tx) => {
    await tx.runAsync('INSERT INTO queue_test(value) VALUES(?)', 'rolled-back')
    enter(); await gate; throw new Error('rollback requested')
  })
  await entered
  let outsideCompleted = false
  const outside = sql.runAsync('INSERT INTO queue_test(value) VALUES(?)', 'outside').then(() => { outsideCompleted = true })
  await Promise.resolve(); assert.equal(outsideCompleted, false)
  const rejected = assert.rejects(transaction, /rollback requested/)
  release(); await rejected; await outside
  assert.deepEqual((await sql.getAllAsync<{ value: string }>('SELECT value FROM queue_test')).map((r) => r.value), ['outside'])
})
test('QR v3 reuses real verifier and resolves signed subject only within this list', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, clock, keys).run('42')
  const p = await h.repo.package(packageId), token = vectors.cases[0]!.token
  assert.equal((await identifyQr(token, p, sample, provider)).student.student_id, '101')
  await assert.rejects(identifyQr(vectors.cases.find((v) => v.name === 'tampered-payload')!.token, p, sample, provider), /SIGNATURE_INVALID/)
  await assert.rejects(identifyQr(token, { ...p, examId: '43' }, sample, provider), /SUBJECT_EXAM_MISMATCH/)
  await assert.rejects(identifyQr(token, { ...p, manifest: { ...p.manifest, students: [] } }, sample, provider), /no pertenece/)
})
test('QR v2 is explicitly unverifiable and QR without offered keys is unavailable', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest({ qr: { available: false, reason: 'V2', issuer: null, audience: null, keys: [], revoked_jtis: null } })
  await new PackageDownloader(mockApi(m), h.repo, clock, keys).run('42')
  const p = await h.repo.package(packageId), payload = Buffer.from(JSON.stringify({ v: 2 })).toString('base64url')
  await assert.rejects(identifyQr('abc.'+payload+'.abc', p, sample, provider), /v2/)
  await assert.rejects(identifyQr(vectors.cases[0]!.token, p, sample, provider), /no ofrece/)
})
test('known ineligibility and known revocation reject capture', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(); m.students[0]!.eligibility_status = 'INELIGIBLE'
  await new PackageDownloader(mockApi(m), h.repo, clock, keys).run('42')
  await assert.rejects(captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, stableUuid, provider), /habilitación/)
  const p = await h.repo.package(packageId)
  p.manifest.students[0]!.eligibility_status = 'ELIGIBLE'; p.manifest.qr.revoked_jtis = [vectors.claims.jti]
  await assert.rejects(identifyQr(vectors.cases[0]!.token, p, sample, provider), /revocación/)
})
for (const method of ['MANUAL', 'QR'] as const) test(`${method} capture is provisional, UUID-stable and guarded against local duplicates`, async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, clock, keys).run('42')
  const first = await captureProvisional(h.repo, packageId, '101', method, sample, stableUuid, provider, vectors.cases[0]!.token)
  const repeated = await captureProvisional(h.repo, packageId, '101', method, sample, () => { throw new Error('Do not mint new UUID on retry') }, provider, vectors.cases[0]!.token)
  assert.deepEqual(repeated, first); assert.equal(await h.repo.pendingCount(), 1)
  assert.equal(first.local_status, 'PENDING_SYNC'); assert.notEqual(first.local_status, 'ACCEPTED')
  assert.equal(first.sync_compatibility, method === 'QR' ? 'QR_V3_REQUIRES_BACKEND_EXTENSION' : 'HU37_MANUAL_V1')
  assert.match(first.captured_at, /Z$/)
  await assert.rejects(h.db.runAsync('UPDATE events SET payload=?', '{}'), /IMMUTABLE_EVENT/)
  await assert.rejects(h.db.runAsync('DELETE FROM events'), /PENDING_EVENT/)
})
test('session boundaries distinguish local expiry, logout, account change and revocation', async () => {
  const h = harness(), boundaries: string[] = []
  h.session.onSecurityBoundary(async (reason) => { boundaries.push(reason) })
  await signIn(h)
  assert.equal(boundaries[0], 'account-change')
  assert.equal(h.session.offlineBinding()?.userId, '7')
  h.clock.now = NOW + 3600001
  await h.session.checkExpiry(); assert.equal(boundaries.at(-1), 'expired')
  assert.equal(h.session.offlineBinding(), null)
  h.clock.now = NOW; await h.session.login('teacher@example.test', 'Synthetic!123')
  await h.session.currentDeviceRevoked(11); assert.equal(boundaries.at(-1), 'revoked')
  await h.session.login('teacher@example.test', 'Synthetic!123'); await h.session.logout()
  assert.equal(boundaries.at(-1), 'logout')
})
test('binary HTTP uses same Bearer origin, rejects redirects, and frozen errors remain explicit', async () => {
  const bytes = new Uint8Array([1, 2]), base = binding.apiBase
  const client = new HttpClient(base, async (url, init) => {
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer SYNTHETIC')
    assert.equal(init.redirect, 'manual')
    return { status: 200, url, text: async () => '', arrayBuffer: async () => bytes.buffer }
  })
  assert.deepEqual(await client.request('exams/42/offline/package', { token: 'SYNTHETIC', responseType: 'bytes' }), bytes)
  const redirect = new HttpClient(base, async (url) => ({ status: 302, url, text: async () => '' }))
  await assert.rejects(redirect.request('exams/42/offline/package', { responseType: 'bytes' }), (e: unknown) => e instanceof ApiError && e.kind === 'configuration')
  assert.match(httpError(409, { code: 'DISTRIBUTION_FROZEN' }).message, /DISTRIBUTION_FROZEN/)
})
