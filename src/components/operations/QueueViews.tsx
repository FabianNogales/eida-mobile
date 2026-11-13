import { Pressable, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { queueDate, queueStatus, type QueueKind, type QueueRow } from '../../ui/queuePresentation'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { Notice } from '../Notice'
import { StatusBadge } from '../StatusBadge'
import { ExamIcon } from '../general/ExamIcon'
import { MainTabIcon } from '../MainTabIcon'

export function QueueSegments({ value, entryCount, incidentCount, onChange }: {
  value: QueueKind; entryCount: number | null; incidentCount: number | null; onChange(kind: QueueKind): void
}) {
  const options = [
    { kind: 'entries', name: 'Ingresos', count: entryCount },
    { kind: 'incidents', name: 'Incidencias', count: incidentCount },
  ] as const
  return <View style={s.segments}>{options.map(({ kind, name, count }) =>
    <Pressable key={kind} accessibilityRole="tab" accessibilityState={{ selected: kind === value }}
      accessibilityLabel={count === null ? name : `${name}, ${count} por enviar`}
      onPress={() => onChange(kind)} style={[s.segment, kind === value && s.selected]}>
      <AppText variant="label" style={kind === value ? s.primary : s.muted}>{name}</AppText>
      {count !== null && count > 0 && <AppText variant="caption" style={s.count}>{count}</AppText>}
    </Pressable>)}</View>
}

export function QueueRecordRow({ row, kind, onOpen }: { row: QueueRow; kind: QueueKind; onOpen(): void }) {
  const status = queueStatus(kind, row.state)
  const caption = row.exam + ' · ' + queueDate(row.date)
  return <Pressable accessibilityRole="button" accessibilityLabel={`${row.title}, ${caption}, ${status.label}`}
    onPress={onOpen} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <View style={s.icon} importantForAccessibility="no-hide-descendants">
      <ExamIcon name={kind === 'entries' ? 'person' : 'alert'} />
    </View>
    <View style={s.copy}>
      <AppText variant="label">{row.title}</AppText>
      <AppText variant="caption" style={s.muted}>{caption}</AppText>
      <StatusBadge {...status} />
    </View>
    <ExamIcon name="chevron" />
  </Pressable>
}

export function QueueSyncButton({ disabled, onPress }: { disabled: boolean; onPress(): void }) {
  const color = disabled ? theme.colors.muted : theme.colors.primary
  return <Pressable accessibilityRole="button" accessibilityLabel="Sincronizar"
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.sync, pressed && s.pressed]}>
    <MainTabIcon name="pending" color={color} />
    <AppText variant="label" style={{ color }}>Sincronizar</AppText>
  </Pressable>
}

export function QueueRecordDetails({ row, kind, onClose, onOfficial }: {
  row: QueueRow; kind: QueueKind; onClose(): void; onOfficial?: () => void
}) {
  const status = queueStatus(kind, row.state)
  const facts = [
    { label: 'Examen', value: row.exam },
    { label: 'Estado', value: row.state === 'PENDING' ? 'Pendiente de sincronización' : status.label },
  ]
  if (row.method) facts.push({ label: 'Registro', value: row.method === 'QR' ? 'QR · Este dispositivo' : 'Manual · Este dispositivo' })
  if (kind === 'incidents' && row.student) facts.push({ label: 'Estudiante', value: row.student })
  if (row.receivedAt) facts.push({ label: 'Recepción del servidor', value: queueDate(row.receivedAt) })
  return <>
    <View style={s.rowHeading}>
      <View style={s.icon} importantForAccessibility="no-hide-descendants"><ExamIcon name={row.state === 'PENDING' ? 'clock' : kind === 'entries' ? 'person' : 'alert'} /></View>
      <View style={s.copy}>
        <StatusBadge {...status} />
        <AppText variant="subtitle" accessibilityRole="header">{row.title}</AppText>
        <AppText variant="caption" style={s.muted}>{queueDate(row.date)}</AppText>
      </View>
    </View>
    <Card style={s.facts}>{facts.map(({ label, value }) => <View key={label} style={s.fact}>
      <AppText variant="caption" style={s.muted}>{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>)}</Card>
    {row.description && <AppText>{row.description}</AppText>}
    {row.state === 'PENDING' && <Notice tone="info" message={kind === 'entries'
      ? 'Este ingreso está guardado en el dispositivo. Aún falta el resultado del servidor.'
      : 'Este reporte está guardado en el dispositivo. Aún falta el resultado del envío.'} />}
    {row.state === 'DUPLICATE' && <Notice tone="info" message="El servidor ya tenía un ingreso para este estudiante." />}
    {row.issue && <Notice message={row.issue} />}
    {row.needsReview && <Notice message="El servidor marcó el registro para revisión." />}
    {onOfficial && <ActionButton secondary label="Consultar reporte oficial" onPress={onOfficial} />}
    <ActionButton secondary label="Volver" onPress={onClose} />
  </>
}

const s = StyleSheet.create({
  segments: { flexDirection: 'row', backgroundColor: theme.colors.border, padding: theme.spacing.xs,
    borderRadius: theme.radius.control, gap: theme.spacing.xs },
  segment: { flex: 1, minHeight: theme.layout.minTouch, flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, padding: theme.spacing.sm, borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.colors.surface },
  primary: { color: theme.colors.primary }, muted: { color: theme.colors.muted },
  count: { backgroundColor: theme.colors.background, color: theme.colors.primary, paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md,
    minHeight: theme.layout.minTouch, backgroundColor: theme.colors.surface, borderColor: theme.colors.border,
    borderWidth: 1, borderRadius: theme.radius.control },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  pressed: { borderColor: theme.colors.primary },
  copy: { flex: 1, gap: theme.spacing.xs },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.background, borderRadius: theme.radius.control },
  facts: { padding: 0, gap: 0 },
  sync: { minHeight: theme.layout.minTouch, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  fact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: theme.spacing.sm, padding: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
})
