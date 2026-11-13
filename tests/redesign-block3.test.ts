import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { theme } from '../src/config/theme'
import type { IncidentItem } from '../src/features/incidents/contracts'
import { receiptState, type SyncItem, type SyncReceipt } from '../src/features/offline/sync/contracts'
import { entryQueueRows, incidentQueueRows, pendingCount, queueAttemptSummary, queueCanSend, queueDate, queueIssue, queueStatus } from '../src/ui/queuePresentation'
import { anchor, binding, packageId } from './support/offlineFixtures'
import { elements, renderedText, renderPresentation } from './support/renderPresentation'

const date = '2030-01-01T12:12:00Z'
const entry: SyncItem = {
  eventId: 'entry-1', examId: '42', packageId, studentId: '101', actorId: binding.userId, method: 'QR', capturedAt: date,
  state: 'PENDING', attempts: 0, lastAttemptAt: null, receipt: null, errorCode: null, errorMessage: null,
}
const report: IncidentItem = {
  event: { v: 1, event_id: 'report-1', exam_id: '42', package_id: packageId, actor_id: binding.userId,
    mobile_device_id: binding.deviceId, installation_id: binding.installationId, student_id: null, type: 'ENVIRONMENT',
    description: 'Descripción de prueba', captured_at: date,
    time_evidence: { ...anchor, capturedElapsed: anchor.elapsed, source: 'SERVER_ANCHORED_ESTIMATE' } },
  hash: 'a'.repeat(64), state: 'PENDING', attempts: 0, receipt: null, errorCode: null,
}

function settled(id: string, status: SyncReceipt['status']): SyncItem {
  const receipt: SyncReceipt = {
    event_id: id, status, code: status === 'REJECTED' ? 'INVALID_QR' : 'EXAM_ENDED', message: 'Mensaje del servidor',
    entry_id: status === 'ACCEPTED' || status === 'DUPLICATE' ? 123 : null, received_at: date, review_required: status === 'CONFLICT',
  }
  return { ...entry, eventId: id, state: receiptState(status), receipt }
}

test('the queue distinguishes an unknown count, an empty read and a pending delivery', () => {
  const rows = entryQueueRows([entry, settled('old', 'ACCEPTED')], binding.userId)
  assert.equal(pendingCount(null), null)
  assert.equal(pendingCount([]), 0)
  assert.equal(pendingCount(rows), 1)
  assert.equal(queueCanSend(rows, binding, binding, false), true)
  assert.equal(queueCanSend(rows, binding, null, false), false)
  assert.equal(queueCanSend(rows, binding, { ...binding, deviceId: '99' }, false), false)
  assert.equal(queueCanSend(rows, binding, binding, true), false)
  assert.equal(queueCanSend(entryQueueRows([{ ...entry, state: 'SENDING' }], binding.userId), binding, binding, false), false)
  assert.equal(queueCanSend([], binding, binding, false, 1), true)
  assert.equal(queueCanSend(null, binding, binding, false, 1), false)
})

test('receipts keep accepted, duplicate, conflict, rejected and unverified entries separate', () => {
  const rows = entryQueueRows([
    entry, settled('accepted', 'ACCEPTED'), settled('duplicate', 'DUPLICATE'), settled('conflict', 'CONFLICT'),
    settled('rejected', 'REJECTED'), { ...entry, eventId: 'missing', state: 'CONFIRMED' },
    { ...settled('mismatch', 'ACCEPTED'), eventId: 'other' }, { ...entry, actorId: '99' },
  ], binding.userId)
  assert.deepEqual(rows.map(({ state }) => state), ['PENDING', 'CONFIRMED', 'DUPLICATE', 'CONFLICT', 'REJECTED', 'UNKNOWN', 'UNKNOWN'])
  assert.match(rows.find(({ id }) => id === 'rejected')?.issue ?? '', /validar el QR/)
  assert.equal(rows.some((row) => Object.hasOwn(row, 'receipt')), false)
})

test('incident rows allow an unassigned student and require the original device and matching receipt', () => {
  const received: IncidentItem = { ...report, state: 'REGISTERED',
    receipt: { event_id: report.event.event_id, request_hash: report.hash, status: 'REGISTERED', code: 'INCIDENT_REPORTED',
      incident_id: 12, review_required: false, received_at: date } }
  const rows = incidentQueueRows([received, { ...report, event: { ...report.event, event_id: 'report-2', student_id: '101' } },
    { ...report, event: { ...report.event, mobile_device_id: '99' } }], binding)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.student, null)
  assert.equal(rows[0]?.officialIncident, 12)
  assert.equal(rows[1]?.student, 'Estudiante 101')
  assert.equal(queueStatus('incidents', 'CONFIRMED').label, 'Reporte recibido')
  assert.equal(incidentQueueRows([{ ...received, hash: 'mismatch' }], binding)[0]?.state, 'UNKNOWN')
  assert.equal(incidentQueueRows([received], { ...binding, userId: '99' }).length, 0)
})

test('partial attempts report matching new receipts and preserve the remaining pending total', () => {
  const rows = entryQueueRows([settled('accepted', 'ACCEPTED'), settled('duplicate', 'DUPLICATE'),
    settled('conflict', 'CONFLICT'), settled('rejected', 'REJECTED'), settled('historical', 'ACCEPTED'),
    { ...entry, errorCode: 'NETWORK_UNAVAILABLE', errorMessage: 'internal' }], binding.userId)
  const attempted = new Set(['accepted', 'duplicate', 'conflict', 'rejected', entry.eventId])
  assert.deepEqual(queueAttemptSummary(rows, attempted), { accepted: 1, duplicates: 1, conflicts: 1, rejected: 1, pending: 1 })
  assert.match(queueIssue(rows, attempted) ?? '', /perdió la conexión/)
  assert.equal(queueIssue(rows, new Set(['historical'])), undefined)
  assert.match(queueDate(date, Date.parse('2030-01-01T16:00:00Z')), /^Hoy, /)
})

test('a pending detail shows the real method, hides the internal ID and exposes a return action', () => {
  let closed = false
  const [row] = entryQueueRows([entry], binding.userId)
  assert.ok(row)
  const detail = renderPresentation('components/operations/QueueViews.tsx', 'QueueRecordDetails',
    { row, kind: 'entries', onClose() { closed = true } }, {
      '../../config/theme': { theme }, '../../ui/queuePresentation': { queueDate, queueStatus },
      '../ActionButton': { ActionButton: 'ActionButton' }, '../AppText': { AppText: 'AppText' },
      '../Card': { Card: 'Card' }, '../Notice': { Notice: 'Notice' }, '../StatusBadge': { StatusBadge: 'StatusBadge' },
      '../general/ExamIcon': { ExamIcon: 'ExamIcon' }, '../MainTabIcon': { MainTabIcon: 'MainTabIcon' },
    })
  assert.match(renderedText(detail), /QR · Este dispositivo/)
  assert.match(renderedText(detail), /Pendiente de sincronización/)
  assert.doesNotMatch(renderedText(detail), /entry-1/)
  const back = elements(detail).find((element) => element.props.label === 'Volver')?.props.onPress
  assert.ok(typeof back === 'function')
  back()
  assert.equal(closed, true)
})

test('the native refresh uses protected reads and the modal leaves the list mounted on Back', () => {
  const read = (file: string) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
  const screen = read('screens/PendingOverviewScreen.tsx'), modal = read('components/operations/OperationDetails.tsx')
  assert.match(screen, /useScreenRefresh\(query.reload/)
  assert.match(screen, /runtime\.outbox\.items\(\)/)
  assert.match(screen, /runtime\.incidents\.items\(\)/)
  assert.doesNotMatch(screen, /offline\.refresh\(|\.reconcile\(/)
  assert.match(screen, /sendingFromQueue\.add\(runtime\)[\s\S]*await controller\.request\('me'\)[\s\S]*await offline\.synchronize\(\)/)
  assert.match(modal, /onRequestClose=\{onClose\}/)
  assert.match(read('components/screenRefresh.tsx'), /accessibilityActions:[^\n]*Actualizar contenido/)
})
