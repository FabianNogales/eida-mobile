import { ApiError } from '../../services/http/errors'
import { boolean, integer, object, text } from '../../services/http/schema'
import { instant } from '../../utils/dates'
import type { SessionStorage, StoredSession } from './contracts'

export interface SecureDriver {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  deleteItem(key: string): Promise<void>
}
export const SESSION_KEY = 'eida.session.v1'
export const INSTALLATION_KEY = 'eida.installation.v1'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const storageError = () => new ApiError('storage', 'No se pudo acceder al almacenamiento seguro. Comprueba SecureStore y la build instalada; no se guardará el token en texto plano.')

function parseStored(value: unknown): StoredSession {
  const v = object(value)
  const expiresAt = text(v.expiresAt), token = text(v.token), installationId = text(v.installationId)
  if (v.version !== 1 || !token || token.length > 2048 || /[\r\n]/.test(token) || !uuid.test(installationId) ||
      !Number.isFinite(instant(expiresAt)) || typeof v.serverOffsetMs !== 'number' || !Number.isFinite(v.serverOffsetMs)) throw storageError()
  return { version: 1, apiBase: text(v.apiBase), token, expiresAt, serverOffsetMs: v.serverOffsetMs,
    userId: integer(v.userId), deviceId: integer(v.deviceId), installationId, logoutPending: boolean(v.logoutPending) }
}

export function createSessionStorage(driver: SecureDriver, randomUUID: () => Promise<string>): SessionStorage {
  let pendingId: Promise<string> | null = null
  return {
    async load() {
      try { const raw = await driver.getItem(SESSION_KEY); return raw === null ? null : parseStored(JSON.parse(raw)) }
      catch { throw storageError() }
    },
    async save(session) {
      try { await driver.setItem(SESSION_KEY, JSON.stringify(parseStored(session))) } catch { throw storageError() }
    },
    async clear() { try { await driver.deleteItem(SESSION_KEY) } catch { throw storageError() } },
    async installationId() {
      if (!pendingId) pendingId = (async () => {
        try {
          const existing = await driver.getItem(INSTALLATION_KEY)
          if (existing !== null) { if (!uuid.test(existing)) throw storageError(); return existing }
          const id = await randomUUID()
          if (!uuid.test(id)) throw storageError()
          await driver.setItem(INSTALLATION_KEY, id)
          return id
        } catch { throw storageError() }
      })().finally(() => { pendingId = null })
      return pendingId
    },
  }
}
