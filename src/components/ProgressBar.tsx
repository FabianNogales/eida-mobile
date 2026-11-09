import { StyleSheet, View } from 'react-native'
import { AppText } from './AppText'
import { LoadingState } from './FeedbackStates'
import { theme } from '../config/theme'
import { progressValue } from '../ui/presentation'

export function ProgressBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return <LoadingState label={label} />
  const progress = progressValue(value), percent = Math.round(progress * 100)
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }} style={styles.group}>
    <AppText>{label} · {percent}%</AppText>
    <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
  </View>
}
const styles = StyleSheet.create({ group: { gap: theme.spacing.sm }, track: { height: 8, borderRadius: theme.radius.small, backgroundColor: theme.colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: theme.colors.primary } })
