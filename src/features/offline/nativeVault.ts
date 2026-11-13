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
import { OfflineProtectionError, protectedKey, protectedOperation } from './protection'
import { checkOfflineGrant, checkPreviousVault, checkVaultSession, onlineGrant, vaultStorage, type VaultGrant } from './vaultAccess'

const options: SecureStore.SecureStoreOptions = { keychainService: vaultStorage.keychainService,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: vaultStorage.requireAuthentication }
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
  private closing: Promise<void> = Promise.resolve()
  private expiry: ReturnType<typeof setTimeout> | undefined
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
    if (this.expiry !== undefined) clearTimeout(this.expiry)
    this.expiry = undefined
    const db = this.db; this.db = null
    if (db) this.closing = this.closing.catch(() => {}).then(() => db.closeAsync())
    await this.closing
  }
  async closeAccess(reason: 'expired' | 'revoked' | 'logout' | 'account-change') {
    this.needsOnlineValidation = true
    const closing = this.lock()
    // Keep the previous clock anchor for the same credential on expiry.
    try {
      if (reason !== 'expired') await this.grantOperation(() => SecureStore.deleteItemAsync(grantKey, options))
    } finally { await closing }
    // Never delete database, protected keys or pending events.
  }
  async open(online: OfflineBinding | undefined, onExpire: () => void): Promise<VaultRuntime> {
    if (this.opening) throw new Error('La apertura local ya está en curso.')
    this.opening = true
    let db: SqlPort | null = null
    try {
      const closing = this.lock()
      const generation = this.generation
      await closing
      let deadline = Infinity
      const check = () => {
        if (this.generation !== generation) throw new OfflineProtectionError('INTERRUPTED')
        if (performance.now() >= deadline) throw new OfflineProtectionError('SESSION_REQUIRED')
      }
      check()
      if (this.needsOnlineValidation && !online) throw new OfflineProtectionError('SESSION_REQUIRED')
      const apiBase = resolveApiBase(process.env.EXPO_PUBLIC_EIDA_API_BASE_URL)
      const installationId = await nativeSessionStorage.installationId()
      const credential = await nativeSessionStorage.load()
      const stored = await protectedOperation(async () => {
        const raw = await SecureStore.getItemAsync(grantKey, options)
        return raw ? JSON.parse(raw) as VaultGrant : null
      })
      const b = online ?? stored?.binding
      if (!b) throw new OfflineProtectionError('SESSION_REQUIRED')
      const binding: OfflineBinding = { apiBase: resolveApiBase(b.apiBase), userId: id(b.userId), deviceId: id(b.deviceId), installationId: uuid(b.installationId) }
      if (binding.apiBase !== apiBase || binding.installationId !== installationId || !sameBinding(binding, b)) {
        throw new OfflineProtectionError('SESSION_REQUIRED')
      }
      checkVaultSession(credential, binding)
      const clockStart = performance.now(), wallStart = Date.now()
      const sample = await nativeClock.sample()
      const grant = online ? onlineGrant(binding, credential, sample, wallStart, stored) : stored
      deadline = clockStart + checkOfflineGrant(grant, credential, sample)
      check()
      const module = await import('react-native-quick-crypto'), crypto = module.default
      const digest: Digest = (data) => crypto.createHash('sha256').update(typeof data === 'string' ? module.Buffer.from(data, 'utf8') : module.Buffer.from(data)).digest('hex')
      const scope = digest(JSON.stringify([binding.apiBase, binding.userId, binding.installationId, binding.deviceId]))
      const marker = 'scope-' + scope
      // Legacy markers were persisted before opening either database. Reading them
      // never asks SecureStore to decrypt the old authentication-bound key.
      await checkPreviousVault((service) => SecureStore.getItemAsync(marker, { ...options, keychainService: service }))
      check()
      const key = await protectedKey({
        marker: () => SecureStore.getItemAsync(marker, options),
        read: () => SecureStore.getItemAsync('key-' + scope, options),
        write: (key) => SecureStore.setItemAsync('key-' + scope, key, options),
        mark: () => SecureStore.setItemAsync(marker, '1', options),
      }, !!online, () => crypto.randomBytes(32).toString('hex'), check)
      try {
        const sqlite = await import('expo-sqlite')
        const raw = await sqlite.openDatabaseAsync(`${vaultStorage.databasePrefix}${scope}.db`, { useNewConnection: true })
        db = new SerializedSql(raw as unknown as RawSqlPort, check)
        check()
        await initializeCipher(db, key)
      } catch (e) {
        if (e instanceof ProtectedStorageError || e instanceof OfflineProtectionError) throw e
        // Do not expose native SQL statements (including PRAGMA key) in the UI or logs.
        throw new Error('No se pudo abrir la información cifrada. Los datos existentes se conservan.')
      }
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
      if (online) await this.grantOperation(async () => {
        check()
        await protectedOperation(() => SecureStore.setItemAsync(grantKey, JSON.stringify(grant), options))
      })
      check()
      const expire = () => {
        if (this.generation !== generation) return
        const remaining = deadline - performance.now()
        if (remaining > 0) this.expiry = setTimeout(expire, Math.min(remaining, 2147483647))
        else onExpire()
      }
      this.expiry = setTimeout(expire, Math.min(Math.max(0, deadline - performance.now()), 2147483647))
      this.db = db; this.runtime = runtime
      this.needsOnlineValidation = false
      return runtime
    } catch (error) {
      if (db) { try { await db.closeAsync() } catch { /* preserve encrypted files */ } }
      throw error
    } finally { this.opening = false }
  }
}
