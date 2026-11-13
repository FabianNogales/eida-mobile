import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'
import { EidaLogo } from './EidaLogo'

// Original artwork rendered as a local transparent PNG; no SVG transformer or network.
export function EidaBrand() {
  return <View style={s.brand}>
    <EidaLogo />
    <AppText variant="title" accessibilityRole="header">EIDA Control</AppText>
    <AppText style={s.caption}>Control de ingreso a exámenes</AppText>
  </View>
}
const s = StyleSheet.create({ brand: { alignItems: 'center', gap: theme.spacing.md }, caption: { color: theme.colors.muted, textAlign: 'center' } })
