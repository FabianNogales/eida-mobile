import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { theme } from '../config/theme'

export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={theme.colors.muted} style={styles.input} {...props} /></View>
}
const styles = StyleSheet.create({
  field: { gap: 8 }, label: { color: theme.colors.navy, fontWeight: '600', fontSize: 14 },
  input: { minHeight: 54, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'white', color: theme.colors.text, fontSize: 16 },
})
