import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { useDiscipline } from '../features/incidents/useDiscipline'
import { incidentTypes, statusLabels } from '../features/incidents/contracts'
import { laPazInstant } from '../utils/dates'

export function IncidentsScreen() {
  const params = useLocalSearchParams<{ examId: string }>(), examId = typeof params.examId === 'string' ? params.examId : '', router = useRouter()
  const { api, context } = useDiscipline(examId), [page, setPage] = useState(1)
  const permission = context.data
  const load = useCallback(async (signal: AbortSignal) => permission?.read && api ? api.incidents(examId, page, signal) : null, [api, permission, examId, page])
  const query = useRemoteQuery(load)
  return <Screen><Text style={s.title}>Incidencias del examen</Text>
    <Notice message="Consulta online. Una incidencia es un reporte; no implica una infracción confirmada. Los permisos se comprueban por examen en Laravel." />
    {(context.error || query.error) && <Notice message={context.error ?? query.error ?? ''} />}
    {!permission && <Text style={s.body}>La consulta requiere conexión y que la política central del token móvil habilite estos endpoints.</Text>}
    <ActionButton secondary label="Actualizar autorización y reportes" onPress={() => { context.refresh(); query.refresh() }} />
    {permission?.manage && <>
      <ActionButton label="Infracciones · docente responsable" onPress={() => router.push({ pathname: '/(private)/infractions', params: { examId } })} />
      <ActionButton secondary label="Expulsiones y anulación · online" onPress={() => router.push({ pathname: '/(private)/discipline-actions', params: { examId } })} />
    </>}
    {permission?.report && <Text style={s.body}>Para reportar offline, abre tu paquete descargado y vigente desde Paquetes protegidos.</Text>}
    <ActionButton secondary label="Paquetes y reportes locales cifrados" onPress={() => router.push('/offline')} />
    {permission?.read && query.data?.data.map((incident) => <View key={incident.id} style={s.card}>
      <Text style={s.subtitle}>{incidentTypes.find((type) => type.value === incident.type)?.label}</Text>
      <Text style={s.body}>{incident.student ? `${incident.student.last_names}, ${incident.student.first_names}` : 'Incidencia general'}</Text>
      <Text style={s.label}>{statusLabels[incident.status] ?? 'Estado pendiente de interpretación'}</Text>
      <Text style={s.body}>{laPazInstant(incident.reportedAt)}</Text>
      <ActionButton secondary label="Detalle de incidencia" onPress={() => router.push({ pathname: '/(private)/incident', params: { examId, incidentId: incident.id } })} />
    </View>)}
    {query.data && <><ActionButton secondary label="Página anterior" disabled={page <= 1} onPress={() => setPage(page - 1)} />
      <ActionButton secondary label="Página siguiente" disabled={page >= query.data.lastPage} onPress={() => setPage(page + 1)} /></>}
  </Screen>
}
export function IncidentDetailScreen() {
  const { examId = '', incidentId = '' } = useLocalSearchParams<{ examId: string; incidentId: string }>(), { api, context } = useDiscipline(examId)
  const load = useCallback(async (signal: AbortSignal) => context.data?.read && api ? api.incident(examId, incidentId, signal) : null, [api, context.data, examId, incidentId])
  const query = useRemoteQuery(load), incident = context.data?.read ? query.data : null
  return <Screen><Text style={s.title}>Detalle de incidencia</Text>
    {(context.error || query.error) && <Notice message={context.error ?? query.error ?? ''} />}
    {incident && <>
      <Text style={s.subtitle}>{incidentTypes.find((type) => type.value === incident.type)?.label}</Text>
      <Text style={s.body}>{incident.description}</Text>
      <Text style={s.body}>{incident.student ? `${incident.student.last_names}, ${incident.student.first_names} · SIS ${incident.student.sis_code}` : 'Sin estudiante relacionado'}</Text>
      <Text style={s.body}>Reportó: {incident.reporter ?? 'No informado'} · {laPazInstant(incident.reportedAt)}</Text>
      <Notice message={`Estado del reporte: ${statusLabels[incident.status] ?? 'Estado pendiente de interpretación'}. No supone una decisión disciplinaria.`} />
    </>}
    <ActionButton secondary label="Actualizar online" onPress={() => { context.refresh(); query.refresh() }} />
  </Screen>
}
