import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState } from '../components/FeedbackStates'
import { StatusBadge } from '../components/StatusBadge'
import { ExamActionRow } from '../components/general/ExamActionRow'
import { ExamMeta } from '../components/general/ExamMeta'
import { ExamIcon } from '../components/general/ExamIcon'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { collaborations, teacherExams } from '../features/exams/api'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { usePrivateRefresh } from '../hooks/usePrivateRefresh'
import { examDestination } from '../ui/generalScreens'
import { briefExamStatus, examHeading, homeOverview } from '../ui/examPresentation'
import { pendingSummary } from '../ui/pendingSummary'
import { useQueueReadiness } from '../ui/useQueueReadiness'

export function HomeScreen() {
  const { session } = useAuth()
  return canAccessPrivate(session) ? <Dashboard key={session.user?.id} /> : null
}
function Dashboard() {
  const { session, controller } = useAuth(), offline = useOffline(), router = useRouter()
  const loadExams = useCallback((signal: AbortSignal) => teacherExams(controller!, 'upcoming', 1, signal), [controller, session.user?.id])
  const loadCollaborations = useCallback((signal: AbortSignal) => collaborations(controller!, signal), [controller, session.user?.id])
  const exams = useRemoteQuery(loadExams), assignments = useRemoteQuery(loadCollaborations)
  const { loading, error, control, empty, choose } = homeOverview(exams, assignments)
  const heading = control ? examHeading(control) : null
  const known = useQueueReadiness(offline.runtime, offline.busy)
  const summary = pendingSummary(known, offline.syncItems, offline.incidentItems)
  const firstName = session.user?.display_name.trim().split(/\s+/)[0]
  const refresh = usePrivateRefresh(() => Promise.all([exams.reload(), assignments.reload()]), loading)
  return <Screen refresh={refresh}>
    <View style={s.greeting}>
      <AppText variant="title" accessibilityRole="header">{firstName ? `Hola, ${firstName}` : 'Hola'}</AppText>
      <AppText style={s.muted}>{control ? 'Tu control, a mano.' : 'Encuentra tu examen y continúa.'}</AppText>
    </View>
    <QueryFeedback loading={loading && !refresh.refreshing} error={error} label="Consultando tus exámenes" retry={refresh.onRefresh} />
    {control && heading && <Card style={s.featured}>
      <View style={s.top}><AppText variant="caption" style={s.light}>EXAMEN ASIGNADO</AppText>
        {control.status && <StatusBadge {...briefExamStatus(control.status)} />}
      </View>
      <View style={s.titles}><AppText variant="title" style={s.light} accessibilityRole="header">{heading.title}</AppText>
        {heading.subtitle && <AppText style={s.light}>{heading.subtitle}</AppText>}
      </View>
      <ExamMeta date={control.date} time={control.time} room={control.room} relation={control.relation} light />
      <ActionButton secondary label="Continuar control" icon={<ExamIcon name="qr" />} onPress={() => router.push(examDestination(control.id))} />
    </Card>}
    {empty && <EmptyState title="Sin exámenes asignados" message="No hay exámenes propios ni colaboraciones en la consulta actual." />}
    {choose && <EmptyState title="Elige tu examen" message="Consulta tus exámenes o colaboraciones para continuar." />}
    <View style={s.actions}>
      <ExamActionRow card icon="calendar" label="Mis exámenes"
        hint={exams.data ? `${exams.data.total} próximos o activos en docencia` : undefined}
        onPress={() => router.push('/(private)/exams')} />
      {(!!assignments.data?.length || !!assignments.error) && <ExamActionRow card icon="person" label="Mis colaboraciones"
        hint={assignments.data ? `${assignments.data.length} asignadas` : undefined} onPress={() => router.push('/(private)/collaborations')} />}
      <ExamActionRow card icon="clock" label="Ingresos y reportes pendientes"
        hint={summary ? `${summary.pending} por enviar · ${summary.attention} por revisar` : 'Consultar estado'}
        onPress={() => router.push('/(private)/pending')} />
    </View>
  </Screen>
}
const s = StyleSheet.create({
  greeting: { gap: theme.spacing.sm }, muted: { color: theme.colors.muted },
  featured: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy, gap: theme.spacing.lg },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  titles: { gap: theme.spacing.xs }, light: { color: theme.colors.onPrimary }, actions: { gap: theme.spacing.md },
})
