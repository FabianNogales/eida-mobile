import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ListScreen } from '../components/ListScreen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { StatusBadge } from '../components/StatusBadge'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { OnlineAccessState } from '../components/operations/OnlineAccessState'
import { theme } from '../config/theme'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { usePrivateRefresh } from '../hooks/usePrivateRefresh'
import { useDiscipline } from '../features/incidents/useDiscipline'
import { incidentTypes, statusLabels } from '../features/incidents/contracts'
import { laPazInstant } from '../utils/dates'

export function IncidentsScreen() {
  const params = useLocalSearchParams<{ examId: string }>(), examId = typeof params.examId === 'string' ? params.examId : '', router = useRouter()
  const { api, context } = useDiscipline(examId), [page, setPage] = useState(1)
  const permission = context.data
  const load = useCallback(async (signal: AbortSignal) => permission?.read && api ? api.incidents(examId, page, signal) : null, [api, permission, examId, page])
  const query = useRemoteQuery(load)
  const allowed = permission?.read && String(permission.examId) === examId
  // The refreshed permission changes the dependent query; do not re-read with the previous grant.
  const refresh = usePrivateRefresh(context.reload, context.loading || query.loading)
  return <ListScreen data={allowed ? query.data?.data.filter((item) => String(item.examId) === examId) ?? [] : []}
    refresh={refresh}
    keyExtractor={(item) => item.id} ListHeaderComponent={<View style={s.section}>
      <AppText variant="subtitle" accessibilityRole="header">Reportes del examen</AppText>
      <Notice tone="info" message="Consulta oficial online. Un reporte no implica una infracción confirmada ni una sanción." />
      {!allowed ? (!refresh.refreshing || !context.loading) && <OnlineAccessState loading={context.loading} error={context.error}
        message="El servidor no autoriza consultar incidencias de este examen con esta cuenta." retry={refresh.onRefresh} /> : <>
        <QueryFeedback loading={query.loading} error={query.error} label="Consultando reportes oficiales" retry={query.refresh} />
        {permission?.manage && <>
          <ActionButton label="Infracciones · docente autorizado" onPress={() => router.push({ pathname: '/(private)/infractions', params: { examId } })} />
          <ActionButton secondary label="Expulsiones y anulación · solo online" onPress={() => router.push({ pathname: '/(private)/discipline-actions', params: { examId } })} />
        </>}
        {permission?.report && <AppText>Para un reporte offline, abre tu paquete vigente y selecciona Registrar incidencia.</AppText>}
      </>}
      <ActionButton secondary label="Paquetes y reportes locales cifrados" onPress={() => router.push('/offline')} />
    </View>}
    renderItem={({ item }) => <Card>
      <StatusBadge label={statusLabels[item.status] ?? item.status} />
      <AppText variant="subtitle" accessibilityRole="header">{incidentTypes.find((type) => type.value === item.type)?.label}</AppText>
      <AppText>{item.student ? `${item.student.last_names}, ${item.student.first_names}` : 'Incidencia general'}</AppText>
      <AppText>{laPazInstant(item.reportedAt)}</AppText>
      <ActionButton secondary label="Detalle del reporte" onPress={() => router.push({ pathname: '/(private)/incident', params: { examId, incidentId: item.id } })} />
    </Card>}
    ListEmptyComponent={allowed && query.data && !query.loading && !query.error ? <EmptyState title="Sin reportes en esta página" message="No se agregan incidencias de demostración." /> : undefined}
    ListFooterComponent={allowed && query.data ? <View style={s.section}>
      <AppText>Página {query.data.page} de {query.data.lastPage}</AppText>
      <ActionButton secondary label="Página anterior" disabled={page <= 1 || query.loading} onPress={() => setPage(page - 1)} />
      <ActionButton secondary label="Página siguiente" disabled={page >= query.data.lastPage || query.loading} onPress={() => setPage(page + 1)} />
    </View> : undefined} />
}
export function IncidentDetailScreen() {
  const { examId = '', incidentId = '' } = useLocalSearchParams<{ examId: string; incidentId: string }>(), { api, context } = useDiscipline(examId)
  const load = useCallback(async (signal: AbortSignal) => context.data?.read && api ? api.incident(examId, incidentId, signal) : null, [api, context.data, examId, incidentId])
  const query = useRemoteQuery(load)
  const allowed = context.data?.read && String(context.data.examId) === examId
  const incident = allowed && query.data && String(query.data.examId) === examId && query.data.id === incidentId ? query.data : null
  const refresh = usePrivateRefresh(context.reload, context.loading || query.loading)
  return <Screen refresh={refresh}>
    {!allowed ? (!refresh.refreshing || !context.loading) && <OnlineAccessState loading={context.loading} error={context.error}
      message="No tienes autorización actual para consultar este reporte." retry={refresh.onRefresh} /> : <>
      <QueryFeedback loading={query.loading} error={query.error} label="Consultando detalle oficial" retry={query.refresh} />
      {incident && <Card>
        <StatusBadge label={statusLabels[incident.status] ?? incident.status} />
        <AppText variant="subtitle" accessibilityRole="header">{incidentTypes.find((type) => type.value === incident.type)?.label}</AppText>
        <AppText>{incident.description}</AppText>
        <AppText>{incident.student ? `${incident.student.last_names}, ${incident.student.first_names} · SIS ${incident.student.sis_code}` : 'Sin estudiante relacionado'}</AppText>
        <AppText>Reportó: {incident.reporter ?? 'No informado'} · {laPazInstant(incident.reportedAt)}</AppText>
        <Notice tone="info" message="Estado de un reporte oficial. No supone una decisión disciplinaria." />
      </Card>}
    </>}
  </Screen>
}
const s = StyleSheet.create({ section: { gap: theme.spacing.md } })
