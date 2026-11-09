import { StyleSheet, Text, View } from 'react-native'
import { theme } from '../config/theme'
import { tones, type Tone } from '../ui/presentation'

// Label is explicit. Color/connectivity never establishes a server ACK or permission.
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const colors = tones[tone]
  return <View style={[styles.badge, { backgroundColor: colors.background }]}>
    <Text style={[styles.text, { color: colors.foreground }]}>{label}</Text>
  </View>
}
const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: theme.radius.control, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  text: { ...theme.typography.label, flexShrink: 1 },
})
