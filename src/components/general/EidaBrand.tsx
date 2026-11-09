import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'
import { EidaLogo } from './EidaLogo'

// Original artwork rendered as a local transparent PNG; no SVG transformer or network.
export function EidaBrand() {
  return <View style={s.brand}>
    <EidaLogo />
    <AppText variant="subtitle">EIDA Control</AppText>
    <AppText variant="caption" style={s.caption}>Universidad Mayor de San Simón</AppText>
  </View>
}
const s = StyleSheet.create({ brand: { gap: theme.spacing.xs }, caption: { color: theme.colors.muted } })
