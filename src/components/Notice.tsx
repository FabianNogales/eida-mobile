import { StyleSheet, Text, View } from 'react-native'
import { theme } from '../config/theme'

export function Notice({ message }: { message: string }) {
  return <View style={styles.box}><Text accessibilityRole="alert" style={styles.text}>{message}</Text></View>
}
const styles = StyleSheet.create({
  box: { padding: 16, backgroundColor: theme.colors.warningSoft, borderRadius: 12 },
  text: { color: theme.colors.warning, fontSize: 14, lineHeight: 22 },
})
