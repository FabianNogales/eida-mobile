import { useCallback, useEffect, useState } from 'react'
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
import type { InfractionDraft } from '../features/incidents/repository'
import { incidentDelivery, incidentLabels, incidentStates } from '../ui/operations'
import { useQueueReadiness } from '../ui/useQueueReadiness'
import { laPazInstant } from '../utils/dates'

export function OfflineIncidentsScreen() {
  const offline = useOffline(), r = offline.runtime, { controller } = useAuth(), router = useRouter()
  const params = useLocalSearchParams<{ eventId?: string }>(), known = useQueueReadiness(r, offline.busy)
  const [focused, setFocused] = useState(false), [drafts, setDrafts] = useState<{ runtime: typeof r; items: InfractionDraft[] } | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null), [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState<IncidentState | 'ALL'>('ALL')
  const [selected, setSelected] = useState<{ runtime: typeof r; id: string } | null>(null)
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setDrafts(null); setSelected(null) } }, []))
  useEffect(() => {
    let current = true; setDrafts(null); setDraftError(null)
    if (r && focused) void r.incidents.drafts().then((items) => { r.check(); if (current) setDrafts({ runtime: r, items }) })
      .catch(() => { if (current) setDraftError('No se pudieron consultar los borradores protegidos. No se presentan como una lista vacía.') })
    return () => { current = false }
  }, [r, focused, revision])
  if (!r) return <Screen><Notice message="Desbloquea el almacén con biometría. Las incidencias pendientes siguen cifradas." />
    <ActionButton label="Ir al desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (!focused) return <Screen><AppText>Consulta detenida.</AppText></Screen>
  const scopedItems = offline.incidentItems.filter((item) => !params.eventId || item.event.event_id === params.eventId)
  const items = known ? scopedItems.filter((item) => filter === 'ALL' || item.state === filter) : []
  const item = known && selected && selected.runtime === r ? offline.incidentItems.find((row) => row.event.event_id === selected.id) : null
  const options: { value: IncidentState | 'ALL'; label: string }[] = [{ value: 'ALL', label: `Todos (${scopedItems.length})` },
    ...incidentStates.map((state) => ({ value: state, label: `${incidentLabels[state].label} (${scopedItems.filter((i) => i.state === state).length})` }))]
  return <>
    <ListScreen data={items} keyExtractor={(row) => row.event.event_id} ListHeaderComponent={<View style={s.section}>
      <AppText variant="subtitle" accessibilityRole="header">Incidencias y borradores protegidos</AppText>
      <Notice tone="info" message="Un reporte no confirma una infracción ni aplica sanciones. Esta cola es independiente de los ingresos HU37." />
      {offline.error && <Notice tone="error" message={offline.error} />}
      {!controller?.offlineBinding() && <Notice message="Para enviar valida con internet la cuenta y dispositivo originales." />}
      <ActionButton label="Sincronizar incidencias" busy={offline.busy} disabled={!controller?.offlineBinding()} onPress={() => { void offline.synchronizeIncidents() }} />
      <ActionButton secondary label="Actualizar estados y borradores" disabled={offline.busy} onPress={() => {
        setRevision((value) => value + 1); void offline.refresh().catch(() => {})
      }} />
      {known ? <ChoiceChips options={options} value={filter} onChange={setFilter} /> : <LoadingState label="Leyendo incidencias autorizadas" />}
    </View>} renderItem={({ item: row }) => <Card>
      <OperationState {...incidentDelivery(row)} />
      <AppText variant="subtitle">{incidentTypes.find((type) => type.value === row.event.type)?.label}</AppText>
      <AppText>Examen {row.event.exam_id} · {laPazInstant(row.event.captured_at)}</AppText>
      <ActionButton secondary label="Ver reporte y resultado" onPress={() => setSelected({ runtime: r, id: row.event.event_id })} />
    </Card>} ListEmptyComponent={known ? <EmptyState title="Sin reportes en esta vista" message="Los conflictos y rechazos se conservan en sus filtros." /> : undefined}
      ListFooterComponent={<View style={s.section}>
        {draftError && <Notice tone="error" message={draftError} />}
        {!drafts && !draftError && <LoadingState label="Consultando borradores protegidos" />}
        {drafts?.runtime === r && !params.eventId && <>
          <AppText variant="subtitle" accessibilityRole="header">Borradores de infracción</AppText>
          {drafts.items.length === 0 && <AppText>No hay borradores en la consulta local actual.</AppText>}
          {drafts.items.map((draft) => <Card key={draft.id}>
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
