import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { NativeOfflineVault, type VaultRuntime } from './nativeVault'
import { OfflineApi } from './api'
import { PackageDownloader } from './download'
import { nativeClock } from './clock'
import { sameBinding, type PackageRecord, type PreparationState } from './contracts'
import { OfflineSyncController } from './sync/controller'
import { SyncApi } from './sync/api'
import type { SyncItem, SyncProgress } from './sync/contracts'

interface OfflineContext {
  runtime: VaultRuntime | null; packages: PackageRecord[]; pending: number; busy: boolean; error: string | null
  preparation: PreparationState
  syncItems: SyncItem[]; syncProgress: SyncProgress; synchronize(): Promise<void>
  unlock(): Promise<void>; lock(): Promise<void>; refresh(): Promise<void>; download(examId: string, resumeId?: string): Promise<void>
}
const Context = createContext<OfflineContext | null>(null)
export function OfflineProvider({ children }: PropsWithChildren) {
  const { controller } = useAuth()
  const [vault] = useState(() => new NativeOfflineVault())
  const [runtime, setRuntime] = useState<VaultRuntime | null>(null)
  const [packages, setPackages] = useState<PackageRecord[]>([])
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preparation, setPreparation] = useState<PreparationState>('NO_DESCARGADO')
  const [syncItems, setSyncItems] = useState<SyncItem[]>([])
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ running: false, total: 0, processed: 0, batches: 0, message: null })
  const work = useRef(false)
  const clearView = useCallback(() => {
    setRuntime(null); setPackages([]); setPending(0); setSyncItems([])
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
    r.check(); setPackages(current); setPending(count); setSyncItems(items)
  }, [vault, clearView])
  useEffect(() => controller?.onSecurityBoundary(async (reason) => {
    clearView(); await vault.closeAccess(reason)
  }), [controller, vault, clearView])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void lock().catch(() => setError('El almacén local se bloqueó. Reabre la aplicación para desbloquearlo.'))
    })
    return () => { sub.remove(); void vault.lock().catch(() => {}) }
  }, [vault, lock])
  const unlock = async () => {
    if (work.current) return
    work.current = true; setBusy(true); setError(null)
    try { const r = await vault.unlock(controller?.offlineBinding() ?? undefined); r.check(); setRuntime(r); await refresh() }
    catch (e) { clearView(); await vault.lock().catch(() => {}); setPreparation('ERROR'); setError(e instanceof Error ? e.message : 'No se pudo desbloquear el almacén.') }
    finally { work.current = false; setBusy(false) }
  }
  const download = async (examId: string, resumeId?: string) => {
    if (work.current) return
    const r = vault.runtime, binding = controller?.offlineBinding()
    if (!r || !controller || !binding || !sameBinding(binding, r.repo.binding)) {
      setError('Valida la misma cuenta con internet y desbloquea su almacén antes de preparar.'); return
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
    if (!r || !controller?.offlineBinding()) { setError('Desbloquea la cola y valida con internet la cuenta original.'); return }
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
  return <Context.Provider value={{ runtime, packages, pending, busy, error, preparation, syncItems, syncProgress, synchronize, unlock, lock, refresh, download }}>{children}</Context.Provider>
}
export function useOffline() { const value = useContext(Context); if (!value) throw new Error('OfflineProvider no está disponible.'); return value }
