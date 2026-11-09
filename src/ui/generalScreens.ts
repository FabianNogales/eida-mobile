import type { SessionSnapshot } from '../features/auth/contracts'
import { canAccessPrivate } from '../features/auth/guards'
import type { ExamPage, TeacherExam } from '../features/exams/api'
import type { PackageRecord } from '../features/offline/contracts'
import type { Tone } from './presentation'
import type { pendingSummary } from './pendingSummary'

export function loginPresentation(session: SessionSnapshot, hasController: boolean) {
  const destination: '/(private)' | '/session' | null = canAccessPrivate(session) ? '/(private)' : session.status === 'initializing' ||
    (hasController && (session.status === 'recoverable-error' || (session.status === 'offline' && session.hasCredential))) ? '/session' : null
  return { destination, disabled: !hasController || session.busy || session.hasCredential,
    loading: session.status === 'authenticating',
    message: session.message ?? (session.status === 'expired' ? 'Tu sesión venció. Vuelve a ingresar.' : null) }
}
export function userInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return [words[0]?.[0], words.length > 1 ? words[words.length - 1]?.[0] : undefined].filter(Boolean).join('').toLocaleUpperCase('es')
}
export function orderedExams(exams: readonly TeacherExam[]): TeacherExam[] {
  return [...exams].sort((a, b) => Number(b.status === 'IN_PROGRESS') - Number(a.status === 'IN_PROGRESS'))
}
export function homeExamOverview(page: ExamPage | null) {
  const rows = orderedExams(page?.data ?? [])
  return { active: rows.find((exam) => exam.status === 'IN_PROGRESS') ?? null,
    first: rows[0] ?? null, total: page?.total ?? null }
}
export function examDestination(id: number) {
  return { pathname: '/(private)/offline-distribution' as const, params: { examId: String(id) } }
}
export function examIncidentsDestination(id: number) {
  return { pathname: '/(private)/incidents' as const, params: { examId: String(id) } }
}
export function examStatus(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'IN_PROGRESS': return { label: 'En desarrollo', tone: 'success' }
    case 'SCHEDULED': return { label: 'Programado', tone: 'info' }
    case 'COMPLETED': case 'FINISHED': return { label: 'Finalizado', tone: 'neutral' }
    case 'CANCELLED': return { label: 'Cancelado', tone: 'error' }
    case 'DRAFT': return { label: 'Borrador', tone: 'neutral' }
    default: return { label: status, tone: 'neutral' }
  }
}
export function offlineExamState(examId: number, unlocked: boolean,
  packages: readonly Pick<PackageRecord, 'active' | 'examId' | 'state'>[]): { label: string; tone: Tone } {
  if (!unlocked) return { label: 'Almacén bloqueado', tone: 'neutral' }
  const copies = packages.filter((p) => p.active && p.examId === String(examId))
  if (copies.some((p) => p.state === 'PREPARADO')) return { label: 'Copia local preparada', tone: 'info' }
  const copy = copies[0]
  if (!copy) return { label: 'Sin lista offline local', tone: 'neutral' }
  const labels = { NO_DESCARGADO: 'Sin descargar', DESCARGANDO: 'Descarga en curso', INCOMPLETA: 'Descarga incompleta',
    PREPARADO: 'Copia local preparada', DESACTUALIZADO: 'Copia desactualizada', VENCIDO: 'Copia vencida', ERROR: 'Error de preparación' }
  return { label: labels[copy.state], tone: 'warning' }
}
export function logoutConfirmation(summary: ReturnType<typeof pendingSummary>): string {
  const pending = summary ? `${summary.pending} operaciones por enviar y ${summary.attention} conflictos o rechazos en el almacén abierto.`
    : 'El almacén está bloqueado; no se puede comprobar cuántas operaciones quedan pendientes.'
  return `${pending} Cerrar sesión no sincroniza ni elimina los eventos cifrados. Para acceder de nuevo deberás validar con internet la misma cuenta y desbloquear su almacén. ¿Cerrar sesión?`
}
