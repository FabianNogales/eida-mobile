import type { DistributionContext, Manifest, OfflineStudent, PackageRecord, PreparationState } from '../features/offline/contracts'
import type { SyncItem } from '../features/offline/sync/contracts'
import type { IncidentItem } from '../features/incidents/contracts'
import { eligible } from '../features/offline/identity'
import { pendingSummary } from './pendingSummary'
import type { Tone } from './presentation'

export const preparationLabels: Record<PreparationState, { label: string; tone: Tone }> = {
  NO_DESCARGADO: { label: 'No descargada', tone: 'neutral' },
  DESCARGANDO: { label: 'Descargando y verificando', tone: 'info' },
  INCOMPLETA: { label: 'Descarga incompleta', tone: 'warning' },
  PREPARADO: { label: 'Lista preparada', tone: 'success' },
  DESACTUALIZADO: { label: 'Copia desactualizada', tone: 'warning' },
  VENCIDO: { label: 'Vigencia finalizada', tone: 'error' },
  ERROR: { label: 'Error de preparación', tone: 'error' },
}
export function packageActions(p: Pick<PackageRecord, 'active' | 'state'>, unlocked: boolean, online: boolean) {
  return { open: unlocked && p.active && p.state === 'PREPARADO',
    resume: unlocked && online && !p.active && p.state !== 'VENCIDO' && p.state !== 'DESACTUALIZADO',
    revalidate: unlocked && online && p.active }
}
export function distributionAccess(c: DistributionContext, unlocked: boolean) {
  return { supervise: c.can_prepare, ownList: c.lists.find((list) => list.list_id === c.own_list_id) ?? null,
    prepare: c.can_prepare && !c.stale && !c.unavailable_reason,
    download: !!c.own_list_id && unlocked && !c.stale && !c.unavailable_reason,
    lists: c.can_prepare ? c.lists : c.lists.filter((list) => list.list_id === c.own_list_id) }
}
export function ownExamPackages(c: DistributionContext, packages: readonly PackageRecord[], unlocked: boolean) {
  return unlocked && c.own_list_id ? packages.filter((p) => p.examId === String(c.exam.id) && p.manifest.list_id === c.own_list_id) : []
}
export function examPendingSummary(examId: string, unlocked: boolean, entries: readonly SyncItem[], incidents: readonly IncidentItem[]) {
  return pendingSummary(unlocked, entries.filter((e) => e.examId === examId), incidents.filter((e) => e.event.exam_id === examId))
}
export function manifestPhotoSummary(manifest: Pick<Manifest, 'students'>) {
  let present = 0, absent = 0
  for (const student of manifest.students) for (const photo of student.photos) {
    if (photo.state === 'PRESENT') present++; else absent++
  }
  return { present, absent }
}
export function studentPhotoLabel(student: Pick<OfflineStudent, 'photos'>) {
  if (student.photos.some((p) => p.state === 'PRESENT')) return 'Fotografía disponible en la ficha'
  return student.photos.length > 0 && student.photos.every((p) => p.state === 'ABSENT')
    ? 'Ausencia de fotografías informada por el servidor' : 'Disponibilidad de fotografía no informada'
}
export function studentEntryLabel(student: Pick<OfflineStudent, 'entry_status'>, item?: SyncItem): { label: string; tone: Tone } {
  const receipt = item?.receipt?.event_id === item?.eventId ? item?.receipt : null
  if (receipt?.status === 'ACCEPTED') return { label: 'Ingreso confirmado por el servidor', tone: 'success' }
  if (receipt?.status === 'DUPLICATE') return { label: 'Ingreso existente · duplicado informado', tone: 'info' }
  if (receipt?.status === 'CONFLICT' || item?.state === 'CONFLICT') return { label: 'Conflicto · revisar sincronización', tone: 'warning' }
  if (receipt?.status === 'REJECTED' || item?.state === 'REJECTED') return { label: 'Rechazado · sin nuevo ingreso confirmado', tone: 'error' }
  if (item) return { label: 'Registro local · sin nueva confirmación oficial', tone: 'warning' }
  return student.entry_status === 'REGISTERED' ? { label: 'Ingreso informado en la copia', tone: 'info' }
    : { label: 'Sin ingreso en la copia', tone: 'neutral' }
}
export function manualAvailability(student: OfflineStudent, hasLocalEvent: boolean) {
  if (hasLocalEvent) return { allowed: false, reason: 'Ya existe una operación local. Revisa su resultado en Sincronización.' }
  try { eligible(student); return { allowed: true, reason: null } }
  catch (error) { return { allowed: false, reason: error instanceof Error ? error.message : 'La copia no permite registrar este ingreso.' } }
}
export function packageViewAllowed(p: PackageRecord | null, packageId: string, sameRuntime: boolean, blocked: boolean) {
  return !!p && p.id === packageId && sameRuntime && !blocked && p.active && p.state === 'PREPARADO'
}
export function searchPageMatches<Runtime>(page: { runtime: Runtime; term: string; offset: number } | null,
  runtime: Runtime, term: string, searchedTerm: string, offset: number) {
  return !!page && page.runtime === runtime && page.term === searchedTerm && page.offset === offset && term === searchedTerm
}
export function listDestination(packageId: string, search = false) {
  return { pathname: '/offline/list' as const, params: { packageId, ...(search ? { focusSearch: '1' } : {}) } }
}
export function scanDestination(packageId: string) { return { pathname: '/offline/scan' as const, params: { packageId } } }
