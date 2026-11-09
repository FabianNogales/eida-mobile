import { ApiError } from '../../services/http/errors'
import { sameBinding, type OfflineBinding } from '../offline/contracts'
import type { DisciplineApi } from './api'
import type { IncidentRepository } from './repository'

export function incidentFailure(error: unknown): string {
  if (!(error instanceof ApiError)) return 'INVALID_RESPONSE_OR_LOCAL_FAILURE'
  if (error.status === 401) return 'SESSION_REQUIRED'
  if (error.status === 403) return error.code === 'MOBILE_ABILITY_REQUIRED' ? 'MOBILE_POLICY_PENDING' : 'ACCESS_DENIED'
  if (error.status === 422) return 'CONTRACT_REJECTED'
  if (error.status === 404) return 'BACKEND_EXTENSION_REQUIRED'
  if ((error.status ?? 0) >= 500) return 'SERVER_FAILURE'
  return error.kind === 'timeout' ? 'RESPONSE_LOST' : 'CONNECTION_UNCONFIRMED'
}
export const incidentErrorLabels: Readonly<Record<string, string>> = {
  SESSION_REQUIRED: 'Valida otra vez la cuenta original.', MOBILE_POLICY_PENDING: 'La política central todavía no habilita incidencias para el token móvil. Requiere coordinación del backend.',
  ACCESS_DENIED: 'Acceso denegado. Se conserva el evento para revisión.', CONTRACT_REJECTED: 'El servidor rechazó la estructura. Conserva la evidencia para revisar el contrato.',
  BACKEND_EXTENSION_REQUIRED: 'Falta desplegar la extensión de incidencias.', SERVER_FAILURE: 'Error de servidor; reintenta con el mismo UUID.',
  RESPONSE_LOST: 'No llegó la respuesta. El reintento conservará el UUID.', CONNECTION_UNCONFIRMED: 'Sin conexión confirmada. Los pendientes se conservan.',
  INVALID_RESPONSE_OR_LOCAL_FAILURE: 'No se conservó un recibo válido. Reintenta sin modificar el evento.', INTERRUPTED: 'Envío interrumpido; pendiente de recuperar el recibo.',
}
export class IncidentSync {
  private busy = false
  constructor(private repository: IncidentRepository, private api: Pick<DisciplineApi, 'sync'>, private currentBinding: () => OfflineBinding | null, private newUuid: () => string) {}
  private authorize() {
    const b = this.currentBinding()
    if (!b || !sameBinding(b, this.repository.binding)) throw new Error('Valida la cuenta y el dispositivo originales para enviar incidencias.')
  }
  async run(changed: () => void = () => {}) {
    if (this.busy) throw new Error('Ya se están enviando incidencias.')
    this.authorize(); this.busy = true
    const lease = this.newUuid(); let acquired = false
    try {
      await this.repository.acquire(lease); acquired = true
      for (const item of await this.repository.items()) {
        if (item.state !== 'PENDING') continue
        this.authorize()
        const request = await this.repository.begin(lease, item.event.event_id); changed()
        try {
          const receipt = await this.api.sync(request.event.exam_id, request.json, request.hash)
          this.authorize()
          await this.repository.finish(lease, item.event.event_id, receipt)
          if (['OFFLINE_AUTHORIZATION_CHANGED', 'INCIDENT_AUTHORIZATION_REVOKED'].includes(receipt.code)) {
            await this.repository.repo.setState(request.event.package_id, 'DESACTUALIZADO')
          }
          changed()
        } catch (error) {
          try { await this.repository.defer(lease, item.event.event_id, incidentFailure(error)) } catch { /* locked: recover SENDING on next unlock */ }
          changed(); return // No automatic resend after ambiguous transport errors.
        }
      }
    } finally {
      if (acquired) { try { await this.repository.release(lease) } catch { /* next unlock recovers only the incident lease */ } }
      this.busy = false; changed()
    }
  }
}
