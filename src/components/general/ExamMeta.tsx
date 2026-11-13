import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { examTimeLabel, naturalExamDate } from '../../ui/examPresentation'
import { AppText } from '../AppText'
import { ExamIcon, type ExamIconName } from './ExamIcon'

export function ExamMeta({ date, time, room, relation, stacked = false, light = false }: {
  date: string; time: string; room?: string | null; relation?: string; stacked?: boolean; light?: boolean
}) {
  const color = light ? theme.colors.onPrimary : theme.colors.navy
  const hour = examTimeLabel(time)
  const rows: { icon: ExamIconName; text: string }[] = [
    { icon: 'calendar', text: stacked ? naturalExamDate(date) : `${naturalExamDate(date)} · ${hour}` },
    ...(stacked ? [{ icon: 'clock' as const, text: hour }] : []),
    ...(room ? [{ icon: 'place' as const, text: room }] : []),
    ...(relation ? [{ icon: 'person' as const, text: relation }] : []),
  ]
  return <View style={[s.meta, stacked && s.stacked]}>{rows.map((row) =>
    <View key={row.icon} style={s.item}><ExamIcon name={row.icon} color={color} />
      <AppText style={[s.text, { color }]}>{row.text}</AppText>
    </View>)}</View>
}
const s = StyleSheet.create({
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }, stacked: { flexDirection: 'column' },
  item: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, maxWidth: '100%' },
  text: { flexShrink: 1 },
})

