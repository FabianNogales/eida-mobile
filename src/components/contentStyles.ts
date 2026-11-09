import { StyleSheet } from 'react-native'
import { theme } from '../config/theme'

export const contentStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.navy },
  subtitle: { fontSize: 18, fontWeight: '700', color: theme.colors.navy },
  body: { fontSize: 14, lineHeight: 22, color: theme.colors.muted },
  card: { backgroundColor: 'white', borderRadius: 18, padding: 20, gap: 10 },
  label: { color: theme.colors.accent, fontWeight: '700', fontSize: 12 },
})
