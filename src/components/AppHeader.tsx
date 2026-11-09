import { StyleSheet, View } from 'react-native'
import { AppText } from './AppText'
import { theme } from '../config/theme'

// Content heading; not a second system/navigation header and does not add top insets.
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.header}><AppText variant="title" accessibilityRole="header">{title}</AppText>
    {subtitle && <AppText style={styles.subtitle}>{subtitle}</AppText>}</View>
}
const styles = StyleSheet.create({ header: { gap: theme.spacing.sm }, subtitle: { color: theme.colors.muted } })
