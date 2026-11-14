// Desktop adapter tests only: real HU36 repository, SQLite and QR verifier; no physical camera.
import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import vectors from '../src/features/qr/fixtures/php-vectors.json'
import { QrScanSession } from '../src/features/scanner/scanSession'
import { PackageDownloader } from '../src/features/offline/download'
import { captureProvisional } from '../src/features/offline/identity'
import { OutboxRepository } from '../src/features/offline/sync/outbox'
import { OfflineSyncController } from '../src/features/offline/sync/controller'
import { parseEnvelope } from '../src/features/offline/manifest'
import type { Manifest } from '../src/features/offline/contracts'
import type { Rs256Provider } from '../src/features/qr/contracts'
import { anchor, binding, digest, envelope, harnessOffline, manifest, mockApi, packageId, provider, sample } from './support/offlineFixtures'
import { ack, at, capabilities, sequence } from './support/syncFixtures'

const valid = vectors.cases[0]!.token
const uuid = 'a3a0ef87-356b-4cb9-a49e-a7ce319e2772'
async function setup(t: TestContext, m: Manifest = manifest(), crypto: Rs256Provider = provider) {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  let clock = { ...sample }, locked = false, minted = 0
  await new PackageDownloader(mockApi(m), h.repo, { sample: async () => clock }, async () => {}).run(m.exam_id)
  const session = new QrScanSession(m.package_id, {
    repo: h.repo, digest, provider: crypto, uuid: () => { minted++; return uuid },
    sample: async () => clock, check: () => { if (locked) throw new Error('Almacén bloqueado.') },
    photoUri: async (bytes, mime) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
  })
  await session.revalidate()
  return { ...h, session, minted: () => minted, setClock: (next: typeof sample) => { clock = next }, lock: () => { locked = true } }
}
function start(session: QrScanSession) {
  session.cameraAccess(true)
  assert.equal(session.start(), true)
  const state = session.state
  assert.ok(state.phase === 'scanning')
  session.cameraReady(state.scanId)
  return state.scanId
}
function expectError(session: QrScanSession, pattern: RegExp) {
  const state = session.state
  assert.ok(state.phase === 'error' || state.phase === 'blocked')
  assert.match(state.message, pattern)
  assert.equal('identity' in state, false)
}

test('valid native detection uses the real verifier and needs explicit confirmation', async (t) => {
  const h = await setup(t), scanId = start(h.session)
  assert.equal(await h.session.detect(scanId, { type: 'qr', data: valid }), true)
  const review = h.session.state
  assert.ok(review.phase === 'review')
  assert.equal(review.identity.student.student_id, '101')
  assert.equal(review.identity.photos.length, 0) // Legitimate ABSENT photos are preserved.
  assert.equal(JSON.stringify(review).includes(valid), false)
  assert.equal(await h.repo.pendingCount(), 0)
  assert.equal(h.minted(), 0)
  const saved = await h.session.confirm()
  assert.ok(saved)
  assert.equal(saved.method, 'QR'); assert.equal(saved.qr_token, valid)
  assert.equal(saved.event_id, uuid); assert.equal(saved.local_status, 'PENDING_SYNC')
  assert.equal(h.session.state.phase, 'saved')
  assert.equal(await h.repo.pendingCount(), 1)
  assert.equal(h.minted(), 1)
})

for (const name of ['tampered-signature', 'tampered-payload', 'wrong-algorithm', 'unknown-kid']) {
  test(`native detection rejects ${name} without identity or writes`, async (t) => {
    const h = await setup(t), vector = vectors.cases.find((item) => item.name === name)!
    assert.equal(await h.session.detect(start(h.session), { type: 'qr', data: vector.token }), false)
    expectError(h.session, new RegExp(vector.reason!))
    assert.equal(await h.session.confirm(), null)
    assert.equal(await h.repo.pendingCount(), 0)
  })
}
test('a genuine QR for another exam cannot identify a student', async (t) => {
  const m = manifest(); m.exam_id = '43'; m.exam.id = 43
  const h = await setup(t, m)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  expectError(h.session, /SUBJECT_EXAM_MISMATCH/)
})
test('signed subject outside the downloaded list never exposes identity', async (t) => {
  const m = manifest(); m.students[0]!.student_id = '102'
  const h = await setup(t, m)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  expectError(h.session, /no pertenece/)
})
test('expired QR uses anchored native time even while the package is still usable', async (t) => {
  const m = manifest({ expires_at: '2030-01-01T02:00:00Z' })
  m.exam.entry_closes_at = m.expires_at; m.exam.duration_minutes = 120
  const h = await setup(t, m)
  const expired = vectors.cases.find((item) => item.name === 'expired-at-boundary')!
  h.setClock({ ...sample, elapsed: sample.elapsed + expired.now * 1000 - anchor.serverMs })
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  expectError(h.session, /TIME_INVALID/)
  assert.equal(await h.repo.pendingCount(), 0)
})
test('QR v2 is explicitly unsupported offline and malformed text is not followed as a URL', async (t) => {
  const h = await setup(t)
  const v2 = `abc.${Buffer.from(JSON.stringify({ v: 2, name: 'UNTRUSTED' })).toString('base64url')}.abc`
  await h.session.detect(start(h.session), { type: 'qr', data: v2 })
  expectError(h.session, /v2.*no es verificable/)
  for (const data of ['', 'https://outside.example.test/qr', 'x'.repeat(4097)]) {
    await h.session.detect(start(h.session), { type: 'qr', data })
    expectError(h.session, /QR|FORMAT_INVALID/)
  }
  assert.equal(await h.repo.pendingCount(), 0)
})
test('known ineligibility or revocation rejects an otherwise valid scan', async (t) => {
  for (const condition of ['eligibility', 'revocation']) {
    const m = manifest()
    if (condition === 'eligibility') m.students[0]!.eligibility_status = 'INELIGIBLE'
    if (condition === 'revocation') m.qr.revoked_jtis = [vectors.claims.jti]
    const h = await setup(t, m)
    await h.session.detect(start(h.session), { type: 'qr', data: valid })
    expectError(h.session, /habilitación|revocación/)
    assert.equal(await h.repo.pendingCount(), 0)
  }
})
test('opening the scanner directly cannot start the camera when the list has no QR trust material', async (t) => {
  const m = manifest()
  m.qr = { available: false, reason: null, issuer: null, audience: null, keys: [], revoked_jtis: null }
  const h = await setup(t, m)
  assert.equal(h.session.state.phase, 'blocked')
  expectError(h.session, /no incluye claves públicas/)
  h.session.cameraAccess(true)
  assert.equal(h.session.start(), false)
  assert.equal(await h.session.detect(0, { type: 'qr', data: valid }), false)
  assert.equal(await h.session.confirm(), null)
  assert.equal(await h.repo.pendingCount(), 0)
})
test('camera without permission, unready preview and non-QR callbacks cannot verify or capture', async (t) => {
  const h = await setup(t)
  assert.equal(h.session.start(), false)
  assert.equal(await h.session.detect(0, { type: 'qr', data: valid }), false)
  h.session.cameraAccess(true); h.session.start()
  const state = h.session.state; assert.ok(state.phase === 'scanning')
  assert.equal(await h.session.detect(state.scanId, { type: 'qr', data: valid }), false)
  h.session.cameraReady(state.scanId)
  assert.equal(await h.session.detect(state.scanId, { type: 'ean13', data: valid }), false)
  h.session.cameraAccess(false)
  assert.equal(await h.session.detect(state.scanId, { type: 'qr', data: valid }), false)
  assert.equal(await h.session.confirm(), null)
  assert.equal(await h.repo.pendingCount(), 0)
})
test('camera unavailable pauses without exposing a previous result', async (t) => {
  const h = await setup(t), scanId = start(h.session)
  h.session.cameraFailed(scanId)
  expectError(h.session, /Cámara no disponible/)
  assert.equal(await h.session.detect(scanId, { type: 'qr', data: valid }), false)
})
test('double detection and double confirmation produce exactly one stable immutable event', async (t) => {
  const h = await setup(t), id = start(h.session)
  const first = h.session.detect(id, { type: 'qr', data: valid })
  assert.equal(await h.session.detect(id, { type: 'qr', data: valid }), false)
  await first
  const saving = h.session.confirm()
  assert.equal(await h.session.confirm(), null)
  const event = await saving; assert.ok(event)
  assert.equal(await h.repo.pendingCount(), 1); assert.equal(h.minted(), 1)
  await assert.rejects(h.db.runAsync('UPDATE events SET payload=?', '{}'), /IMMUTABLE_EVENT/)
  await assert.rejects(h.db.runAsync('DELETE FROM events'), /PENDING_EVENT/)
  assert.deepEqual(await h.repo.event('42', '101'), event)
})
test('consecutive scans require rearming; old callbacks cannot claim the new preview', async (t) => {
  const h = await setup(t), oldId = start(h.session)
  await h.session.detect(oldId, { type: 'qr', data: 'invalid' })
  expectError(h.session, /FORMAT_INVALID/)
  const newId = start(h.session)
  assert.notEqual(newId, oldId)
  h.session.cameraFailed(oldId)
  assert.equal(await h.session.detect(oldId, { type: 'qr', data: valid }), false)
  assert.equal(await h.session.detect(newId, { type: 'qr', data: valid }), true)
  assert.equal(await h.repo.pendingCount(), 0)
})
test('cancellation clears review and prevents confirmation; a fresh scan can follow', async (t) => {
  const h = await setup(t)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  h.session.cancel()
  assert.equal(h.session.state.phase, 'idle')
  assert.equal(await h.session.confirm(), null)
  assert.equal(await h.repo.pendingCount(), 0)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  assert.equal(h.session.state.phase, 'review')
})
test('local duplicate preserves original method, raw evidence and UUID including a racing manual capture', async (t) => {
  const h = await setup(t)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  const original = await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, () => uuid, provider)
  assert.deepEqual(await h.session.confirm(), original)
  assert.equal(h.minted(), 0)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  const duplicate = h.session.state; assert.ok(duplicate.phase === 'duplicate')
  assert.deepEqual(duplicate.event, original)
  assert.equal(await h.session.confirm(), null)
  assert.equal(await h.repo.pendingCount(), 1)
})
test('rescan after saving finds the same UUID and never appends another QR event', async (t) => {
  const h = await setup(t)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  const original = await h.session.confirm()
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  const state = h.session.state; assert.ok(state.phase === 'duplicate')
  assert.deepEqual(state.event, original)
  assert.equal(h.minted(), 1); assert.equal(await h.repo.pendingCount(), 1)
})
test('expiry, boot change and scope lock clear identity without deleting pending evidence', async (t) => {
  for (const condition of ['expiry', 'boot', 'scope']) {
    const h = await setup(t)
    await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, () => uuid, provider)
    await h.session.detect(start(h.session), { type: 'qr', data: valid })
    if (condition === 'expiry') h.setClock({ ...sample, elapsed: sample.elapsed + 3600000 })
    if (condition === 'boot') h.setClock({ ...sample, boot: '4' })
    if (condition === 'scope') h.lock()
    await h.session.revalidate()
    expectError(h.session, /vigencia|reinició|bloqueado/)
    assert.equal(h.session.start(), false)
    assert.equal(await h.session.confirm(), null)
    assert.equal(await h.repo.pendingCount(), 1)
  }
})
test('confirmation rechecks package validity after the operator has reviewed identity', async (t) => {
  const h = await setup(t)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  assert.equal(h.session.state.phase, 'review')
  h.setClock({ ...sample, elapsed: sample.elapsed + 3600000 })
  assert.equal(await h.session.confirm(), null)
  expectError(h.session, /vigencia/)
  assert.equal(await h.repo.pendingCount(), 0)
  assert.equal(h.minted(), 0)
})
test('camera capture feeds the existing HU37 outbox without rewriting evidence or inventing an ACK', async (t) => {
  const h = await setup(t)
  await h.session.detect(start(h.session), { type: 'qr', data: valid })
  const event = await h.session.confirm(); assert.ok(event)
  const outbox = new OutboxRepository(h.connection, binding, digest)
  await outbox.reconcile()
  const pending = await outbox.pending()
  assert.equal(pending.length, 1)
  assert.equal(pending[0]?.id, event.event_id)
  assert.equal(pending[0]?.wire.qr_token, valid)
  assert.equal(pending[0]?.needsQrV3, true)
  assert.equal((await outbox.items())[0]?.state, 'PENDING')
  assert.equal((await outbox.items())[0]?.receipt, null)
  await h.session.detect(start(h.session), { type: 'qr', data: 'invalid' })
  h.session.cancel(); h.session.close()
  const restarted = new OutboxRepository(h.connection, binding, digest)
  await restarted.reconcile()
  assert.deepEqual(await restarted.pending(), pending)
  assert.deepEqual(await h.repo.event('42', '101'), event)
})

test('a new preparation enables the Laravel QR and HU37 sends both copies with their original package IDs', async (t) => {
  const previous = manifest()
  previous.qr = { available: false, reason: 'PRODUCTION_QR_V3_NOT_CONFIRMED',
    issuer: null, audience: null, keys: [], revoked_jtis: null }
  previous.students.push({ ...previous.students[0]!, student_id: '102', sis_code: '203000102', identity_number: 'CI-102' })
  const h = await setup(t, previous)
  assert.equal(h.session.state.phase, 'blocked')
  const manual = await captureProvisional(h.repo, previous.package_id, '102', 'MANUAL', sample, () => uuid, provider)

  const nextId = '01234567-89ab-4cde-8f01-23456789abce'
  const next = manifest({ package_id: nextId, authorization_id: nextId, students: previous.students })
  const downloaded = parseEnvelope({ data: { mobile: envelope(next) } }, digest)
  const api = { ...mockApi(next), package: async () => ({ ...downloaded, serverTime: next.server_time }) }
  await new PackageDownloader(api, h.repo, { sample: async () => sample }, async () => {}).run(next.exam_id)
  assert.equal((await h.repo.package(previous.package_id)).active, false)
  assert.equal((await h.repo.usable(nextId, sample)).manifest.qr.available, true)

  const nextEventId = 'a3a0ef87-356b-4cb9-a49e-a7ce319e2773'
  const session = new QrScanSession(nextId, {
    repo: h.repo, digest, provider, uuid: () => nextEventId, sample: async () => sample, check: () => {},
    photoUri: async () => { throw new Error('Laboratory students have no photos') },
  })
  await session.revalidate()
  assert.equal(await session.detect(start(session), { type: 'qr', data: valid }), true)
  assert.equal(session.state.phase, 'review')
  assert.equal(await h.repo.pendingCount(), 1)
  const qr = await session.confirm()
  assert.ok(qr)
  assert.equal(qr.local_status, 'PENDING_SYNC')
  assert.equal(await h.repo.pendingCount(), 2)

  const outbox = new OutboxRepository(h.connection, binding, digest)
  const delivered = new Map<string, string>()
  const controller = new OfflineSyncController(outbox, {
    capabilities: async () => ({ ...capabilities, qrVersions: [2, 3] }),
    send: async (_exam, batch) => batch.events.map((event) => {
      delivered.set(event.event_id, batch.package_id)
      if (event.event_id === qr.event_id) assert.ok(event.qr_token === valid)
      return ack(event)
    }),
  }, sequence(), () => binding, () => at)
  await controller.sync()
  assert.equal(delivered.get(manual.event_id), previous.package_id)
  assert.equal(delivered.get(qr.event_id), nextId)
  assert.equal(await h.repo.pendingCount(), 0)
  assert.equal((await outbox.items()).find((row) => row.eventId === qr.event_id)?.receipt?.status, 'ACCEPTED')
})
test('incomplete or stale packages cannot mount an armed scanner or accept detection', async (t) => {
  const h = await setup(t)
  for (const state of ['INCOMPLETA', 'DESACTUALIZADO'] as const) {
    await h.repo.setState(packageId, state)
    const session = new QrScanSession(packageId, {
      repo: h.repo, digest, provider, uuid: () => uuid, check: () => {}, sample: async () => sample,
      photoUri: async () => { throw new Error('No photographs should be read') },
    })
    await session.revalidate(); session.cameraAccess(true)
    expectError(session, /paquete/)
    assert.equal(session.start(), false)
    assert.equal(await session.detect(0, { type: 'qr', data: valid }), false)
  }
  assert.equal(await h.repo.pendingCount(), 0)
})
test('leaving or locking during crypto verification discards late identity and cannot confirm', async (t) => {
  let release!: () => void, entered!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const entering = new Promise<void>((resolve) => { entered = resolve })
  const crypto: Rs256Provider = { name: 'Delayed real OpenSSL verification', verify: async (...args) => {
    entered(); await gate; return provider.verify(...args)
  } }
  const h = await setup(t, manifest(), crypto)
  const detection = h.session.detect(start(h.session), { type: 'qr', data: valid })
  await entering
  h.session.close(); release()
  assert.equal(await detection, false)
  assert.equal(h.session.state.phase, 'closed')
  assert.equal(await h.session.confirm(), null)
  assert.equal(h.session.start(), false)
  assert.equal(await h.repo.pendingCount(), 0)
})
test('verified local photo is read from SQLite and corruption blocks review and capture', async (t) => {
  const bytes = new Uint8Array([1, 2, 3]), m = manifest()
  m.students[0]!.photos[0] = { kind: 'profile', state: 'PRESENT', mime: 'image/png', size: bytes.length,
    sha256: digest(bytes), revision: '1', path: `exams/42/offline/packages/${packageId}/photos/101/profile` }
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await h.repo.stage(envelope(m), m, anchor)
  await h.repo.savePhoto(packageId, '101', 'profile', digest(bytes), bytes)
  await h.repo.publish(packageId, sample)
  const session = new QrScanSession(packageId, { repo: h.repo, digest, provider, uuid: () => uuid,
    sample: async () => sample, check: () => {}, photoUri: async (value, mime) => `data:${mime};base64,${Buffer.from(value).toString('base64')}` })
  await session.revalidate()
  await session.detect(start(session), { type: 'qr', data: valid })
  const state = session.state; assert.ok(state.phase === 'review')
  assert.equal(state.identity.photos[0]?.uri, 'data:image/png;base64,AQID')
  session.cancel()
  // Corrupt the test database, not the scanner/crypto implementation.
  await h.db.runAsync('UPDATE photos SET bytes=? WHERE package_id=?', new Uint8Array([9, 9, 9]), packageId)
  await session.detect(start(session), { type: 'qr', data: valid })
  expectError(session, /integridad/)
  assert.equal(await session.confirm(), null)
  assert.equal(await h.repo.pendingCount(), 0)
})
