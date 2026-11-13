import * as SecureStore from 'expo-secure-store'
import { initializeCipher, OfflineRepository, ProtectedStorageError, type SqlPort } from './repository'
import { sameBinding, type Digest, type Manifest, type OfflineBinding } from './contracts'
import { resolveApiBase } from '../../config/api'
import { nativeSessionStorage } from '../auth/nativeStorage'
import type { Rs256Provider } from '../qr/contracts'
import { loadNativeCrypto } from '../qr/nativeCrypto'
import { nativeClock } from './clock'
import { id, uuid } from './manifest'
import { SerializedSql, type RawSqlPort } from './serializedSql'
import { OutboxRepository } from './sync/outbox'
import { IncidentRepository } from '../incidents/repository'
import { OfflineProtectionError, protectedKey, protectedOperation, requireStrongBiometry } from './protection'
import { offlineProtection } from '../../config/offlineLab'

const options: SecureStore.SecureStoreOptions = { keychainService: offlineProtection.keychainService,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const protectedOptions: SecureStore.SecureStoreOptions = { ...options, requireAuthentication: offlineProtection.requireAuthentication,
  authenticationPrompt: 'Desbloquear lista offline de EIDA Control' }
const grantKey = 'active-offline-scope'
export interface VaultRuntime {
  repo: OfflineRepository; digest: Digest; uuid(): string; provider: Rs256Provider
  outbox: OutboxRepository
  incidents: IncidentRepository
  validateKeys(manifest: Manifest): Promise<void>; check(): void
}

export class NativeOfflineVault {
  private db: SqlPort | null = null
  private generation = 0
  private opening = false
  private needsOnlineValidation = false
  private grantQueue: Promise<void> = Promise.resolve()
  private grantOperation(action: () => Promise<void>): Promise<void> {
    const task = this.grantQueue.catch(() => {}).then(action)
    this.grantQueue = task
    return task
  }
  runtime: VaultRuntime | null = null
  async lock() {
    this.generation++
    this.runtime = null
    const db = this.db; this.db = null
    if (db) await db.closeAsync()
  }
  async closeAccess(reason: 'expired' | 'revoked' | 'logout' | 'account-change') {
    if (reason !== 'expired') this.needsOnlineValidation = true
    const closing = this.lock()
    // Local token expiry does not erase the bounded package grant. Other boundaries do.
    try {
      if (reason !== 'expired') await this.grantOperation(() => SecureStore.deleteItemAsync(grantKey, options))
    } finally { await closing }
    // Never delete database, protected keys or pending events.
  }
  async unlock(online?: OfflineBinding): Promise<VaultRuntime> {
    if (this.opening) throw new Error('El desbloqueo local ya está en curso.')
    this.opening = true
    let db: SqlPort | null = null
    try {
      await this.lock()
      const generation = this.generation
      const check = () => { if (this.generation !== generation) throw new OfflineProtectionError('INTERRUPTED') }
      if (this.needsOnlineValidation && !online) throw new Error('El acceso local se cerró. Primero valida de nuevo la cuenta con internet.')
      if (offlineProtection.requireAuthentication) requireStrongBiometry(() => SecureStore.canUseBiometricAuthentication())
      const apiBase = resolveApiBase(process.env.EXPO_PUBLIC_EIDA_API_BASE_URL)
      const installationId = await nativeSessionStorage.installationId()
      const credential = await nativeSessionStorage.load()
      if (credential?.logoutPending) throw new Error('El cierre de sesión está pendiente. Vuelve a iniciar sesión antes de abrir paquetes.')
      const raw = online ? JSON.stringify(online) : await protectedOperation(() => SecureStore.getItemAsync(grantKey, options))
      if (!raw) throw new Error('Primero valida tu cuenta con internet y prepara una lista en este dispositivo.')
      const b = JSON.parse(raw) as OfflineBinding
      const binding: OfflineBinding = { apiBase: resolveApiBase(b.apiBase), userId: id(b.userId), deviceId: id(b.deviceId), installationId: uuid(b.installationId) }
      if (binding.apiBase !== apiBase || binding.installationId !== installationId ||
          (credential && (String(credential.userId) !== binding.userId || String(credential.deviceId) !== binding.deviceId || credential.apiBase !== binding.apiBase)) ||
          (online && !sameBinding(binding, online))) throw new Error('El acceso local corresponde a otra cuenta, servidor o instalación.')
      const module = await import('react-native-quick-crypto'), crypto = module.default
      const digest: Digest = (data) => crypto.createHash('sha256').update(typeof data === 'string' ? module.Buffer.from(data, 'utf8') : module.Buffer.from(data)).digest('hex')
      const scope = digest(JSON.stringify([binding.apiBase, binding.userId, binding.installationId, binding.deviceId]))
      const key = await protectedKey({
        marker: () => SecureStore.getItemAsync('scope-' + scope, options),
        read: () => SecureStore.getItemAsync('key-' + scope, protectedOptions),
        write: (key) => SecureStore.setItemAsync('key-' + scope, key, protectedOptions),
        mark: () => SecureStore.setItemAsync('scope-' + scope, '1', options),
      }, !!online, () => crypto.randomBytes(32).toString('hex'), check)
      try {
        const sqlite = await import('expo-sqlite')
        const raw = await sqlite.openDatabaseAsync(`${offlineProtection.databasePrefix}${scope}.db`, { useNewConnection: true })
        db = new SerializedSql(raw as unknown as RawSqlPort, check)
        check()
        await initializeCipher(db, key)
      } catch (e) {
        if (e instanceof ProtectedStorageError) throw e
        // Do not expose native SQL statements (including PRAGMA key) in the UI or logs.
        throw new Error('No se pudo abrir la base cifrada. El fallo puede ser de apertura, clave o integración SQLite/SQLCipher; no indica que cancelaste la biometría. Conserva los datos y solicita revisión de la APK y la clave protegida.')
      }
      // Also fail closed if the native monotonic clock is absent.
      await nativeClock.sample()
      const provider = await loadNativeCrypto()
      const outbox = new OutboxRepository(db, binding, digest, check)
      await outbox.reconcile()
      await outbox.recoverInterrupted(new Date().toISOString())
      const repo = new OfflineRepository(db, binding, digest, check)
      const incidents = new IncidentRepository(db, repo, digest, check)
      await incidents.recoverInterrupted()
      const runtime: VaultRuntime = { repo, outbox, incidents, digest,
        uuid: () => crypto.randomUUID(), provider, check,
        async validateKeys(manifest) {
          if (!manifest.qr.available) return
          for (const key of manifest.qr.keys) {
            const details = crypto.createPublicKey(key.pem)
            if (details.asymmetricKeyType !== 'rsa' || (details.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
              throw new Error('El servidor anunció una clave QR RSA no admitida.')
            }
          }
        },
      }
      check()
      await this.grantOperation(async () => { check(); await protectedOperation(() => SecureStore.setItemAsync(grantKey, JSON.stringify(binding), options)) })
      check()
      this.db = db; this.runtime = runtime
      this.needsOnlineValidation = false
      return runtime
    } catch (error) {
      if (db) { try { await db.closeAsync() } catch { /* preserve encrypted files */ } }
      throw error
    } finally { this.opening = false }
  }
}
