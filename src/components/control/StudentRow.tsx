import { Pressable, StyleSheet } from 'react-native'
import { theme } from '../../config/theme'
import type { OfflineStudent } from '../../features/offline/contracts'
import type { SyncItem } from '../../features/offline/sync/contracts'
import { studentEntryLabel, studentPhotoLabel } from '../../ui/controlScreens'
import { AppText } from '../AppText'
import { StatusBadge } from '../StatusBadge'

export function StudentRow({ student, item, disabled, onOpen }: {
  student: OfflineStudent; item?: SyncItem; disabled: boolean; onOpen(): void
}) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
    accessibilityLabel={`Abrir ficha de ${student.last_names}, ${student.first_names}. SIS ${student.sis_code}. CI ${student.identity_number}. ${studentEntryLabel(student, item).label}`}
    onPress={onOpen} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <AppText variant="label">{student.last_names}, {student.first_names}</AppText>
    <AppText variant="caption">SIS {student.sis_code} · CI {student.identity_number}</AppText>
    <AppText variant="caption">Habilitación en copia: {student.eligibility_status ?? 'Desconocida'}</AppText>
    <StatusBadge {...studentEntryLabel(student, item)} />
    <AppText variant="caption" style={s.muted}>{studentPhotoLabel(student)}</AppText>
  </Pressable>
}
const s = StyleSheet.create({ row: { minHeight: theme.layout.minTouch, padding: theme.spacing.lg, gap: theme.spacing.sm,
  backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control },
  pressed: { borderColor: theme.colors.primary }, muted: { color: theme.colors.muted } })
