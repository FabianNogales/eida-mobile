import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { AppText } from './AppText'
import { ActionButton } from './ActionButton'
import { Notice } from './Notice'
import { theme } from '../config/theme'

export function LoadingState({ label }: { label: string }) {
  return <View style={styles.state} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
    <ActivityIndicator color={theme.colors.primary} importantForAccessibility="no" /><AppText>{label}</AppText>
  </View>
}
export function EmptyState({ title, message, action }: { title: string; message: string; action?: { label: string; onPress(): void } }) {
  return <View style={styles.state}><AppText variant="subtitle" accessibilityRole="header">{title}</AppText>
    <AppText>{message}</AppText>{action && <ActionButton secondary {...action} />}</View>
}
export function ConnectionBanner({ state, message }: { state: 'online' | 'offline' | 'unknown'; message: string }) {
  const label = state === 'online' ? 'Conexión disponible' : state === 'offline' ? 'Sin conexión' : 'Conexión no comprobada'
  return <Notice tone={state === 'online' ? 'info' : 'warning'} message={`${label}. ${message}`} />
}
const styles = StyleSheet.create({ state: { gap: theme.spacing.md, paddingVertical: theme.spacing.lg } })
