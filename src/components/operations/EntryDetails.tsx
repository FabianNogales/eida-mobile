import type { SyncItem } from '../../features/offline/sync/contracts'
import { entryDelivery } from '../../ui/operations'
import { laPazInstant } from '../../utils/dates'
import { AppText } from '../AppText'
import { Notice } from '../Notice'
import { OperationState } from './OperationState'

export function EntryDetails({ item }: { item: SyncItem }) {
  const receipt = item.receipt?.event_id === item.eventId ? item.receipt : null
  return <>
    <OperationState {...entryDelivery(item)} />
    <AppText>Examen {item.examId} · estudiante {item.studentId}</AppText>
    <AppText>Método: {item.method} · captura estimada: {laPazInstant(item.capturedAt)}</AppText>
    <AppText>Operación: {item.eventId}</AppText><AppText>Paquete original: {item.packageId} · actor {item.actorId}</AppText>
    <AppText>Intentos: {item.attempts} · último: {item.lastAttemptAt ? laPazInstant(item.lastAttemptAt) : 'No registrado'}</AppText>
    {item.errorMessage && <Notice tone="error" message={`${item.errorCode ?? 'Error'}: ${item.errorMessage}`} />}
    {receipt && <>
      <AppText>{receipt.code}: {receipt.message}</AppText>
      <AppText>Recibido por Laravel: {laPazInstant(receipt.received_at)}</AppText>
      {receipt.status === 'ACCEPTED' && <Notice tone="success" message={`INGRESO OFICIAL CONFIRMADO por Laravel · registro ${receipt.entry_id}.`} />}
      {receipt.status === 'DUPLICATE' && <Notice tone="info" message={`Ya existía un ingreso oficial (${receipt.entry_id}). Esta operación no creó otro ingreso.`} />}
      {(receipt.status === 'CONFLICT' || receipt.status === 'REJECTED') && <Notice message="El resultado no confirma un nuevo ingreso. El evento y su evidencia permanecen protegidos." />}
      {receipt.review_required && <Notice message="Evidencia pendiente de revisión. La hora declarada del dispositivo no acredita por sí sola asistencia durante el examen." />}
    </>}
    {item.state === 'CONFLICT' && <Notice message="Reenviar el mismo UUID no cambia la decisión. No hay aprobación automática de asistencia." />}
  </>
}
