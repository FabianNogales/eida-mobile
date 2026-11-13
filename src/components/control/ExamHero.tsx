import { StyleSheet, View } from 'react-native'
import type { OfflineExam } from '../../features/offline/contracts'
import { theme } from '../../config/theme'
import { briefExamStatus, examHeading } from '../../ui/examPresentation'
import { AppText } from '../AppText'
import { StatusBadge } from '../StatusBadge'
import { ExamMeta } from '../general/ExamMeta'

export function ExamHero({ exam, relation }: { exam: OfflineExam; relation: string }) {
  const heading = examHeading(exam)
  return <View style={s.hero}>
    {heading.subtitle && <AppText variant="label" style={s.type}>{heading.subtitle}</AppText>}
    <AppText variant="title" accessibilityRole="header">{heading.title}</AppText>
    <ExamMeta date={exam.exam_date} time={exam.start_time} room={exam.room?.name} />
    {exam.room?.location && <AppText variant="caption" style={s.muted}>{exam.room.location}</AppText>}
    <View style={s.badges}><StatusBadge label={relation} tone="info" /><StatusBadge {...briefExamStatus(exam.status)} /></View>
  </View>
}
const s = StyleSheet.create({
  hero: { gap: theme.spacing.md, paddingBottom: theme.spacing.lg, borderBottomWidth: 1, borderColor: theme.colors.border },
  type: { color: theme.colors.accent }, muted: { color: theme.colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
})
