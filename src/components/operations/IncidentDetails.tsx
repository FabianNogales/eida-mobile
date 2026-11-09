import type { IncidentItem } from '../../features/incidents/contracts'
import { incidentTypes } from '../../features/incidents/contracts'
import { incidentErrorLabels } from '../../features/incidents/sync'
import { incidentDelivery } from '../../ui/operations'
import { laPazInstant } from '../../utils/dates'
import { AppText } from '../AppText'
import { Notice } from '../Notice'
import { OperationState } from './OperationState'

export function IncidentDetails({ item }: { item: IncidentItem }) {
  const e = item.event
  const receipt = item.receipt?.event_id === e.event_id && item.receipt.request_hash === item.hash ? item.receipt : null
  return <>
    <OperationState {...incidentDelivery(item)} />
    <AppText variant="subtitle">{incidentTypes.find((type) => type.value === e.type)?.label}</AppText>
    <AppText>{e.description}</AppText>
    <AppText>Examen {e.exam_id} · estudiante {e.student_id ?? 'Sin relación individual'} · actor {e.actor_id}</AppText>
    <AppText>Captura declarada: {laPazInstant(e.captured_at)}</AppText><AppText>UUID {e.event_id} · intentos {item.attempts}</AppText>
    {item.errorCode && <Notice tone="error" message={incidentErrorLabels[item.errorCode] ?? 'Envío pendiente de revisión; el contenido original se conserva.'} />}
    {receipt && <Notice tone={receipt.status === 'REGISTERED' ? 'success' : receipt.status === 'REJECTED' ? 'error' : 'warning'}
      message={receipt.status === 'REGISTERED' ? `Laravel confirmó el reporte ${receipt.incident_id}. Recepción: ${laPazInstant(receipt.received_at)}. No constituye una infracción confirmada.`
        : `Resultado ${receipt.status}. Código: ${receipt.code}. No se confirmó un reporte oficial nuevo.`} />}
    {receipt?.review_required && <Notice message="Requiere revisión por recepción tardía. No aplica sanciones automáticamente." />}
  </>
}
