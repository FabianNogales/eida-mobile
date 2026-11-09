import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { theme } from '../config/theme'

export function ActionButton({ label, onPress, busy = false, secondary = false, disabled = false }: {
  label: string; onPress: () => void; busy?: boolean; secondary?: boolean; disabled?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled, busy }} disabled={busy || disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || busy || disabled) && { opacity: 0.7 }]}>
    {busy && <ActivityIndicator color="white" />}
    <Text style={[styles.label, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>
}
const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 12, backgroundColor: theme.colors.primary, padding: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: theme.colors.border },
  label: { color: 'white', fontSize: 16, fontWeight: '700' },
  secondaryText: { color: theme.colors.primary },
})

