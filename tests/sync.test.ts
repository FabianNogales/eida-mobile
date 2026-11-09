import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/services/http/errors'
import { OfflineSyncController } from '../src/features/offline/sync/controller'
import { OutboxRepository } from '../src/features/offline/sync/outbox'
import { SyncApi } from '../src/features/offline/sync/api'
import { parseSyncResponse } from '../src/features/offline/sync/schema'
import type { SyncReceipt, WireBatch } from '../src/features/offline/sync/contracts'
import { ack, at, capabilities, syncHarness } from './support/syncFixtures'
import { anchor, binding, digest, envelope, sample } from './support/offlineFixtures'

test('HU37 batches at most 100 and persists individual definitive results without changing events', async (t) => {
  const h = await syncHarness(205); t.after(() => h.db.closeAsync())
  const requests: WireBatch[] = []
  const api = { capabilities: async () => capabilities, send: async (_exam: string, batch: WireBatch) => {
    requests.push(batch); return batch.events.map((e, i) => ack(e, i % 4 === 0 ? 'ACCEPTED' : i % 4 === 1 ? 'DUPLICATE' : i % 4 === 2 ? 'CONFLICT' : 'REJECTED'))
  } }
  const controller = new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at)
  await controller.sync()
  assert.deepEqual(requests.map((b) => b.events.length), [100, 100, 5])
  const items = await h.outbox.items()
  assert.equal(items.length, 205); assert.equal(await h.repo.pendingCount(), 0)
  assert.ok(items.every((i) => i.receipt && !['PENDING', 'SENDING'].includes(i.state)))
  for (const e of h.originals) assert.deepEqual(await h.repo.event(e.exam_id, e.student_id), e)
  await controller.sync(); assert.equal(requests.length, 3) // Never resubmit stored conflicts/rejections either.
})

test('events from an old and a new package are sent separately with their original context', async (t) => {
  const h = await syncHarness(2, false, 1); t.after(() => h.db.closeAsync())
  const packageId = h.uuid(), next = { ...h.m, package_id: packageId, authorization_id: packageId }
  await h.repo.stage(envelope(next), next, anchor); await h.repo.publish(packageId, sample)
  const original = h.originals[0]; assert.ok(original)
  await h.repo.append({ ...original, event_id: h.uuid(), package_id: packageId, student_id: '102' })
  const requests: WireBatch[] = []
  await new OfflineSyncController(h.outbox, { capabilities: async () => capabilities, send: async (_e, b) => { requests.push(b); return b.events.map((e) => ack(e)) } }, h.uuid, () => binding, () => at).sync()
  assert.deepEqual(requests.map((r) => r.package_id), [original.package_id, packageId])
  assert.deepEqual(requests.map((r) => r.events.length), [1, 1])
  assert.equal((await h.repo.event('42', '101'))?.package_id, original.package_id)
})

test('timeout after server commit recovers ACCEPTED with the identical UUID and content', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const server = new Map<string, SyncReceipt>(), requests: string[] = []
  let lose = true
  const api = { capabilities: async () => capabilities, send: async (_exam: string, batch: WireBatch) => {
    requests.push(JSON.stringify(batch))
    const results = batch.events.map((e) => { const result = server.get(e.event_id) ?? ack(e); server.set(e.event_id, result); return result })
    if (lose) { lose = false; throw new ApiError('timeout', 'synthetic timeout') }
    return results
  } }
  const controller = new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at)
  await controller.sync()
  assert.equal((await h.outbox.items())[0]?.state, 'PENDING'); assert.equal(server.size, 1)
  await controller.sync()
  assert.equal(requests[0], requests[1]); assert.equal((await h.outbox.items())[0]?.state, 'CONFIRMED')
  assert.equal((await h.outbox.items())[0]?.attempts, 2); assert.equal(server.size, 1)
  await controller.sync(); assert.equal(requests.length, 2)
})

test('partial response stores known receipts atomically and retries only missing UUIDs', async (t) => {
  const h = await syncHarness(2); t.after(() => h.db.closeAsync())
  const requests: WireBatch[] = []
  const api = { capabilities: async () => capabilities, send: async (_e: string, b: WireBatch) => {
    requests.push(b); return b.events.slice(0, 1).map((e) => ack(e))
  } }
  const controller = new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at)
  await controller.sync()
  assert.equal(await h.repo.pendingCount(), 1)
  assert.equal((await h.outbox.items()).filter((i) => i.state === 'CONFIRMED').length, 1)
  await controller.sync()
  assert.equal(requests[1]?.events.length, 1)
  assert.equal(requests[1]?.events[0]?.event_id, h.originals[1]?.event_id)
  assert.equal(await h.repo.pendingCount(), 0)
})

test('unknown, repeated or structurally invalid receipts never become official confirmations', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const pending = await h.outbox.pending(), event = pending[0]
  assert.ok(event)
  const r = ack(event.wire), response = (results: unknown[]) => ({ data: { protocol_version: 2, exam_id: 42, results } })
  assert.throws(() => parseSyncResponse(response([{ ...r, event_id: h.uuid() }]), '42', [event.id]))
  assert.throws(() => parseSyncResponse(response([r, r]), '42', [event.id]))
  assert.throws(() => parseSyncResponse(response([{ ...r, entry_id: null }]), '42', [event.id]))
  assert.throws(() => parseSyncResponse(response([{ ...r, status: 'LOCAL_ACCEPTED' }]), '42', [event.id]))
  assert.deepEqual(parseSyncResponse(response([]), '42', [event.id]), [])
  assert.equal((await h.outbox.items())[0]?.state, 'PENDING')
})

test('local lease prevents simultaneous sends from two controllers', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  let started!: () => void, release!: () => void, calls = 0
  const entered = new Promise<void>((resolve) => { started = resolve }), gate = new Promise<void>((resolve) => { release = resolve })
  const api = { capabilities: async () => capabilities, send: async (_e: string, b: WireBatch) => { calls++; started(); await gate; return b.events.map((e) => ack(e)) } }
  const first = new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at)
  const second = new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at)
  const running = first.sync(); await entered
  await assert.rejects(second.sync(), /curso/)
  await assert.rejects(first.sync(), /curso/)
  release(); await running; assert.equal(calls, 1)
})

test('restart recovers SENDING and its persisted request without replacing the original package', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const events = await h.outbox.pending(), lease = h.uuid(), attempt = h.uuid()
  await h.outbox.acquire(lease)
  const sent = await h.outbox.begin(lease, attempt, events, at)
  const restored = new OutboxRepository(h.connection, binding, digest)
  await restored.recoverInterrupted(at)
  assert.equal((await restored.items())[0]?.state, 'PENDING')
  let recovered: WireBatch | undefined
  await new OfflineSyncController(restored, { capabilities: async () => capabilities, send: async (_e, b) => { recovered = b; return b.events.map((e) => ack(e)) } }, h.uuid, () => binding, () => at).sync()
  assert.deepEqual(recovered, sent)
  assert.equal((await restored.items())[0]?.state, 'CONFIRMED')
})

const failures = [
  new ApiError('network', 'synthetic'), new ApiError('timeout', 'synthetic'), new ApiError('http', 'synthetic', 401),
  new ApiError('http', 'synthetic', 401, 'ACCOUNT_INACTIVE'), new ApiError('http', 'synthetic', 401, 'MOBILE_DEVICE_REVOKED'),
  new ApiError('http', 'synthetic', 403, 'PACKAGE_NOT_OWNED'), new ApiError('http', 'synthetic', 422), new ApiError('http', 'synthetic', 500),
]
for (const failure of failures) test(`failure ${failure.kind}/${failure.status}/${failure.code} preserves pending evidence`, async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const original = h.originals[0]; assert.ok(original)
  await new OfflineSyncController(h.outbox, { capabilities: async () => capabilities, send: async () => { throw failure } }, h.uuid, () => binding, () => at).sync()
  assert.equal((await h.outbox.items())[0]?.state, 'PENDING')
  assert.ok((await h.outbox.items())[0]?.errorCode)
  assert.deepEqual(await h.repo.event(original.exam_id, original.student_id), original)
})

test('account switch cannot retag, send or inspect another actors outbox', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const other = { ...binding, userId: '8' }; let sent = 0
  const api = { capabilities: async () => capabilities, send: async () => { sent++; return [] } }
  await assert.rejects(new OfflineSyncController(h.outbox, api, h.uuid, () => other).sync(), /originales/)
  await assert.rejects(new OutboxRepository(h.connection, other, digest).items(), /otro usuario/)
  assert.equal(sent, 0); assert.equal((await h.outbox.items())[0]?.actorId, '7')
})

test('requests, source events and definitive receipts cannot be rewritten or deleted', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  await assert.rejects(h.db.runAsync('UPDATE sync_outbox SET wire_event=?', '{}'), /IMMUTABLE_OUTBOX_REQUEST/)
  await assert.rejects(h.db.runAsync('DELETE FROM sync_outbox'), /KEEP_OUTBOX/)
  await new OfflineSyncController(h.outbox, { capabilities: async () => capabilities, send: async (_e, b) => b.events.map((e) => ack(e)) }, h.uuid, () => binding, () => at).sync()
  await assert.rejects(h.db.runAsync('UPDATE sync_receipts SET result=?', '{}'), /IMMUTABLE_RECEIPT/)
  await assert.rejects(h.db.runAsync('DELETE FROM events'), /PENDING_EVENT/)
})

test('mutating a pending DTO cannot change the persisted request used for transport', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const events = await h.outbox.pending(), event = events[0]; assert.ok(event)
  const lease = h.uuid(); await h.outbox.acquire(lease)
  event.wire.student_id = '999'
  await assert.rejects(h.outbox.begin(lease, h.uuid(), events, at), /cambió/)
  await h.outbox.release(lease)
  assert.equal((await h.outbox.pending())[0]?.wire.student_id, '101')
  assert.equal((await h.outbox.items())[0]?.attempts, 0)
})

test('a local confirmed flag without an immutable backend receipt cannot be presented as official', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  await h.db.runAsync("UPDATE sync_outbox SET state='CONFIRMED'")
  await assert.rejects(h.outbox.items(), /recibo definitivo coherente/)
})

test('missing deployed capabilities never sends an event to the legacy-only contract', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync()); let sent = 0
  await new OfflineSyncController(h.outbox, { capabilities: async () => { throw new ApiError('http', 'missing', 404) },
    send: async () => { sent++; return [] } }, h.uuid, () => binding, () => at).sync()
  assert.equal(sent, 0); assert.equal((await h.outbox.items())[0]?.errorCode, 'BACKEND_EXTENSION_REQUIRED')
})

test('QR v3 stays pending until the backend advertises verification while manual events synchronize', async (t) => {
  const h = await syncHarness(2, true); t.after(() => h.db.closeAsync())
  const requests: WireBatch[] = []; let supported = false
  const api = { capabilities: async () => ({ ...capabilities, qrVersions: supported ? [2, 3] : [2] }),
    send: async (_e: string, b: WireBatch) => { requests.push(b); return b.events.map((e) => ack(e)) } }
  const controller = new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at)
  await controller.sync()
  assert.deepEqual(requests[0]?.events.map((e) => e.method), ['MANUAL'])
  assert.equal((await h.outbox.items()).find((i) => i.method === 'QR')?.errorCode, 'QR_V3_UNAVAILABLE')
  supported = true; await controller.sync()
  assert.deepEqual(requests[1]?.events.map((e) => e.method), ['QR'])
  const original = h.originals[1]; assert.ok(original)
  assert.deepEqual(await h.repo.event(original.exam_id, original.student_id), original)
  assert.equal(requests[1]?.events[0]?.qr_token, original.qr_token)
})

test('receipt persistence failure rolls back all definitive results, retaining stable retry requests', async (t) => {
  const h = await syncHarness(2); t.after(() => h.db.closeAsync())
  const second = h.originals[1]; assert.ok(second)
  await h.db.execAsync(`CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON sync_receipts
    WHEN NEW.event_id='${second.event_id}' BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END`)
  await new OfflineSyncController(h.outbox, { capabilities: async () => capabilities, send: async (_e, b) => b.events.map((e) => ack(e)) }, h.uuid, () => binding, () => at).sync()
  assert.equal((await h.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_receipts'))?.n, 0)
  assert.equal(await h.repo.pendingCount(), 2)
  assert.ok((await h.outbox.items()).every((i) => i.state === 'PENDING'))
})

test('SyncApi reuses session requests and projects only protocol-v2 fields', async (t) => {
  const h = await syncHarness(); t.after(() => h.db.closeAsync())
  const calls: string[] = []
  const api = new SyncApi({ request: async (path, options) => {
    calls.push(path)
    if (path.endsWith('sync-capabilities')) return { data: { protocol_versions: [1, 2], max_events: 100, qr_versions: [2], late_evidence: true, late_policy: 'REVIEW_ONLY', time_evidence: 'DEVICE_DECLARED_NOT_ATTESTED' } }
    const body = options?.body
    assert.ok(body && typeof body === 'object' && 'events' in body && Array.isArray(body.events))
    return { data: { protocol_version: 2, exam_id: 42, results: body.events.map((e: unknown) => {
      assert.ok(e && typeof e === 'object' && 'event_id' in e)
      assert.equal('local_status' in e, false); assert.equal('exam_id' in e, false); assert.equal('sync_compatibility' in e, false)
      return { event_id: e.event_id, status: 'ACCEPTED', code: 'ENTRY_REGISTERED', message: 'Synthetic receipt', entry_id: 123, review_required: false, received_at: at }
    }) } }
  } })
  await new OfflineSyncController(h.outbox, api, h.uuid, () => binding, () => at).sync()
  assert.deepEqual(calls, ['exams/42/offline/sync-capabilities', 'exams/42/offline/sync'])
})
