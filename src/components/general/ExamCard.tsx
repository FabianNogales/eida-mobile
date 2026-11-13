import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { TeacherExam } from '../../features/exams/api'
import type { PackageRecord } from '../../features/offline/contracts'
import { briefExamStatus, briefPreparation, examHeading } from '../../ui/examPresentation'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { TextAction } from './TextAction'
import { ExamMeta } from './ExamMeta'
import { ExamIcon } from './ExamIcon'

export function ExamCard({ exam, unlocked, packages, onOpen }: {
  exam: TeacherExam; unlocked: boolean; packages: readonly PackageRecord[]; onOpen(): void
}) {
  const heading = examHeading(exam), offline = briefPreparation(exam.id, unlocked, packages), status = briefExamStatus(exam.status)
  return <Card style={s.card}>
    <View style={s.top}><View style={s.heading}>
      <AppText variant="subtitle" accessibilityRole="header">{heading.title}</AppText>
      {heading.subtitle && <AppText style={s.muted}>{heading.subtitle}</AppText>}
    </View><StatusBadge {...offline} /></View>
    <ExamMeta date={exam.exam_date} time={exam.start_time} room={exam.room?.name} />
    <View style={s.footer}>
      <View style={s.relation}><ExamIcon name="person" color={theme.colors.muted} /><View style={s.roleCopy}>
        <AppText variant="caption" style={s.muted}>Docente responsable</AppText><AppText variant="caption" style={s.muted}>{status.label}</AppText>
      </View></View>
      <TextAction label="Abrir examen" onPress={onOpen} />
    </View>
  </Card>
}
const s = StyleSheet.create({
  card: { gap: theme.spacing.md }, top: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'flex-start' },
  heading: { flexGrow: 1, flexBasis: 160, gap: theme.spacing.xs }, muted: { color: theme.colors.muted },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  relation: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexShrink: 1 },
  roleCopy: { flexShrink: 1 },
})
