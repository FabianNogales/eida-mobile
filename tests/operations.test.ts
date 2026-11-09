import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import vectors from '../src/features/qr/fixtures/php-vectors.json'
import { QrScanSession, type QrScanState } from '../src/features/scanner/scanSession'
import { PackageDownloader } from '../src/features/offline/download'
import type { SyncItem } from '../src/features/offline/sync/contracts'
import { IncidentRepository } from '../src/features/incidents/repository'
import { IncidentSync } from '../src/features/incidents/sync'
import { DisciplineApi, type DisciplinePermissions } from '../src/features/incidents/api'
import type { IncidentItem } from '../src/features/incidents/contracts'
import { ApiError, httpError } from '../src/services/http/errors'
import { createExitConfirmation, goBack } from '../src/navigation/back'
import { entryDelivery, entryLabels, incidentDelivery, incidentLabels, latestEntryAttempt,
  localEntrySavedMessage, queueKnown, reportDescriptionError, scanPresentation } from '../src/ui/operations'
import { pendingSummary } from '../src/ui/pendingSummary'
import { binding, digest, harnessOffline, manifest, mockApi, packageId, provider, sample } from './support/offlineFixtures'

const EVENT = 'a3a0ef87-356b-4cb9-a49e-a7ce319e2772'
async function scanner(t: TestContext) {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, { sample: async () => sample }, async () => {}).run('42')
  let minted = 0
  const session = new QrScanSession(packageId, { repo: h.repo, digest, provider,
    check: () => {}, sample: async () => sample, uuid: () => { minted++; return EVENT },
    photoUri: async (bytes, mime) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}` })
  await session.revalidate()
  const start = () => {
    session.cameraAccess(true); assert.equal(session.start(), true)
    const state = session.state; assert.ok(state.phase === 'scanning')
    session.cameraReady(state.scanId); return state.scanId
  }
  return { ...h, session, start, minted: () => minted }
}
function entry(overrides: Partial<SyncItem> = {}): SyncItem {
  return { eventId: EVENT, packageId, examId: '42', studentId: '101', actorId: '7', method: 'QR',
    capturedAt: '2030-01-01T00:02:00Z', state: 'PENDING', attempts: 0, lastAttemptAt: null,
    errorCode: null, errorMessage: null, receipt: null, ...overrides }
}

test('scanner labels distinguish detection, verification, review and local saving without claiming an ACK', () => {
  const states: QrScanState[] = [{ phase: 'checking' }, { phase: 'idle' }, { phase: 'scanning', scanId: 1 },
    { phase: 'detected' }, { phase: 'verifying' }, { phase: 'saving' }, { phase: 'closed' },
    { phase: 'error', message: 'QR rechazado: EXPIRED.' }, { phase: 'blocked', message: 'SQLCipher bloqueado.' }]
  for (const state of states) {
    const label = scanPresentation(state)
    assert.ok(label.label.length > 0); assert.ok(label.icon.length > 0)
    assert.doesNotMatch(label.label, /ingreso oficial confirmado/i)
  }
  assert.equal(localEntrySavedMessage, 'INGRESO GUARDADO EN EL DISPOSITIVO — PENDIENTE DE SINCRONIZACIÓN')
})
test('the real scanner detects/authenticates without registering; cancellation keeps storage unchanged', async (t) => {
  const h = await scanner(t), scanId = h.start()
  await h.session.detect(scanId, { type: 'qr', data: vectors.cases[0]!.token })
  assert.equal(h.session.state.phase, 'review')
  assert.equal(await h.repo.event('42', '101'), null); assert.equal(h.minted(), 0)
  h.session.cancel()
  assert.equal(await h.session.confirm(), null)
  assert.equal(h.session.state.phase, 'idle'); assert.equal(h.minted(), 0)
})
test('explicit confirmation and repeated taps use the real synchronous scanner gate and one UUID', async (t) => {
  const h = await scanner(t), scanId = h.start()
  await h.session.detect(scanId, { type: 'qr', data: vectors.cases[0]!.token })
  const results = await Promise.all([h.session.confirm(), h.session.confirm()])
  assert.equal(results.filter(Boolean).length, 1); assert.equal(h.minted(), 1)
  assert.equal((await h.repo.event('42', '101'))?.event_id, EVENT)
  assert.equal(h.session.state.phase, 'saved')
  assert.equal(scanPresentation(h.session.state).tone, 'warning')
})
test('invalid QR and unsigned v2 never produce an authenticated identity or an event', async (t) => {
  const h = await scanner(t)
  const v2 = `unsigned.${Buffer.from(JSON.stringify({ v: 2, sub: '101', name: 'Untrusted' })).toString('base64url')}.unsigned`
  for (const token of ['not-a-token', v2]) {
    const scanId = h.start()
    await h.session.detect(scanId, { type: 'qr', data: token })
    const state = h.session.state
    assert.ok(state.phase === 'error' || state.phase === 'blocked')
    assert.equal('identity' in state, false)
    if (token === v2) assert.match(state.message, /v2.*offline/i)
  }
  assert.equal(await h.repo.event('42', '101'), null)
})
test('camera access denial prevents the real scanner from starting', async (t) => {
  const h = await scanner(t)
  h.session.cameraAccess(false)
  assert.equal(h.session.start(), false)
  assert.equal(h.session.state.phase, 'idle'); assert.equal(h.minted(), 0)
})
test('queue readiness is unknown on first protected read and retains known counts during sending', () => {
  const runtime = {}, nextRuntime = {}
  assert.equal(queueKnown(null, runtime, false), false)
  assert.equal(queueKnown(runtime, null, true), false)
  assert.equal(pendingSummary(queueKnown(runtime, null, true), [], []), null)
  assert.equal(queueKnown(runtime, null, false), true)
  assert.equal(queueKnown(runtime, runtime, true), true)
  assert.equal(queueKnown(nextRuntime, runtime, true), false)
})
test('ACCEPTED, DUPLICATE, CONFLICT and REJECTED keep distinct meanings and preserve review evidence', () => {
  const item = entry(), before = JSON.stringify(item)
  assert.equal(entryDelivery(item).tone, 'warning')
  for (const status of ['ACCEPTED', 'DUPLICATE', 'CONFLICT', 'REJECTED'] as const) {
    const receipt = { event_id: EVENT, status, code: status, message: 'Recibo sintético', entry_id: status === 'ACCEPTED' || status === 'DUPLICATE' ? 1 : null,
      review_required: true, received_at: '2030-01-01T00:03:00Z' }
    const withReceipt = entry({ state: status === 'ACCEPTED' ? 'CONFIRMED' : status, receipt })
    assert.equal(entryDelivery(withReceipt).tone === 'success', status === 'ACCEPTED')
    assert.equal(withReceipt.receipt?.review_required, true)
  }
  assert.equal(entryDelivery(entry({ state: 'CONFIRMED' })).tone, 'warning')
  assert.equal(JSON.stringify(item), before)
})
test('incident ACK confirms a report, and never labels it as a confirmed infraction', async (t) => {
  const h = await scanner(t), reports = new IncidentRepository(h.connection, h.repo, digest)
  const event = await reports.capture(packageId, { type: 'ENVIRONMENT', description: 'Descripción de prueba', studentId: null }, sample, () => EVENT)
  const local = (await reports.items())[0]; assert.ok(local)
  assert.equal(incidentDelivery(local).tone, 'warning')
  const received: IncidentItem = { ...local, state: 'REGISTERED', receipt: { event_id: event.event_id, request_hash: local.hash,
    status: 'REGISTERED', code: 'INCIDENT_REPORTED', incident_id: 12, review_required: true, received_at: '2030-01-01T00:03:00Z' } }
  assert.match(incidentDelivery(received).label, /Reporte registrado/)
  assert.doesNotMatch(incidentDelivery(received).label, /infracción confirmada/i)
  assert.equal(incidentDelivery({ ...received, receipt: null }).tone, 'warning')
})
test('latest attempt is taken from stored attempt dates and never fabricated from capture time', () => {
  assert.equal(latestEntryAttempt([entry()]), null)
  assert.equal(latestEntryAttempt([{ lastAttemptAt: 'invalid' }, { lastAttemptAt: '2030-01-01T00:02:00Z' },
    { lastAttemptAt: '2030-01-01T00:03:00.123456Z' }]), '2030-01-01T00:03:00.123456Z')
})
test('form validation uses the original description contract and optional assigned student rules', async (t) => {
  assert.ok(reportDescriptionError('   ')); assert.ok(reportDescriptionError('x'.repeat(4001)))
  assert.equal(reportDescriptionError('Observación válida'), null)
  const h = await scanner(t), reports = new IncidentRepository(h.connection, h.repo, digest)
  await assert.rejects(reports.capture(packageId, { type: 'ENVIRONMENT', description: '', studentId: null }, sample, () => EVENT))
  await assert.rejects(reports.capture(packageId, { type: 'ENVIRONMENT', description: 'Prueba', studentId: '999' }, sample, () => EVENT))
  assert.equal((await reports.items()).length, 0)
})
test('network failure leaves the original incident UUID, description and hash pending', async (t) => {
  const h = await scanner(t), reports = new IncidentRepository(h.connection, h.repo, digest)
  await reports.capture(packageId, { type: 'ENVIRONMENT', description: 'Texto original de prueba', studentId: null }, sample, () => EVENT)
  const original = (await reports.items())[0]; assert.ok(original)
  const sync = new IncidentSync(reports, { sync: async () => { throw new ApiError('network', 'Sin conexión') } }, () => binding,
    () => 'b3a0ef87-356b-4cb9-a49e-a7ce319e2772')
  await sync.run()
  const item = (await reports.items())[0]; assert.ok(item)
  assert.equal(item.state, 'PENDING'); assert.equal(item.event.event_id, original.event.event_id)
  assert.equal(item.event.description, original.event.description); assert.equal(item.hash, original.hash)
  assert.equal(item.errorCode, 'CONNECTION_UNCONFIRMED')
})
test('collaborators cannot invoke owner discipline and MOBILE_ABILITY_REQUIRED remains a real rejection', async () => {
  let calls = 0
  const api = new DisciplineApi({ request: async () => { calls++; throw httpError(403, { code: 'MOBILE_ABILITY_REQUIRED' }) } })
  const permission: DisciplinePermissions = { examId: 42, manage: false, read: true, report: true, observedAt: '2030-01-01T00:01:00Z' }
  await assert.rejects(api.expel('42', permission, 101, 'Prueba'), /docente responsable/)
  await assert.rejects(api.annul('42', permission, 1, 'Prueba'), /docente responsable/)
  assert.equal(calls, 0)
  await assert.rejects(api.context('42'), { status: 403, code: 'MOBILE_ABILITY_REQUIRED' })
})
test('Back cancellation does not invoke confirmation; repeated confirmation retries once', () => {
  const decision = createExitConfirmation(), calls: string[] = []
  const port = { canGoBack: () => true, back: () => { calls.push('back') }, replace: () => { calls.push('replace') } }
  decision.request(() => goBack(port)); decision.cancel(); decision.confirm()
  assert.deepEqual(calls, [])
  decision.request(() => goBack(port)); decision.confirm(); decision.confirm()
  assert.deepEqual(calls, ['back'])
  decision.request(() => goBack(port)); decision.clear(); decision.confirm() // Logout/revocation clears pending actions.
  assert.deepEqual(calls, ['back'])
})
test('operational states include text and a symbol, and do not depend only on color', () => {
  for (const state of [...Object.values(entryLabels), ...Object.values(incidentLabels)]) {
    assert.ok(state.label.trim()); assert.ok(state.icon.trim())
    assert.ok(['info', 'warning', 'error', 'success', 'neutral'].includes(state.tone))
  }
})
