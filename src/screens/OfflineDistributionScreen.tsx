import { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { StatusBadge } from '../components/StatusBadge'
import { DistributionListCard } from '../components/control/DistributionListCard'
import { ExamHero } from '../components/control/ExamHero'
import { PreparationStatus } from '../components/control/PreparationStatus'
import { ExamActionRow } from '../components/general/ExamActionRow'
import { ExamIcon } from '../components/general/ExamIcon'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import { OfflineApi } from '../features/offline/api'
import { DisciplineApi } from '../features/incidents/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { usePrivateRefresh } from '../hooks/usePrivateRefresh'
import { ApiError } from '../services/http/errors'
import { listDestination } from '../ui/controlScreens'
import { detailPresentation, examExtraActions } from '../ui/examPresentation'

export function OfflineDistributionScreen() {
  const params = useLocalSearchParams<{ examId: string }>(), { session } = useAuth()
  const examId = typeof params.examId === 'string' ? params.examId : ''
  return <DistributionView key={String(session.user?.id) + ':' + examId} examId={examId} />
}
function DistributionView({ examId }: { examId: string }) {
  const { controller } = useAuth(), offline = useOffline(), router = useRouter()
  const [preparing, setPreparing] = useState(false), [prepareError, setPrepareError] = useState<string | null>(null)
  const [distribution, setDistribution] = useState(false), [actions, setActions] = useState(false)
  const api = useCallback(() => new OfflineApi(controller!, offline.runtime?.digest ?? (() => { throw new Error('No se pudo abrir la información local.')})), [controller, offline.runtime])
  const load = useCallback(async () => {
    const context = await api().context(examId).catch(async (error: unknown) => {
      if (error instanceof ApiError && error.status === 403 && offline.runtime) {
        for (const p of await offline.runtime.repo.list()) if (p.examId === examId) await offline.runtime.repo.setState(p.id, 'DESACTUALIZADO')
        await offline.refresh()
      }
      throw error
    })
    // Existing owner-only request; supervision never grants another list's download.
    if (context.can_prepare && context.distribution_id) await api().assignments(examId)
    if ((context.stale || context.unavailable_reason) && offline.runtime) {
      for (const p of await offline.runtime.repo.list()) if (p.examId === examId) await offline.runtime.repo.setState(p.id, 'DESACTUALIZADO')
      await offline.refresh()
    }
    return context
  }, [api, examId, offline.runtime, offline.refresh])
  const query = useRemoteQuery(load)
  const c = query.data && String(query.data.exam.id) === examId ? query.data : null
  const loadPermissions = useCallback(async (signal: AbortSignal) => {
    if (!controller || !c) return null
    const permission = await new DisciplineApi(controller).context(examId)
    if (signal.aborted) throw new ApiError('cancelled', 'Consulta cancelada.')
    return permission
  }, [controller, examId, c])
  const permissions = useRemoteQuery(loadPermissions)
  const refresh = usePrivateRefresh(query.reload, query.loading || permissions.loading || preparing || offline.busy)
  const view = c ? detailPresentation(c, offline.packages, offline.runtime !== null,
    !!controller?.offlineBinding(), offline.busy) : null
  const extras = examExtraActions(c?.exam.id ?? 0, permissions.loading || permissions.error ? null : permissions.data)
  const local = view?.local, latest = view?.latest
  return <Screen refresh={refresh}>
    <QueryFeedback loading={query.loading && !refresh.refreshing} error={query.error} label="Consultando examen" retry={refresh.onRefresh} />
    {prepareError && <Notice tone="error" message={prepareError} />}
    {offline.error && <Notice tone="error" message={offline.error} />}
    {c && view && <>
      <ExamHero exam={c.exam} relation={view.relation} />
      {c.stale && <Notice message="La distribución cambió. Tu lista requiere revisión antes de continuar." />}
      {c.unavailable_reason && <Notice tone="error" message="El servidor no permite preparar o abrir esta lista en su estado actual." />}
      <Card>
        <View style={s.listHeading}><View style={s.copy}>
          <AppText variant="caption" style={s.muted}>MI LISTA</AppText>
          <AppText variant="subtitle" accessibilityRole="header">{view.count === null ? 'Cantidad por confirmar' : `${view.count} estudiantes`}</AppText>
          {c.own_list_id && <AppText variant="caption" style={s.muted}>Lista {c.own_list_id}</AppText>}
        </View><View style={s.download}><ExamIcon name="download" /></View></View>
        {!c.own_list_id ? <AppText>{view.access.supervise ? 'Supervisión sin lista personal.' : 'Aún no tienes una lista asignada.'}</AppText>
          : offline.runtime ? <PreparationStatus state={latest?.state ?? 'NO_DESCARGADO'} active={latest?.active} />
            : <StatusBadge label="Preparación por consultar" />}
        {local && latest && local.id !== latest.id && <AppText variant="caption" style={s.muted}>Tu lista anterior sigue disponible mientras termina la preparación.</AppText>}
      </Card>
      {c.own_list_id && <>
        <ActionButton label="Controlar ingreso" icon={<ExamIcon name="qr" color={view.control ? theme.colors.onPrimary : theme.colors.muted} />}
          disabled={!view.control} onPress={() => {
          if (view.control && local) router.push(listDestination(local.id))
        }} />
        <ActionButton secondary label={local ? 'Ver preparación offline' : 'Preparar lista offline'}
          disabled={offline.busy || c.stale || !!c.unavailable_reason}
          onPress={() => router.push({ pathname: '/(private)/prepare-offline', params: { examId } })} />
        {!local && <AppText variant="caption" style={s.muted}>Prepara tu lista para controlar ingresos sin internet.</AppText>}
      </>}
      {!c.own_list_id && <EmptyState title={view.access.supervise ? 'Puedes supervisar la distribución' : 'Sin lista personal'}
        message={view.access.supervise ? 'Supervisar no permite descargar las listas de otras personas.' : 'Consulta con el responsable del examen.'} />}
      {c.can_prepare && !c.frozen && <ActionButton secondary label="Preparar distribución de listas"
        disabled={!view.prepareDistribution} busy={preparing} onPress={() => {
          setPreparing(true); setPrepareError(null)
          void api().prepare(examId).then(query.refresh)
            .catch((e) => setPrepareError(e instanceof Error ? e.message : 'No se pudo preparar.')).finally(() => setPreparing(false))
        }} />}
      <View>
        {extras.incidents && <ExamActionRow icon="alert" label="Incidencias"
          onPress={() => router.push({ pathname: '/(private)/incidents', params: { examId } })} />}
        {c.own_list_id && <ExamActionRow icon="clock" label="Seguimiento de mis ingresos" hint="Consultar pendientes y resultados"
          onPress={() => router.push('/offline/sync')} />}
        {extras.discipline && <ExamActionRow icon="shield" label={actions ? 'Ocultar acciones autorizadas' : 'Acciones autorizadas'}
          onPress={() => setActions((old) => !old)} />}
        {extras.discipline && actions && <View style={s.section}>
          <ActionButton secondary label="Infracciones" onPress={() => router.push({ pathname: '/(private)/infractions', params: { examId } })} />
          <ActionButton secondary label="Expulsiones y anulación" onPress={() => router.push({ pathname: '/(private)/discipline-actions', params: { examId } })} />
        </View>}
        {view.access.supervise && <ExamActionRow icon="list" label={distribution ? 'Ocultar distribución' : 'Supervisar distribución'}
          onPress={() => setDistribution((old) => !old)} />}
        <ExamActionRow icon="download" label="Mis paquetes" onPress={() => router.push('/offline')} />
      </View>
      {permissions.loading && <AppText variant="caption" style={s.muted}>Consultando acciones disponibles…</AppText>}
      {permissions.error && <View style={s.section}><AppText variant="caption" style={s.muted}>Las acciones adicionales no están disponibles.</AppText>
        <TextAction label="Reintentar consulta de acciones" onPress={() => { void permissions.reload() }} /></View>}
      {view.access.supervise && distribution && <View style={s.section}>
        <AppText variant="subtitle" accessibilityRole="header">Distribución de listas</AppText>
        <StatusBadge label={c.frozen ? 'Distribución preparada' : 'Sin preparar'} tone={c.stale ? 'warning' : 'neutral'} />
        {view.access.lists.map((list) => <DistributionListCard key={list.list_id} list={list} own={list.list_id === c.own_list_id} />)}
        {view.access.lists.length === 0 && <AppText>No hay listas preparadas.</AppText>}
        {c.frozen && <ActionButton secondary label="Verificar distribución" disabled={!view.prepareDistribution} busy={preparing}
          onPress={() => {
            setPreparing(true); setPrepareError(null)
            void api().prepare(examId).then(query.refresh)
              .catch((e) => setPrepareError(e instanceof Error ? e.message : 'No se pudo verificar.')).finally(() => setPreparing(false))
          }} />}
      </View>}
    </>}
    {!c && !query.loading && !query.error && <Notice message="No hay un examen autorizado disponible." />}
  </Screen>
}
const s = StyleSheet.create({
  section: { gap: theme.spacing.md }, muted: { color: theme.colors.muted },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }, copy: { flex: 1, gap: theme.spacing.sm },
  download: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
})
