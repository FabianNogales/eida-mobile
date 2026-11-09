import { HttpClient, type RequestOptions } from '../../services/http/client'
import { ApiError, errorMessage, protocolError } from '../../services/http/errors'
import { instant } from '../../utils/dates'
import { AuthApi } from './api'
import type { CurrentUser, SessionSnapshot, SessionStatus, SessionStorage, StoredSession } from './contracts'
import type { OfflineBinding } from '../offline/contracts'

export type SecurityBoundary = 'expired' | 'revoked' | 'logout' | 'account-change'

export class SessionController {
  private record: StoredSession | null = null
  private actor: CurrentUser | null = null
  private busy = false
  private loaded = false
  private epoch = 0
  private readonly listeners = new Set<() => void>()
  private readonly boundaryListeners = new Set<(reason: SecurityBoundary) => Promise<void>>()
  private state: SessionSnapshot = { status: 'initializing', user: null, message: null, busy: false,
    hasCredential: false, logoutPending: false, expiresAt: null, deviceId: null, validatedAt: null }
  constructor(private readonly http: HttpClient, private readonly api: AuthApi,
    private readonly storage: SessionStorage, private readonly now: () => number = Date.now) {}

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  onSecurityBoundary(listener: (reason: SecurityBoundary) => Promise<void>) {
    this.boundaryListeners.add(listener)
    return () => { this.boundaryListeners.delete(listener) }
  }
  private async boundary(reason: SecurityBoundary) { for (const listener of this.boundaryListeners) await listener(reason) }
  offlineBinding(): OfflineBinding | null {
    if (this.state.status !== 'authenticated' || !this.record || this.record.logoutPending || this.remainingMs() <= 0) return null
    return { apiBase: this.record.apiBase, userId: String(this.record.userId), deviceId: String(this.record.deviceId), installationId: this.record.installationId }
  }

  private publish(status: SessionStatus, message: string | null = null) {
    if (status !== 'authenticated') this.actor = null
    this.state = { status, message, user: this.actor, busy: this.busy,
      hasCredential: this.record !== null, logoutPending: this.record?.logoutPending ?? false,
      expiresAt: this.record?.expiresAt ?? null, deviceId: this.record?.deviceId ?? null,
      validatedAt: status === 'authenticated' ? this.state.validatedAt ?? new Date(this.now()).toISOString() : null }
    for (const listener of this.listeners) listener()
  }
  private cancelPrivate() { this.epoch++; this.http.abortAll() }
  remainingMs() { return this.record ? instant(this.record.expiresAt) - (this.now() + this.record.serverOffsetMs) : 0 }

  private async invalidate(message: string, reason: SecurityBoundary = 'revoked') {
    const wasBusy = this.busy
    this.busy = true
    this.cancelPrivate()
    this.publish('expired', message)
    try {
      await this.boundary(reason)
      await this.storage.clear()
      this.record = null
      this.loaded = true
      this.publish('expired', message)
    } catch (error) { this.publish('recoverable-error', errorMessage(error)) }
    finally { this.busy = wasBusy; this.publish(this.state.status, this.state.message) }
  }
  private async validate() {
    if (!this.record) return
    const user = await this.api.me(this.record.token)
    if (user.id !== this.record.userId) throw protocolError()
    if (user.status !== 'ACTIVE') throw new ApiError('http', 'La cuenta se encuentra inactiva.', 401, 'ACCOUNT_INACTIVE')
    if (user.must_change_password) throw new ApiError('http', 'Debes cambiar tu contraseña en EIDA Web.', 403, 'PASSWORD_CHANGE_REQUIRED')
    this.actor = user
    this.publish('authenticated')
  }
  private async authFailure(error: unknown) {
    if (error instanceof ApiError && (error.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED')) {
      await this.invalidate(error.message)
    } else {
      this.cancelPrivate()
      this.publish(error instanceof ApiError && ['network', 'timeout'].includes(error.kind) ? 'offline' : 'recoverable-error', errorMessage(error))
    }
  }

  async restore() {
    if (this.busy) return
    this.busy = true; this.loaded = false; this.cancelPrivate(); this.publish('initializing')
    try {
      this.record = await this.storage.load()
      this.loaded = true
      if (!this.record) this.publish('unauthenticated')
      else if (this.record.apiBase !== this.http.baseUrl) {
        this.publish('recoverable-error', 'La credencial pertenece a otra configuración de backend. No se enviará a esta URL. Puedes olvidarla localmente o restaurar la configuración anterior.')
      } else if (this.record.logoutPending) this.publish('unauthenticated', 'Sesión local cerrada. La revocación remota sigue pendiente.')
      else if (this.remainingMs() <= 0) await this.invalidate('La credencial alcanzó su vencimiento. Inicia sesión nuevamente.', 'expired')
      else await this.validate()
    } catch (error) { await this.authFailure(error) }
    finally { this.busy = false; this.publish(this.state.status, this.state.message) }
  }

  async login(identifier: string, password: string) {
    if (this.busy) return
    if (!this.loaded) { this.publish('recoverable-error', 'Primero debe comprobarse el almacenamiento de la sesión anterior. Reintenta la validación.'); return }
    if (this.record) { this.publish(this.state.status, 'Primero resuelve o elimina la credencial local anterior.'); return }
    const id = identifier.trim()
    if (!id || id.length > 100 || !password.trim() || password.length < 8 || password.length > 20) {
      this.publish('unauthenticated', 'Ingresa un correo o código y una contraseña de 8 a 20 caracteres.'); return
    }
    this.busy = true; this.cancelPrivate(); this.publish('authenticating')
    try {
      await this.boundary('account-change')
      const installationId = await this.storage.installationId()
      const result = await this.api.login(id, password, installationId)
      if (result.device.installation_id !== installationId || result.device.status !== 'ACTIVE') throw protocolError()
      const saved: StoredSession = { version: 1, apiBase: this.http.baseUrl, token: result.access_token,
        expiresAt: result.expires_at, serverOffsetMs: instant(result.server_time) - this.now(),
        userId: result.user.id, deviceId: result.device.id, installationId, logoutPending: false }
      await this.storage.save(saved)
      this.record = saved
      await this.validate()
    } catch (error) {
      if (!this.record && error instanceof ApiError && error.kind === 'http') this.publish('unauthenticated', error.message)
      else await this.authFailure(error)
    } finally { this.busy = false; this.publish(this.state.status, this.state.message) }
  }

  async request(path: string, options: Omit<RequestOptions, 'token'> = {}): Promise<unknown> {
    if (this.state.status !== 'authenticated' || !this.record || this.record.logoutPending || this.record.apiBase !== this.http.baseUrl) {
      throw new ApiError('http', 'Debes validar tu sesión antes de consultar información privada.', 401)
    }
    if (this.remainingMs() <= 0) {
      await this.invalidate('La sesión alcanzó su vencimiento.', 'expired')
      throw new ApiError('http', 'La sesión alcanzó su vencimiento.', 401)
    }
    const epoch = this.epoch
    try {
      const data = await this.http.request(path, { ...options, token: this.record.token })
      if (epoch !== this.epoch) throw new ApiError('cancelled', 'La sesión cambió. Se descartó la respuesta anterior.')
      return data
    } catch (error) {
      if (epoch === this.epoch && error instanceof ApiError) {
        if (error.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED') await this.invalidate(error.message)
        else if (['network', 'timeout'].includes(error.kind) || (error.status ?? 0) >= 500) {
          this.cancelPrivate()
          this.publish(['network', 'timeout'].includes(error.kind) ? 'offline' : 'recoverable-error', error.message)
        }
      }
      throw error
    }
  }

  async checkExpiry() {
    if (!this.busy && this.record && !this.record.logoutPending && this.remainingMs() <= 0) await this.invalidate('La sesión alcanzó su vencimiento.', 'expired')
  }

  async logout() {
    if (this.busy || !this.record) return
    this.busy = true; this.cancelPrivate(); this.publish('initializing')
    try {
      await this.boundary('logout')
      const pending = { ...this.record, logoutPending: true }
      await this.storage.save(pending)
      this.record = pending
      this.publish('unauthenticated', 'Sesión local cerrada. Solicitando revocación remota…')
      if (pending.apiBase !== this.http.baseUrl) {
        this.publish('unauthenticated', 'La credencial pertenece a otro backend. Revócala desde ese servidor o EIDA Web; no se enviará a la URL actual.')
        return
      }
      try { await this.api.logout(pending.token) }
      catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error
        await this.storage.clear(); this.record = null
        this.publish('unauthenticated', 'El servidor confirmó que la credencial ya no es válida. Se eliminó localmente.')
        return
      }
      await this.storage.clear(); this.record = null
      this.publish('unauthenticated', 'Cierre de sesión confirmado por el servidor.')
    } catch (error) {
      this.publish(this.record?.logoutPending ? 'unauthenticated' : 'recoverable-error',
        this.record?.logoutPending ? 'Sesión local cerrada; no se confirmó la revocación remota. ' + errorMessage(error) :
          'No se pudo guardar el cierre local. Reintenta antes de reiniciar la app. ' + errorMessage(error))
    } finally { this.busy = false; this.publish(this.state.status, this.state.message) }
  }

  async forgetLocal() {
    if (this.busy) return
    this.busy = true; this.cancelPrivate(); this.publish('initializing')
    try {
      await this.boundary('logout')
      await this.storage.clear(); this.record = null; this.loaded = true
      this.publish('unauthenticated', 'Credencial eliminada localmente. No se confirmó su revocación en el servidor.')
    } catch (error) { this.publish('recoverable-error', errorMessage(error)) }
    finally { this.busy = false; this.publish(this.state.status, this.state.message) }
  }

  async currentDeviceRevoked(deviceId: number) {
    if (this.record?.deviceId === deviceId) await this.invalidate('Se revocó esta instalación. Inicia sesión nuevamente.')
  }
}
