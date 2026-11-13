import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { canAccessPrivate } from '../auth/guards'
import { NativeOfflineVault, type VaultRuntime } from './nativeVault'
import { OfflineApi } from './api'
import { PackageDownloader } from './download'
import { nativeClock } from './clock'
import { sameBinding, type PackageRecord, type PreparationState } from './contracts'
import { OfflineSyncController } from './sync/controller'
import { SyncApi } from './sync/api'
import type { SyncItem, SyncProgress } from './sync/contracts'
import { DisciplineApi } from '../incidents/api'
import { IncidentSync } from '../incidents/sync'
import type { IncidentItem } from '../incidents/contracts'
import { OfflineProtectionError } from './protection'

interface OfflineContext {
  runtime: VaultRuntime | null; packages: PackageRecord[]; pending: number; busy: boolean; error: string | null
  preparation: PreparationState
  syncItems: SyncItem[]; syncProgress: SyncProgress; synchronize(): Promise<void>
  incidentItems: IncidentItem[]; synchronizeIncidents(): Promise<void>
  open(): Promise<void>; refresh(): Promise<void>; download(examId: string, resumeId?: string): Promise<void>
}
const Context = createContext<OfflineContext | null>(null)
export function OfflineProvider({ children }: PropsWithChildren) {
  const { controller, session } = useAuth()
  const [vault] = useState(() => new NativeOfflineVault())
  const [runtime, setRuntime] = useState<VaultRuntime | null>(null)
  const [packages, setPackages] = useState<PackageRecord[]>([])
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preparation, setPreparation] = useState<PreparationState>('NO_DESCARGADO')
  const [syncItems, setSyncItems] = useState<SyncItem[]>([])
  const [incidentItems, setIncidentItems] = useState<IncidentItem[]>([])
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ running: false, total: 0, processed: 0, batches: 0, message: null })
  const work = useRef(false)
  const foreground = useRef(AppState.currentState == null || AppState.currentState === 'active')
  const [activation, setActivation] = useState(0)
  const attempted = useRef<string | null>(null)
  const clearView = useCallback(() => {
    setRuntime(null); setPackages([]); setPending(0); setSyncItems([]); setIncidentItems([])
    setSyncProgress({ running: false, total: 0, processed: 0, batches: 0, message: null })
  }, [])
  const lock = useCallback(async () => { clearView(); await vault.lock() }, [vault, clearView])
  const refresh = useCallback(async () => {
    const r = vault.runtime
    if (!r) { clearView(); return }
    const sample = await nativeClock.sample()
    await r.outbox.reconcile()
    const records = await r.repo.list()
    for (const p of records) if (p.active && p.state === 'PREPARADO') {
      try { await r.repo.usable(p.id, sample) } catch { /* expired state persisted; boot mismatch remains locked by usable */ }
    }
    const current = await r.repo.list(), count = await r.repo.pendingCount()
    const items = await r.outbox.items()
    const reports = await r.incidents.items()
    r.check(); setPackages(current); setPending(count); setSyncItems(items); setIncidentItems(reports)
  }, [vault, clearView])
  useEffect(() => controller?.onSecurityBoundary(async (reason) => {
    attempted.current = null
    setError(null); clearView(); await vault.closeAccess(reason)
  }), [controller, vault, clearView])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active'
      if (active === foreground.current) return
      foreground.current = active
      if (active) setActivation((value) => value + 1)
      else {
        attempted.current = null
        void lock().catch(() => setError('No se pudo cerrar la información local. Reabre la aplicación.'))
      }
    })
    return () => { sub.remove(); void vault.lock().catch(() => {}) }
  }, [vault, lock])
  const open = useCallback(async () => {
    const current = controller?.getSnapshot()
    if (work.current || vault.runtime || !foreground.current || !current || current.busy || current.logoutPending) return
    const binding = canAccessPrivate(current) ? controller?.offlineBinding() : undefined
    if (!binding && (current.status !== 'offline' || !current.hasCredential)) return
    work.current = true; setBusy(true); setError(null)
    try {
      const r = await vault.open(binding ?? undefined, () => {
        void lock().catch(() => {})
        setError(new OfflineProtectionError('SESSION_REQUIRED').message)
      })
      await refresh()
      r.check(); setRuntime(r)
    } catch (e) {
      clearView(); await vault.lock().catch(() => {})
      if (foreground.current && !(e instanceof OfflineProtectionError && e.code === 'INTERRUPTED')) {
        setError(e instanceof Error ? e.message : 'No se pudo abrir la información.')
      }
    }
    finally { work.current = false; setBusy(false) }
  }, [controller, vault, clearView, lock, refresh])
  const eligible = !!controller && !session.busy && !session.logoutPending &&
    (canAccessPrivate(session) || (session.status === 'offline' && session.hasCredential))
  useEffect(() => {
    if (!eligible || !foreground.current || runtime || busy || work.current) return
    const key = JSON.stringify([activation, session.status, session.user?.id, session.deviceId, session.validatedAt, session.expiresAt])
    if (attempted.current === key) return
    attempted.current = key
    void open()
  }, [eligible, activation, session.status, session.user?.id, session.deviceId, session.validatedAt, session.expiresAt, runtime, busy, open])
  const download = async (examId: string, resumeId?: string) => {
    if (work.current) return
    const r = vault.runtime, binding = controller?.offlineBinding()
    if (!r || !controller || !binding || !sameBinding(binding, r.repo.binding)) {
      setError('Valida la cuenta original con conexión antes de preparar la lista.'); return
    }
    work.current = true; setBusy(true); setError(null); setPreparation('DESCARGANDO')
    try {
      // Stay below the existing 60/min route throttle without automatic retries.
      // Cancellation during pacing cannot resume a request for the previous scope.
      const beforePhoto = async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1200)); r.check() }
      await new PackageDownloader(new OfflineApi(controller, r.digest, beforePhoto), r.repo, nativeClock, r.validateKeys,
        () => { void refresh().catch(() => {}) }).run(examId, resumeId)
      await refresh()
      setPreparation('PREPARADO')
    } catch (e) {
      setPreparation('ERROR')
      setError(e instanceof Error ? e.message : 'Descarga interrumpida.')
      await refresh().catch(() => {})
    } finally { work.current = false; setBusy(false) }
  }
  const synchronize = async () => {
    if (work.current) return
    const r = vault.runtime
    if (!r || !controller?.offlineBinding()) { setError('Valida la cuenta original con conexión para enviar.'); return }
    work.current = true; setBusy(true); setError(null)
    try {
      await new OfflineSyncController(r.outbox, new SyncApi(controller), r.uuid, () => controller.offlineBinding()).sync((progress) => {
        // A late response cannot repopulate a view locked by logout/account switch.
        if (vault.runtime === r) { setSyncProgress(progress); void refresh().catch(() => {}) }
      })
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se confirmó la sincronización. Los eventos se conservaron.'); await refresh().catch(() => {}) }
    finally { work.current = false; setBusy(false) }
  }
  const synchronizeIncidents = async () => {
    if (work.current) return
    const r = vault.runtime
    if (!r || !controller?.offlineBinding()) { setError('Valida la cuenta original con conexión para enviar incidencias.'); return }
    work.current = true; setBusy(true); setError(null)
    try {
      await new IncidentSync(r.incidents, new DisciplineApi(controller), () => controller.offlineBinding(), r.uuid).run(() => {
        if (vault.runtime === r) void refresh().catch(() => {})
      })
      await refresh()
    } catch { setError('No se confirmó el envío de incidencias. Los reportes originales se conservan protegidos.'); await refresh().catch(() => {}) }
    finally { work.current = false; setBusy(false) }
  }
  return <Context.Provider value={{ runtime, packages, pending, busy, error, preparation, syncItems, syncProgress, synchronize, incidentItems, synchronizeIncidents, open, refresh, download }}>{children}</Context.Provider>
}
export function useOffline() { const value = useContext(Context); if (!value) throw new Error('OfflineProvider no está disponible.'); return value }
