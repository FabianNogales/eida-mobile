import { useCallback } from 'react'
import { Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { EmptyState } from '../components/FeedbackStates'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { collaborations } from '../features/exams/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { usePrivateRefresh } from '../hooks/usePrivateRefresh'
import { examDate } from '../utils/dates'
import { useRouter } from 'expo-router'

export function CollaborationsScreen() {
  const router = useRouter()
  const { controller } = useAuth()
  const load = useCallback((signal: AbortSignal) => collaborations(controller!, signal), [controller])
  const query = useRemoteQuery(load)
  const refresh = usePrivateRefresh(query.reload, query.loading)
  return <Screen refresh={refresh}>
    <QueryFeedback loading={query.loading && !refresh.refreshing} error={query.error} label="Consultando colaboraciones autorizadas" retry={refresh.onRefresh} />
    {query.data?.length === 0 && <EmptyState title="Sin colaboraciones" message="No hay asignaciones autorizadas en la consulta actual." />}
    {query.data?.map((exam) => <View style={s.card} key={exam.exam_id}>
      <Text style={s.label}>Colaboración autorizada al consultar</Text>
      <Text style={s.subtitle}>{exam.exam_name}</Text>
      <Text style={s.body}>{exam.subject_name}</Text>
      <Text style={s.body}>{examDate(exam.exam_date)} · {exam.start_time.slice(0, 5)} · {exam.duration_minutes} min</Text>
      <Text style={s.body}>Ambiente: {exam.room ?? 'No informado'}</Text>
      <ActionButton secondary label="Mi lista y paquete offline" onPress={() => router.push({ pathname: '/(private)/offline-distribution', params: { examId: String(exam.exam_id) } })} />
      <ActionButton secondary label="Consultar incidencias y permisos" onPress={() => router.push({ pathname: '/(private)/incidents', params: { examId: String(exam.exam_id) } })} />
    </View>)}
  </Screen>
}
