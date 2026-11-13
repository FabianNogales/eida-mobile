import type { Collaboration, ExamPage, ExamView, TeacherExam } from '../features/exams/api'
import type { DisciplinePermissions } from '../features/incidents/api'
import type { DistributionContext, PackageRecord } from '../features/offline/contracts'
import { distributionAccess, ownExamPackages } from './controlScreens'
import type { Tone } from './presentation'

export function examHeading(exam: { name: string; subject_name: string | null }) {
  const subject = exam.subject_name?.trim()
  return { title: subject || exam.name, subtitle: subject && subject !== exam.name ? exam.name : null }
}
function examCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T12:00:00-04:00')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
export function naturalExamDate(value: string) {
  const date = examCalendarDate(value)
  if (!date) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}
export function briefExamStatus(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'IN_PROGRESS': return { label: 'En curso', tone: 'success' }
    case 'SCHEDULED': case 'ACTIVE': return { label: 'Programado', tone: 'info' }
    case 'COMPLETED': case 'FINISHED': return { label: 'Finalizado', tone: 'neutral' }
    case 'CANCELLED': return { label: 'Cancelado', tone: 'error' }
    case 'DRAFT': return { label: 'Borrador', tone: 'neutral' }
    default: return { label: 'Estado por confirmar', tone: 'neutral' }
  }
}
export function briefPreparation(examId: number, unlocked: boolean, packages: readonly PackageRecord[]): { label: string; tone: Tone } {
  if (!unlocked) return { label: 'Sin consultar', tone: 'neutral' }
  const own = packages.filter((p) => p.examId === String(examId))
  const current = own.find((p) => p.active && p.state === 'PREPARADO') ?? own[0]
  switch (current?.state) {
    case 'PREPARADO': return { label: current.active ? 'Lista preparada' : 'Por verificar', tone: current.active ? 'success' : 'warning' }
    case 'DESCARGANDO': return { label: 'Preparando', tone: 'info' }
    case 'INCOMPLETA': return { label: 'Incompleta', tone: 'warning' }
    case 'DESACTUALIZADO': return { label: 'Desactualizada', tone: 'warning' }
    case 'VENCIDO': return { label: 'Vencida', tone: 'error' }
    case 'ERROR': return { label: 'Error al preparar', tone: 'error' }
    default: return { label: 'Por preparar', tone: 'warning' }
  }
}
export interface HomeControl {
  id: number; name: string; subject_name: string | null; date: string; time: string; room: string | null
  relation: 'Docente responsable' | 'Colaborador'; status: string | null
}
const examsPerPage = 5
const serverExamsPerPage = 10

export function examPagination(meta: Partial<Pick<ExamPage, 'total' | 'perPage' | 'currentPage' | 'lastPage'>>, page: number) {
  const { total, perPage, currentPage, lastPage } = meta
  if (total === undefined || !Number.isSafeInteger(total) || total < 0 || perPage !== serverExamsPerPage ||
      currentPage === undefined || !Number.isSafeInteger(currentPage) || currentPage < 1 ||
      lastPage !== Math.max(1, Math.ceil(total / perPage))) return null
  const pages = Math.max(1, Math.ceil(total / examsPerPage))
  const current = Math.min(page, pages)
  return { current, pages, previous: current > 1 ? current - 1 : null, next: current < pages ? current + 1 : null }
}

export function examPageLocation(page: number) {
  const offset = (page - 1) * examsPerPage
  return { serverPage: Math.floor(offset / serverExamsPerPage) + 1, offset: offset % serverExamsPerPage, size: examsPerPage }
}

function examStart(exam: TeacherExam): number {
  const { exam_date: date, start_time: time } = exam
  if (!examCalendarDate(date) || !validExamTime(time)) return NaN
  // The API returns a local calendar date and time in America/La_Paz.
  return Date.parse(date + 'T' + time + '-04:00')
}

function validExamTime(time: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)
}

export function examTimeLabel(time: string) {
  return validExamTime(time) ? time.slice(0, 5) : 'Hora por confirmar'
}

const isScheduled = (exam: TeacherExam) => exam.status === 'SCHEDULED' || exam.status === 'ACTIVE'

export function examFeedRows(page: ExamPage, view: ExamView, now = Date.now()): TeacherExam[] {
  // Only reorder when this response contains the entire result for the view.
  if (page.currentPage !== 1 || page.lastPage !== 1 || page.total !== page.data.length ||
      (view !== 'upcoming' && view !== 'all')) return page.data
  return page.data.map((exam) => {
    const start = examStart(exam)
    const scheduled = isScheduled(exam)
    const inWindow = scheduled && start <= now && Number.isSafeInteger(exam.duration_minutes) &&
      exam.duration_minutes > 0 && now < start + exam.duration_minutes * 60_000
    const rank = exam.status === 'IN_PROGRESS' || inWindow ? 0 :
      !Number.isFinite(start) ? 3 : scheduled && start > now ? 1 : 2
    return { exam, start, rank }
  }).sort((a, b) => a.rank - b.rank ||
    (Number.isFinite(a.start) && Number.isFinite(b.start) ? (a.start - b.start) * (a.rank === 2 ? -1 : 1) || a.exam.id - b.exam.id
      : Number(Number.isFinite(b.start)) - Number(Number.isFinite(a.start)))).map(({ exam }) => exam)
}

export function relevantControl(page: ExamPage | null, assignments: readonly Collaboration[] | null, now = Date.now()): HomeControl | null {
  const exam = page && examFeedRows(page, 'upcoming', now).find((row) => row.status === 'IN_PROGRESS' || isScheduled(row))
  if (exam) return { id: exam.id, name: exam.name, subject_name: exam.subject_name,
      date: exam.exam_date, time: exam.start_time, room: exam.room?.name ?? null,
      relation: 'Docente responsable', status: exam.status }
  const unique = new Map<number, Collaboration>()
  for (const a of assignments ?? []) unique.set(a.exam_id, a)
  const assignment = unique.size === 1 ? [...unique.values()][0] : null
  if (!assignment || page?.data.some((exam) => exam.id === assignment.exam_id)) return null
  return { id: assignment.exam_id, name: assignment.exam_name, subject_name: assignment.subject_name,
    date: assignment.exam_date, time: assignment.start_time, room: assignment.room,
    relation: 'Colaborador', status: null }
}
interface PresentationQuery<T> { data: T | null; loading: boolean; error: string | null }
export function homeOverview(exams: PresentationQuery<ExamPage>, assignments: PresentationQuery<readonly Collaboration[]>) {
  const loading = exams.loading || assignments.loading, error = exams.error ?? assignments.error
  const control = !loading ? relevantControl(exams.data, assignments.data) : null
  const empty = !loading && !error && exams.data?.total === 0 && assignments.data?.length === 0
  return { loading, error, control, empty, choose: !loading && !error && !control && !empty }
}
export function examExtraActions(examId: number, permission: DisciplinePermissions | null) {
  const sameExam = permission?.examId === examId
  return { incidents: !!permission && sameExam && permission.read, discipline: !!permission && sameExam && permission.manage }
}
export function detailPresentation(c: DistributionContext, packages: readonly PackageRecord[], unlocked: boolean, online: boolean, busy: boolean) {
  const access = distributionAccess(c, unlocked), own = ownExamPackages(c, packages, unlocked)
  const local = own.find((p) => p.active && p.state === 'PREPARADO')
  return {
    access, local, latest: own[0],
    relation: c.can_prepare ? 'Docente responsable' : 'Colaborador autorizado',
    count: access.ownList?.student_count ?? local?.manifest.students.length ?? null,
    control: !!local && access.download && !busy,
    prepareOffline: access.download && online && !busy,
    prepareDistribution: access.prepare && !busy,
  }
}
export const examFilterOptions: readonly { value: ExamView; label: string }[] = [
  { value: 'upcoming', label: 'Próximos y activos' }, { value: 'past', label: 'Anteriores' },
  { value: 'cancelled', label: 'Cancelados' }, { value: 'all', label: 'Todos' },
]

