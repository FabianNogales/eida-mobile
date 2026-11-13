import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { ExamView } from '../../features/exams/api'
import { examFilterOptions } from '../../ui/examPresentation'
import { AppText } from '../AppText'

export function ExamFilters({ value, onChange }: { value: ExamView; onChange(value: ExamView): void }) {
  return <View style={s.filters} accessibilityLabel="Vista de exámenes">
    {examFilterOptions.map((view) => <Pressable key={view.value} accessibilityRole="radio"
      accessibilityState={{ checked: value === view.value }} accessibilityLabel={view.label}
      onPress={() => onChange(view.value)} style={({ pressed }) => [s.filter, value === view.value && s.selected, pressed && s.pressed]}>
      <AppText variant="label" style={value === view.value ? s.selectedText : s.text}>{view.label}</AppText>
    </Pressable>)}
  </View>
}
const s = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, padding: theme.spacing.xs,
    borderRadius: theme.radius.control, backgroundColor: theme.colors.border },
  filter: { flexBasis: '45%', flexGrow: 1, minHeight: theme.layout.minTouch, minWidth: theme.layout.minTouch,
    paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm, justifyContent: 'center', alignItems: 'center',
    borderRadius: theme.radius.control, maxWidth: '100%' },
  selected: { backgroundColor: theme.colors.surface }, pressed: { opacity: 0.75 },
  selectedText: { color: theme.colors.primary, textAlign: 'center' }, text: { color: theme.colors.muted, textAlign: 'center' },
})
