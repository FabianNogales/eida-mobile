import test from 'node:test'
import assert from 'node:assert/strict'
import { PackageDownloader } from '../src/features/offline/download'
import type { DistributionContext, PackageRecord } from '../src/features/offline/contracts'
import type { SyncItem } from '../src/features/offline/sync/contracts'
import { distributionAccess, listDestination, manualAvailability, manifestPhotoSummary, ownExamPackages,
  packageActions, packageViewAllowed, preparationLabels, scanDestination, searchPageMatches,
  studentEntryLabel, studentPhotoLabel } from '../src/ui/controlScreens'
import { anchor, envelope, harnessOffline, manifest, mockApi, packageId, sample } from './support/offlineFixtures'

function record(overrides: Partial<PackageRecord> = {}): PackageRecord {
  const m = manifest()
  return { id: packageId, examId: m.exam_id, manifest: m, envelope: envelope(m), anchor, active: true,
    state: 'PREPARADO', error: null, ...overrides }
}
function context(overrides: Partial<DistributionContext> = {}): DistributionContext {
  return { exam: manifest().exam, can_prepare: true, unavailable_reason: null, distribution_id: '1',
    version: 1, frozen: true, stale: false, prepared_at: '2030-01-01T00:01:00Z', own_list_id: '2',
    lists: [{ list_id: '2', responsible_id: '7', responsible_name: 'Responsable de prueba', student_count: 1,
      surname_range: { from: 'Álvarez', to: 'Álvarez' } },
    { list_id: '3', responsible_id: '8', responsible_name: 'Colaborador de prueba', student_count: 4,
      surname_range: { from: 'B', to: 'Z' } }], ...overrides }
}
test('authorized context offers only the assigned list while supervision remains metadata', () => {
  const c = context(), access = distributionAccess(c, true)
  assert.equal(access.supervise, true); assert.equal(access.download, true)
  assert.equal(access.ownList?.list_id, '2'); assert.equal(access.lists.length, 2)
  assert.deepEqual(ownExamPackages(c, [record(), record({ manifest: manifest({ list_id: '3' }) })], true).map((p) => p.manifest.list_id), ['2'])
})
test('a collaborator sees only their assignment and cannot prepare the distribution', () => {
  const access = distributionAccess(context({ can_prepare: false, own_list_id: '3' }), true)
  assert.equal(access.prepare, false); assert.equal(access.supervise, false); assert.equal(access.download, true)
  assert.deepEqual(access.lists.map((list) => list.list_id), ['3'])
})
test('a supervisor without own list gets no downloadable records or inferred assignment', () => {
  const c = context({ own_list_id: null })
  assert.equal(distributionAccess(c, true).supervise, true)
  assert.equal(distributionAccess(c, true).download, false)
  assert.equal(distributionAccess(c, true).ownList, null)
  assert.deepEqual(ownExamPackages(c, [record()], true), [])
  const unassigned = distributionAccess(context({ can_prepare: false, own_list_id: null }), true)
  assert.deepEqual(unassigned.lists, []); assert.equal(unassigned.prepare, false)
})
test('stale, unavailable or locked contexts do not offer a personal download', () => {
  for (const c of [context({ stale: true }), context({ unavailable_reason: 'MOBILE_ABILITY_REQUIRED' })]) {
    assert.equal(distributionAccess(c, true).download, false)
    assert.equal(distributionAccess(c, true).prepare, false)
  }
  assert.equal(distributionAccess(context(), false).download, false)
  assert.deepEqual(ownExamPackages(context(), [record()], false), [])
})
test('preparation states stay distinct; incomplete copies never open and retries require online binding', () => {
  assert.equal(Object.keys(preparationLabels).length, 7)
  assert.equal(packageActions(record(), true, false).open, true)
  for (const state of ['NO_DESCARGADO', 'DESCARGANDO', 'INCOMPLETA', 'DESACTUALIZADO', 'VENCIDO', 'ERROR'] as const) {
    assert.equal(packageActions(record({ state }), true, true).open, false, state)
  }
  assert.equal(packageActions(record({ active: false, state: 'INCOMPLETA' }), true, true).resume, true)
  assert.equal(packageActions(record({ active: false, state: 'INCOMPLETA' }), true, false).resume, false)
  assert.equal(packageActions(record({ active: false, state: 'DESACTUALIZADO' }), true, true).resume, false)
  assert.equal(packageActions(record(), false, true).open, false)
})
test('personal data gate rejects missing, changed, blocked and unpublished package scopes', () => {
  assert.equal(packageViewAllowed(record(), packageId, true, false), true)
  assert.equal(packageViewAllowed(record(), 'another-package', true, false), false)
  assert.equal(packageViewAllowed(record(), packageId, false, false), false)
  assert.equal(packageViewAllowed(record(), packageId, true, true), false)
  assert.equal(packageViewAllowed(record({ active: false }), packageId, true, false), false)
  assert.equal(packageViewAllowed(record({ state: 'VENCIDO' }), packageId, true, false), false)
  assert.equal(packageViewAllowed(null, packageId, true, false), false)
})
test('legitimate photo absence remains explicit and never substitutes for an invalid present image', () => {
  const m = manifest(), student = m.students[0]
  assert.ok(student)
  assert.deepEqual(manifestPhotoSummary(m), { present: 0, absent: 2 })
  assert.match(studentPhotoLabel(student), /Ausencia/)
  assert.match(studentPhotoLabel({ photos: [] }), /no informada/)
  student.photos[0] = { kind: 'profile', state: 'PRESENT', mime: 'image/png', size: 3, revision: '1',
    sha256: 'a'.repeat(64), path: `exams/42/offline/packages/${packageId}/photos/101/profile` }
  assert.deepEqual(manifestPhotoSummary(m), { present: 1, absent: 1 })
  assert.match(studentPhotoLabel(student), /disponible en la ficha/)
})
test('manual affordances reuse the existing eligibility guard and local duplicate knowledge', () => {
  const student = manifest().students[0]
  assert.ok(student)
  assert.equal(manualAvailability(student, false).allowed, true)
  assert.equal(manualAvailability(student, true).allowed, false)
  for (const value of [{ ...student, student_status: 'INACTIVE' }, { ...student, enrollment_status: null },
    { ...student, eligibility_status: 'INELIGIBLE' }, { ...student, entry_status: 'REGISTERED' as const }]) {
    assert.equal(manualAvailability(value, false).allowed, false)
  }
})
test('entry labels distinguish a snapshot, provisional event and actual server receipts', () => {
  const item: SyncItem = { eventId: 'event-1', examId: '42', packageId, studentId: '101', actorId: '7', method: 'MANUAL',
    capturedAt: '2030-01-01T00:02:00Z', state: 'PENDING', attempts: 0, lastAttemptAt: null, errorCode: null, errorMessage: null, receipt: null }
  assert.match(studentEntryLabel({ entry_status: 'PENDING' }).label, /Sin ingreso en la copia/)
  assert.match(studentEntryLabel({ entry_status: 'REGISTERED' }).label, /en la copia/)
  assert.match(studentEntryLabel({ entry_status: 'PENDING' }, item).label, /sin nueva confirmación/)
  for (const status of ['ACCEPTED', 'DUPLICATE', 'CONFLICT', 'REJECTED'] as const) {
    const result = studentEntryLabel({ entry_status: 'PENDING' }, { ...item, receipt: { event_id: 'event-1', status,
      code: status, message: 'Respuesta de prueba', entry_id: 1, review_required: false, received_at: '2030-01-01T00:03:00Z' } })
    assert.equal(result.tone === 'success', status === 'ACCEPTED')
  }
})
test('query rows remain scoped to the original runtime, search term and page', () => {
  const runtime = {}, page = { runtime, term: 'Álvarez', offset: 50 }
  assert.equal(searchPageMatches(page, runtime, 'Álvarez', 'Álvarez', 50), true)
  assert.equal(searchPageMatches(page, {}, 'Álvarez', 'Álvarez', 50), false)
  assert.equal(searchPageMatches(page, runtime, '203000101', 'Álvarez', 50), false)
  assert.equal(searchPageMatches(page, runtime, 'Álvarez', 'Álvarez', 0), false)
})
test('list/search and scan links carry only package context, never student PII or QR payloads', () => {
  assert.deepEqual(listDestination(packageId), { pathname: '/offline/list', params: { packageId } })
  assert.deepEqual(listDestination(packageId, true), { pathname: '/offline/list', params: { packageId, focusSearch: '1' } })
  assert.deepEqual(scanDestination(packageId), { pathname: '/offline/scan', params: { packageId } })
})
test('real SQLite list searches preserve accented names, SIS, CI and literal wildcard protections', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest()
  await new PackageDownloader(mockApi(m), h.repo, { sample: async () => sample }, async () => {}).run('42')
  assert.equal(packageActions(await h.repo.usable(packageId, sample), true, false).open, true)
  for (const term of ['ÁLVAREZ', 'alvarez', '203000101', 'CI-101']) {
    const rows = await h.repo.search(packageId, term)
    assert.equal(rows[0]?.student_id, '101', term)
  }
  for (const term of ['%', '_', '!', 'ana%', 'ana_', 'ana!']) assert.equal((await h.repo.search(packageId, term)).length, 0, term)
  await assert.rejects(h.repo.student(packageId, '999'), /fuera de la lista/)
})
test('interrupted download stays incomplete while the old usable publication is preserved', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const clock = { sample: async () => sample }
  await new PackageDownloader(mockApi(manifest()), h.repo, clock, async () => {}).run('42')
  const next = manifest({ package_id: 'abcdef01-2345-4678-9abc-def012345678' })
  const student = next.students[0]; assert.ok(student)
  student.photos[0] = { kind: 'profile', state: 'PRESENT', mime: 'image/png', size: 3, revision: '1',
    sha256: 'a'.repeat(64), path: `exams/42/offline/packages/${next.package_id}/photos/101/profile` }
  const api = { ...mockApi(next), photo: async (): Promise<Uint8Array> => { throw new Error('Descarga interrumpida de prueba') } }
  await assert.rejects(new PackageDownloader(api, h.repo, clock, async () => {}).run('42'), /interrumpida/)
  assert.equal(packageActions(await h.repo.package(next.package_id), true, true).open, false)
  assert.equal((await h.repo.package(next.package_id)).state, 'INCOMPLETA')
  assert.equal(packageActions(await h.repo.usable(packageId, sample), true, false).open, true)
})
