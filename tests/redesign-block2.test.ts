import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { theme } from '../src/config/theme'
import type { OfflineStudent, PackageRecord, PreparationState } from '../src/features/offline/contracts'
import type { SyncItem } from '../src/features/offline/sync/contracts'
import * as presentation from '../src/ui/entryPresentation'
import * as control from '../src/ui/controlScreens'
import { anchor, envelope, manifest, packageId } from './support/offlineFixtures'
import { elements, renderedText, renderPresentation } from './support/renderPresentation'

const student = { ...manifest().students[0]!, identity_number: '12345678' }
const event = { event_id: 'entry-fixture' }
const row: SyncItem = {
  eventId: event.event_id, examId: '42', packageId, studentId: '101', actorId: '7',
  method: 'QR', capturedAt: '2030-01-01T00:02:00Z', state: 'PENDING',
  attempts: 0, lastAttemptAt: null, errorCode: null, errorMessage: null, receipt: null,
}

function packageRecord(state: PreparationState, active = false): PackageRecord {
  const data = manifest()
  return { id: packageId, examId: data.exam_id, state, manifest: data, envelope: envelope(data), anchor, active, error: null }
}

test('preparation exposes the real copy state and requires a checked active package before opening control', () => {
  const input = { authorized: true, unlocked: true, downloading: false, checked: null, failed: false }
  assert.equal(presentation.preparationPresentation(input).label, 'Lista no preparada')
  assert.equal(presentation.preparationPresentation({ ...input, downloading: true }).label, 'Preparando lista')
  assert.equal(presentation.preparationPresentation({ ...input, failed: true }).label, 'Error al preparar la lista')
  assert.equal(presentation.preparationPresentation({ ...input, latest: packageRecord('VENCIDO') }).label, 'Información vencida')
  assert.equal(presentation.preparationPresentation({ ...input, latest: packageRecord('INCOMPLETA') }).ready, false)
  assert.equal(presentation.preparationPresentation({ ...input, latest: packageRecord('PREPARADO', true) }).ready, false)
  assert.equal(presentation.preparationPresentation({ ...input, checked: packageRecord('PREPARADO') }).ready, false)
  assert.equal(presentation.preparationPresentation({ ...input, checked: packageRecord('PREPARADO', true) }).label, 'Lista preparada')
  assert.equal(presentation.preparationPresentation({ ...input, checked: packageRecord('PREPARADO', true), authorized: false }).ready, false)
  assert.equal(presentation.preparationPresentation({ ...input, unlocked: false }).label, 'Lista protegida')
})

test('official confirmation requires a matching valid receipt; duplicate, conflict and rejection keep distinct outcomes', () => {
  const { entryResult } = presentation
  const receipt = { event_id: event.event_id, status: 'ACCEPTED' as const, code: 'OK', message: 'Aceptado',
    entry_id: 81, review_required: false, received_at: '2030-01-01T00:03:00Z' }
  assert.equal(entryResult(event).message, 'Pendiente de sincronización')
  assert.equal(entryResult(event, row, true).title, 'Ingreso ya registrado')
  assert.equal(entryResult(event, { ...row, state: 'CONFIRMED' }).title, 'Resultado por comprobar')
  assert.equal(entryResult(event, { ...row, receipt: { ...receipt, event_id: 'another-entry' } }).message, 'Pendiente de sincronización')
  assert.equal(entryResult(event, { ...row, receipt: { ...receipt, review_required: true } }).title, 'Resultado por comprobar')
  assert.equal(entryResult(event, { ...row, receipt }).title, 'Ingreso confirmado')
  assert.equal(entryResult(event, { ...row, receipt: { ...receipt, status: 'DUPLICATE' } }).title, 'Ingreso duplicado')
  assert.equal(entryResult(event, { ...row, state: 'CONFLICT' }).title, 'Ingreso en revisión')
  assert.equal(entryResult(event, { ...row, state: 'REJECTED' }).title, 'Ingreso rechazado')
})

test('student rows expose SIS and eligibility to TalkBack without revealing CI or photos', () => {
  const render = (value: OfflineStudent) => renderPresentation('components/control/StudentRow.tsx', 'StudentRow',
    { student: value, disabled: false, onOpen() {} }, {
      '../../config/theme': { theme }, '../../ui/controlScreens': control, '../../ui/entryPresentation': presentation,
      '../AppText': { AppText: 'AppText' }, '../StatusBadge': { StatusBadge: 'StatusBadge' }, '../general/ExamIcon': { ExamIcon: 'ExamIcon' },
    })
  const tree = render(student)
  assert.match(String(tree.props.accessibilityLabel), /SIS .* Habilitado/)
  assert.doesNotMatch(String(tree.props.accessibilityLabel), /12345678/)
  assert.doesNotMatch(renderedText(tree), /12345678/)
  assert.equal(elements(tree).some((node) => node.type === 'Image'), false)
  assert.match(String(render({ ...student, eligibility_status: 'INELIGIBLE' }).props.accessibilityLabel), /Inhabilitado/)
})

const reviewDeps = {
  react: { useState() { throw new Error('This test renders stateless views only') } },
  '../../config/theme': { theme }, '../../ui/entryPresentation': presentation,
  '../ActionButton': { ActionButton: 'ActionButton' }, '../AppText': { AppText: 'AppText' }, '../Card': { Card: 'Card' },
  '../StatusBadge': { StatusBadge: 'StatusBadge' }, '../Notice': { Notice: 'Notice' },
  '../general/TextAction': { TextAction: 'TextAction' }, '../operations/EntryDetails': { EntryDetails: 'EntryDetails' },
}

test('review passes only supplied photos, masks CI and delegates save and cancel to separate explicit actions', () => {
  const component = 'components/control/EntryReview.tsx'
  const uri = 'data:image/png;base64,AA=='
  const profile = renderPresentation(component, 'StudentIdentity', { student, photos: [{ kind: 'profile', uri }] }, reviewDeps)
  const photoSource = elements(profile).find((node) => node.type === 'Image')?.props.source
  assert.equal((photoSource as { uri?: string } | undefined)?.uri, uri)
  const facts = renderPresentation(component, 'EntryFacts', { exam: 'Parcial', document: student.identity_number, method: 'QR' }, reviewDeps)
  assert.match(renderedText(facts), /QR verificado.*5678/)
  assert.doesNotMatch(renderedText(facts), /12345678/)
  const actions: string[] = []
  const review = renderPresentation(component, 'EntryReview', {
    student, photos: [], exam: 'Parcial', method: 'MANUAL',
    onConfirm() { actions.push('save') }, onCancel() { actions.push('cancel') },
  }, reviewDeps)
  assert.deepEqual(actions, [])
  for (const label of ['Cancelar', 'Confirmar ingreso']) {
    const press = elements(review).find((node) => node.props.label === label)?.props.onPress
    assert.ok(typeof press === 'function')
    press()
  }
  assert.deepEqual(actions, ['cancel', 'save'])
})

test('scanner messages distinguish invalid, unverifiable and wrong-exam QR without echoing claims', () => {
  assert.match(presentation.scanIssue('QR rechazado: SUBJECT_EXAM_MISMATCH.'), /otro examen/)
  assert.match(presentation.scanIssue('QR rechazado: FORMAT_INVALID.'), /no es válido/)
  assert.match(presentation.scanIssue('QR v2 no es verificable criptográficamente offline.'), /no se puede verificar/)
})

test('control retains one virtualized list and scanner manual fallback returns to the same package with search focused', () => {
  const source = (path: string) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
  const list = source('screens/OfflineListScreen.tsx'), scanner = source('screens/OfflineScannerScreen.tsx')
  assert.match(list, /<ListScreen data=\{rowsVisible \? students : \[\]\}/)
  assert.doesNotMatch(list, /<ScrollView/)
  assert.match(list, /r\.repo\.search\(packageId, searchTerm, offset\)/)
  assert.match(list, /router\.setParams\(\{ focusSearch: '0' \}\)/)
  assert.match(scanner, /router\.dismissTo\(listDestination\(packageId, true\)\)/)
  assert.match(scanner, /<Camera scanId=\{state.phase === 'scanning' \? state.scanId : null\}/)
  assert.match(scanner, /onDetection=\{onDetection\}/)
  assert.match(scanner, /onConfirm=\{\(\) => \{\s*void view\.session\.confirm\(/)
})
