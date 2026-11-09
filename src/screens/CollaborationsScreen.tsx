import { useCallback } from 'react'
import { Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { collaborations } from '../features/exams/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { examDate } from '../utils/dates'
import { useRouter } from 'expo-router'

export function CollaborationsScreen() {
  const router = useRouter()
  const { controller } = useAuth()
  const load = useCallback((signal: AbortSignal) => collaborations(controller!, signal), [controller])
  const query = useRemoteQuery(load)
  return <Screen>
    <Text style={s.body}>Asignaciones vigentes devueltas por el servidor. Horarios de America/La_Paz.</Text>
    <ActionButton secondary label="Actualizar autorizaciones" busy={query.loading} onPress={query.refresh} />
    {query.loading && <LoadingState label="Consultando colaboraciones autorizadas" />}
    {query.error && <Notice message={query.error} />}
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
    <Text style={s.body}>Una asignación revocada o no disponible deja de aparecer al actualizar. La descarga requiere autorización vigente y una lista propia.</Text>
  </Screen>
}
