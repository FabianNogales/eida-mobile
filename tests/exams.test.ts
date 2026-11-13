import test from 'node:test'
import assert from 'node:assert/strict'
import { collaborations, teacherExams, devices, revokeDevice } from '../src/features/exams/api'
import { harness, signIn, response, loginResponse, user, device } from './support/authFixtures'

const exam = { id: 42, name: 'Examen sintético', subject_name: 'Asignatura sintética', subject_code: 'TEST',
  exam_date: '2030-01-01', start_time: '10:00:00', duration_minutes: 60, status: 'IN_PROGRESS',
  room: { id: 1, code: 'A1', name: 'Ambiente sintético' } }
const assignment = { exam_id: 43, exam_name: 'Colaboración sintética', subject_name: 'Asignatura sintética',
  exam_date: '2030-01-02', start_time: '11:00:00', duration_minutes: 90, room: null }

test('teacher exams use real view/page/per_page contract and preserve official status', async () => {
  const h = harness(async (path, _init, url) => {
    if (path === 'teacher/exams') {
      const params = new URL(url).searchParams
      assert.equal(params.get('view'), 'upcoming'); assert.equal(params.get('page'), '2'); assert.equal(params.get('per_page'), '10')
      return response(url, { data: [exam], meta: { current_page: 2, last_page: 3, per_page: 10, total: 21 } })
    }
    return response(url, path === 'me' ? { success: true, data: user } : loginResponse())
  })
  await signIn(h)
  const page = await teacherExams(h.session, 'upcoming', 2)
  assert.equal(page.currentPage, 2); assert.equal(page.lastPage, 3); assert.equal(page.data[0]?.status, 'IN_PROGRESS')
})
test('an empty backend page remains empty', async () => {
  const h = harness(async (path, _init, url) => response(url, path === 'teacher/exams'
    ? { data: [], meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 } }
    : path === 'me' ? { success: true, data: user } : loginResponse()))
  await signIn(h)
  assert.deepEqual((await teacherExams(h.session, 'past', 1)).data, [])
})
test('an incomplete teacher page is a protocol error rather than an invented page count', async () => {
  const api = { async request() {
    return { data: [exam], meta: { current_page: 1, per_page: 10 } }
  } }
  await assert.rejects(teacherExams(api, 'upcoming', 1), { kind: 'protocol' })
})
test('an active collaboration is represented without invented teacher or status fields', async () => {
  const h = harness(async (path, _init, url) => response(url, path === 'me/collaborations'
    ? { data: [assignment] } : path === 'me' ? { success: true, data: user } : loginResponse()))
  await signIn(h)
  const rows = await collaborations(h.session)
  assert.equal(rows[0]?.exam_id, 43)
  assert.equal('status' in rows[0]!, false)
  assert.equal('teacher' in rows[0]!, false)
})
test('revoked collaborations disappear on a fresh server list; no local records are injected', async () => {
  let active = true
  const h = harness(async (path, _init, url) => response(url, path === 'me/collaborations'
    ? { data: active ? [assignment] : [] } : path === 'me' ? { success: true, data: user } : loginResponse()))
  await signIn(h)
  assert.equal((await collaborations(h.session)).length, 1)
  active = false
  assert.deepEqual(await collaborations(h.session), [])
})
test('the same authenticated account may query teacher exams and collaborations', async () => {
  const h = harness(async (path, _init, url) => response(url, path === 'teacher/exams'
    ? { data: [exam], meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 } }
    : path === 'me/collaborations' ? { data: [assignment] } : path === 'me' ? { success: true, data: user } : loginResponse()))
  await signIn(h)
  assert.equal((await teacherExams(h.session, 'all', 1)).data[0]?.id, 42)
  assert.equal((await collaborations(h.session))[0]?.exam_id, 43)
  assert.ok(!h.session.getSnapshot().user?.roles.includes('COLABORADOR'))
})
test('a forbidden teacher list does not log out an otherwise valid collaborator', async () => {
  const h = harness(async (path, _init, url) => response(url, path === 'teacher/exams'
    ? { message: 'Forbidden - Insufficient permissions' }
    : path === 'me' ? { success: true, data: user } : loginResponse(), path === 'teacher/exams' ? 403 : 200))
  await signIn(h)
  await assert.rejects(teacherExams(h.session, 'all', 1), { status: 403 })
  assert.equal(h.session.getSnapshot().status, 'authenticated')
})
test('device listing and own-device revocation use the actual endpoints', async () => {
  const h = harness(async (path, init, url) => response(url, path === 'auth/devices'
    ? { data: [device] } : path === 'me' ? { success: true, data: user } : loginResponse(), init.method === 'DELETE' ? 204 : 200))
  await signIn(h)
  assert.equal((await devices(h.session))[0]?.id, 11)
  await revokeDevice(h.session, 11)
  await h.session.currentDeviceRevoked(11)
  assert.equal(h.session.getSnapshot().status, 'expired')
  assert.ok(h.calls.some(c => c.path === 'auth/devices/11' && c.init.method === 'DELETE'))
})
