import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { ListScreen } from '../components/ListScreen'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { IncidentDetails } from '../components/operations/IncidentDetails'
import { ChoiceChips } from '../components/operations/ChoiceChips'
import { OperationState } from '../components/operations/OperationState'
import { OperationDetails } from '../components/operations/OperationDetails'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import { incidentTypes, infractionTypes, type IncidentState } from '../features/incidents/contracts'
import { incidentDelivery, incidentLabels, incidentStates } from '../ui/operations'
import { useScreenRefresh } from '../hooks/useScreenRefresh'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { laPazInstant } from '../utils/dates'

export function OfflineIncidentsScreen() {
  const offline = useOffline(), r = offline.runtime, { controller } = useAuth(), router = useRouter()
  const params = useLocalSearchParams<{ eventId?: string }>()
  const [focused, setFocused] = useState(false)
  const [filter, setFilter] = useState<IncidentState | 'ALL'>('ALL')
  const [selected, setSelected] = useState<{ runtime: typeof r; id: string } | null>(null)
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setSelected(null) } }, []))
  // Re-read after the provider publishes an updated delivery snapshot.
  const deliveryItems = offline.incidentItems
  const loadLocal = useCallback(async () => {
    if (!r || !focused) return null
    const [drafts, items] = await Promise.allSettled([r.incidents.drafts(), r.incidents.items()])
    r.check()
    return { drafts, items }
  }, [r, focused, deliveryItems])
  const query = useRemoteQuery(loadLocal)
  const refresh = useScreenRefresh(query.reload, !!r && focused && !offline.busy && !query.loading && !selected)
  const reports = query.data?.items.status === 'fulfilled' ? query.data.items.value : null
  const drafts = query.data?.drafts.status === 'fulfilled' ? query.data.drafts.value : null
  const localError = query.error || query.data?.items.status === 'rejected' || query.data?.drafts.status === 'rejected'
  const known = reports !== null
  if (!r) return <Screen><Notice message="Desbloquea el almacén protegido. Las incidencias pendientes siguen cifradas." />
    <ActionButton label="Ir al desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (!focused) return <Screen><AppText>Consulta detenida.</AppText></Screen>
  const scopedItems = (reports ?? []).filter((item) => !params.eventId || item.event.event_id === params.eventId)
  const items = known ? scopedItems.filter((item) => filter === 'ALL' || item.state === filter) : []
  const item = selected && selected.runtime === r ? reports?.find((row) => row.event.event_id === selected.id) : null
  const options: { value: IncidentState | 'ALL'; label: string }[] = [{ value: 'ALL', label: `Todos (${scopedItems.length})` },
    ...incidentStates.map((state) => ({ value: state, label: `${incidentLabels[state].label} (${scopedItems.filter((i) => i.state === state).length})` }))]
  return <>
    <ListScreen data={items} refresh={refresh} keyExtractor={(row) => row.event.event_id} ListHeaderComponent={<View style={s.section}>
      <AppText variant="subtitle" accessibilityRole="header">Incidencias y borradores protegidos</AppText>
      <Notice tone="info" message="Un reporte no confirma una infracción ni aplica sanciones. Esta cola es independiente de los ingresos HU37." />
      {offline.error && <Notice tone="error" message={offline.error} />}
      {!controller?.offlineBinding() && <Notice message="Para enviar valida con internet la cuenta y dispositivo originales." />}
      <ActionButton label="Sincronizar incidencias" busy={offline.busy} disabled={!controller?.offlineBinding()} onPress={() => { void offline.synchronizeIncidents() }} />
      {known ? <ChoiceChips options={options} value={filter} onChange={setFilter} />
        : query.loading && !refresh.refreshing && <LoadingState label="Leyendo incidencias autorizadas" />}
    </View>} renderItem={({ item: row }) => <Card>
      <OperationState {...incidentDelivery(row)} />
      <AppText variant="subtitle">{incidentTypes.find((type) => type.value === row.event.type)?.label}</AppText>
      <AppText>Examen {row.event.exam_id} · {laPazInstant(row.event.captured_at)}</AppText>
      <ActionButton secondary label="Ver reporte y resultado" onPress={() => setSelected({ runtime: r, id: row.event.event_id })} />
    </Card>} ListEmptyComponent={known ? <EmptyState title="Sin reportes en esta vista" message="Los conflictos y rechazos se conservan en sus filtros." /> : undefined}
      ListFooterComponent={<View style={s.section}>
        {localError && <><Notice tone="error" message="No se pudo completar la consulta local de incidencias y borradores." />
          <ActionButton secondary label="Reintentar consulta local" onPress={refresh.onRefresh} disabled={offline.busy} /></>}
        {drafts && !params.eventId && <>
          <AppText variant="subtitle" accessibilityRole="header">Borradores de infracción</AppText>
          {drafts.length === 0 && <AppText>No hay borradores en la consulta local actual.</AppText>}
          {drafts.map((draft) => <Card key={draft.id}>
            <OperationState label="Borrador local · sin envío automático" icon="…" tone="warning" />
            <AppText variant="subtitle">{infractionTypes.find((type) => type.value === draft.type)?.label}</AppText>
            <AppText>{draft.description}</AppText><AppText>Examen {draft.examId} · estudiante {draft.studentId} · {laPazInstant(draft.capturedAt)}</AppText>
            <Notice message="No es una infracción registrada. Debe revisarla el docente autorizado antes de solicitar su registro online." />
            <ActionButton secondary label="Solicitar revisión docente online" disabled={!controller?.offlineBinding()}
              onPress={() => router.push({ pathname: '/(private)/infractions', params: { examId: draft.examId, draftId: draft.id } })} />
          </Card>)}
        </>}
        {params.eventId && <ActionButton secondary label="Ver todas las incidencias" onPress={() => router.replace('/offline/incidents')} />}
        <ActionButton secondary label="Paquetes protegidos" onPress={() => router.replace('/offline')} />
      </View>} />
    {item && <OperationDetails title="Resultado de la incidencia" onClose={() => setSelected(null)}>
      <IncidentDetails item={item} />
      {item.receipt?.incident_id && <ActionButton secondary label="Consultar detalle oficial online" disabled={!controller?.offlineBinding()}
        onPress={() => { setSelected(null); router.push({ pathname: '/(private)/incident', params: { examId: item.event.exam_id, incidentId: String(item.receipt?.incident_id) } }) }} />}
    </OperationDetails>}
  </>
}
const s = StyleSheet.create({ section: { gap: theme.spacing.md } })
