import { harnessOffline, manifest, envelope, anchor, binding, digest, sample } from './offlineFixtures'
import { OutboxRepository } from '../../src/features/offline/sync/outbox'
import type { ProvisionalEvent } from '../../src/features/offline/contracts'
import type { ReceiptStatus, SyncCapabilities, SyncReceipt, WireBatch } from '../../src/features/offline/sync/contracts'

export const at = '2030-01-01T00:02:00.000Z'
export const capabilities: SyncCapabilities = { protocols: [1, 2], maxEvents: 100, qrVersions: [2], lateEvidence: true }
export function sequence() {
  let value = 0
  return () => `00000000-0000-4000-8000-${(++value).toString(16).padStart(12, '0')}`
}
export function ack(event: WireBatch['events'][number], status: ReceiptStatus = 'ACCEPTED'): SyncReceipt {
  return { event_id: event.event_id, status, code: { ACCEPTED: 'ENTRY_REGISTERED', DUPLICATE: 'ALREADY_REGISTERED', CONFLICT: 'EXAM_ENDED', REJECTED: 'INVALID_QR' }[status],
    message: 'Resultado sintético del servidor', entry_id: status === 'ACCEPTED' || status === 'DUPLICATE' ? 123 : null,
    review_required: status === 'CONFLICT', received_at: at }
}
export async function syncHarness(count = 1, qrLast = false, captureCount = count) {
  const h = await harnessOffline(), uuid = sequence(), m = manifest(), base = m.students[0]
  if (!base) throw new Error('Missing synthetic fixture')
  m.students = Array.from({ length: count }, (_, i) => ({ ...base, student_id: String(i + 101), sis_code: String(203000101 + i), identity_number: 'CI-' + (i + 101) }))
  await h.repo.stage(envelope(m), m, anchor); await h.repo.publish(m.package_id, sample)
  const originals: ProvisionalEvent[] = []
  for (const student of m.students.slice(0, captureCount)) {
    const event: ProvisionalEvent = { event_id: uuid(), exam_id: m.exam_id, package_id: m.package_id, list_id: m.list_id,
      version: m.version, room_id: m.room_id, student_id: student.student_id, method: 'MANUAL', captured_at: m.prepared_at,
      device_id: binding.installationId, local_status: 'PENDING_SYNC',
      sync_compatibility: qrLast && student === m.students.at(-1) ? 'QR_V3_REQUIRES_BACKEND_EXTENSION' : 'HU37_MANUAL_V1',
      time_evidence: { ...anchor, capturedElapsed: sample.elapsed, source: 'SERVER_ANCHORED_ESTIMATE' } }
    if (qrLast && student === m.students.at(-1)) { event.method = 'QR'; event.qr_token = 'SYNTHETIC_V3_EVIDENCE_FOR_TRANSPORT_ONLY' }
    await h.repo.append(event); originals.push(event)
  }
  const outbox = new OutboxRepository(h.connection, binding, digest)
  await outbox.reconcile()
  return { ...h, uuid, m, originals, outbox }
}
