import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { ExamView } from '../../features/exams/api'
import { AppText } from '../AppText'

const views: { value: ExamView; label: string }[] = [
  { value: 'upcoming', label: 'Próximos y activos' }, { value: 'past', label: 'Pasados' },
  { value: 'cancelled', label: 'Cancelados' }, { value: 'all', label: 'Todos' },
]
export function ExamFilters({ value, onChange }: { value: ExamView; onChange(value: ExamView): void }) {
  return <View style={s.filters} accessibilityLabel="Vista de exámenes">
    {views.map((view) => <Pressable key={view.value} accessibilityRole="radio" accessibilityState={{ checked: value === view.value }}
      accessibilityLabel={view.label} onPress={() => onChange(view.value)} style={({ pressed }) => [s.filter, value === view.value && s.selected, pressed && s.pressed]}>
      <AppText variant="label" style={value === view.value ? s.selectedText : s.text}>{view.label}</AppText>
    </Pressable>)}
  </View>
}
const s = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  filter: { minHeight: theme.layout.minTouch, minWidth: theme.layout.minTouch, paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md, justifyContent: 'center', borderRadius: theme.radius.control,
    borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.surface, maxWidth: '100%' },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pressed: { borderColor: theme.colors.navy }, selectedText: { color: theme.colors.onPrimary }, text: { color: theme.colors.text },
})
