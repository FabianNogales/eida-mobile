import type { QrScanState } from '../features/scanner/scanSession'
import type { SyncItem, OutboxState } from '../features/offline/sync/contracts'
import type { IncidentItem, IncidentState } from '../features/incidents/contracts'
import { description } from '../features/incidents/contracts'
import { instant } from '../utils/dates'
import type { Tone } from './presentation'

export const localEntrySavedMessage = 'INGRESO GUARDADO EN EL DISPOSITIVO — PENDIENTE DE SINCRONIZACIÓN'
export interface OperationLabel { label: string; icon: string; tone: Tone }
export const entryStates: readonly OutboxState[] = ['PENDING', 'SENDING', 'CONFIRMED', 'DUPLICATE', 'CONFLICT', 'REJECTED']
export const entryLabels: Record<OutboxState, OperationLabel> = {
  PENDING: { label: 'PENDING · Pendiente', icon: '…', tone: 'warning' },
  SENDING: { label: 'SENDING · Enviando', icon: '↑', tone: 'info' },
  CONFIRMED: { label: 'ACCEPTED · Nuevo ingreso confirmado', icon: '✓', tone: 'success' },
  DUPLICATE: { label: 'DUPLICATE · Ingreso existente', icon: '↺', tone: 'info' },
  CONFLICT: { label: 'CONFLICT · Requiere revisión', icon: '!', tone: 'warning' },
  REJECTED: { label: 'REJECTED · Rechazado', icon: '×', tone: 'error' },
}
export function entryDelivery(item: SyncItem): OperationLabel {
  const receipt = item.receipt?.event_id === item.eventId ? item.receipt : null
  if (receipt) return entryLabels[receipt.status === 'ACCEPTED' ? 'CONFIRMED' : receipt.status]
  if (item.state === 'CONFIRMED' || item.state === 'DUPLICATE') return { label: 'Resultado sin recibo comprobable', icon: '?', tone: 'warning' }
  return entryLabels[item.state]
}
export const incidentStates: readonly IncidentState[] = ['PENDING', 'SENDING', 'REGISTERED', 'CONFLICT', 'REJECTED']
export const incidentLabels: Record<IncidentState, OperationLabel> = {
  PENDING: { label: 'Reporte pendiente', icon: '…', tone: 'warning' },
  SENDING: { label: 'Enviando reporte', icon: '↑', tone: 'info' },
  REGISTERED: { label: 'Reporte registrado en Laravel', icon: '✓', tone: 'success' },
  CONFLICT: { label: 'Conflicto · revisar reporte', icon: '!', tone: 'warning' },
  REJECTED: { label: 'Reporte rechazado', icon: '×', tone: 'error' },
}
export function incidentDelivery(item: IncidentItem): OperationLabel {
  const receipt = item.receipt
  if (receipt && receipt.event_id === item.event.event_id && receipt.request_hash === item.hash) return incidentLabels[receipt.status]
  return item.state === 'REGISTERED' ? { label: 'Reporte sin recibo comprobable', icon: '?', tone: 'warning' } : incidentLabels[item.state]
}
export function scanPresentation(state: QrScanState): OperationLabel {
  switch (state.phase) {
    case 'checking': return { label: 'Comprobando autorización local', icon: '…', tone: 'info' }
    case 'idle': return { label: 'Listo para iniciar lectura', icon: '○', tone: 'neutral' }
    case 'scanning': return { label: 'Cámara en lectura', icon: '○', tone: 'info' }
    case 'detected': return { label: 'QR detectado · cámara pausada', icon: '…', tone: 'info' }
    case 'verifying': return { label: 'Verificando firma, vigencia, examen y lista', icon: '…', tone: 'info' }
    case 'review': return { label: 'QR v3 autenticado · revisa la identidad', icon: '✓', tone: 'success' }
    case 'saving': return { label: 'Guardando provisional en el dispositivo', icon: '…', tone: 'info' }
    case 'saved': return { label: 'Guardado localmente · consulta el recibo', icon: '…', tone: 'warning' }
    case 'duplicate': return { label: 'Operación local ya existente', icon: '↺', tone: 'warning' }
    case 'error': return { label: 'No se validó la lectura', icon: '×', tone: 'error' }
    case 'blocked': return { label: 'Acceso local bloqueado', icon: '!', tone: 'error' }
    case 'closed': return { label: 'Lectura detenida', icon: '○', tone: 'neutral' }
  }
}
export function queueKnown(runtime: unknown, observedRuntime: unknown, busy: boolean) {
  return runtime != null && (!busy || runtime === observedRuntime)
}
export function latestEntryAttempt(items: readonly Pick<SyncItem, 'lastAttemptAt'>[]): string | null {
  let latest: string | null = null, latestMs = -Infinity
  for (const item of items) if (item.lastAttemptAt) {
    const time = instant(item.lastAttemptAt)
    if (Number.isFinite(time) && time > latestMs) { latest = item.lastAttemptAt; latestMs = time }
  }
  return latest
}
export function reportDescriptionError(body: string): string | null {
  try { description(body); return null } catch (error) { return error instanceof Error ? error.message : 'Revisa la descripción.' }
}
