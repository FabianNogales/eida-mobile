import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import type { Collaboration, ExamPage, TeacherExam } from '../src/features/exams/api'
import type { DistributionContext, PackageRecord } from '../src/features/offline/contracts'
import { theme } from '../src/config/theme'
import { buttonColors } from '../src/ui/presentation'
import * as presentation from '../src/ui/examPresentation'
import { detailPresentation, examExtraActions, examFeedRows, examHeading, examPageLocation, examPagination,
  naturalExamDate, relevantControl, briefPreparation, examFilterOptions, homeOverview } from '../src/ui/examPresentation'
import { examDestination } from '../src/ui/generalScreens'
import { listDestination } from '../src/ui/controlScreens'
import { anchor, envelope, manifest, packageId } from './support/offlineFixtures'
import { elements, renderedText, renderPresentation } from './support/renderPresentation'

const exam: TeacherExam = { id: 42, name: 'Primer parcial', subject_name: 'Materia sintética', subject_code: null,
  exam_date: '2030-01-01', start_time: '09:00:00', duration_minutes: 60, status: 'SCHEDULED', room: null }
const page = (rows: TeacherExam[]): ExamPage => ({ data: rows, currentPage: 1, lastPage: 1, perPage: 10, total: rows.length })
const assignment: Collaboration = { exam_id: 43, exam_name: 'Parcial asignado', subject_name: 'Otra materia',
  exam_date: '2030-01-02', start_time: '10:00:00', duration_minutes: 90, room: null }
function record(overrides: Partial<PackageRecord> = {}): PackageRecord {
  const m = manifest()
  return { id: packageId, examId: m.exam_id, state: 'PREPARADO', active: true, manifest: m, envelope: envelope(m), anchor, ...overrides }
}
function context(overrides: Partial<DistributionContext> = {}): DistributionContext {
  return { exam: manifest().exam, can_prepare: true, unavailable_reason: null, distribution_id: '1', version: 1,
    frozen: true, stale: false, prepared_at: '2030-01-01T00:01:00Z', own_list_id: '2',
    lists: [{ list_id: '2', responsible_id: '7', responsible_name: 'Responsable sintético', student_count: 1,
      surname_range: { from: 'A', to: 'A' } },
    { list_id: '3', responsible_id: '8', responsible_name: 'Otra persona sintética', student_count: 9,
      surname_range: { from: 'B', to: 'Z' } }], ...overrides }
}
const deps = {
  '../../config/theme': { theme }, '../../ui/examPresentation': presentation,
  '../AppText': { AppText: 'AppText' }, '../Card': { Card: 'Card' }, '../StatusBadge': { StatusBadge: 'StatusBadge' },
  './TextAction': { TextAction: 'TextAction' }, './ExamMeta': { ExamMeta: 'ExamMeta' }, './ExamIcon': { ExamIcon: 'ExamIcon' },
  '../general/ExamMeta': { ExamMeta: 'ExamMeta' }, './EidaLogo': { EidaLogo: 'EidaLogo' },
}

test('subject and actual exam name provide hierarchy without inventing an exam type', () => {
  assert.deepEqual(examHeading(exam), { title: exam.subject_name, subtitle: exam.name })
  assert.deepEqual(examHeading({ name: 'Nombre único', subject_name: null }), { title: 'Nombre único', subtitle: null })
  assert.equal(examHeading({ name: 'Duplicado', subject_name: 'Duplicado' }).subtitle, null)
  assert.equal(naturalExamDate('2026-02-31'), 'Fecha por confirmar')
  assert.equal(naturalExamDate('invalid'), 'Fecha por confirmar')
  assert.match(naturalExamDate('2026-11-09'), /9/)
  assert.doesNotMatch(naturalExamDate('2026-11-09'), /America|2026-11-09/)
})

test('home chooses a real active teaching exam and keeps its destination without mutating responses', () => {
  const rows = [{ ...exam, id: 44, exam_date: '2029-12-31' }, { ...exam, status: 'IN_PROGRESS' }]
  const before = JSON.stringify(rows), result = relevantControl(page(rows), [assignment])
  assert.equal(result?.id, 42); assert.equal(result?.relation, 'Docente responsable')
  assert.equal(JSON.stringify(rows), before)
  assert.deepEqual(examDestination(result?.id ?? 0), { pathname: '/(private)/offline-distribution', params: { examId: '42' } })
})

test('home uses the first teaching candidate in the global order provided by a paginated response', () => {
  const response = { ...page([{ ...exam, id: 45, exam_date: '2029-12-30' }, exam]), total: 40, lastPage: 4 }
  const result = relevantControl(response, [])
  assert.equal(result?.id, 45)
  assert.equal('percentage' in (result ?? {}), false)
  assert.equal('globalNext' in (result ?? {}), false)
  assert.equal(relevantControl(page([{ ...exam, status: 'CANCELLED' }]), []), null)
  assert.equal(relevantControl(page([{ ...exam, status: 'UNKNOWN' }]), []), null)
})

test('a sole collaboration stays status-unknown; ambiguous collaborations require user selection', () => {
  const result = relevantControl(page([]), [assignment])
  assert.equal(result?.id, assignment.exam_id); assert.equal(result?.status, null)
  assert.equal(result?.relation, 'Colaborador')
  assert.equal(relevantControl(page([]), [assignment, { ...assignment, exam_id: 44 }]), null)
  assert.equal(relevantControl(null, null), null)
  assert.equal(relevantControl(page([]), []), null)
  assert.equal(relevantControl(page([{ ...exam, status: 'CANCELLED' }]), [{ ...assignment, exam_id: exam.id }]), null)
})

test('list filters retain exactly the supported backend views and never add a current-page ongoing filter', () => {
  assert.deepEqual(examFilterOptions.map((filter) => filter.value), ['upcoming', 'past', 'cancelled', 'all'])
  assert.match(examFilterOptions[0]?.label ?? '', /Próximos y activos/)
})

test('visual exam pages split the fixed server response and hide navigation up to five exams', () => {
  for (const total of [0, 1, 5]) {
    assert.deepEqual(examPagination({ ...page([]), total }, 1), { current: 1, pages: 1, previous: null, next: null })
  }
  const six = { ...page([]), total: 6 }
  assert.deepEqual(examPagination(six, 1), { current: 1, pages: 2, previous: null, next: 2 })
  assert.deepEqual(examPagination(six, 2), { current: 2, pages: 2, previous: 1, next: null })
  const multi = { ...six, total: 21, lastPage: 3, currentPage: 2 }
  assert.deepEqual(examPagination(multi, 3), { current: 3, pages: 5, previous: 2, next: 4 })
  assert.deepEqual(examPagination(multi, 5), { current: 5, pages: 5, previous: 4, next: null })
  assert.deepEqual(examPagination(six, 5), examPagination(six, 2))
  assert.deepEqual([1, 2, 3, 4, 5].map(examPageLocation), [
    { serverPage: 1, offset: 0, size: 5 }, { serverPage: 1, offset: 5, size: 5 },
    { serverPage: 2, offset: 0, size: 5 }, { serverPage: 2, offset: 5, size: 5 },
    { serverPage: 3, offset: 0, size: 5 },
  ])
  assert.equal(examPagination({ currentPage: 1, perPage: 10, lastPage: 1 }, 1), null)
  assert.equal(examPagination({ ...multi, lastPage: 2 }, 1), null)
})

test('compact exam navigation exposes labelled arrow actions and disables unavailable destinations', () => {
  const changes: number[] = []
  const render = (busy: boolean) => renderPresentation('components/general/ExamPagination.tsx', 'ExamPagination',
    { current: 1, pages: 3, previous: null, next: 2, busy, onPage: (value: number) => changes.push(value) },
    { '../../config/theme': { theme }, '../AppText': { AppText: 'AppText' }, './ExamIcon': { ExamIcon: 'ExamIcon' } })
  const arrows = elements(render(false)).filter((node) => node.type === 'Pressable')
  assert.deepEqual(arrows.map((node) => node.props.accessibilityLabel), ['Página anterior', 'Página siguiente'])
  assert.deepEqual(arrows.map((node) => node.props.disabled), [true, false])
  assert.equal(elements(render(false)).find((node) => node.type === 'AppText')?.props.accessibilityLabel, 'Página 1 de 3')
  for (const arrow of [...arrows, ...elements(render(true)).filter((node) => node.type === 'Pressable')]) {
    const handler = arrow.props.onPress
    assert.ok(typeof handler === 'function')
    handler()
  }
  assert.deepEqual(changes, [2])
})

test('a complete exam result prioritizes active and upcoming times in La Paz and keeps unknown times stable', () => {
  const now = Date.parse('2026-11-12T14:00:00Z')
  const row = (id: number, date: string, overrides: Partial<TeacherExam> = {}): TeacherExam =>
    ({ ...exam, id, exam_date: date, ...overrides })
  const rows = [row(8, '2026-11-20'), row(4, '2026-11-13'), row(1, '2026-11-12'),
    row(3, '2026-11-13'), row(9, '2026-11-12', { status: 'IN_PROGRESS' }),
    row(7, '2026-02-31'), row(6, '2026-11-13', { start_time: '' }),
    row(2, '2026-11-12', { start_time: '10:01:00', status: 'ACTIVE' }),
    row(10, '2026-11-12', { start_time: '09:30:00', status: 'ACTIVE' })]
  assert.deepEqual(examFeedRows(page(rows), 'all', now).map(({ id }) => id), [9, 10, 2, 3, 4, 8, 1, 7, 6])
  const upcoming = page(rows.filter(({ id }) => [2, 3, 4, 8, 9, 10].includes(id)))
  assert.equal(relevantControl(upcoming, [], now)?.id, examFeedRows(upcoming, 'upcoming', now)[0]?.id)
})

test('visual pagination retains global server chronology across response boundaries', () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({
    ...exam, id: i + 1, exam_date: '2030-01-' + String(i + 1).padStart(2, '0'),
    status: i === 10 ? 'IN_PROGRESS' : 'SCHEDULED',
  }))
  const results = [rows.slice(0, 10), rows.slice(10)].map((data, i) =>
    ({ ...page(data), total: 11, currentPage: i + 1, lastPage: 2 }))
  const visible = [1, 2, 3].flatMap((number) => {
    const { serverPage, offset, size } = examPageLocation(number)
    return examFeedRows(results[serverPage - 1]!, 'upcoming').slice(offset, offset + size)
  })
  assert.deepEqual(visible, rows)
  assert.equal(relevantControl(results[0]!, [])?.id, visible[0]?.id)
})

test('home loading and failures never masquerade as empty assignments or expose a stale highlighted exam', () => {
  const resolved = { data: page([]), loading: false, error: null }
  const none = { data: [], loading: false, error: null }
  assert.equal(homeOverview(resolved, none).empty, true)
  const loading = homeOverview({ ...resolved, data: page([exam]), loading: true }, none)
  assert.equal(loading.control, null); assert.equal(loading.empty, false)
  const failed = homeOverview({ data: null, loading: false, error: 'Sin conexión' }, none)
  assert.equal(failed.error, 'Sin conexión'); assert.equal(failed.empty, false); assert.equal(failed.choose, false)
  const ambiguous = homeOverview(resolved, { ...none, data: [assignment, { ...assignment, exam_id: 44 }] })
  assert.equal(ambiguous.choose, true); assert.equal(ambiguous.empty, false)
})

test('preparation badges distinguish locked data, another exam and a staged replacement from a ready active list', () => {
  assert.equal(briefPreparation(42, false, [record()]).label, 'Sin consultar')
  assert.equal(briefPreparation(43, true, [record()]).label, 'Por preparar')
  assert.equal(briefPreparation(42, true, [record({ active: false })]).label, 'Por verificar')
  assert.equal(briefPreparation(42, true, [record({ active: false, state: 'INCOMPLETA' })]).label, 'Incompleta')
  assert.equal(briefPreparation(42, true, [record({ active: false, state: 'INCOMPLETA' }), record()]).label, 'Lista preparada')
})

test('owner supervision without a personal assignment never enables downloads or control of another list', () => {
  const view = detailPresentation(context({ own_list_id: null }), [record()], true, true, false)
  assert.equal(view.access.supervise, true)
  assert.equal(view.control, false); assert.equal(view.prepareOffline, false)
  assert.equal(view.count, null); assert.equal(view.local, undefined)
  assert.equal(view.prepareDistribution, true)
})

test('collaborators can control only their own ready list; stale, busy and locked data disable actions', () => {
  const c = context({ can_prepare: false }), own = record()
  const view = detailPresentation(c, [own, record({ manifest: manifest({ list_id: '3' }) })], true, true, false)
  assert.equal(view.relation, 'Colaborador autorizado')
  assert.equal(view.access.supervise, false)
  assert.deepEqual(view.access.lists.map((list) => list.list_id), ['2'])
  assert.equal(view.count, 1); assert.equal(view.control, true); assert.equal(view.prepareOffline, true)
  assert.equal(view.prepareDistribution, false)
  assert.deepEqual(listDestination(view.local?.id ?? ''), { pathname: '/offline/list', params: { packageId } })
  for (const blocked of [context({ stale: true }), context({ unavailable_reason: 'EXAM_ENDED' })]) {
    const result = detailPresentation(blocked, [own], true, true, false)
    assert.equal(result.control, false); assert.equal(result.prepareOffline, false)
  }
  assert.equal(detailPresentation(c, [own], false, true, false).control, false)
  assert.equal(detailPresentation(c, [own], true, true, true).control, false)
  assert.equal(detailPresentation(c, [own], true, false, false).prepareOffline, false)
  assert.equal(detailPresentation(c, [own], true, false, false).control, true)
})

test('disciplinary links need explicit matching server permissions, not just a teaching relationship', () => {
  const permission = { examId: 42, read: true, report: true, manage: false, observedAt: '2030-01-01T00:00:00Z' }
  assert.deepEqual(examExtraActions(42, null), { incidents: false, discipline: false })
  assert.deepEqual(examExtraActions(42, permission), { incidents: true, discipline: false })
  assert.deepEqual(examExtraActions(43, { ...permission, manage: true }), { incidents: false, discipline: false })
  assert.equal(examExtraActions(42, { ...permission, manage: true }).discipline, true)
})

test('real exam card renders compact authorized metadata and its open callback without invented room data', () => {
  let opened = 0
  const tree = renderPresentation('components/general/ExamCard.tsx', 'ExamCard',
    { exam, unlocked: false, packages: [], onOpen: () => { opened++ } }, deps)
  assert.match(renderedText(tree), /Materia sintética.*Primer parcial/s)
  assert.doesNotMatch(renderedText(tree), /America|UUID|Outbox|SecureStore/)
  const meta = elements(tree).find((node) => node.type === 'ExamMeta')
  assert.ok(meta); assert.equal(meta.props.room, undefined)
  const action = elements(tree).find((node) => node.props.label === 'Abrir examen')
  assert.ok(action && typeof action.props.onPress === 'function')
  action.props.onPress(); assert.equal(opened, 1)
  const badge = elements(tree).find((node) => node.props.label === 'Sin consultar')
  assert.ok(badge)
})

test('real hero and metadata render natural dates, actual relation and optional room without technical timezone labels', () => {
  const c = context()
  const hero = renderPresentation('components/control/ExamHero.tsx', 'ExamHero',
    { exam: c.exam, relation: 'Colaborador autorizado' }, deps)
  assert.ok(elements(hero).some((node) => node.props.label === 'Colaborador autorizado'))
  const meta = renderPresentation('components/general/ExamMeta.tsx', 'ExamMeta',
    { date: '2026-11-09', time: '09:00:00', room: null, relation: 'Colaborador', stacked: true }, deps)
  assert.match(renderedText(meta), /09:00/)
  assert.doesNotMatch(renderedText(meta), /Ambiente no informado|America/)
})

test('real segmented filters and action rows preserve selection, callbacks, disabled and accessible labels', () => {
  let selected = ''
  const filters = renderPresentation('components/general/ExamFilters.tsx', 'ExamFilters',
    { value: 'past', onChange: (value: string) => { selected = value } }, deps)
  const radio = elements(filters).find((node) => node.props.accessibilityLabel === 'Anteriores')
  assert.ok(radio)
  const state = radio.props.accessibilityState
  assert.ok(typeof state === 'object' && state !== null && 'checked' in state)
  assert.equal(state.checked, true)
  assert.ok(typeof radio.props.onPress === 'function'); radio.props.onPress(); assert.equal(selected, 'past')
  const row = renderPresentation('components/general/ExamActionRow.tsx', 'ExamActionRow',
    { label: 'Mis exámenes', icon: 'calendar', disabled: true, onPress() {} }, deps)
  assert.equal(row.props.disabled, true)
  assert.equal(row.props.accessibilityRole, 'button')
  assert.equal(row.props.accessibilityLabel, 'Mis exámenes')
})

test('login brand keeps the local official logo and screen architecture keeps footer, guards and virtualization', () => {
  const brand = renderPresentation('components/general/EidaBrand.tsx', 'EidaBrand', {}, deps)
  assert.match(renderedText(brand), /EIDA Control.*Control de ingreso a exámenes/s)
  assert.equal(elements(brand).filter((node) => node.type === 'EidaLogo').length, 1)
  const read = (path: string) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
  const login = read('screens/LoginScreen.tsx')
  assert.match(login, /footer=\{<ActionButton label="Iniciar sesión"/)
  assert.match(login, /secureTextEntry=\{!visible\}/)
  assert.match(login, /trailing=\{<Pressable accessibilityRole="button"/)
  assert.match(login, /loginFields\(identifier, password\)/)
  assert.match(login, /view\.message/)
  assert.match(read('app/_layout.tsx'), /initialRouteName: 'login'/)
  assert.doesNotMatch(read('app/(private)/_layout.tsx'), /<Redirect/)
  const exams = read('screens/ExamsScreen.tsx')
  assert.match(exams, /<ListScreen data=\{ordered\}/)
  assert.doesNotMatch(exams, /ScrollView|useFocusEffect/)
  assert.doesNotMatch(read('screens/HomeScreen.tsx'), /useFocusEffect|percentage|America\/La_Paz/)
})

test('the shared button accepts a decorative icon while keeping busy and disabled semantics', () => {
  const dependencies = { '../config/theme': { theme }, '../ui/presentation': { buttonColors } }
  const icon = createElement('ControlIcon')
  const normal = renderPresentation('components/ActionButton.tsx', 'ActionButton',
    { label: 'Controlar ingreso', onPress() {}, icon }, dependencies)
  assert.equal(normal.props.accessibilityLabel, 'Controlar ingreso')
  assert.ok(elements(normal).some((node) => node.type === 'ControlIcon'))
  const busy = renderPresentation('components/ActionButton.tsx', 'ActionButton',
    { label: 'Controlar ingreso', onPress() {}, icon, busy: true }, dependencies)
  assert.equal(busy.props.disabled, true)
  assert.ok(elements(busy).some((node) => node.type === 'ActivityIndicator'))
  assert.ok(!elements(busy).some((node) => node.type === 'ControlIcon'))
})

