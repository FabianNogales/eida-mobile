import { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { EmptyState } from '../components/FeedbackStates'
import { ListScreen } from '../components/ListScreen'
import { TextAction } from '../components/general/TextAction'
import { ExamCard } from '../components/general/ExamCard'
import { ExamFilters } from '../components/general/ExamFilters'
import { ExamPagination } from '../components/general/ExamPagination'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { teacherExams, type ExamPage, type ExamView } from '../features/exams/api'
import { useOffline } from '../features/offline/OfflineProvider'
import { usePrivateRefresh } from '../hooks/usePrivateRefresh'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { protocolError } from '../services/http/errors'
import { examFeedRows, examPageLocation, examPagination } from '../ui/examPresentation'
import { examDestination } from '../ui/generalScreens'

export function ExamsScreen() {
  const { session } = useAuth()
  const [view, setView] = useState<ExamView>('upcoming')
  return canAccessPrivate(session) ? <ExamFeed key={`${session.user?.id}:${view}`} view={view} setView={setView} /> : null
}

function ExamFeed({ view, setView }: { view: ExamView; setView(view: ExamView): void }) {
  const router = useRouter()
  const { controller } = useAuth()
  const { runtime, packages } = useOffline()
  const [page, setPage] = useState(1)
  const [lastMeta, setLastMeta] = useState<Pick<ExamPage, 'total' | 'perPage' | 'lastPage' | 'currentPage'> | null>(null)
  const { serverPage, offset, size } = examPageLocation(page)
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await teacherExams(controller!, view, serverPage, signal)
    if (result.currentPage !== serverPage || !examPagination(result, 1)) throw protocolError()
    return result
  }, [controller, view, serverPage])
  const query = useRemoteQuery(load)
  const result = query.data
  const currentPagination = result && examPagination(result, page)
  const current = currentPagination?.current
  useEffect(() => {
    if (!result || current === undefined) return
    const { total, perPage, lastPage, currentPage } = result
    setLastMeta({ total, perPage, lastPage, currentPage })
    if (page !== current) setPage(current)
  }, [result, page, current])
  const pagination = currentPagination ?? (query.loading && lastMeta ? examPagination(lastMeta, page) : null)
  const loading = query.loading || (!!currentPagination && page !== currentPagination.current)
  const refresh = usePrivateRefresh(query.reload, loading)
  const ordered = result && !loading ? examFeedRows(result, view).slice(offset, offset + size) : []

  return <ListScreen data={ordered} keyExtractor={(exam) => String(exam.id)} refresh={refresh} scrollKey={page}
    ListHeaderComponent={<View style={s.section}>
      <ExamFilters value={view} onChange={setView} />
      <TextAction label="Mis colaboraciones" onPress={() => router.push('/(private)/collaborations')} />
      <QueryFeedback loading={loading && !refresh.refreshing} error={query.error} label="Consultando exámenes" retry={refresh.onRefresh} />
    </View>}
    ListEmptyComponent={!loading && !query.error && result
      ? <EmptyState title="Sin exámenes en esta vista" message="Prueba otra vista o consulta tus colaboraciones." /> : undefined}
    renderItem={({ item }) => <ExamCard exam={item} unlocked={runtime !== null} packages={packages}
      onOpen={() => router.push(examDestination(item.id))} />}
    footer={pagination && pagination.pages > 1 ? <ExamPagination {...pagination}
      busy={loading || refresh.refreshing} onPage={setPage} /> : undefined} />
}

const s = StyleSheet.create({ section: { gap: theme.spacing.md } })
