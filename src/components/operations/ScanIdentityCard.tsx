import { Image, StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import type { ScanIdentity } from '../../features/scanner/scanSession'
import type { ProvisionalEvent } from '../../features/offline/contracts'
import type { SyncReceipt } from '../../features/offline/sync/contracts'
import { localEntrySavedMessage } from '../../ui/operations'
import { laPazInstant } from '../../utils/dates'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { Notice } from '../Notice'

export function ScanIdentityCard({ identity, examName, review, event, receipt: suppliedReceipt, onConfirm, onCancel }: {
  identity: ScanIdentity; examName: string; review: boolean; event: ProvisionalEvent | null
  receipt: SyncReceipt | null | undefined; onConfirm(): void; onCancel(): void
}) {
  const student = identity.student
  const receipt = event && suppliedReceipt?.event_id === event.event_id ? suppliedReceipt : null
  return <Card>
    <AppText variant="subtitle" accessibilityRole="header">Identidad autenticada con QR v3</AppText>
    <AppText variant="title">{student.last_names}, {student.first_names}</AppText>
    <AppText>SIS {student.sis_code} · CI {student.identity_number}</AppText>
    <AppText>{examName}</AppText>
    <AppText>Inscripción: {student.enrollment_status ?? 'Desconocida'} · habilitación en copia: {student.eligibility_status ?? 'Desconocida'}</AppText>
    {student.photos.filter((photo) => photo.state === 'ABSENT').map((photo) => <Notice key={photo.kind} tone="info"
      message={`Fotografía ${photo.kind === 'profile' ? 'de perfil' : 'histórica'}: ausencia informada por el servidor.`} />)}
    {identity.photos.map((photo) => <View key={photo.kind} style={s.group}>
      <AppText variant="label">Fotografía {photo.kind === 'profile' ? 'de perfil' : 'histórica'}</AppText>
      <Image source={{ uri: photo.uri }} accessibilityLabel={`Fotografía institucional ${photo.kind}`} style={s.photo} resizeMode="contain" />
    </View>)}
    {review && <>
      <Notice message="Comprueba la persona y las fotografías. La firma válida no registra el ingreso ni acredita cambios posteriores a la descarga." />
      <ActionButton label="Confirmar ingreso provisional" onPress={onConfirm} />
      <ActionButton secondary label="Cancelar sin registrar" onPress={onCancel} />
    </>}
    {event && (receipt?.status === 'ACCEPTED' ? <Notice tone="success" message={`INGRESO OFICIAL CONFIRMADO por Laravel · registro ${receipt.entry_id}.`} /> :
      receipt?.status === 'DUPLICATE' ? <Notice tone="info" message={`El servidor informa un ingreso existente (${receipt.entry_id}). Esta operación no creó otro ingreso.`} /> :
      receipt ? <Notice tone={receipt.status === 'REJECTED' ? 'error' : 'warning'} message={`${receipt.status}: ${receipt.code}. ${receipt.message} Sin nuevo ingreso oficial confirmado.`} /> :
      <Notice message={`${localEntrySavedMessage}. UUID ${event.event_id} · ${laPazInstant(event.captured_at)}. Sin confirmación oficial.`} />)}
    {receipt?.review_required && <Notice message="La evidencia requiere revisión. No se acredita asistencia por la hora declarada del dispositivo." />}
  </Card>
}
const s = StyleSheet.create({ group: { gap: theme.spacing.sm }, photo: { width: '100%', aspectRatio: 0.85, maxHeight: 360 } })
