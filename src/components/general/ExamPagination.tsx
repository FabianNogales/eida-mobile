import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { AppText } from '../AppText'
import { ExamIcon } from './ExamIcon'

export function ExamPagination({ current, pages, previous, next, busy, onPage }: {
  current: number; pages: number; previous: number | null; next: number | null
  busy: boolean; onPage(page: number): void
}) {
  if (pages <= 1) return null
  const arrow = (target: number | null, back: boolean) => {
    const disabled = busy || target === null
    return <Pressable accessibilityRole="button" accessibilityLabel={back ? 'Página anterior' : 'Página siguiente'}
      accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!busy && target !== null) onPage(target) }}
      style={({ pressed }) => [s.arrow, pressed && s.pressed]}>
      <View style={back && s.back}><ExamIcon name="chevron" color={disabled ? theme.colors.muted : theme.colors.primary} /></View>
    </Pressable>
  }
  return <View style={s.pagination}>
    {arrow(previous, true)}
    <AppText accessibilityLiveRegion="polite" accessibilityLabel={`Página ${current} de ${pages}`}>{current} / {pages}</AppText>
    {arrow(next, false)}
  </View>
}

const s = StyleSheet.create({
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderTopWidth: 1, borderColor: theme.colors.border },
  arrow: { minWidth: theme.layout.minTouch, minHeight: theme.layout.minTouch,
    alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.sm },
  pressed: { backgroundColor: theme.colors.background },
  back: { transform: [{ rotate: '180deg' }] },
})
