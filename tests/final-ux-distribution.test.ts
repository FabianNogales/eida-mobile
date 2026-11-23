import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { DistributionContext, PackageRecord } from '../src/features/offline/contracts'
import { copyMatchesDistribution, currentDistribution, prepareCopyContext, reconcileDistribution, resumableCopyId } from '../src/features/offline/distribution'
import { PackageDownloader } from '../src/features/offline/download'
import { captureProvisional } from '../src/features/offline/identity'
import { ApiError, httpError } from '../src/services/http/errors'
import { distributionAccess, ownExamPackages } from '../src/ui/controlScreens'
import { homeOverview } from '../src/ui/examPresentation'
import { anchor, envelope, harnessOffline, manifest, mockApi, packageId, provider, sample } from './support/offlineFixtures'

function context(overrides: Partial<DistributionContext> = {}): DistributionContext {
  return { exam: manifest().exam, can_prepare: true, unavailable_reason: null, distribution_id: '1', version: 1,
    frozen: true, stale: false, prepared_at: '2030-01-01T00:01:00Z', own_list_id: '2',
    lists: [{ list_id: '2', responsible_id: '7', responsible_name: 'Responsable', student_count: 1,
      surname_range: { from: 'A', to: 'Z' } }], ...overrides }
}
function copy(): PackageRecord {
  const m = manifest()
  return { id: m.package_id, examId: m.exam_id, state: 'PREPARADO', manifest: m, envelope: envelope(m),
    anchor, active: true, error: null }
}

test('a matching list ID never substitutes for the current distribution and version', () => {
  assert.equal(copyMatchesDistribution(copy(), context()), true)
  for (const current of [
    context({ version: 2 }), context({ distribution_id: '9' }), context({ own_list_id: '8' }),
    context({ stale: true }), context({ own_list_id: null }), context({ unavailable_reason: 'EXAM_FINISHED' }),
    context({ exam: { ...manifest().exam, id: 43 } }),
  ]) {
    assert.equal(copyMatchesDistribution(copy(), current), false)
    assert.deepEqual(ownExamPackages(current, [copy()], true), [])
    assert.equal(resumableCopyId(copy(), current), undefined)
  }
  assert.equal(resumableCopyId({ ...copy(), active: false, state: 'INCOMPLETA' }, context()), packageId)
  assert.equal(resumableCopyId({ ...copy(), state: 'DESACTUALIZADO' }, context()), undefined)
  assert.equal(resumableCopyId({ ...copy(), state: 'VENCIDO' }, context()), undefined)
})

test('a changed distribution blocks the old copy and a fresh download preserves original pending events', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const clock = { sample: async () => sample }
  await new PackageDownloader(mockApi(manifest()), h.repo, clock, async () => {}).run('42')
  const event = await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample,
    () => 'abcdef01-2345-4678-9abc-def012345678', provider)
  const before = JSON.stringify(await h.repo.event('42', '101'))
  const current = context({ distribution_id: '9', version: 2, own_list_id: '3' })
  await reconcileDistribution(h.repo, current)
  assert.equal((await h.repo.package(packageId)).state, 'DESACTUALIZADO')
  await assert.rejects(h.repo.usable(packageId, sample), /Actualizar copia/)
  await assert.rejects(captureProvisional(h.repo, packageId, '101', 'MANUAL', sample,
    () => 'bbbbbbbb-2345-4678-9abc-def012345678', provider), /Actualizar copia/)
  assert.equal(await h.repo.pendingCount(), 1)

  const fresh = manifest({ package_id: 'aaaaaaaa-2345-4678-9abc-def012345678',
    authorization_id: 'aaaaaaaa-2345-4678-9abc-def012345678', distribution_id: '9', version: 2, list_id: '3' })
  await new PackageDownloader(mockApi(fresh), h.repo, clock, async () => {}).run('42')
  assert.equal((await h.repo.usable(fresh.package_id, sample)).manifest.version, 2)
  assert.equal((await h.repo.package(packageId)).active, false)
  assert.equal(JSON.stringify(await h.repo.event('42', '101')), before)
  assert.equal((await h.repo.event('42', '101'))?.event_id, event.event_id)
  assert.equal(await h.repo.pendingCount(), 1)
})

test('only a currently authorized owner requests distribution preparation before downloading', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  let updated = false
  const calls: string[] = []
  const api = {
    context: async () => { calls.push('context'); return updated ? context({ version: 2 }) : context({ stale: true }) },
    prepare: async (examId: string) => { assert.equal(examId, '42'); calls.push('prepare'); updated = true },
  }
  const fresh = await prepareCopyContext(api, h.repo, '42')
  assert.deepEqual(calls, ['context', 'prepare', 'context'])
  assert.equal(fresh.version, 2)
  assert.equal(distributionAccess(context({ stale: true }), true).prepare, true)
  assert.equal(distributionAccess(context({ stale: true }), true).download, false)
})

test('collaborators refresh only their assignment and never prepare another distribution', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  let stale = true, prepareCalls = 0
  const api = {
    context: async () => context({ can_prepare: false, own_list_id: '3', stale, version: stale ? 1 : 2 }),
    prepare: async () => { prepareCalls++ },
  }
  await assert.rejects(prepareCopyContext(api, h.repo, '42'), /docente responsable.*Actualizar copia/)
  assert.equal(prepareCalls, 0)
  stale = false
  const fresh = await prepareCopyContext(api, h.repo, '42')
  assert.equal(fresh.own_list_id, '3')
  assert.equal(fresh.version, 2)
  assert.equal(prepareCalls, 0)
  assert.equal(distributionAccess(fresh, true).prepare, false)
  assert.equal(distributionAccess(fresh, true).download, true)
  assert.deepEqual(ownExamPackages(fresh, [copy()], true), [])
})

test('a server refusal remains a refusal with an actionable message and no revival of stale copies', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, { sample: async () => sample }, async () => {}).run('42')
  const api = { context: async () => context({ stale: true }),
    prepare: async (): Promise<never> => { throw httpError(409, { code: 'DISTRIBUTION_FROZEN' }) } }
  await assert.rejects(prepareCopyContext(api, h.repo, '42'),
    (error: unknown) => error instanceof ApiError && error.code === 'DISTRIBUTION_FROZEN' &&
      /responsable de EIDA.*Actualizar copia/.test(error.message))
  await assert.rejects(h.repo.usable(packageId, sample), /Actualizar copia/)
})

test('network failure keeps the offline copy; known loss of access blocks it', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  await new PackageDownloader(mockApi(manifest()), h.repo, { sample: async () => sample }, async () => {}).run('42')
  await assert.rejects(currentDistribution({ context: async (): Promise<never> => {
    throw new ApiError('network', 'Sin conexión')
  } }, h.repo, '42'))
  assert.equal((await h.repo.usable(packageId, sample)).active, true)
  await assert.rejects(currentDistribution({ context: async (): Promise<never> => {
    throw httpError(403, {})
  } }, h.repo, '42'))
  await assert.rejects(h.repo.usable(packageId, sample), /Actualizar copia/)
})

test('a distribution rejected during download also blocks the previous active copy', async (t) => {
  const h = await harnessOffline(); t.after(() => h.db.closeAsync())
  const m = manifest(), clock = { sample: async () => sample }
  await new PackageDownloader(mockApi(m), h.repo, clock, async () => {}).run('42')
  const rejected = { ...mockApi(m), package: async (): Promise<never> => {
    throw httpError(409, { code: 'DISTRIBUTION_FROZEN' })
  } }
  await assert.rejects(new PackageDownloader(rejected, h.repo, clock, async () => {}).run('42'))
  await assert.rejects(h.repo.usable(packageId, sample), /Actualizar copia/)
})

test('a collaborator-only Home can show its assigned exam without a teaching feed', () => {
  const skippedTeaching = { data: null, error: null, loading: false }
  const assignment = { exam_id: 42, exam_name: 'Asignado', subject_name: 'Materia', exam_date: '2030-01-01',
    start_time: '00:00:00', duration_minutes: 60, room: null }
  const view = homeOverview(skippedTeaching, { data: [assignment], error: null, loading: false }, false)
  assert.equal(view.error, null)
  assert.equal(view.control?.id, 42)
  assert.equal(view.control?.relation, 'Colaborador')
  assert.equal(homeOverview(skippedTeaching, { data: [], error: null, loading: false }, false).empty, true)
})

test('normal operator screens expose help and downloaded lists without device or diagnostic tools', () => {
  const source = (file: string) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
  const profile = source('screens/ProfileScreen.tsx')
  assert.doesNotMatch(profile, /Dispositivos autorizados|qr-diagnostics/)
  assert.match(profile, /ControlHelp/)
  assert.match(profile, /Cerrar sesión/)
  assert.match(source('app/(private)/devices.tsx'), /Redirect href="\/\(private\)\/\(tabs\)\/profile"/)
  const help = source('components/general/ControlHelp.tsx')
  for (const text of ['Prepara tu lista', 'sin internet', 'Envía los pendientes', 'cambió la distribución', 'Problemas frecuentes']) {
    assert.ok(help.includes(text))
  }
  assert.doesNotMatch(help, /QR v[23]|paquetes|manifiesto|diagnóstico|SQLCipher/)
  for (const file of ['screens/ProfileScreen.tsx', 'screens/LoginScreen.tsx', 'screens/SessionScreen.tsx',
    'screens/OfflinePackagesScreen.tsx']) {
    assert.doesNotMatch(source(file), /ProtectionDiagnostics|(?:push|navigate)\('\/qr-diagnostics'\)/)
  }
  assert.match(source('app/offline/_layout.tsx'), /Listas descargadas/)
  assert.match(source('screens/OfflineDistributionScreen.tsx'), /label="Listas descargadas"/)
})

