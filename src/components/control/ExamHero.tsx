import { StyleSheet } from 'react-native'
import type { OfflineExam } from '../../features/offline/contracts'
import { theme } from '../../config/theme'
import { examStatus } from '../../ui/generalScreens'
import { examDate } from '../../utils/dates'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'

export function ExamHero({ exam, relation }: { exam: OfflineExam; relation: string }) {
  return <Card style={s.hero}>
    <StatusBadge {...examStatus(exam.status)} />
    <AppText variant="title" accessibilityRole="header" style={s.light}>{exam.name}</AppText>
    <AppText style={s.light}>{exam.subject_name ?? 'Asignatura no informada'}</AppText>
    <AppText style={s.light}>{examDate(exam.exam_date)} · {exam.start_time.slice(0, 5)} · {exam.duration_minutes} min</AppText>
    <AppText style={s.light}>{exam.room ? `${exam.room.name} · ${exam.room.code}` : 'Ambiente no informado'}</AppText>
    {exam.room?.location && <AppText style={s.light}>{exam.room.location}</AppText>}
    <AppText variant="caption" style={s.light}>{relation}</AppText>
  </Card>
}
const s = StyleSheet.create({ hero: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy,
  borderLeftColor: theme.colors.accent, borderLeftWidth: 4 }, light: { color: theme.colors.onPrimary } })
