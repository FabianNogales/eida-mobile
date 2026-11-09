import { array, boolean, integer, nullableText, object, text } from '../../services/http/schema'
import { protocolError } from '../../services/http/errors'
import { id, timestamp, uuid } from '../offline/manifest'
import type { ProvisionalEvent } from '../offline/contracts'

export const incidentTypes = [
  { value: 'IDENTIFICATION', label: 'Identificación' },
  { value: 'SUSPECTED_IMPERSONATION', label: 'Sospecha de suplantación' },
  { value: 'INELIGIBILITY', label: 'Habilitación observada' },
  { value: 'WRONG_EXAM', label: 'QR de otro examen' },
  { value: 'ENVIRONMENT', label: 'Ambiente del examen' },
] as const
export type IncidentType = typeof incidentTypes[number]['value']
export const infractionTypes = [{ value: 'COPYING', label: 'Copia' }, { value: 'CHEATING', label: 'Trampa' }, { value: 'IMPERSONATION', label: 'Suplantación de identidad' }] as const
export type InfractionType = typeof infractionTypes[number]['value']
export type InfractionStatus = 'REPORTED' | 'CONFIRMED' | 'RESOLVED'
export const statusLabels: Readonly<Record<string, string>> = { REPORTED: 'Reportada', REGISTERED: 'Registrada', OPEN: 'Abierta', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelta', CLOSED: 'Cerrada', CONFIRMED: 'Confirmada' }
export function incidentType(value: unknown): IncidentType {
  if (value === 'IDENTIFICATION' || value === 'SUSPECTED_IMPERSONATION' || value === 'INELIGIBILITY' || value === 'WRONG_EXAM' || value === 'ENVIRONMENT') return value
  throw protocolError()
}
export function infractionType(value: unknown): InfractionType {
  if (value === 'COPYING' || value === 'CHEATING' || value === 'IMPERSONATION') return value
  throw protocolError()
}
export function infractionStatus(value: unknown): InfractionStatus {
  if (value === 'REPORTED' || value === 'CONFIRMED' || value === 'RESOLVED') return value
  throw protocolError()
}
export function description(value: unknown): string {
  const result = text(value).trim()
  if (!result || result.length > 4000) throw new Error('Describe lo sucedido, con un máximo de 4000 caracteres para el reporte local.')
  return result
}
export interface IncidentEvent {
  v: 1; event_id: string; exam_id: string; package_id: string; actor_id: string; mobile_device_id: string; installation_id: string
  student_id: string | null; type: IncidentType; description: string; captured_at: string; time_evidence: ProvisionalEvent['time_evidence']
}
export interface IncidentReceipt {
  event_id: string; request_hash: string; status: 'REGISTERED' | 'CONFLICT' | 'REJECTED'; code: string
  incident_id: number | null; review_required: boolean; received_at: string
}
export type IncidentState = 'PENDING' | 'SENDING' | IncidentReceipt['status']
export const deliveryLabels: Record<IncidentState, string> = { PENDING: 'PENDIENTE DE SINCRONIZACIÓN', SENDING: 'ENVIANDO', REGISTERED: 'REGISTRADA EN SERVIDOR', CONFLICT: 'CONFLICTO', REJECTED: 'RECHAZADA' }
export interface IncidentItem { event: IncidentEvent; hash: string; state: IncidentState; attempts: number; errorCode: string | null; receipt: IncidentReceipt | null }
export function parseEvent(value: unknown): IncidentEvent {
  const e = object(value), t = object(e.time_evidence)
  if (e.v !== 1 || t.source !== 'SERVER_ANCHORED_ESTIMATE' || !/^\d{1,20}$/.test(text(t.boot))) throw protocolError()
  const result: IncidentEvent = { v: 1, event_id: uuid(e.event_id), exam_id: id(e.exam_id), package_id: uuid(e.package_id), actor_id: id(e.actor_id),
    mobile_device_id: id(e.mobile_device_id), installation_id: uuid(e.installation_id), student_id: e.student_id === null ? null : id(e.student_id),
    type: incidentType(e.type), description: description(e.description), captured_at: timestamp(e.captured_at),
    time_evidence: { serverMs: integer(t.serverMs, 0), boot: text(t.boot), elapsed: integer(t.elapsed, 0), capturedElapsed: integer(t.capturedElapsed, 0), source: 'SERVER_ANCHORED_ESTIMATE' } }
  if (Object.keys(e).length !== 12 || Object.keys(t).length !== 5 || result.description !== e.description ||
      result.event_id !== result.event_id.toLowerCase() || result.package_id !== result.package_id.toLowerCase() ||
      result.installation_id !== result.installation_id.toLowerCase()) throw protocolError()
  return result
}
export function parseReceipt(value: unknown): IncidentReceipt {
  const r = object(value)
  if (!/^[a-f0-9]{64}$/.test(text(r.request_hash)) || !['REGISTERED', 'CONFLICT', 'REJECTED'].includes(text(r.status))) throw protocolError()
  const status = r.status
  if (status !== 'REGISTERED' && status !== 'CONFLICT' && status !== 'REJECTED') throw protocolError()
  const incident = r.incident_id === null ? null : integer(r.incident_id)
  if ((status === 'REGISTERED') !== (incident !== null)) throw protocolError()
  return { event_id: uuid(r.event_id), request_hash: text(r.request_hash), status, code: text(r.code), incident_id: incident,
    review_required: boolean(r.review_required), received_at: timestamp(r.received_at) }
}
export interface Person { id: number; first_names: string; last_names: string; sis_code: string }
export function person(value: unknown): Person { const s = object(value); return { id: integer(s.id), first_names: text(s.first_names), last_names: text(s.last_names), sis_code: text(s.sis_code) } }
export interface OfficialIncident { id: string; examId: number; type: IncidentType; description: string; student: Person | null; status: string; reportedAt: string; reporter: string | null }
export function officialIncident(value: unknown): OfficialIncident {
  const r = object(value), recordId = typeof r.id === 'number' ? String(integer(r.id)) : text(r.id)
  if (!/^(?:qr-)?[1-9][0-9]*$/.test(recordId)) throw protocolError()
  return { id: recordId, examId: integer(r.exam_id), type: incidentType(r.type), description: text(r.description), student: r.student === null ? null : person(r.student),
    status: text(r.status), reportedAt: timestamp(r.reported_at), reporter: r.reported_by === null ? null : nullableText(object(r.reported_by).name) }
}
export interface OfficialInfraction { id: number; examId: number; student: Person; type: InfractionType; description: string; status: InfractionStatus; revision: number; allowed: InfractionStatus[] }
export function officialInfraction(value: unknown): OfficialInfraction {
  const r = object(value)
  return { id: integer(r.id), examId: integer(r.exam_id), student: person(r.student), type: infractionType(r.type), description: text(r.description),
    status: infractionStatus(r.status), revision: integer(r.revision, 0), allowed: array(r.allowed_statuses, infractionStatus) }
}
