import { Pressable, StyleSheet } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'

export function OperationalTile({ label, value, hint, onPress }: { label: string; value: string; hint?: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}
    onPress={onPress} style={({ pressed }) => [s.tile, pressed && s.pressed]}>
    <AppText variant="subtitle">{value}</AppText><AppText variant="label">{label}</AppText>
    {hint && <AppText variant="caption" style={s.hint}>{hint}</AppText>}
  </Pressable>
}
const s = StyleSheet.create({
  tile: { flexBasis: 140, flexGrow: 1, minHeight: theme.layout.minTouch, gap: theme.spacing.sm, padding: theme.spacing.lg,
    borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  pressed: { borderColor: theme.colors.primary }, hint: { color: theme.colors.muted },
})
