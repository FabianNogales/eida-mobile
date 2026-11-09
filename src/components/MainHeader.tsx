import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { AppText } from './AppText'

export function MainHeader({ title }: { title: string }) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
    <AppText variant="subtitle" accessibilityRole="header" style={styles.title}>{title}</AppText>
  </SafeAreaView>
}
const styles = StyleSheet.create({
  header: { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.lg, textAlign: 'center' },
})
