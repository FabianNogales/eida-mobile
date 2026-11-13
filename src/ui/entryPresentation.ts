import type { OfflineStudent, PackageRecord, PreparationState, ProvisionalEvent } from '../features/offline/contracts'
import type { SyncItem } from '../features/offline/sync/contracts'
import type { Tone } from './presentation'

type Status = { label: string; tone: Tone }

export function studentEligibility(student: Pick<OfflineStudent, 'student_status' | 'enrollment_status' | 'eligibility_status'>): Status {
  if (student.student_status !== 'ACTIVE') return { label: 'Inhabilitado', tone: 'error' }
  if (!student.enrollment_status || !student.eligibility_status) return { label: 'Habilitación por confirmar', tone: 'neutral' }
  return student.enrollment_status === 'ACTIVE' && student.eligibility_status === 'ELIGIBLE'
    ? { label: 'Habilitado', tone: 'success' } : { label: 'Inhabilitado', tone: 'error' }
}

export function entryResult(event: Pick<ProvisionalEvent, 'event_id'>, item?: SyncItem, duplicate = false) {
  const own = item?.eventId === event.event_id ? item : undefined
  const receipt = own?.receipt?.event_id === event.event_id ? own.receipt : null
  if (receipt?.status === 'ACCEPTED' && receipt.entry_id !== null && !receipt.review_required) {
    return { title: duplicate ? 'Ingreso ya confirmado' : 'Ingreso confirmado', message: 'Confirmado por el servidor.', tone: 'success' as const }
  }
  if (receipt?.status === 'DUPLICATE' && receipt.entry_id !== null && !receipt.review_required) {
    return { title: 'Ingreso duplicado', message: 'El servidor ya tenía un ingreso para este estudiante.', tone: 'info' as const }
  }
  if (receipt?.status === 'REJECTED' || own?.state === 'REJECTED') {
    return { title: 'Ingreso rechazado', message: 'Consulta el motivo en el detalle del registro.', tone: 'error' as const }
  }
  if (receipt?.status === 'CONFLICT' || own?.state === 'CONFLICT') {
    return { title: 'Ingreso en revisión', message: 'Hay un conflicto en el registro. Consulta el detalle.', tone: 'warning' as const }
  }
  if (receipt || own?.state === 'CONFIRMED' || own?.state === 'DUPLICATE') {
    return { title: 'Resultado por comprobar', message: 'El registro aún no tiene un recibo válido.', tone: 'warning' as const }
  }
  return { title: duplicate ? 'Ingreso ya registrado' : 'Ingreso registrado', message: 'Pendiente de sincronización', tone: 'warning' as const }
}

const preparationCopy: Record<PreparationState, Status & { message: string }> = {
  NO_DESCARGADO: { label: 'Lista no preparada', message: 'Prepárala antes de perder la conexión.', tone: 'neutral' },
  DESCARGANDO: { label: 'Preparando lista', message: 'Descargando y verificando los datos de tu lista.', tone: 'info' },
  INCOMPLETA: { label: 'Preparación incompleta', message: 'Reintenta con conexión para terminar la descarga.', tone: 'warning' },
  PREPARADO: { label: 'Lista preparada', message: 'Tu lista está disponible para trabajar sin internet.', tone: 'success' },
  DESACTUALIZADO: { label: 'Lista desactualizada', message: 'Prepara una copia vigente antes de controlar ingresos.', tone: 'warning' },
  VENCIDO: { label: 'Información vencida', message: 'Prepara una copia vigente con conexión.', tone: 'error' },
  ERROR: { label: 'Error al preparar la lista', message: 'Puedes volver a intentar la preparación.', tone: 'error' },
}

export function preparationPresentation({ authorized, unlocked, downloading, checked, latest, failed }: {
  authorized: boolean; unlocked: boolean; downloading: boolean; checked: PackageRecord | null
  latest?: PackageRecord; failed: boolean
}) {
  if (!authorized) return { label: 'Lista sin autorización', message: 'El examen no tiene una lista disponible para tu cuenta.', tone: 'warning' as const, ready: false }
  if (!unlocked) return { label: 'Lista protegida', message: 'Desbloquea el almacén para consultar su estado.', tone: 'neutral' as const, ready: false }
  const ready = !downloading && checked?.active === true && checked.state === 'PREPARADO'
  const state = downloading ? 'DESCARGANDO' : ready ? 'PREPARADO' : latest?.state === 'PREPARADO' ? 'ERROR' :
    failed && (!latest || latest.state === 'NO_DESCARGADO') ? 'ERROR' : latest?.state ?? 'NO_DESCARGADO'
  return { ...preparationCopy[state], ready }
}

export function scanIssue(message: string) {
  if (message.includes('SUBJECT_EXAM_MISMATCH')) return 'Este QR corresponde a otro examen.'
  if (message.includes('TIME_INVALID')) return 'El QR está vencido o todavía no es válido.'
  if (message.includes('no pertenece a tu lista')) return 'El estudiante no pertenece a tu lista.'
  if (message.includes('ya informaba un ingreso')) return 'La copia ya registra un ingreso para este estudiante.'
  if (/UNKNOWN_KID|CRYPTO_UNAVAILABLE|CONTEXT_INVALID|QR v2|no ofrece QR v3/.test(message)) {
    return 'Este QR no se puede verificar sin conexión. Usa la búsqueda manual.'
  }
  if (/^QR rechazado:|^QR malformado/.test(message)) return 'El QR no es válido. Escanea otro código o busca al estudiante.'
  return message
}
