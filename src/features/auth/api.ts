import { HttpClient } from '../../services/http/client'
import { array, boolean, integer, nullableText, object, text } from '../../services/http/schema'
import { protocolError } from '../../services/http/errors'
import { instant } from '../../utils/dates'
import type { CurrentUser, MobileDevice, MobileLogin } from './contracts'
import { loginFailure } from './loginFeedback'

export function parseUser(value: unknown): CurrentUser {
  const v = object(value)
  return { id: integer(v.id), display_name: text(v.display_name), email: text(v.email), status: text(v.status),
    must_change_password: boolean(v.must_change_password), roles: array(v.roles, text) }
}
export function parseDevice(value: unknown): MobileDevice {
  const v = object(value)
  if (v.platform !== 'android' || !['ACTIVE', 'REVOKED'].includes(text(v.status))) throw protocolError()
  return { id: integer(v.id), installation_id: text(v.installation_id), device_name: text(v.device_name),
    platform: 'android', app_version: nullableText(v.app_version), status: v.status as MobileDevice['status'],
    last_login_at: text(v.last_login_at), revoked_at: nullableText(v.revoked_at) }
}
export function parseLogin(value: unknown): MobileLogin {
  const v = object(object(value).data)
  if (v.token_type !== 'Bearer') throw protocolError()
  const token = text(v.access_token)
  if (!token || token.length > 2048 || /[\r\n]/.test(token)) throw protocolError()
  const expires = text(v.expires_at), server = text(v.server_time)
  if (!Number.isFinite(instant(server)) || !Number.isFinite(instant(expires)) || instant(expires) <= instant(server)) throw protocolError()
  return { access_token: token, token_type: 'Bearer', expires_at: expires, server_time: server,
    abilities: array(v.abilities, text), device: parseDevice(v.device), user: parseUser(v.user) }
}
export class AuthApi {
  constructor(private readonly http: HttpClient, private readonly appVersion = '0.1.0') {}
  async login(identifier: string, password: string, installationId: string): Promise<MobileLogin> {
    try {
      return parseLogin(await this.http.request('auth/mobile/login', { method: 'POST', body: {
        identifier, password, installation_id: installationId, device_name: 'EIDA Control Android', app_version: this.appVersion,
      } }))
    } catch (error) { throw loginFailure(error) }
  }
  async me(token: string): Promise<CurrentUser> {
    const response = object(await this.http.request('me', { token }))
    if (response.success !== true) throw protocolError()
    return parseUser(response.data)
  }
  async logout(token: string): Promise<void> {
    const response = object(await this.http.request('auth/logout', { method: 'POST', token }))
    if (response.message !== 'Session revoked successfully') throw protocolError()
  }
}
