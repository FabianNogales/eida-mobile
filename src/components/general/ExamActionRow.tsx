import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'
import { ExamIcon, type ExamIconName } from './ExamIcon'

export function ExamActionRow({ label, hint, icon, onPress, card = false, disabled = false }: {
  label: string; hint?: string; icon: ExamIconName; onPress(): void; card?: boolean; disabled?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [s.row, card && s.card, pressed && s.pressed, disabled && s.disabled]}>
    <View style={s.icon}><ExamIcon name={icon} /></View>
    <View style={s.copy}><AppText variant="label">{label}</AppText>{hint && <AppText variant="caption" style={s.hint}>{hint}</AppText>}</View>
    <ExamIcon name="chevron" />
  </Pressable>
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: theme.spacing.md,
    paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderColor: theme.colors.border },
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderRadius: theme.radius.card, paddingHorizontal: theme.spacing.md },
  icon: { width: 40, height: 40, borderRadius: theme.radius.control, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: theme.spacing.xs }, hint: { color: theme.colors.muted },
  pressed: { backgroundColor: theme.colors.background }, disabled: { opacity: 0.5 },
})

