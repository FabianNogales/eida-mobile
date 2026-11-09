import { ApiError } from '../../../services/http/errors'
import { sameBinding, type OfflineBinding } from '../contracts'
import type { OutboxRepository } from './outbox'
import type { SyncApi } from './api'
import type { PendingEvent, SyncCapabilities, SyncFailure, SyncProgress } from './contracts'

export function syncFailure(error: unknown): SyncFailure {
  if (!(error instanceof ApiError)) return { code: 'INVALID_RESPONSE_OR_LOCAL_FAILURE', message: 'No se pudo conservar una respuesta válida. Reintenta sin modificar la evidencia.', stop: true }
  if (error.kind === 'network') return { code: 'NETWORK_UNAVAILABLE', message: 'Sin conexión. El servidor pudo haber procesado el último envío; el UUID se conservará.', stop: true }
  if (error.kind === 'timeout') return { code: 'RESPONSE_TIMEOUT', message: 'No llegó la respuesta. Reintenta con el mismo UUID para recuperar el resultado del servidor.', stop: true }
  if (error.code === 'ACCOUNT_INACTIVE') return { code: error.code, message: 'La cuenta está desactivada. Los eventos permanecen protegidos.', stop: true }
  if (error.code === 'MOBILE_DEVICE_REVOKED') return { code: error.code, message: 'El servidor revocó este dispositivo. Los eventos no se eliminaron.', stop: true }
  if (error.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED') return { code: 'SESSION_NOT_VALIDATED', message: 'Valida de nuevo la cuenta original con internet para sincronizar.', stop: true }
  if (error.status === 403) return { code: error.code ?? 'SYNC_FORBIDDEN', message: error.code === 'PACKAGE_NOT_OWNED' ? 'El paquete no pertenece al actor autenticado; no se cambiará de usuario la evidencia.' : 'El servidor denegó acceso al paquete o al permiso de sincronización.', stop: false }
  if (error.status === 422) return { code: 'INVALID_BATCH_STRUCTURE', message: 'El servidor rechazó la estructura del lote. Conserva la evidencia para revisar el contrato.', stop: false }
  if (error.status === 404) return { code: 'BACKEND_EXTENSION_REQUIRED', message: 'El servidor no ofrece la extensión HU37 requerida. Despliega el backend antes de reintentar.', stop: false }
  if (error.status === 429) return { code: 'RATE_LIMITED', message: 'Límite de solicitudes alcanzado. Espera y reintenta manualmente.', stop: true }
  if ((error.status ?? 0) >= 500) return { code: 'SERVER_FAILURE', message: 'Error del servidor. Puede haber resultados ya confirmados; se recuperarán con los UUID originales.', stop: true }
  return { code: 'SYNC_REQUEST_FAILED', message: 'No se confirmó el envío. Los eventos permanecen pendientes.', stop: true }
}

export class OfflineSyncController {
  private busy = false
  constructor(private outbox: OutboxRepository, private api: Pick<SyncApi, 'capabilities' | 'send'>,
    private uuid: () => string, private currentBinding: () => OfflineBinding | null,
    private now: () => string = () => new Date().toISOString()) {}
  private authorize() {
    const current = this.currentBinding()
    if (!current || !sameBinding(current, this.outbox.binding)) throw new Error('Debes validar la cuenta y el dispositivo originales antes de enviar.')
  }
  async sync(update: (progress: SyncProgress) => void = () => {}) {
    if (this.busy) throw new Error('La sincronización ya está en curso.')
    this.authorize()
    const lease = this.uuid()
    this.busy = true
    let acquired = false, processed = 0, batches = 0, total = 0, message: string | null = null
    const progress = (running: boolean) => update({ running, processed, batches, total, message })
    try {
      await this.outbox.acquire(lease); acquired = true
      await this.outbox.reconcile()
      const pending = await this.outbox.pending(); total = pending.length; progress(true)
      const groups = new Map<string, PendingEvent[]>()
      for (const event of pending) {
        const key = JSON.stringify(event.context), group = groups.get(key) ?? []
        group.push(event); groups.set(key, group)
      }
      for (const group of groups.values()) {
        this.authorize()
        const first = group[0]
        if (!first) continue
        let caps: SyncCapabilities
        try { caps = await this.api.capabilities(first.context.exam_id) }
        catch (error) {
          const failure = syncFailure(error); await this.outbox.defer(group, failure); message = failure.message; progress(true)
          if (failure.stop) break
          continue
        }
        if (!caps.protocols.includes(2) || !caps.lateEvidence) {
          message = 'El backend requiere la extensión de evidencia y recibos HU37 v2 antes del primer envío.'
          await this.outbox.defer(group, { code: 'BACKEND_EXTENSION_REQUIRED', message, stop: false }); progress(true); continue
        }
        const eligible = group.filter((e) => !e.needsQrV3 || caps.qrVersions.includes(3))
        const blocked = group.filter((e) => e.needsQrV3 && !caps.qrVersions.includes(3))
        if (blocked.length) {
          message = 'Hay evidencia QR v3 pendiente: el servidor todavía no anuncia su verificación estricta.'
          await this.outbox.defer(blocked, { code: 'QR_V3_UNAVAILABLE', message, stop: false })
        }
        const size = Math.min(100, caps.maxEvents)
        for (let offset = 0; offset < eligible.length; offset += size) {
          this.authorize()
          const events = eligible.slice(offset, offset + size), attempt = this.uuid()
          const batch = await this.outbox.begin(lease, attempt, events, this.now())
          batches++; progress(true)
          try {
            const receipts = await this.api.send(first.context.exam_id, batch)
            this.authorize()
            await this.outbox.finish(lease, attempt, events, receipts, this.now())
            processed += receipts.length
            if (receipts.length !== events.length) message = 'Respuesta parcial: se guardaron los recibos válidos; los UUID restantes siguen pendientes.'
            progress(true)
          } catch (error) {
            const failure = syncFailure(error); message = failure.message
            // If the vault closed, SENDING is intentionally recovered as PENDING on next unlock.
            try { await this.outbox.fail(lease, attempt, events, failure, this.now()) } catch { /* retain persisted original attempt */ }
            progress(true)
            if (failure.stop) return
          }
        }
      }
      if (!message) message = total === 0 ? 'No hay eventos pendientes de envío.' : 'Se conservaron los resultados recibidos. Revisa confirmaciones, duplicados y conflictos.'
    } finally {
      if (acquired) { try { await this.outbox.release(lease) } catch { /* runtime locked; recover its lease on next unlock */ } }
      this.busy = false; progress(false)
    }
  }
}
