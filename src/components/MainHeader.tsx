import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { AppText } from './AppText'
import { EidaLogo } from './general/EidaLogo'

export function MainHeader({ title }: { title: string }) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
    <View style={styles.row}><EidaLogo compact decorative />
      <AppText variant="subtitle" accessibilityRole="header" style={styles.title}>{title}</AppText>
    </View>
  </SafeAreaView>
}
const styles = StyleSheet.create({
  header: { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, width: '100%',
    maxWidth: theme.layout.contentMaxWidth, alignSelf: 'center' },
  title: { textAlign: 'center' },
})
