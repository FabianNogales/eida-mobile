import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { OfflineStudent, ProvisionalEvent } from '../../features/offline/contracts'
import type { SyncItem } from '../../features/offline/sync/contracts'
import { entryResult, studentEligibility } from '../../ui/entryPresentation'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { Notice } from '../Notice'
import { StatusBadge } from '../StatusBadge'
import { TextAction } from '../general/TextAction'
import { EntryDetails } from '../operations/EntryDetails'

export type StudentPhotos = readonly { kind: string; uri: string }[]

export function StudentIdentity({ student, photos }: { student: OfflineStudent; photos: StudentPhotos }) {
  const primary = photos.find((photo) => photo.kind === 'profile') ?? photos[0]
  return <View style={s.identity}>
    <View style={s.portrait}>
      {primary ? <Image source={{ uri: primary.uri }} style={s.photo} resizeMode="contain"
        accessibilityLabel={photoLabel(primary.kind)} /> : <AppText variant="caption" style={s.center}>Sin foto disponible</AppText>}
    </View>
    <View style={s.name}>
      <StatusBadge {...studentEligibility(student)} />
      <AppText variant="subtitle" accessibilityRole="header">{student.first_names} {student.last_names}</AppText>
      <AppText variant="caption">SIS {student.sis_code}</AppText>
    </View>
  </View>
}

function photoLabel(kind: string) {
  return kind === 'profile' ? 'Fotografía institucional de perfil' : 'Fotografía institucional histórica'
}

export function AdditionalPhotos({ photos }: { photos: StudentPhotos }) {
  const primary = photos.find((photo) => photo.kind === 'profile') ?? photos[0]
  return <>{photos.filter((photo) => photo !== primary).map((photo) => <View key={photo.kind} style={s.additional}>
    <AppText variant="caption">{photoLabel(photo.kind)}</AppText>
    <Image source={{ uri: photo.uri }} accessibilityLabel={photoLabel(photo.kind)} style={[s.photo, s.secondaryPhoto]} resizeMode="contain" />
  </View>)}</>
}

export function EntryFacts({ exam, document, method }: { exam: string; document: string; method?: 'MANUAL' | 'QR' }) {
  const suffix = document.length > 4 ? ' ' + document.slice(-4) : ''
  const rows: [string, string][] = [
    ['Examen', exam],
  ]
  if (method) rows.push(['Identificación', method === 'QR' ? 'QR verificado' : 'Búsqueda manual'])
  rows.push(['Documento', method ? '•••' + suffix : document])
  return <Card style={s.facts}>{rows.map(([label, value]) => <View key={label} style={s.fact}>
    <AppText variant="caption" style={s.muted}>{label}</AppText>
    <AppText variant="label" style={s.value}>{value}</AppText>
  </View>)}</Card>
}

export function EntryReview({ student, photos, exam, method, busy, error, onConfirm, onCancel, canConfirm = true }: {
  student: OfflineStudent; photos: StudentPhotos; exam: string; method: 'MANUAL' | 'QR'; busy?: boolean
  error?: string | null; canConfirm?: boolean; onConfirm(): void; onCancel(): void
}) {
  return <>
    <StudentIdentity student={student} photos={photos} />
    <EntryFacts exam={exam} document={student.identity_number} method={method} />
    <AdditionalPhotos photos={photos} />
    <Notice tone="info" message={photos.length ? 'Compara la fotografía antes de confirmar.' : 'Comprueba la identidad antes de confirmar.'} />
    {error && <Notice tone="error" message={error} />}
    <View style={s.actions}>
      <ActionButton label="Confirmar ingreso" busy={busy} disabled={!canConfirm} onPress={onConfirm} />
      <TextAction label="Cancelar" disabled={busy} onPress={onCancel} />
    </View>
  </>
}

export function EntryResult({ event, item, duplicate, error, onContinue }: {
  event: Pick<ProvisionalEvent, 'event_id'>; item?: SyncItem; duplicate?: boolean; error?: string | null
  onContinue(): void
}) {
  const [expanded, setExpanded] = useState(false)
  const detail = item?.eventId === event.event_id ? item : null
  const result = entryResult(event, item, duplicate)
  return <>
    <Card style={s.result}>
      <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" style={s.center}>{result.title}</AppText>
      <StatusBadge label={result.message} tone={result.tone} />
    </Card>
    {error && <Notice message={error} />}
    <View style={s.actions}>
      <ActionButton label="Continuar control" onPress={onContinue} />
      {detail && <TextAction label={expanded ? 'Ocultar detalle del registro' : 'Ver detalle del registro'}
        onPress={() => setExpanded(!expanded)} />}
    </View>
    {expanded && detail && <Card><EntryDetails item={detail} /></Card>}
  </>
}

const s = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  portrait: { width: 76, minHeight: 88, backgroundColor: theme.colors.surface, borderRadius: theme.radius.control,
    overflow: 'hidden', justifyContent: 'center' },
  name: { flex: 1, gap: theme.spacing.xs },
  photo: { width: '100%', height: 96, backgroundColor: theme.colors.surface },
  additional: { gap: theme.spacing.xs, alignItems: 'flex-start' }, secondaryPhoto: { height: 160 },
  facts: { padding: 0, gap: 0 }, fact: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    alignItems: 'center', padding: theme.spacing.md, gap: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border },
  muted: { color: theme.colors.muted }, value: { maxWidth: '100%' },
  center: { textAlign: 'center' }, result: { alignItems: 'center' }, actions: { gap: theme.spacing.xs },
})
