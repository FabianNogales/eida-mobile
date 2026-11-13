import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { OfflineStudent } from '../../features/offline/contracts'
import type { SyncItem } from '../../features/offline/sync/contracts'
import { studentEntryLabel } from '../../ui/controlScreens'
import { studentEligibility } from '../../ui/entryPresentation'
import { AppText } from '../AppText'
import { StatusBadge } from '../StatusBadge'
import { ExamIcon } from '../general/ExamIcon'

export function StudentRow({ student, item, disabled, onOpen }: {
  student: OfflineStudent; item?: SyncItem; disabled: boolean; onOpen(): void
}) {
  const name = `${student.first_names} ${student.last_names}`
  const initials = [student.first_names.trim()[0], student.last_names.trim()[0]].join('').toLocaleUpperCase('es')
  const eligibility = studentEligibility(student)
  const entry = item || student.entry_status === 'REGISTERED' ? studentEntryLabel(student, item) : null
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
    accessibilityLabel={`Abrir ficha de ${name}. SIS ${student.sis_code}. ${eligibility.label}${entry ? '. ' + entry.label : ''}`}
    onPress={onOpen} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <View style={s.avatar} importantForAccessibility="no-hide-descendants"><AppText variant="label" style={s.initials}>{initials}</AppText></View>
    <View style={s.copy}>
      <AppText variant="label">{name}</AppText>
      <AppText variant="caption" style={s.muted}>SIS {student.sis_code}</AppText>
      <View style={s.states}><StatusBadge {...eligibility} />{entry && <StatusBadge {...entry} />}</View>
    </View>
    <ExamIcon name="chevron" />
  </Pressable>
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: theme.layout.minTouch, padding: theme.spacing.md,
    gap: theme.spacing.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.control },
  avatar: { width: 38, height: 38, borderRadius: theme.radius.pill, backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: theme.spacing.xs }, states: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  initials: { color: theme.colors.primary }, pressed: { borderColor: theme.colors.primary }, muted: { color: theme.colors.muted },
})
