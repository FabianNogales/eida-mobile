import { StyleSheet } from 'react-native'
import { theme } from '../config/theme'

export const contentStyles = StyleSheet.create({
  title: { ...theme.typography.title, color: theme.colors.navy },
  subtitle: { ...theme.typography.subtitle, color: theme.colors.navy },
  body: { ...theme.typography.body, color: theme.colors.muted },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, padding: theme.spacing.xl, gap: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border },
  label: { ...theme.typography.caption, color: theme.colors.accent, fontWeight: '700' },
})
