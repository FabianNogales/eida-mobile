import { StyleSheet, View, type ViewProps } from 'react-native'
import { theme } from '../config/theme'

export function Card({ style, ...props }: ViewProps) { return <View {...props} style={[styles.card, style]} /> }
const styles = StyleSheet.create({ card: { width: '100%', padding: theme.spacing.xl, gap: theme.spacing.md,
  backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, borderColor: theme.colors.border, borderWidth: 1 } })
