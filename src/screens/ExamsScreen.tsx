import { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { EmptyState } from '../components/FeedbackStates'
import { ListScreen } from '../components/ListScreen'
import { Notice } from '../components/Notice'
import { ExamCard } from '../components/general/ExamCard'
import { ExamFilters } from '../components/general/ExamFilters'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { teacherExams, type ExamView } from '../features/exams/api'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { examDestination, examIncidentsDestination, orderedExams } from '../ui/generalScreens'

export function ExamsScreen() {
  const { session } = useAuth()
  return session.user ? <ExamFeed key={session.user.id} /> : null
}
function ExamFeed() {
  const router = useRouter()
  const { controller } = useAuth()
  const { runtime, packages } = useOffline()
  const [view, setView] = useState<ExamView>('upcoming'), [page, setPage] = useState(1)
  // A query boundary discards the previous view/page before the next effect runs.
  return <ExamPage key={view + ':' + page} controller={controller} view={view} page={page}
    unlocked={runtime !== null} packages={packages} setView={(next) => { setPage(1); setView(next) }}
    setPage={setPage} onCollaborations={() => router.push('/(private)/collaborations')} />
}
function ExamPage({ controller, view, page, unlocked, packages, setView, setPage, onCollaborations }: {
  controller: ReturnType<typeof useAuth>['controller']; view: ExamView; page: number
  unlocked: boolean; packages: ReturnType<typeof useOffline>['packages']
  setView(view: ExamView): void; setPage(page: number): void; onCollaborations(): void
}) {
  const router = useRouter()
  const load = useCallback((signal: AbortSignal) => teacherExams(controller!, view, page, signal), [controller, view, page])
  const query = useRemoteQuery(load)
  const ordered = orderedExams(query.data?.data ?? [])
  return <ListScreen data={ordered} keyExtractor={(exam) => String(exam.id)}
    ListHeaderComponent={<View style={s.section}>
      <AppText variant="subtitle" accessibilityRole="header">Docencia</AppText>
      <AppText style={s.muted}>Exámenes propios. Las colaboraciones se consultan por separado.</AppText>
      <ActionButton secondary label="Mis colaboraciones autorizadas" onPress={onCollaborations} />
      <ExamFilters value={view} onChange={setView} />
      <Notice tone="info" message="Horarios de America/La_Paz. El servidor determina estados y autorizaciones. Las copias locales se validan al abrirlas." />
      <ActionButton secondary label="Actualizar exámenes" busy={query.loading} onPress={query.refresh} />
      <QueryFeedback loading={query.loading} error={query.error} label="Consultando exámenes" retry={query.refresh} />
      {query.data && <AppText variant="caption" style={s.muted}>Página {query.data.currentPage} de {query.data.lastPage} · {query.data.total} exámenes</AppText>}
    </View>}
    ListEmptyComponent={!query.loading && !query.error && query.data
      ? <EmptyState title="Sin exámenes en esta vista" message="Prueba otra vista o consulta tus colaboraciones." /> : undefined}
    renderItem={({ item }) => <ExamCard exam={item} unlocked={unlocked} packages={packages}
      onOpen={() => router.push(examDestination(item.id))}
      onIncidents={() => router.push(examIncidentsDestination(item.id))} />}
    ListFooterComponent={query.data ? <View style={s.section}>
      <AppText variant="caption" style={s.muted}>Las funciones de incidencias requieren autorización móvil; el acceso se comprueba al consultarlas.</AppText>
      <View style={s.pagination}>
        <View style={s.pageButton}><ActionButton secondary label="Anterior" disabled={page <= 1 || query.loading} onPress={() => setPage(page - 1)} /></View>
        <View style={s.pageButton}><ActionButton secondary label="Siguiente" disabled={page >= query.data.lastPage || query.loading} onPress={() => setPage(page + 1)} /></View>
      </View>
    </View> : undefined} />
}
const s = StyleSheet.create({
  section: { gap: theme.spacing.md }, muted: { color: theme.colors.muted },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  pageButton: { flexBasis: 120, flexGrow: 1 },
})
