import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { OperationLabel } from '../../ui/operations'
import { tones } from '../../ui/presentation'
import { AppText } from '../AppText'

export function OperationState({ label, icon, tone }: OperationLabel) {
  const colors = tones[tone]
  return <View accessible accessibilityLabel={label} style={[s.state, { backgroundColor: colors.background }]}>
    <AppText importantForAccessibility="no" style={{ color: colors.foreground }}>{icon}</AppText>
    <AppText variant="label" style={{ color: colors.foreground }}>{label}</AppText>
  </View>
}
const s = StyleSheet.create({ state: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', alignSelf: 'flex-start',
  maxWidth: '100%', padding: theme.spacing.sm, borderRadius: theme.radius.control } })
