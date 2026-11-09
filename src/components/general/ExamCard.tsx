import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { TeacherExam } from '../../features/exams/api'
import type { PackageRecord } from '../../features/offline/contracts'
import { examStatus, offlineExamState } from '../../ui/generalScreens'
import { examDate } from '../../utils/dates'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'

export function ExamCard({ exam, unlocked, packages, onOpen, onIncidents }: {
  exam: TeacherExam; unlocked: boolean; packages: readonly PackageRecord[]; onOpen(): void; onIncidents(): void
}) {
  const status = examStatus(exam.status), offline = offlineExamState(exam.id, unlocked, packages)
  return <Card style={s.card}>
    <View style={s.row}><AppText variant="caption">Docencia · responsable</AppText><StatusBadge {...status} /></View>
    <AppText variant="subtitle" accessibilityRole="header">{exam.name}</AppText>
    <AppText style={s.muted}>{exam.subject_name ?? 'Asignatura no informada'}{exam.subject_code ? ` · ${exam.subject_code}` : ''}</AppText>
    <AppText>{examDate(exam.exam_date)} · {exam.start_time.slice(0, 5)} · {exam.duration_minutes} min</AppText>
    <AppText>Ambiente: {exam.room ? `${exam.room.name} · ${exam.room.code}` : 'No informado'}</AppText>
    <View style={s.divider} /><StatusBadge {...offline} />
    <ActionButton label="Abrir examen" onPress={onOpen} />
    <ActionButton secondary label="Consultar incidencias y permisos" onPress={onIncidents} />
  </Card>
}
const s = StyleSheet.create({
  card: { borderTopWidth: 3, borderTopColor: theme.colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  muted: { color: theme.colors.muted }, divider: { borderTopWidth: 1, borderColor: theme.colors.border, marginVertical: theme.spacing.xs },
})
