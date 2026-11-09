// Synthetic data and transports for tests only. Never imported by app code.
import { HttpClient, type ResponsePort, type Transport } from '../../src/services/http/client'
import { AuthApi } from '../../src/features/auth/api'
import { SessionController } from '../../src/features/auth/session'
import { createSessionStorage, type SecureDriver } from '../../src/features/auth/storage'
import type { CurrentUser, StoredSession } from '../../src/features/auth/contracts'

export const BASE = 'https://eida.example.test/backend/api/v1'
export const NOW = Date.parse('2030-01-01T00:00:00.000Z')
export const INSTALLATION = '7c4dfeaf-e588-4db1-9524-496a7905582d'
export const PASSWORD = 'Synthetic!123'
export const user: CurrentUser = { id: 7, display_name: 'Docente sintético', email: 'teacher@example.test',
  status: 'ACTIVE', must_change_password: false, roles: ['DOCENTE', 'ADMINISTRADOR'] }
export const device = { id: 11, installation_id: INSTALLATION, device_name: 'EIDA Control Android', platform: 'android',
  app_version: '0.1.0', status: 'ACTIVE', last_login_at: '2030-01-01T00:00:00.000000Z', revoked_at: null }
export function loginResponse(actor = user) {
  return { data: { access_token: '1|SYNTHETIC_TOKEN_' + actor.id, token_type: 'Bearer', expires_at: '2030-01-01T01:00:00.000000Z',
    server_time: '2030-01-01T00:00:00.000000Z', abilities: ['mobile:session', 'mobile:devices', 'control:read'],
    device: { ...device, id: actor.id === 7 ? 11 : 12 }, user: actor } }
}
export function stored(overrides: Partial<StoredSession> = {}): StoredSession {
  return { version: 1, apiBase: BASE, token: '1|SYNTHETIC_TOKEN_7', expiresAt: '2030-01-01T01:00:00.000000Z',
    serverOffsetMs: 0, userId: 7, deviceId: 11, installationId: INSTALLATION, logoutPending: false, ...overrides }
}
export function response(url: string, data: unknown, status = 200): ResponsePort {
  return { status, url, redirected: false, text: async () => status === 204 ? '' : JSON.stringify(data) }
}
export function memoryDriver() {
  const values = new Map<string, string>()
  const writes: { key: string; value: string }[] = []
  const driver: SecureDriver = {
    async getItem(key) { return values.get(key) ?? null },
    async setItem(key, value) { values.set(key, value); writes.push({ key, value }) },
    async deleteItem(key) { values.delete(key) },
  }
  return { driver, values, writes }
}
export function harness(handler?: (path: string, init: RequestInit, url: string) => Promise<ResponsePort>) {
  const memory = memoryDriver()
  const calls: { path: string; init: RequestInit }[] = []
  const clock = { now: NOW }
  const transport: Transport = async (url, init) => {
    const path = new URL(url).pathname.slice(new URL(BASE).pathname.length + 1)
    calls.push({ path, init })
    if (handler) return handler(path, init, url)
    if (path === 'auth/mobile/login') return response(url, loginResponse())
    if (path === 'me') return response(url, { success: true, data: user })
    if (path === 'auth/logout') return response(url, { message: 'Session revoked successfully' })
    return response(url, { data: [] })
  }
  const storage = createSessionStorage(memory.driver, async () => INSTALLATION)
  const http = new HttpClient(BASE, transport)
  const session = new SessionController(http, new AuthApi(http), storage, () => clock.now)
  return { ...memory, calls, clock, storage, http, session }
}
export async function signIn(h: ReturnType<typeof harness>) {
  await h.session.restore()
  await h.session.login(user.email, PASSWORD)
}
