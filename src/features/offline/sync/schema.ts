import { array, boolean, integer, object, text } from '../../../services/http/schema'
import { timestamp, uuid } from '../manifest'
import type { ReceiptStatus, SyncCapabilities, SyncReceipt } from './contracts'

export function receiptStatus(v: unknown): ReceiptStatus {
  if (v === 'ACCEPTED' || v === 'DUPLICATE' || v === 'CONFLICT' || v === 'REJECTED') return v
  throw new Error('Estado de recibo desconocido. Se conservaron los pendientes.')
}
export function parseReceipt(value: unknown): SyncReceipt {
  const r = object(value), status = receiptStatus(r.status), code = text(r.code), message = text(r.message)
  const entryId = r.entry_id === null ? null : integer(r.entry_id), review = boolean(r.review_required)
  if (!/^[A-Z0-9_]{1,80}$/.test(code) || message.length > 2000 ||
      ((status === 'ACCEPTED' || status === 'DUPLICATE') ? entryId === null || review : entryId !== null) ||
      (status === 'CONFLICT' && !review)) throw new Error('El recibo no contiene una confirmación coherente.')
  return { event_id: uuid(r.event_id), status, code, message, entry_id: entryId, review_required: review, received_at: timestamp(r.received_at) }
}
export function parseSyncResponse(value: unknown, examId: string, expectedIds: string[]): SyncReceipt[] {
  const data = object(object(value).data)
  if (String(integer(data.exam_id)) !== examId || data.protocol_version !== 2) throw new Error('La respuesta no corresponde al protocolo y examen enviados.')
  const receipts = array(data.results, parseReceipt), expected = new Set(expectedIds.map((id) => id.toLowerCase())), seen = new Set<string>()
  for (const r of receipts) {
    const id = r.event_id.toLowerCase()
    if (!expected.has(id) || seen.has(id)) throw new Error('La respuesta contiene UUID ajenos o repetidos. Se conservaron los pendientes.')
    seen.add(id)
  }
  return receipts // A valid subset is persisted; absent UUIDs stay pending.
}
export function parseCapabilities(value: unknown): SyncCapabilities {
  const d = object(object(value).data)
  const protocols = array(d.protocol_versions, (v) => integer(v)), maxEvents = integer(d.max_events), qrVersions = array(d.qr_versions, (v) => integer(v))
  if (maxEvents > 100 || d.late_policy !== 'REVIEW_ONLY' || d.time_evidence !== 'DEVICE_DECLARED_NOT_ATTESTED') {
    throw new Error('El servidor no anuncia un contrato de evidencia compatible.')
  }
  return { protocols, maxEvents, qrVersions, lateEvidence: boolean(d.late_evidence) }
}
