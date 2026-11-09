import { useCallback, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { teacherExams, type ExamView } from '../features/exams/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { examDate } from '../utils/dates'
import { useRouter } from 'expo-router'

const views: { value: ExamView; label: string }[] = [
  { value: 'upcoming', label: 'Próximos y en desarrollo' }, { value: 'past', label: 'Pasados' },
  { value: 'cancelled', label: 'Cancelados' }, { value: 'all', label: 'Todos' },
]
export function ExamsScreen() {
  const router = useRouter()
  const { controller } = useAuth()
  const [view, setView] = useState<ExamView>('upcoming')
  const [page, setPage] = useState(1)
  const load = useCallback((signal: AbortSignal) => teacherExams(controller!, view, page, signal), [controller, view, page])
  const query = useRemoteQuery(load)
  const ordered = [...(query.data?.data ?? [])].sort((a, b) => Number(b.status === 'IN_PROGRESS') - Number(a.status === 'IN_PROGRESS'))
  return <Screen>
    <Text style={s.title}>Mis exámenes</Text>
    <Text style={s.body}>Horarios de America/La_Paz. Las vistas y estados los determina el servidor.</Text>
    {views.map((item) => <ActionButton key={item.value} secondary={view !== item.value} label={item.label}
      onPress={() => { setPage(1); setView(item.value) }} />)}
    <ActionButton secondary label="Actualizar" busy={query.loading} onPress={query.refresh} />
    {query.loading && <ActivityIndicator />}
    {query.error && <Notice message={query.error} />}
    {query.data && <>
      <Text style={s.body}>Página {query.data.currentPage} de {query.data.lastPage} · {query.data.total} exámenes</Text>
      {ordered.length === 0 && <Notice message="No hay exámenes en esta vista." />}
      {ordered.map((exam) => <View key={exam.id} style={s.card}>
        <Text style={s.label}>{exam.status === 'IN_PROGRESS' ? 'En desarrollo · estado del servidor' : 'Docente responsable'}</Text>
        <Text style={s.subtitle}>{exam.name}</Text>
        <Text style={s.body}>{exam.subject_name ?? 'Asignatura no informada'}{exam.subject_code ? ` · ${exam.subject_code}` : ''}</Text>
        <Text style={s.body}>{examDate(exam.exam_date)} · {exam.start_time.slice(0, 5)} · {exam.duration_minutes} min</Text>
        <Text style={s.body}>Ambiente: {exam.room ? `${exam.room.name} (${exam.room.code})` : 'No informado'}</Text>
        <Text style={s.body}>Estado oficial: {exam.status}</Text>
        <ActionButton secondary label="Distribución y mi paquete offline" onPress={() => router.push({ pathname: '/(private)/offline-distribution', params: { examId: String(exam.id) } })} />
      </View>)}
      <ActionButton secondary label="Página anterior" disabled={page <= 1 || query.loading} onPress={() => setPage((p) => p - 1)} />
      <ActionButton secondary label="Página siguiente" disabled={page >= query.data.lastPage || query.loading} onPress={() => setPage((p) => p + 1)} />
    </>}
  </Screen>
}
