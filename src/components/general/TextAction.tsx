import { Pressable, StyleSheet } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'

export function TextAction({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, pressed && s.pressed]}>
    <AppText variant="label" style={[s.label, disabled && s.disabled]}>{label}</AppText>
  </Pressable>
}
const s = StyleSheet.create({
  action: { minHeight: theme.layout.minTouch, minWidth: theme.layout.minTouch, padding: theme.spacing.sm,
    justifyContent: 'center', borderRadius: theme.radius.control },
  pressed: { backgroundColor: theme.colors.background }, label: { textAlign: 'center', color: theme.colors.primary },
  disabled: { color: theme.colors.muted },
})
