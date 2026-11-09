import test from 'node:test'
import assert from 'node:assert/strict'
import type { SessionSnapshot } from '../src/features/auth/contracts'
import { canAccessPrivate } from '../src/features/auth/guards'
import { collaborations, teacherExams, type TeacherExam } from '../src/features/exams/api'
import { ApiError, httpError } from '../src/services/http/errors'
import { examDestination, examIncidentsDestination, examStatus, homeExamOverview, loginPresentation,
  logoutConfirmation, offlineExamState, orderedExams, userInitials } from '../src/ui/generalScreens'
import { pendingSummary } from '../src/ui/pendingSummary'
import { harness, loginResponse, response, signIn, user } from './support/authFixtures'

const session: SessionSnapshot = { status: 'unauthenticated', user: null, busy: false,
  message: null, hasCredential: false, logoutPending: false, expiresAt: null, deviceId: null, validatedAt: null }
const exam: TeacherExam = { id: 42, name: 'Examen de prueba', subject_name: null, subject_code: null,
  exam_date: '2030-01-01', start_time: '10:00:00', duration_minutes: 60, status: 'SCHEDULED', room: null }

test('login keeps existing redirects, guards and credential/busy restrictions', () => {
  assert.deepEqual(loginPresentation(session, true), { destination: null, disabled: false, loading: false, message: null })
  assert.equal(loginPresentation(session, false).disabled, true)
  assert.equal(loginPresentation({ ...session, status: 'initializing' }, true).destination, '/session')
  assert.equal(loginPresentation({ ...session, status: 'recoverable-error' }, true).destination, '/session')
  assert.equal(loginPresentation({ ...session, status: 'offline', hasCredential: true }, true).destination, '/session')
  assert.equal(loginPresentation({ ...session, status: 'authenticating', busy: true }, true).loading, true)
  assert.equal(loginPresentation({ ...session, busy: true }, true).disabled, true)
  assert.equal(loginPresentation({ ...session, hasCredential: true, logoutPending: true }, true).disabled, true)
  const active = { ...session, status: 'authenticated' as const, user, hasCredential: true }
  assert.equal(loginPresentation(active, true).destination, '/(private)')
  assert.notEqual(loginPresentation({ ...active, user: { ...user, must_change_password: true } }, true).destination, '/(private)')
  assert.notEqual(loginPresentation({ ...active, logoutPending: true }, true).destination, '/(private)')
})
test('login preserves credential, network and server messages instead of inventing success', () => {
  for (const error of [httpError(422, {}), new ApiError('network', 'Sin conexión. Reintenta.'),
    httpError(403, { code: 'ACCOUNT_INACTIVE' }), httpError(429, {})]) {
    const view = loginPresentation({ ...session, message: error.message }, true)
    assert.equal(view.message, error.message)
    assert.equal(view.destination, null)
  }
  assert.match(loginPresentation({ ...session, status: 'expired' }, true).message ?? '', /venció/)
})
test('identity uses the real display name, including accents, without demonstration initials', () => {
  assert.equal(userInitials('  Ángela María López '), 'ÁL')
  assert.equal(userInitials('Úrsula'), 'Ú')
  assert.equal(userInitials(''), '')
})
test('home only selects an official IN_PROGRESS exam from the returned page, preserving source data', () => {
  const active = { ...exam, id: 43, status: 'IN_PROGRESS' }, unknown = { ...exam, id: 44, status: 'UNKNOWN' }
  const rows = [exam, unknown, active], before = JSON.stringify(rows)
  const overview = homeExamOverview({ data: rows, currentPage: 1, lastPage: 3, perPage: 10, total: 21 })
  assert.equal(overview.active, active); assert.equal(overview.first, active); assert.equal(overview.total, 21)
  assert.deepEqual(orderedExams(rows).map((item) => item.id), [43, 42, 44])
  assert.equal(JSON.stringify(rows), before)
  assert.equal(homeExamOverview({ data: [unknown], currentPage: 1, lastPage: 1, perPage: 10, total: 1 }).active, null)
  assert.equal('percentage' in overview, false)
})
test('missing and empty home data are distinct and never become sample exams', () => {
  assert.deepEqual(homeExamOverview(null), { active: null, first: null, total: null })
  assert.deepEqual(homeExamOverview({ data: [], currentPage: 1, lastPage: 1, perPage: 10, total: 0 }),
    { active: null, first: null, total: 0 })
})
test('unknown exam states remain explicit and local copy labels do not grant authorization', () => {
  assert.deepEqual(examStatus('IN_PROGRESS'), { label: 'En desarrollo', tone: 'success' })
  assert.deepEqual(examStatus('UNRECOGNIZED'), { label: 'UNRECOGNIZED', tone: 'neutral' })
  assert.equal(offlineExamState(42, false, [{ active: true, examId: '42', state: 'PREPARADO' }]).label, 'Almacén bloqueado')
  assert.equal(offlineExamState(42, true, [{ active: false, examId: '42', state: 'PREPARADO' }]).label, 'Sin lista offline local')
  assert.equal(offlineExamState(42, true, [{ active: true, examId: '43', state: 'PREPARADO' }]).label, 'Sin lista offline local')
  assert.equal(offlineExamState(42, true, [{ active: true, examId: '42', state: 'PREPARADO' }]).label, 'Copia local preparada')
  for (const state of ['VENCIDO', 'DESACTUALIZADO', 'INCOMPLETA', 'ERROR'] as const) {
    assert.equal(offlineExamState(42, true, [{ active: true, examId: '42', state }]).tone, 'warning')
  }
})
test('logout confirmation warns about both queues and does not treat a locked vault as empty', () => {
  const summary = pendingSummary(true, [{ state: 'PENDING' }, { state: 'CONFLICT' }], [{ state: 'PENDING' }])
  assert.match(logoutConfirmation(summary), /2 operaciones por enviar y 1 conflictos o rechazos/)
  assert.match(logoutConfirmation(summary), /no sincroniza ni elimina/)
  assert.match(logoutConfirmation(summary), /misma cuenta/)
  assert.match(logoutConfirmation(null), /no se puede comprobar/)
  assert.doesNotMatch(logoutConfirmation(null), /0 operaciones/)
})
test('general screen links keep the exam context and existing detail destinations', () => {
  assert.deepEqual(examDestination(42), { pathname: '/(private)/offline-distribution', params: { examId: '42' } })
  assert.deepEqual(examIncidentsDestination(42), { pathname: '/(private)/incidents', params: { examId: '42' } })
  assert.equal(canAccessPrivate({ ...session, status: 'expired', user }), false)
  assert.equal(canAccessPrivate({ ...session, status: 'authenticated', user: { ...user, status: 'INACTIVE' } }), false)
})
test('real adapters keep teacher and collaboration sources distinct without adding missing status or authority', async () => {
  const assignment = { exam_id: 43, exam_name: 'Colaboración de prueba', subject_name: 'Materia de prueba',
    exam_date: '2030-01-02', start_time: '11:00:00', duration_minutes: 90, room: null }
  const h = harness(async (path, _init, url) => response(url, path === 'teacher/exams'
    ? { data: [exam], meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 } }
    : path === 'me/collaborations' ? { data: [assignment] } : path === 'me' ? { success: true, data: user } : loginResponse()))
  await signIn(h)
  assert.equal(homeExamOverview(await teacherExams(h.session, 'upcoming', 1)).active, null)
  const assignments = await collaborations(h.session)
  assert.equal(assignments[0]?.exam_id, 43)
  assert.equal('status' in (assignments[0] ?? {}), false)
  assert.equal('teacher' in (assignments[0] ?? {}), false)
})
test('a denied teacher query and MOBILE_ABILITY_REQUIRED remain errors with no fabricated data', async () => {
  const h = harness(async (path, _init, url) => response(url, path === 'teacher/exams' ? {}
    : path === 'me' ? { success: true, data: user } : loginResponse(), path === 'teacher/exams' ? 403 : 200))
  await signIn(h)
  await assert.rejects(teacherExams(h.session, 'upcoming', 1), { status: 403 })
  assert.equal(canAccessPrivate(h.session.getSnapshot()), true)
  const error = httpError(403, { code: 'MOBILE_ABILITY_REQUIRED' })
  assert.equal(error.code, 'MOBILE_ABILITY_REQUIRED'); assert.match(error.message, /no tiene el permiso/)
})
