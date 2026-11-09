import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState } from '../components/FeedbackStates'
import { StatusBadge } from '../components/StatusBadge'
import { IdentityBlock } from '../components/general/IdentityBlock'
import { OperationalTile } from '../components/general/OperationalTile'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { collaborations, teacherExams } from '../features/exams/api'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { examDestination, homeExamOverview } from '../ui/generalScreens'
import { pendingSummary } from '../ui/pendingSummary'
import { examDate, laPazInstant } from '../utils/dates'

export function HomeScreen() {
  const { session } = useAuth()
  return session.user ? <Dashboard key={session.user.id} /> : null
}
function Dashboard() {
  const { session, controller } = useAuth()
  const offline = useOffline(), router = useRouter()
  const loadExams = useCallback((signal: AbortSignal) => teacherExams(controller!, 'upcoming', 1, signal), [controller, session.user?.id])
  const loadCollaborations = useCallback((signal: AbortSignal) => collaborations(controller!, signal), [controller, session.user?.id])
  const exams = useRemoteQuery(loadExams), assignments = useRemoteQuery(loadCollaborations)
  const { active, first: next } = homeExamOverview(exams.data)
  const summary = pendingSummary(offline.runtime !== null, offline.syncItems, offline.incidentItems)
  const prepared = offline.runtime ? offline.packages.filter((p) => p.active && p.state === 'PREPARADO').length : null
  const openExam = (examId: number) => router.push(examDestination(examId))
  return <Screen>
    <AppText variant="caption" style={s.muted}>Tu jornada de control</AppText>
    <IdentityBlock name={session.user?.display_name ?? ''} detail={session.user?.roles.join(' · ') || 'Sin rol global declarado'} />
    <AppText variant="caption" style={s.muted}>La colaboración se autoriza por examen; puede coexistir con tu función docente.</AppText>

    <AppText variant="subtitle" accessibilityRole="header">Exámenes propios</AppText>
    <QueryFeedback loading={exams.loading} error={exams.error} label="Consultando exámenes propios" retry={exams.refresh} />
    {exams.data && <>
      {active ? <Card style={s.active}>
        <View style={s.row}><StatusBadge label="En desarrollo" tone="success" /><AppText variant="caption" style={s.light}>Docencia · responsable</AppText></View>
        <AppText variant="title" style={s.light} accessibilityRole="header">{active.name}</AppText>
        <AppText style={s.light}>{active.subject_name ?? 'Asignatura no informada'}</AppText>
        <AppText style={s.light}>{examDate(active.exam_date)} · {active.start_time.slice(0, 5)} · {active.duration_minutes} min</AppText>
        <AppText style={s.light}>{active.room ? active.room.name + ' · ' + active.room.code : 'Ambiente no informado'}</AppText>
        <ActionButton secondary label="Continuar control" onPress={() => openExam(active.id)} />
      </Card> : next ? <Card>
        <AppText variant="caption">En esta consulta · docencia</AppText>
        <AppText variant="subtitle" accessibilityRole="header">{next.name}</AppText>
        <AppText>{examDate(next.exam_date)} · {next.start_time.slice(0, 5)}</AppText>
        <ActionButton secondary label="Abrir examen" onPress={() => openExam(next.id)} />
      </Card> : <EmptyState title="Sin exámenes en esta consulta" message="Puedes revisar tus colaboraciones o abrir la lista completa de exámenes." />}
      <AppText variant="caption" style={s.muted}>Próximos y activos: {exams.data.total}. Resumen de la página {exams.data.currentPage} de {exams.data.lastPage}; hasta 10 por consulta.</AppText>
    </>}
    <TextAction label="Ver mis exámenes" onPress={() => router.push('/(private)/exams')} />

    <AppText variant="subtitle" accessibilityRole="header">Estado operativo local</AppText>
    <View style={s.tiles}>
      <OperationalTile label="Copias preparadas" value={prepared === null ? 'Por consultar' : String(prepared)}
        hint={prepared === null ? 'Desbloquea el almacén' : 'Estado al último refresco; se valida al abrir'}
        onPress={() => router.push('/offline')} />
      <OperationalTile label="Por sincronizar" value={summary ? String(summary.pending) : 'Por consultar'}
        hint="Ingresos e incidencias" onPress={() => router.push('/(private)/pending')} />
      <OperationalTile label="Conflictos o rechazos" value={summary ? String(summary.attention) : 'Por consultar'}
        hint="Revisión independiente en cada cola" onPress={() => router.push('/(private)/pending')} />
    </View>

    <Card>
      <AppText variant="subtitle" accessibilityRole="header">Mis colaboraciones</AppText>
      <QueryFeedback loading={assignments.loading} error={assignments.error} label="Consultando colaboraciones" retry={assignments.refresh} />
      {assignments.data?.length === 0 && <AppText>No hay colaboraciones en la consulta actual.</AppText>}
      {assignments.data?.slice(0, 2).map((exam) => <View key={exam.exam_id} style={s.assignment}>
        <StatusBadge label="Colaboración asignada" />
        <AppText variant="label">{exam.exam_name}</AppText>
        <AppText>{examDate(exam.exam_date)} · {exam.start_time.slice(0, 5)} · {exam.room ?? 'Ambiente no informado'}</AppText>
        <ActionButton secondary label="Abrir mi asignación" onPress={() => openExam(exam.exam_id)} />
      </View>)}
      <ActionButton secondary label="Ver todas mis colaboraciones" onPress={() => router.push('/(private)/collaborations')} />
    </Card>
    <ActionButton secondary label="Actualizar consultas" busy={exams.loading || assignments.loading}
      onPress={() => { exams.refresh(); assignments.refresh() }} />
    {session.validatedAt && <AppText variant="caption" style={s.muted}>Última validación de sesión: {laPazInstant(session.validatedAt)}. No indica conexión continua.</AppText>}
    <TextAction label="Mi cuenta y dispositivos" onPress={() => router.push('/(private)/profile')} />
  </Screen>
}
const s = StyleSheet.create({
  muted: { color: theme.colors.muted }, light: { color: theme.colors.onPrimary },
  active: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy, borderLeftColor: theme.colors.accent, borderLeftWidth: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  assignment: { gap: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: theme.spacing.md },
})
