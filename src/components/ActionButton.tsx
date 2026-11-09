import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { theme } from '../config/theme'
import { buttonColors, type ButtonVariant } from '../ui/presentation'

export function ActionButton({ label, onPress, busy = false, secondary = false, disabled = false, variant, accessibilityHint }: {
  label: string; onPress: () => void; busy?: boolean; secondary?: boolean; disabled?: boolean; variant?: ButtonVariant; accessibilityHint?: string
}) {
  const kind = variant ?? (secondary ? 'secondary' : 'primary'), colors = buttonColors(kind, disabled, false)
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: busy || disabled, busy }} disabled={busy || disabled}
    onPress={onPress} style={({ pressed }) => {
      const current = buttonColors(kind, disabled, pressed)
      return [styles.button, { backgroundColor: current.background, borderColor: current.border }]
    }}>
    {busy && <ActivityIndicator color={colors.foreground} importantForAccessibility="no" />}
    <Text style={[styles.label, { color: colors.foreground }]}>{busy ? `${label} · En curso` : label}</Text>
  </Pressable>
}
const styles = StyleSheet.create({
  button: { minHeight: theme.layout.controlMinHeight, minWidth: theme.layout.minTouch, borderRadius: theme.radius.control,
    borderWidth: 1, padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: theme.spacing.md },
  label: { ...theme.typography.button, flexShrink: 1, textAlign: 'center' },
})

