import { Image, Modal, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../../config/theme'
import type { OfflineStudent, PackageRecord, ProvisionalEvent } from '../../features/offline/contracts'
import type { SyncReceipt } from '../../features/offline/sync/contracts'
import { manualAvailability } from '../../ui/controlScreens'
import { localEntrySavedMessage } from '../../ui/operations'
import { laPazInstant } from '../../utils/dates'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { Notice } from '../Notice'
import { Screen } from '../Screen'

export function StudentDetailModal({ student, record: p, photos, event, receipt, error, busy, canQrRecord,
  onClose, onManual, onQrRecord, onScan, onIncident }: {
  student: OfflineStudent; record: PackageRecord; photos: { kind: string; uri: string }[]
  event: ProvisionalEvent | null; receipt: SyncReceipt | null | undefined; error: string | null
  busy: boolean; canQrRecord: boolean; onClose(): void; onManual(): void; onQrRecord(): void; onScan(): void; onIncident(): void
}) {
  const manual = manualAvailability(student, event !== null)
  return <Modal visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider><Screen header="none" bottomOwnedByNavigator={false}>
      <View accessibilityViewIsModal onAccessibilityEscape={onClose} style={s.content}>
        <ActionButton secondary label="Volver a la lista" onPress={onClose} />
        <AppText variant="title" accessibilityRole="header">{student.last_names}, {student.first_names}</AppText>
        {error && <Notice tone="error" message={error} />}
        <Card>
          <AppText variant="subtitle" accessibilityRole="header">Identificación</AppText>
          <AppText>SIS: {student.sis_code}</AppText><AppText>CI: {student.identity_number}</AppText>
          {student.photos.filter((photo) => photo.state === 'ABSENT').map((photo) =>
            <Notice key={photo.kind} tone="info" message={`Fotografía ${photo.kind === 'profile' ? 'de perfil' : 'histórica'}: ausencia informada por el servidor.`} />)}
          {photos.map((photo) => <View key={photo.kind} style={s.photoGroup}>
            <AppText variant="label">Fotografía {photo.kind === 'profile' ? 'de perfil' : 'histórica'}</AppText>
            <Image accessibilityLabel={`Fotografía institucional ${photo.kind === 'profile' ? 'de perfil' : 'histórica'}`}
              source={{ uri: photo.uri }} style={s.photo} resizeMode="contain" />
          </View>)}
        </Card>
        <Card>
          <AppText variant="subtitle" accessibilityRole="header">Datos de la copia autorizada</AppText>
          <AppText>{p.manifest.exam.name}</AppText>
          <AppText>Ambiente: {p.manifest.exam.room?.name ?? 'No informado'}</AppText>
          <AppText>Estado de estudiante: {student.student_status}</AppText>
          <AppText>Inscripción: {student.enrollment_status ?? 'Desconocida'}</AppText>
          <AppText>Habilitación: {student.eligibility_status ?? 'Desconocida'} · revisión {student.eligibility_revision ?? 'no informada'}</AppText>
          <AppText>Ingreso al descargar: {student.entry_status === 'REGISTERED' ? 'Informado como registrado' : 'Pendiente en la copia'}</AppText>
          <AppText>Datos al {laPazInstant(p.manifest.prepared_at)}</AppText>
          <Notice message="Los cambios de habilitación, ingresos y revocaciones posteriores a esta copia pueden desconocerse." />
        </Card>
        {event ? <Card>
          {receipt?.status === 'ACCEPTED' ? <Notice tone="success" message={`INGRESO OFICIAL CONFIRMADO por Laravel · registro ${receipt.entry_id}.`} /> :
            receipt?.status === 'DUPLICATE' ? <Notice tone="info" message={`El servidor informa un ingreso oficial existente (${receipt.entry_id}); esta operación es un duplicado.`} /> :
            receipt ? <Notice message={`${receipt.status}: ${receipt.code}. ${receipt.message} Sin nuevo ingreso oficial confirmado.`} /> :
            <Notice message={`${localEntrySavedMessage}. UUID: ${event.event_id}. Hora estimada: ${laPazInstant(event.captured_at)}. Sin confirmación oficial.`} />}
        </Card> : <Card>
          <AppText variant="subtitle" accessibilityRole="header">Registro provisional</AppText>
          {!manual.allowed && <Notice message={manual.reason ?? 'Registro no disponible.'} />}
          <Notice message="Registro manual: no autentica un QR. Comprueba personalmente la identidad y las fotos; será provisional hasta la respuesta de Laravel." />
          <ActionButton label="Registrar ingreso manual provisional" busy={busy} disabled={!manual.allowed} onPress={onManual} />
          <ActionButton secondary label="Registrar ingreso QR provisional" disabled={!manual.allowed || !canQrRecord || busy} onPress={onQrRecord} />
          <AppText>Se comprobarán de nuevo habilitación, vigencia y duplicados al guardar. El servidor decide la aceptación.</AppText>
        </Card>}
        <ActionButton secondary label="Escanear QR de esta lista" disabled={!p.manifest.qr.available || busy} onPress={onScan} />
        <ActionButton secondary label="Reportar incidencia en esta lista" disabled={busy} onPress={onIncident} />
        {p.manifest.qr.available && <Notice message="La sincronización QR v3 requiere soporte anunciado y verificación de evidencia en Laravel. La firma del celular no confirma el ingreso." />}
      </View>
    </Screen></SafeAreaProvider>
  </Modal>
}
const s = StyleSheet.create({ content: { gap: theme.spacing.xl }, photoGroup: { gap: theme.spacing.sm },
  photo: { width: '100%', aspectRatio: 0.85, maxHeight: 360, backgroundColor: theme.colors.background } })
