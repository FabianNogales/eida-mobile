import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'

// Infer the literal union from the options only; a value or callback must not widen it.
export function ChoiceChips<const Value extends string>({ options, value, onChange, disabled = false }: {
  options: readonly { value: Value; label: string }[]; value: NoInfer<Value>; onChange: (value: NoInfer<Value>) => void; disabled?: boolean
}) {
  return <View style={s.row}>{options.map((option) => <Pressable key={option.value} disabled={disabled}
    accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value, disabled }}
    onPress={() => onChange(option.value)} style={({ pressed }) => [s.chip, value === option.value && s.selected, pressed && s.pressed]}>
    <AppText variant="label" style={value === option.value ? s.activeText : s.text}>{option.label}</AppText>
  </Pressable>)}</View>
}
const s = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: { minHeight: theme.layout.minTouch, minWidth: theme.layout.minTouch, maxWidth: '100%', padding: theme.spacing.md,
    borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.surface, justifyContent: 'center' },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }, pressed: { borderColor: theme.colors.navy },
  text: { color: theme.colors.text }, activeText: { color: theme.colors.onPrimary } })
