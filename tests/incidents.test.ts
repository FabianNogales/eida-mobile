import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { IncidentRepository } from '../src/features/incidents/repository'
import { IncidentSync } from '../src/features/incidents/sync'
import { DisciplineApi, type DisciplinePermissions } from '../src/features/incidents/api'
import { incidentTypes, officialIncident, type IncidentReceipt } from '../src/features/incidents/contracts'
import { PackageDownloader } from '../src/features/offline/download'
import { OfflineRepository, initializeCipher } from '../src/features/offline/repository'
import { OutboxRepository } from '../src/features/offline/sync/outbox'
import { captureProvisional } from '../src/features/offline/identity'
import { ApiError } from '../src/services/http/errors'
import { HttpClient } from '../src/services/http/client'
import type { PrivateApi } from '../src/features/exams/api'
import type { RequestOptions } from '../src/services/http/client'
import { TestSql, binding, digest, harnessOffline, manifest, mockApi, packageId, provider, sample } from './support/offlineFixtures'

const ids = () => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` }
const permission: DisciplinePermissions = { examId: 42, read: true, report: true, manage: true, observedAt: '2030-01-01T00:01:00Z' }
async function setup(t: TestContext) {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, { sample: async () => sample }, async () => {}).run('42')
  const reports = new IncidentRepository(h.connection, h.repo, digest), uuid = ids()
  const capture = (studentId: string | null = null) => reports.capture(packageId, { type: 'ENVIRONMENT', description: 'Descripción sintética confidencial', studentId }, sample, uuid)
  return { ...h, reports, uuid, capture }
}
function ack(json: string, hash: string): IncidentReceipt {
  const e = JSON.parse(json)
  return { event_id: e.event_id, request_hash: hash, status: 'REGISTERED', code: 'INCIDENT_REPORTED', incident_id: 12, review_required: false, received_at: '2030-01-01T00:02:00.000Z' }
}
test('offline reports accept only verified types, optional assigned student and nonempty description', async (t) => {
  const h = await setup(t)
  for (const type of incidentTypes) {
    const event = await h.reports.capture(packageId, { type: type.value, description: '  Observación  ', studentId: null }, sample, h.uuid)
    assert.equal(event.description, 'Observación'); assert.equal(event.actor_id, binding.userId)
    assert.equal(event.student_id, null); assert.equal(event.type, type.value)
  }
  assert.equal((await h.capture('101')).student_id, '101')
  for (const type of ['FAKE', 'WRONG_EXAM_QR']) await assert.rejects(h.reports.capture(packageId, { type, description: 'x', studentId: null }, sample, h.uuid))
  await assert.rejects(h.reports.capture(packageId, { type: 'ENVIRONMENT', description: '  ', studentId: null }, sample, h.uuid))
  await assert.rejects(h.capture('999'), /fuera/)
  assert.equal((await h.reports.items()).every((item) => item.state === 'PENDING' && item.receipt === null), true)
})
test('public WRONG_EXAM and REPORTED are not confused with internal QR/PENDING values', () => {
  const record = officialIncident({ id: 1, exam_id: 42, type: 'WRONG_EXAM', description: 'Prueba', student: null, reported_by: null, status: 'REPORTED', reported_at: '2030-01-01T00:02:00Z' })
  assert.equal(record.type, 'WRONG_EXAM'); assert.equal(record.status, 'REPORTED')
})
test('original JSON, fingerprint and actor are immutable; another user cannot read the queue', async (t) => {
  const h = await setup(t); await h.capture()
  await assert.rejects(h.db.runAsync('UPDATE incident_events SET event_json=?', '{}'), /IMMUTABLE_INCIDENT/)
  await assert.rejects(h.db.runAsync('DELETE FROM incident_events'), /KEEP_INCIDENT/)
  const other = new OfflineRepository(h.connection, { ...binding, userId: '8' }, digest)
  await assert.rejects(new IncidentRepository(h.connection, other, digest).items(), /otra cuenta/)
})
test('response lost after server commit retries the exact original UUID and bytes without duplicating', async (t) => {
  const h = await setup(t), original = await h.capture(), calls: string[] = [], committed = new Map<string, IncidentReceipt>()
  let lost = true
  const api = { sync: async (_exam: string, json: string, hash: string) => {
    calls.push(json)
    assert.equal((await h.reports.items())[0]?.state, 'SENDING')
    assert.equal(digest(json), hash)
    const result = committed.get(original.event_id) ?? ack(json, hash)
    committed.set(original.event_id, result)
    if (lost) { lost = false; throw new ApiError('timeout', 'Synthetic lost response') }
    return result
  } }
  const sync = new IncidentSync(h.reports, api, () => binding, h.uuid)
  await sync.run()
  assert.equal((await h.reports.items())[0]?.state, 'PENDING')
  await sync.run()
  const item = (await h.reports.items())[0]!
  assert.equal(item.event.event_id, original.event_id); assert.equal(item.state, 'REGISTERED'); assert.equal(item.attempts, 2)
  assert.equal(committed.size, 1); assert.equal(calls[0], calls[1])
  await sync.run(); assert.equal(calls.length, 2)
  await assert.rejects(h.db.runAsync('UPDATE incident_receipts SET payload=?', '{}'), /IMMUTABLE_INCIDENT_RECEIPT/)
})
for (const status of [401, 403, 422, 500]) test(`HTTP ${status} preserves immutable pending evidence and never invents a receipt`, async (t) => {
  const h = await setup(t), original = await h.capture()
  const http = new HttpClient(binding.apiBase, async (url) => ({ status, url, text: async () => JSON.stringify({ message: 'Fallo sintético' }) }))
  await new IncidentSync(h.reports, new DisciplineApi(http), () => binding, h.uuid).run()
  const item = (await h.reports.items())[0]!
  assert.deepEqual(item.event, original); assert.equal(item.state, 'PENDING'); assert.equal(item.receipt, null)
})
test('explicit conflicts/rejections are retained terminal results and cannot mutate original evidence', async (t) => {
  for (const status of ['CONFLICT', 'REJECTED'] as const) {
    const h = await setup(t); const original = await h.capture(); let calls = 0
    const sync = new IncidentSync(h.reports, { sync: async (_e, json, hash) => { calls++; return { ...ack(json, hash), status, code: status === 'CONFLICT' ? 'EVENT_ID_REUSED' : 'STUDENT_NOT_IN_PACKAGE', incident_id: null, review_required: true } } }, () => binding, h.uuid)
    await sync.run(); await sync.run()
    assert.equal(calls, 1); assert.deepEqual((await h.reports.items())[0]?.event, original)
    assert.equal((await h.reports.items())[0]?.state, status)
  }
})
test('wrong receipt UUID/hash is not a server registration and rolls back local acknowledgement', async (t) => {
  const h = await setup(t); await h.capture()
  await new IncidentSync(h.reports, { sync: async (_e, json, hash) => ({ ...ack(json, hash), request_hash: '0'.repeat(64) }) }, () => binding, h.uuid).run()
  assert.equal((await h.reports.items())[0]?.state, 'PENDING')
  assert.equal((await h.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM incident_receipts'))?.n, 0)
})
test('account switch before send is rejected and interrupted SENDING is recovered independently', async (t) => {
  const h = await setup(t), original = await h.capture()
  const api = { sync: async (_e: string, json: string, hash: string) => ack(json, hash) }
  await assert.rejects(new IncidentSync(h.reports, api, () => ({ ...binding, userId: '8' }), h.uuid).run(), /originales/)
  await h.reports.acquire('old-lease'); await h.reports.begin('old-lease', original.event_id)
  assert.equal((await h.reports.items())[0]?.state, 'SENDING')
  await h.reports.recoverInterrupted()
  assert.equal((await h.reports.items())[0]?.state, 'PENDING')
  await new IncidentSync(h.reports, api, () => binding, h.uuid).run()
  assert.equal((await h.reports.items())[0]?.event.event_id, original.event_id)
})
test('account change while a response is in flight cannot acknowledge under the new user', async (t) => {
  const h = await setup(t), original = await h.capture()
  let current = binding
  await new IncidentSync(h.reports, { sync: async (_e, json, hash) => {
    current = { ...binding, userId: '8' }; return ack(json, hash)
  } }, () => current, h.uuid).run()
  assert.deepEqual((await h.reports.items())[0]?.event, original)
  assert.equal((await h.reports.items())[0]?.receipt, null)
  assert.equal((await h.reports.items())[0]?.state, 'PENDING')
})
test('known server authorization revocation blocks future capture without deleting the original report', async (t) => {
  const h = await setup(t), original = await h.capture()
  await new IncidentSync(h.reports, { sync: async (_e, json, hash) => ({ ...ack(json, hash), status: 'CONFLICT', incident_id: null,
    code: 'OFFLINE_AUTHORIZATION_CHANGED', review_required: true }) }, () => binding, h.uuid).run()
  assert.equal((await h.repo.package(packageId)).state, 'DESACTUALIZADO')
  await assert.rejects(h.capture())
  assert.deepEqual((await h.reports.items())[0]?.event, original)
  assert.equal((await h.reports.items())[0]?.state, 'CONFLICT')
})
test('expired, stale, incomplete, rebooted or locked access cannot capture a new report', async (t) => {
  const h = await setup(t); await h.capture()
  await assert.rejects(h.reports.capture(packageId, { type: 'ENVIRONMENT', description: 'x', studentId: null }, { ...sample, boot: '4' }, h.uuid))
  for (const state of ['DESACTUALIZADO', 'INCOMPLETA'] as const) {
    await h.repo.setState(packageId, state); await assert.rejects(h.capture())
  }
  await h.repo.setState(packageId, 'PREPARADO')
  await assert.rejects(h.reports.capture(packageId, { type: 'ENVIRONMENT', description: 'x', studentId: null }, { ...sample, elapsed: sample.elapsed + 3600000 }, h.uuid))
  const locked = new IncidentRepository(h.connection, h.repo, digest, () => { throw new Error('locked') })
  await assert.rejects(locked.items(), /locked/)
  assert.equal((await h.reports.items()).length, 1)
})
test('local schema fails closed without SQLCipher before any report table is created', async () => {
  class NoCipher extends TestSql {
    override async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null> {
      return sql === 'PRAGMA cipher_version' ? null : super.getFirstAsync<T>(sql, ...params)
    }
  }
  const db = new NoCipher()
  try {
    await assert.rejects(initializeCipher(db, 'ab'.repeat(32)), /SQLCipher/)
    assert.equal(db.native.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='incident_events'").get()?.n, 0)
  } finally { await db.closeAsync() }
})
test('incident sync preserves the existing HU37 queue, UUID and pending count', async (t) => {
  const h = await setup(t), entry = await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample, h.uuid, provider)
  const outbox = new OutboxRepository(h.connection, binding, digest); await outbox.reconcile()
  const before = await outbox.pending()
  await h.capture()
  await new IncidentSync(h.reports, { sync: async (_e, json, hash) => ack(json, hash) }, () => binding, h.uuid).run()
  assert.deepEqual(await outbox.pending(), before)
  assert.deepEqual(await h.repo.event('42', '101'), entry)
  assert.equal(await h.repo.pendingCount(), 1)
})
test('only a contextual cached owner permission permits a draft, never an official offline infraction', async (t) => {
  const h = await setup(t), form = { studentId: '101', type: 'COPYING', description: 'Borrador sintético' }
  await assert.rejects(h.reports.saveDraft(packageId, form, sample, h.uuid), /docente responsable/)
  await h.reports.rememberOwner(packageId, { ...permission, manage: false }, sample)
  await assert.rejects(h.reports.saveDraft(packageId, form, sample, h.uuid))
  await h.reports.rememberOwner(packageId, { ...permission, observedAt: '2030-01-01T00:02:00Z' }, sample)
  const draft = await h.reports.saveDraft(packageId, form, sample, h.uuid)
  assert.equal((await h.reports.drafts())[0]?.id, draft.id)
  assert.equal((await h.reports.items()).length, 0)
  await assert.rejects(h.db.runAsync('UPDATE infraction_drafts SET payload=?', '{}'), /IMMUTABLE_DRAFT/)
  await h.reports.beginDraft(draft.id); await h.reports.recoverInterrupted()
  await assert.rejects(h.reports.beginDraft(draft.id), /incierto/)
  await h.reports.rememberOwner(packageId, { ...permission, manage: false, observedAt: '2030-01-01T00:03:00Z' }, sample)
  await h.reports.rememberOwner(packageId, { ...permission, observedAt: '2030-01-01T00:02:00Z' }, sample)
  assert.equal(await h.reports.canDraft(packageId, sample), false) // A delayed positive response cannot restore a known denied grant.
  await assert.rejects(h.reports.saveDraft(packageId, form, sample, h.uuid))
})
test('collaborator client permissions forbid infracting, expelling, annulling and changing statuses before dispatch', async () => {
  const calls: string[] = [], api = new DisciplineApi({ request: async (path) => { calls.push(path); throw new Error('Must not dispatch') } })
  const collaborator = { ...permission, manage: false }
  await assert.rejects(api.infractions('42', collaborator))
  await assert.rejects(api.createInfraction('42', collaborator, { studentId: 101, type: 'COPYING', description: 'x' }))
  await assert.rejects(api.expel('42', collaborator, 101, 'x'))
  await assert.rejects(api.annul('42', collaborator, 1, 'x'))
  await assert.rejects(api.changeStatus('42', collaborator, 1, 'CONFIRMED', 'x', 1))
  assert.deepEqual(calls, [])
})
test('teacher API uses exact online create/status/annulment contracts and revision without local sanctions', async () => {
  const calls: { path: string; options?: Omit<RequestOptions, 'token'> }[] = []
  const infraction = { id: 1, exam_id: 42, student: { id: 101, first_names: 'Ana', last_names: 'Prueba', sis_code: '101' }, type: 'COPYING', description: 'Prueba', status: 'REPORTED', revision: 5, allowed_statuses: ['CONFIRMED', 'RESOLVED'] }
  const port: PrivateApi = { request: async (path, options) => {
    calls.push({ path, options })
    if (path.endsWith('/annulment')) return { data: { entry: { id: 9, status: 'ANNULLED' } } }
    if (path.endsWith('/expulsions')) return { data: { id: 7, exam_id: 42, student_id: 101, status: 'EXPELLED' } }
    if (path.endsWith('/infractions') && !options?.method) return { data: [infraction], meta: { current_page: 1, last_page: 1 } }
    return { data: infraction }
  } }
  const api = new DisciplineApi(port)
  assert.equal((await api.infractions('42', permission)).data[0]?.id, 1)
  await api.createInfraction('42', permission, { studentId: 101, type: 'COPYING', description: ' Prueba ' })
  await api.changeStatus('42', permission, 1, 'CONFIRMED', 'Motivo', 5)
  await api.expel('42', permission, 101, 'Motivo')
  await api.annul('42', permission, 9, 'Motivo')
  assert.deepEqual(calls[1]?.options?.body, { student_id: 101, type: 'COPYING', description: 'Prueba' })
  assert.equal(calls[2]?.options?.method, 'PATCH')
  assert.deepEqual(calls[2]?.options?.body, { status: 'CONFIRMED', reason: 'Motivo', expected_revision: 5 })
  assert.deepEqual(calls[4]?.options?.body, { reason: 'Motivo' }) // No `confirmed` field on /annulment.
})
