import { integer, object, text } from '../../../services/http/schema'
import { id, timestamp, uuid } from '../manifest'
import type { OfflineBinding } from '../contracts'
import type { PendingEvent, WireBatch, WireContext } from './contracts'

const safeTime = (v: unknown) => integer(v, 0)
export function projectEvent(value: unknown, packageBinding: OfflineBinding): { context: WireContext; wire: WireBatch['events'][number]; needsQrV3: boolean } {
  const e = object(value), t = object(e.time_evidence)
  if (e.method !== 'MANUAL' && e.method !== 'QR') throw new Error('Método local desconocido; se conserva la evidencia.')
  if (t.source !== 'SERVER_ANCHORED_ESTIMATE' || !/^[0-9]{1,40}$/.test(text(t.boot))) throw new Error('La referencia horaria local no es compatible.')
  if (text(e.device_id) !== packageBinding.installationId) throw new Error('La operación pertenece a otra instalación.')
  const context: WireContext = { protocol_version: 2, exam_id: id(e.exam_id), package_id: uuid(e.package_id), list_id: id(e.list_id), version: integer(e.version), room_id: id(e.room_id) }
  const wire: WireBatch['events'][number] = { event_id: uuid(e.event_id), student_id: id(e.student_id), method: e.method,
    captured_at: timestamp(e.captured_at), device_id: text(e.device_id),
    time_evidence: { serverMs: safeTime(t.serverMs), boot: text(t.boot), elapsed: safeTime(t.elapsed),
      capturedElapsed: safeTime(t.capturedElapsed), source: 'SERVER_ANCHORED_ESTIMATE' } }
  if (e.method === 'QR') {
    const token = text(e.qr_token)
    if (!token || token.length > 4096) throw new Error('La evidencia QR local está incompleta.')
    wire.qr_token = token
  }
  return { context, wire, needsQrV3: e.method === 'QR' && e.sync_compatibility === 'QR_V3_REQUIRES_BACKEND_EXTENSION' }
}
export function buildBatch(events: PendingEvent[]): WireBatch {
  const first = events[0]
  if (!first || events.length > 100 || events.some((e) => JSON.stringify(e.context) !== JSON.stringify(first.context))) throw new Error('Lote local incompatible.')
  const { package_id, list_id, version, room_id } = first.context
  return { protocol_version: 2, package_id, list_id, version, room_id, events: events.map((e) => e.wire) }
}
