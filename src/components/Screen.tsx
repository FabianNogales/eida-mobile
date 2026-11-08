import type { PropsWithChildren } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../config/theme'

export function Screen({ children, home = false }: PropsWithChildren<{ home?: boolean }>) {
  return <SafeAreaView style={styles.safe} edges={home ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
  </SafeAreaView>
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 36, gap: 20 },
})

