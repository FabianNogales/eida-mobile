import { useCallback, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused, useRouter } from 'expo-router'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { ListScreen } from '../components/ListScreen'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { ProgressBar } from '../components/ProgressBar'
import { OfflineAccessStatus } from '../components/control/OfflineAccessStatus'
import { ChoiceChips } from '../components/operations/ChoiceChips'
import { OperationDetails } from '../components/operations/OperationDetails'
import { QueueRecordDetails, QueueRecordRow, QueueSegments, QueueSyncButton } from '../components/operations/QueueViews'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { parseUser } from '../features/auth/api'
import { canAccessPrivate } from '../features/auth/guards'
import { sameBinding } from '../features/offline/contracts'
import type { VaultRuntime } from '../features/offline/nativeVault'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { useScreenRefresh } from '../hooks/useScreenRefresh'
import { ApiError } from '../services/http/errors'
import { object } from '../services/http/schema'
import { entryQueueRows, incidentQueueRows, pendingCount, queueAttemptSummary, queueCanSend, queueIssue,
  type QueueKind, type QueueRow } from '../ui/queuePresentation'

const filters = [
  { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Por enviar' },
  { value: 'confirmed', label: 'Confirmados' }, { value: 'duplicate', label: 'Duplicados' }, { value: 'conflict', label: 'Conflictos' },
  { value: 'rejected', label: 'Rechazados' },
] as const
type QueueFilter = typeof filters[number]['value']
const filterStates: Record<Exclude<QueueFilter, 'all'>, QueueRow['state'][]> = {
  pending: ['PENDING', 'SENDING'], confirmed: ['CONFIRMED'], duplicate: ['DUPLICATE'], conflict: ['CONFLICT'], rejected: ['REJECTED'],
}
type Attempt = { runtime: VaultRuntime; kind: QueueKind; ids: ReadonlySet<string>; completeScope: boolean; error: string | null }
const sendingFromQueue = new WeakSet<VaultRuntime>()

export function PendingOverviewScreen() { return <PendingQueues /> }

export function PendingQueues({ only, eventId, footer }: { only?: QueueKind; eventId?: string; footer?: ReactNode }) {
  const router = useRouter(), { session, controller } = useAuth()
  const offline = useOffline(), focused = useIsFocused()
  const runtime = session.logoutPending || session.status === 'expired' ||
    (session.user && String(session.user.id) !== offline.runtime?.repo.binding.userId) ? null : offline.runtime
  const [kind, setKind] = useState<QueueKind>(only ?? 'entries')
  const [selected, setSelected] = useState<{ runtime: VaultRuntime; kind: QueueKind; id: string } | null>(null)
  const [filterByKind, setFilterByKind] = useState<Record<QueueKind, QueueFilter>>({ entries: 'all', incidents: 'all' })
  const [showFilters, setShowFilters] = useState(false)
  const [running, setRunning] = useState<{ runtime: VaultRuntime; kind: QueueKind } | null>(null)
  const [checkingConnection, setCheckingConnection] = useState(false)
  const [summary, setSummary] = useState<Attempt | null>(null)
  const [message, setMessage] = useState<{ runtime: VaultRuntime; kind: QueueKind; text: string } | null>(null)
  const filter = filterByKind[kind]
  const setFilter = (value: QueueFilter) => setFilterByKind((old) => ({ ...old, [kind]: value }))
  const load = useCallback(async (signal: AbortSignal) => {
    if (!runtime) return null
    const readEntries = async () => {
      const items = await runtime.outbox.items()
      return { rows: entryQueueRows(items, runtime.repo.binding.userId), pending: await runtime.repo.pendingCount() }
    }
    const [entries, incidents] = await Promise.allSettled([
      only === 'incidents' ? Promise.resolve(null) : readEntries(),
      only === 'entries' ? Promise.resolve(null) : runtime.incidents.items(),
    ])
    runtime.check()
    if (signal.aborted) return null
    return {
      entries: entries.status === 'fulfilled' ? entries.value : null,
      incidents: incidents.status === 'fulfilled' && incidents.value ? incidentQueueRows(incidents.value, runtime.repo.binding) : null,
    }
  // The provider publishes new snapshots after capture or synchronization.
  }, [runtime, only, offline.syncItems, offline.incidentItems])
  const query = useRemoteQuery(load)
  const entryRecords = query.data?.entries ?? null
  const records = kind === 'entries' ? entryRecords?.rows ?? null : query.data?.incidents ?? null
  const rows = records?.filter((row) => (!eventId || row.id === eventId) &&
    (filter === 'all' || filterStates[filter].includes(row.state))) ?? []
  const detail = focused && selected && selected.runtime === runtime && selected.kind === kind && (!eventId || selected.id === eventId)
    ? records?.find((row) => row.id === selected.id) : undefined
  const ownRun = running && running.runtime === runtime ? running.kind : null
  const currentMessage = message && message.runtime === runtime && message.kind === kind ? message.text : null
  const currentSummary = focused && summary && summary.runtime === runtime && summary.kind === kind ? summary : null
  const readError = !!runtime && !query.loading && records === null
  const refresh = useScreenRefresh(query.reload, focused && !!runtime && !query.loading && !offline.busy && !ownRun && !detail && !currentSummary)
  const authorized = canAccessPrivate(session) && !session.busy
  const binding = authorized ? controller?.offlineBinding() ?? null : null
  const localBinding = runtime?.repo.binding ?? null
  const sameAccount = !!(binding && localBinding && sameBinding(binding, localBinding))
  const count = kind === 'entries' ? entryRecords?.pending ?? null : pendingCount(records)
  const canSend = focused && queueCanSend(records, localBinding, binding,
    offline.busy || ownRun !== null || query.loading || (!!runtime && sendingFromQueue.has(runtime)), count)
  const reviewing = records?.some(({ state }) => state === 'CONFLICT' || state === 'REJECTED')
  const kindRunning = ownRun === kind || (kind === 'entries' && offline.syncProgress.running)
  const showProgress = kindRunning && kind === 'entries' && offline.syncProgress.running && offline.syncProgress.total > 0

  async function send() {
    if (!runtime || !controller || !records || !canSend || sendingFromQueue.has(runtime)) return
    const initial = controller.offlineBinding()
    if (!initial || !sameBinding(runtime.repo.binding, initial)) return
    try { runtime.check() } catch { return }
    sendingFromQueue.add(runtime)
    setRunning({ runtime, kind }); setCheckingConnection(true); setMessage(null); setSummary(null)
    const ids = new Set(records.filter(({ state }) => state === 'PENDING').map(({ id }) => id))
    const completeScope = count === ids.size
    let attempted = false
    try {
      const reply = object(await controller.request('me'))
      const user = parseUser(reply.data)
      const current = controller.offlineBinding()
      runtime.check()
      if (reply.success !== true || !current || !sameBinding(runtime.repo.binding, current) ||
          String(user.id) !== current.userId || user.status !== 'ACTIVE' || user.must_change_password ||
          !canAccessPrivate(controller.getSnapshot()) || controller.getSnapshot().busy) {
        setMessage({ runtime, kind, text: 'Valida la cuenta original para sincronizar.' })
        return
      }
      attempted = true
      setCheckingConnection(false)
      if (kind === 'entries') await offline.synchronize()
      else await offline.synchronizeIncidents()
      setSummary({ runtime, kind, ids, completeScope, error: null })
    } catch (error) {
      const text = error instanceof ApiError && (error.status === 401 || error.status === 403)
        ? 'La sesión o el permiso de envío no están disponibles.'
        : 'No se pudo completar la conexión con el servidor. Los registros siguen disponibles.'
      if (attempted) setSummary({ runtime, kind, ids, completeScope, error: text })
      else setMessage({ runtime, kind, text })
    } finally {
      if (attempted) query.refresh()
      sendingFromQueue.delete(runtime)
      setCheckingConnection(false)
      setRunning(null)
    }
  }

  const counts = currentSummary && records ? queueAttemptSummary(records, currentSummary.ids) : null
  const issue = currentSummary && (currentSummary.error ?? queueIssue(records, currentSummary.ids) ??
    (offline.error ? 'No se pudo completar el envío. Revisa los registros y su estado.' :
      count !== null && count > 0 ? 'Todavía hay registros por enviar.' : null))

  return <>
    <ListScreen data={rows} keyExtractor={(row) => row.id} refresh={refresh} ListHeaderComponent={<View style={s.header}>
      {!only && <QueueSegments value={kind} entryCount={entryRecords?.pending ?? null}
        incidentCount={pendingCount(query.data?.incidents ?? null)} onChange={setKind} />}
      {session.status === 'offline' && <StatusBadge label="Sin conexión" tone="warning" />}
      {ownRun !== null && !checkingConnection && sameAccount && <StatusBadge label="Conexión comprobada" tone="success" />}
      {currentMessage && <Notice message={currentMessage} />}
      {!runtime ? <OfflineAccessStatus loadingLabel="Abriendo registros pendientes" /> : <>
        <View style={s.toolbar}>
          <AppText variant="label" accessibilityRole="header">Registros recientes</AppText>
          {(kindRunning || (count !== null && count > 0)) &&
            <QueueSyncButton disabled={!canSend} onPress={() => { void send() }} />}
        </View>
        {kindRunning && <ProgressBar label={showProgress ? 'Sincronizando registros · recibos procesados' :
          checkingConnection ? 'Comprobando conexión' : 'Sincronizando registros…'}
          value={showProgress ? offline.syncProgress.processed / offline.syncProgress.total : null} />}
        {!kindRunning && count !== null && count > 0 && !sameAccount && session.status !== 'offline' &&
          <Notice message="Valida la cuenta original para sincronizar." />}
        {session.status === 'offline' && count !== null && count > 0 && <AppText variant="caption">Podrás enviar cuando recuperes la conexión y valides tu sesión.</AppText>}
        {readError && <><Notice tone="error" message="No se pudo leer esta cola del almacén protegido." />
          <ActionButton secondary label="Reintentar lectura" disabled={!refresh.enabled} onPress={refresh.onRefresh} /></>}
        {query.loading && !refresh.refreshing && !kindRunning && <LoadingState label="Consultando registros" />}
        {records && records.length > 0 && !eventId && <View style={s.filters}>
          <TextAction label={showFilters ? 'Ocultar filtros' : filter === 'all' ? 'Filtros' :
            'Filtro · ' + (kind === 'incidents' && filter === 'confirmed' ? 'Recibidos' : filters.find(({ value }) => value === filter)?.label ?? 'Todos')}
            onPress={() => setShowFilters((value) => !value)} />
          {showFilters && <ChoiceChips options={filters
            .filter(({ value }) => kind === 'entries' || value !== 'duplicate').map((option) =>
            kind === 'incidents' && option.value === 'confirmed' ? { ...option, label: 'Recibidos' } : option)}
            value={filter} onChange={setFilter} />}
        </View>}
        {count === 0 && records && records.length > 0 && !eventId && <StatusBadge tone={reviewing ? 'warning' : 'neutral'}
          label={reviewing ? 'Sin envíos pendientes · hay resultados por revisar' : 'Sin envíos pendientes'} />}
      </>}
    </View>}
    renderItem={({ item }) => <QueueRecordRow row={item} kind={kind}
      onOpen={() => { if (runtime) setSelected({ runtime, kind, id: item.id }) }} />}
    ListEmptyComponent={records ? <EmptyState
      title={eventId ? 'Registro no disponible' : count && records.length === 0 ? 'Hay registros por enviar' :
        filter === 'pending' || records.length === 0 ? 'Sin pendientes de envío' : 'Sin registros en esta vista'}
      message={eventId ? 'Consulta la lista de incidencias de tu cuenta.' : filter !== 'all' ? 'Prueba con otro filtro.'
        : count && records.length === 0 ? 'El detalle estará disponible cuando se prepare el envío.'
          : 'Los registros aparecerán aquí cuando estén disponibles.'} /> : undefined}
    ListFooterComponent={<View style={s.header}>
      {runtime && focused && footer}
      {!only && <TextAction label="Paquetes protegidos" onPress={() => router.push('/offline')} />}
    </View>} />
    {detail && !currentSummary && <OperationDetails title="Detalle de sincronización" footerBack onClose={() => setSelected(null)}>
      <QueueRecordDetails row={detail} kind={kind} onClose={() => setSelected(null)}
        onOfficial={sameAccount && detail.officialIncident != null && kind === 'incidents'
          ? () => {
            const current = controller?.offlineBinding()
            if (runtime && current && sameBinding(runtime.repo.binding, current) && detail.officialIncident != null) {
              setSelected(null)
              router.push({ pathname: '/(private)/incident', params: { examId: detail.examId, incidentId: String(detail.officialIncident) } })
            }
          } : undefined} />
    </OperationDetails>}
    {currentSummary && <OperationDetails title="Resultado de sincronización" footerBack onClose={() => setSummary(null)}>
      {issue && <Notice message={issue} />}
      {counts && count !== null ? <Card>
        {currentSummary.completeScope && <>
          <AppText>{counts.accepted} {kind === 'entries' ? 'aceptados' : 'reportes recibidos'}</AppText>
          {kind === 'entries' && <AppText>{counts.duplicates} duplicados</AppText>}
          <AppText>{counts.conflicts} conflictos · {counts.rejected} rechazados</AppText>
        </>}
        <AppText>{count} por enviar</AppText>
      </Card> : readError ? <Notice message="No se pudieron verificar los resultados en el almacén." /> : <LoadingState label="Consultando resultados" />}
      <ActionButton label="Ver resultados" onPress={() => { setSummary(null); setSelected(null); setFilter('all') }} />
      <ActionButton secondary label={only ? 'Volver a la lista' : 'Volver a Pendientes'} onPress={() => setSummary(null)} />
    </OperationDetails>}
  </>
}

const s = StyleSheet.create({
  header: { gap: theme.spacing.md },
  filters: { alignItems: 'flex-start', gap: theme.spacing.xs },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.sm },
})
