import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { theme } from '../src/config/theme'
import { connectionLabels, observeConnectivity, type ConnectionState } from '../src/features/connectivity/state'
import { navigationAccess } from '../src/features/offline/navigationAccess'
import { checkOfflineGrant, localGrantProfile, onlineGrant } from '../src/features/offline/vaultAccess'
import { PackageDownloader } from '../src/features/offline/download'
import { captureProvisional } from '../src/features/offline/identity'
import { OfflineRepository } from '../src/features/offline/repository'
import { listDestination, localExamDestination } from '../src/ui/controlScreens'
import { logoutConfirmation } from '../src/ui/generalScreens'
import { pendingSummary } from '../src/ui/pendingSummary'
import { harness, NOW, response, stored, user } from './support/authFixtures'
import { binding, digest, harnessOffline, manifest, mockApi, packageId, provider, sample } from './support/offlineFixtures'
import { elements, renderPresentation } from './support/renderPresentation'

const waiting = { opened: false, error: null }
const ready = { opened: true, error: null }
const credential = stored({ apiBase: binding.apiBase })
const { id, display_name, email, roles } = user
const profile = { id, display_name, email, roles }
const grant = { ...onlineGrant(binding, credential, sample, NOW, null), profile }
const source = (path: string) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('transport errors in private queries preserve the active session; a revocation still closes it', async () => {
  const h = harness(async (path, _init, url) => {
    if (path === 'me') return response(url, { success: true, data: user })
    if (path === 'devices') throw new TypeError('offline')
    if (path === 'unavailable') return response(url, {}, 503)
    return response(url, { code: 'MOBILE_DEVICE_REVOKED' }, 403)
  })
  await h.storage.save(stored())
  await h.session.restore()
  await assert.rejects(h.session.request('devices'), { kind: 'network' })
  await assert.rejects(h.session.request('unavailable'), { status: 503 })
  assert.equal(navigationAccess(h.session.getSnapshot(), ready), 'online-session')
  assert.equal(h.session.getSnapshot().user?.id, user.id)
  await assert.rejects(h.session.request('revoked'), { code: 'MOBILE_DEVICE_REVOKED' })
  assert.equal(navigationAccess(h.session.getSnapshot(), ready), 'blocked')
})

test('cold restoration waits for local authorization and distinguishes same boot from an invalid grant', async () => {
  const h = harness(async () => { throw new TypeError('offline') })
  const saved = stored()
  const localGrant = onlineGrant({ ...binding, apiBase: saved.apiBase }, saved, sample, NOW, null)
  await h.storage.save(saved)
  const restoration = h.session.restore()
  assert.equal(navigationAccess(h.session.getSnapshot(), waiting), 'checking')
  await restoration
  const session = h.session.getSnapshot()
  assert.equal(session.status, 'offline')
  assert.equal(navigationAccess(session, waiting), 'checking')

  function openLocal(clock: typeof sample, permission: typeof localGrant | null) {
    try {
      checkOfflineGrant(permission, saved, clock)
      return ready
    } catch (error) {
      assert.ok(error instanceof Error)
      return { opened: false, error: error.message }
    }
  }

  assert.equal(navigationAccess(session, openLocal({ ...sample, elapsed: sample.elapsed + 10_000 }, localGrant)), 'local-session')
  assert.equal(navigationAccess(session, openLocal({ ...sample, boot: 'new-boot' }, localGrant)), 'blocked')
  assert.equal(navigationAccess(session, openLocal({ ...sample, elapsed: sample.elapsed + 3_600_000 }, localGrant)), 'blocked')
  assert.equal(navigationAccess(session, openLocal(sample, null)), 'blocked')
})

test('Profile uses only the protected identity without a network request and explains unavailable data', () => {
  const h = harness()
  for (const local of [localGrantProfile(grant, binding), null]) {
    const session = { ...h.session.getSnapshot(), status: 'offline', hasCredential: true }
    const tree = renderPresentation('screens/ProfileScreen.tsx', 'ProfileScreen', {}, {
      react: { useState: (value: unknown) => [value, () => {}] },
      'expo-constants': { default: {} },
      'expo-router': { useRouter: () => ({}) },
      '../components/Screen': { Screen: 'Screen' },
      '../components/ActionButton': { ActionButton: 'ActionButton' },
      '../components/AppText': { AppText: 'AppText' },
      '../components/Card': { Card: 'Card' },
      '../components/ConfirmDialog': { ConfirmDialog: 'ConfirmDialog' },
      '../components/Notice': { Notice: 'Notice' },
      '../components/StatusBadge': { StatusBadge: 'StatusBadge' },
      '../components/general/IdentityBlock': { IdentityBlock: 'IdentityBlock' },
      '../components/general/ExamIcon': { ExamIcon: 'ExamIcon' },
      '../components/operations/OperationDetails': { OperationDetails: 'OperationDetails' },
      '../config/theme': { theme },
      '../features/auth/AuthProvider': { useAuth: () => ({ session, controller: h.session }) },
      '../features/offline/OfflineProvider': { useOffline: () => ({ access: 'local-session', runtime: { profile: local, repo: { binding } },
        syncItems: [], incidentItems: [], busy: false }) },
      '../features/connectivity/NetworkProvider': { useNetwork: () => 'offline' },
      '../features/connectivity/state': { connectionLabels },
      '../ui/generalScreens': { logoutConfirmation },
      '../ui/pendingSummary': { pendingSummary },
      '../ui/useQueueReadiness': { useQueueReadiness: () => true },
      '../utils/dates': { laPazInstant: () => '' },
    })
    const account = tree.type
    assert.ok(typeof account === 'function')
    const nodes = elements(Reflect.apply(account, undefined, [tree.props]))
    assert.equal(nodes.find((node) => node.type === 'IdentityBlock')?.props.name, local?.display_name)
    assert.equal(nodes.some((node) => node.type === 'Notice' && String(node.props.message).includes('datos de tu perfil')), !local)
    assert.ok(nodes.some((node) => node.type === 'Notice' && String(node.props.message).includes('dispositivos requiere conexión')))
  }
  assert.equal(h.calls.length, 0)
  assert.equal(localGrantProfile(grant, { ...binding, deviceId: '99' }), null)
})

test('leaving and reopening downloaded control keeps the same copy and only confirmed pending entries', async (t) => {
  const h = await harnessOffline()
  t.after(() => h.db.closeAsync())
  const m = manifest({ students: [...manifest().students, {
    ...manifest().students[0]!, student_id: '102', sis_code: '203000102', identity_number: 'CI-102',
  }] })
  await new PackageDownloader(mockApi(m), h.repo, { sample: async () => sample }, async () => {}).run('42')
  const recorded = await captureProvisional(h.repo, packageId, '101', 'MANUAL', sample,
    () => 'abcdef01-2345-4678-9abc-def012345678', provider)
  const beforeExit = await h.repo.usable(packageId, sample)
  await h.repo.student(beforeExit.id, '102') // Open a review without confirming it.
  assert.deepEqual(localExamDestination(beforeExit.examId), { pathname: '/(private)/offline-distribution', params: { examId: '42' } })
  const reopened = new OfflineRepository(h.connection, binding, digest)
  const active = await reopened.usable(packageId, { ...sample, elapsed: sample.elapsed + 10_000 })
  assert.deepEqual(listDestination(active.id), { pathname: '/offline/list', params: { packageId } })
  assert.equal(await reopened.pendingCount(), 1)
  assert.equal((await reopened.event('42', '101'))?.event_id, recorded.event_id)
  assert.equal(await reopened.event('42', '102'), null)
  assert.match(source('screens/OfflineListScreen.tsx'), /router\.dismissTo\(localExamDestination\(examId\)\)/)
  for (const tab of ['exams', 'pending', 'profile']) {
    assert.ok(source('screens/OfflineListScreen.tsx').includes("router.dismissTo('/(private)/(tabs)/" + tab + "')"))
  }
  assert.match(source('screens/OfflineDistributionScreen.tsx'), /listDestination\(copy.id\)/)
})

test('header connectivity waits for network evidence and refreshes on foreground without using API status', async () => {
  const states: ConnectionState[] = ['unknown']
  const queries: Array<(value: unknown) => void> = []
  const listeners: { network?: (value: unknown) => void; foreground?: () => void } = {}
  const stop = observeConnectivity({
    read: () => new Promise((resolve) => { queries.push(resolve) }),
    onChange(listener) { listeners.network = listener; return () => { delete listeners.network } },
    onForeground(listener) { listeners.foreground = listener; return () => { delete listeners.foreground } },
  }, (state) => states.push(state))
  assert.notEqual(connectionLabels[states[0]!], 'En línea')
  listeners.network?.(false)
  queries[0]?.(true) // A slower initial sample must not undo the latest event.
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.deepEqual(states, ['unknown', 'offline'])
  listeners.foreground?.()
  queries[1]?.(true)
  await new Promise<void>((resolve) => setImmediate(resolve))
  listeners.network?.(null)
  listeners.network?.(false)
  assert.deepEqual(states.map((state) => connectionLabels[state]),
    ['Comprobando red', 'Sin conexión', 'En línea', 'Comprobando red', 'Sin conexión'])
  listeners.foreground?.()
  stop()
  queries[2]?.(true)
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(states.at(-1), 'offline')
  assert.deepEqual(listeners, {})
})

test('QR diagnostics and the raw QR panel are guarded in release routes and actions', () => {
  assert.match(source('app/_layout.tsx'), /<Stack.Protected guard=\{__DEV__\}>\s*<Stack.Screen name="qr-diagnostics"/)
  for (const name of ['LoginScreen', 'SessionScreen', 'ProfileScreen']) {
    assert.match(source('screens/' + name + '.tsx'), /\{__DEV__ && <[^\n]+Diagnóstico QR v3/)
  }
  assert.match(source('screens/OfflineListScreen.tsx'), /\{__DEV__ && !qrBlock && showExternal/)
})
