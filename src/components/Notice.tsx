import { StyleSheet, Text, View } from 'react-native'
import { theme } from '../config/theme'
import { tones, type Tone } from '../ui/presentation'

export function Notice({ message, tone = 'warning', liveRegion }: { message: string; tone?: Tone; liveRegion?: 'none' | 'polite' | 'assertive' }) {
  const colors = tones[tone]
  return <View style={[styles.box, { backgroundColor: colors.background }]}>
    <Text accessibilityRole={tone === 'error' || tone === 'warning' ? 'alert' : undefined}
      accessibilityLiveRegion={liveRegion ?? (tone === 'error' || tone === 'warning' ? 'polite' : 'none')}
      style={[styles.text, { color: colors.foreground }]}>{message}</Text>
  </View>
}
const styles = StyleSheet.create({
  box: { padding: theme.spacing.lg, borderRadius: theme.radius.control },
  text: { ...theme.typography.body },
})
