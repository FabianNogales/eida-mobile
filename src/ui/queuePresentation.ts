import type { IncidentItem } from '../features/incidents/contracts'
import { incidentTypes } from '../features/incidents/contracts'
import { sameBinding, type OfflineBinding } from '../features/offline/contracts'
import { receiptState, type SyncItem } from '../features/offline/sync/contracts'
import { instant } from '../utils/dates'
import type { Tone } from './presentation'

export type QueueKind = 'entries' | 'incidents'
export type QueueState = 'PENDING' | 'SENDING' | 'CONFIRMED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED' | 'UNKNOWN'
export interface QueueRow {
  id: string; title: string; exam: string; examId: string; student: string | null; date: string; state: QueueState
  method?: 'MANUAL' | 'QR'; description?: string; receivedAt?: string; officialIncident?: number
  needsReview?: boolean; issue?: string
}

const statuses: Record<QueueState, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  SENDING: { label: 'Enviando', tone: 'info' },
  CONFIRMED: { label: 'Confirmado', tone: 'success' },
  DUPLICATE: { label: 'Duplicado', tone: 'info' },
  CONFLICT: { label: 'Conflicto', tone: 'warning' },
  REJECTED: { label: 'Rechazado', tone: 'error' },
  UNKNOWN: { label: 'Por verificar', tone: 'warning' },
}
export function queueStatus(kind: QueueKind, state: QueueState) {
  return kind === 'incidents' && state === 'CONFIRMED'
    ? { ...statuses.CONFIRMED, label: 'Reporte recibido' } : statuses[state]
}

const issueCopy: Readonly<Record<string, string>> = {
  NETWORK_UNAVAILABLE: 'Se perdió la conexión. El registro sigue disponible para reintentar.',
  CONNECTION_UNCONFIRMED: 'No se pudo confirmar la conexión. El registro sigue pendiente.',
  RESPONSE_TIMEOUT: 'El servidor no respondió a tiempo. Puedes reintentar.',
  RESPONSE_LOST: 'El servidor no respondió a tiempo. Puedes reintentar.',
  SESSION_REQUIRED: 'Valida la cuenta original para enviar.',
  SESSION_NOT_VALIDATED: 'Valida la cuenta original para enviar.',
  ACCESS_DENIED: 'El servidor denegó el acceso a este registro.',
  SYNC_FORBIDDEN: 'El servidor denegó el acceso a este registro.',
  PACKAGE_NOT_OWNED: 'La lista pertenece a otra cuenta.',
  MOBILE_POLICY_PENDING: 'El servidor todavía no autoriza el envío de incidencias desde el móvil.',
  MOBILE_ABILITY_REQUIRED: 'El servidor no autorizó este envío desde el móvil.',
  BACKEND_EXTENSION_REQUIRED: 'El servidor todavía no admite este tipo de envío.',
  QR_V3_UNAVAILABLE: 'El servidor todavía no admite la verificación de este QR.',
  OFFLINE_AUTHORIZATION_CHANGED: 'Cambió la autorización de la lista.',
  INCIDENT_AUTHORIZATION_REVOKED: 'La autorización para reportar incidencias fue revocada.',
  EXAM_ENDED: 'El examen ya terminó.',
  INVALID_QR: 'El servidor no pudo validar el QR.',
  SERVER_FAILURE: 'El servidor no está disponible. Puedes reintentar.',
  RATE_LIMITED: 'Espera un momento antes de reintentar.',
  PARTIAL_RESPONSE: 'El servidor aún no devolvió el resultado de este registro.',
  STUDENT_NOT_IN_PACKAGE: 'El estudiante no pertenecía a la lista autorizada.',
  EVENT_ID_REUSED: 'El servidor detectó otro registro con el mismo identificador de operación.',
}
function issue(code: string | null | undefined, terminal = false) {
  if (!code) return undefined
  return issueCopy[code] ?? (terminal ? undefined : 'El envío no se pudo completar. El registro sigue pendiente.')
}

export function entryQueueRows(items: readonly SyncItem[], actor: string): QueueRow[] {
  return items.filter((item) => item.actorId === actor).map((item) => {
    const receipt = item.receipt
    const valid = receipt && receipt.event_id.toLowerCase() === item.eventId.toLowerCase() &&
      receiptState(receipt.status) === item.state &&
      (receipt.status === 'ACCEPTED' || receipt.status === 'DUPLICATE'
        ? receipt.entry_id !== null && !receipt.review_required : receipt.entry_id === null)
      ? receipt : null
    const state = valid || item.state === 'PENDING' || item.state === 'SENDING' ? item.state : 'UNKNOWN'
    const student = 'Estudiante ' + item.studentId
    return { id: item.eventId, title: student, student, exam: 'Examen ' + item.examId, examId: item.examId, date: item.capturedAt, state,
      method: item.method, receivedAt: valid?.received_at, needsReview: valid?.review_required,
      issue: valid && (state === 'CONFLICT' || state === 'REJECTED') ? issue(valid.code, true) : issue(item.errorCode) }
  })
}

export function incidentQueueRows(items: readonly IncidentItem[], binding: OfflineBinding): QueueRow[] {
  return items.filter(({ event }) => event.actor_id === binding.userId && event.mobile_device_id === binding.deviceId &&
    event.installation_id === binding.installationId).map((item) => {
    const { event, receipt } = item
    const valid = receipt && receipt.event_id === event.event_id && receipt.request_hash === item.hash &&
      receipt.status === item.state && (receipt.status === 'REGISTERED') === (receipt.incident_id !== null) ? receipt : null
    const state = valid?.status === 'REGISTERED' ? 'CONFIRMED' : valid?.status ??
      (item.state === 'PENDING' || item.state === 'SENDING' ? item.state : 'UNKNOWN')
    return { id: event.event_id, title: incidentTypes.find(({ value }) => value === event.type)?.label ?? 'Incidencia',
      student: event.student_id === null ? null : 'Estudiante ' + event.student_id, exam: 'Examen ' + event.exam_id, examId: event.exam_id,
      date: event.captured_at, state, description: event.description, receivedAt: valid?.received_at,
      officialIncident: valid?.incident_id ?? undefined, needsReview: valid?.review_required,
      issue: valid && (state === 'CONFLICT' || state === 'REJECTED') ? issue(valid.code, true) : issue(item.errorCode) }
  })
}

export function pendingCount(rows: readonly QueueRow[] | null) {
  return rows?.filter(({ state }) => state === 'PENDING' || state === 'SENDING').length ?? null
}

export function queueCanSend(rows: readonly QueueRow[] | null, local: OfflineBinding | null, online: OfflineBinding | null,
  busy: boolean, pending = pendingCount(rows)) {
  return !busy && !!local && !!online && sameBinding(local, online) && rows !== null && pending !== null &&
    pending > rows.filter(({ state }) => state === 'SENDING').length
}

export function queueIssue(rows: readonly QueueRow[] | null, attempted: ReadonlySet<string>) {
  return rows?.find(({ id, state, issue }) => attempted.has(id) && state === 'PENDING' && issue)?.issue
}

export function queueAttemptSummary(rows: readonly QueueRow[], attempted: ReadonlySet<string>) {
  const counts = { accepted: 0, duplicates: 0, conflicts: 0, rejected: 0, pending: pendingCount(rows) ?? 0 }
  for (const { id, state } of rows) {
    if (!attempted.has(id)) continue
    if (state === 'CONFIRMED') counts.accepted++
    if (state === 'DUPLICATE') counts.duplicates++
    if (state === 'CONFLICT') counts.conflicts++
    if (state === 'REJECTED') counts.rejected++
  }
  return counts
}

const laPaz = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' })
const clock = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', timeStyle: 'short' })
export function queueDate(value: string, now = Date.now()) {
  const time = instant(value)
  if (!Number.isFinite(time)) return 'Fecha no disponible'
  const day = laPaz.format(time)
  return (day === laPaz.format(now) ? 'Hoy' : day) + ', ' + clock.format(time)
}
