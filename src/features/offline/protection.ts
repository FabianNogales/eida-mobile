export type ProtectionCode = 'INTERRUPTED' | 'KEY_UNAVAILABLE' | 'SECURE_STORE_ERROR' | 'NATIVE_CONFIGURATION' |
  'SESSION_REQUIRED' | 'PREVIOUS_VAULT'

const messages: Record<ProtectionCode, string> = {
  INTERRUPTED: 'El acceso protegido se interrumpió o se bloqueó. Vuelve a abrir la aplicación y reintenta con la cuenta autorizada.',
  KEY_UNAVAILABLE: 'La clave protegida no está disponible. La información y los pendientes se conservan para revisión.',
  SECURE_STORE_ERROR: 'No se pudo acceder al almacenamiento protegido de Android. Reintenta; si persiste, solicita revisar SecureStore y Android Keystore. Los datos existentes se conservan.',
  NATIVE_CONFIGURATION: 'No está disponible la integración nativa de almacenamiento protegido. Revisa la APK y sus módulos/permisos antes de continuar; no se habilitará almacenamiento sin protección.',
  SESSION_REQUIRED: 'Valida tu sesión de EIDA con conexión para abrir la información local.',
  PREVIOUS_VAULT: 'Hay información de una versión anterior. Se conservó intacta y requiere recuperación antes de continuar.',
}
export class OfflineProtectionError extends Error {
  constructor(readonly code: ProtectionCode) { super(messages[code]); this.name = 'OfflineProtectionError' }
}

export function protectionFailure(error: unknown): OfflineProtectionError {
  if (error instanceof OfflineProtectionError) return error
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : ''
  // Do not expose native SecureStore error messages, keychain services or keys.
  if (code === 'ERR_UNAVAILABLE' || code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_MISSING_PERMISSION') return new OfflineProtectionError('NATIVE_CONFIGURATION')
  if (code === 'ERR_KEY_PERMANENTLY_INVALIDATED') return new OfflineProtectionError('KEY_UNAVAILABLE')
  return new OfflineProtectionError('SECURE_STORE_ERROR')
}
export async function protectedOperation<T>(action: () => Promise<T>): Promise<T> {
  try { return await action() } catch (error) { throw protectionFailure(error) }
}

export interface ProtectedKeyPort {
  marker(): Promise<string | null>
  read(): Promise<string | null>
  write(key: string): Promise<void>
  mark(): Promise<void>
}
export async function protectedKey(port: ProtectedKeyPort, online: boolean, generate: () => string, check: () => void) {
  check()
  const marker = await protectedOperation(() => port.marker()); check()
  let key = await protectedOperation(() => port.read()); check()
  if (!key) {
    if (marker || !online) throw new OfflineProtectionError('KEY_UNAVAILABLE')
    const created = generate()
    if (!/^[a-f0-9]{64}$/.test(created)) throw new OfflineProtectionError('KEY_UNAVAILABLE')
    await protectedOperation(() => port.write(created)); check()
    key = created
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new OfflineProtectionError('KEY_UNAVAILABLE')
  // A prior attempt may have saved the protected key but failed to save its
  // marker. Repair that marker BEFORE any database can be opened.
  if (!marker) { await protectedOperation(() => port.mark()); check() }
  return key
}

export interface CipherProbe {
  version(): Promise<unknown>
  close(): Promise<void>
}
export interface ProtectionReport {
  cipher: 'available' | 'missing' | 'error'
  cipherVersion: string | null
}
export async function inspectProtection(openProbe: () => Promise<CipherProbe>): Promise<ProtectionReport> {
  const report: ProtectionReport = { cipher: 'error', cipherVersion: null }
  let probe: CipherProbe | undefined
  try {
    probe = await openProbe()
    const row: unknown = await probe.version()
    if (typeof row === 'object' && row !== null) for (const value of Object.values(row)) {
      if (typeof value === 'string') {
        const version = value.match(/^\d+\.\d+(?:\.\d+){0,2}/)?.[0]
        if (version) { report.cipherVersion = version; break }
      }
    }
    report.cipher = report.cipherVersion ? 'available' : 'missing'
  } catch { report.cipher = 'error'; report.cipherVersion = null }
  finally {
    if (probe) try { await probe.close() } catch { report.cipher = 'error'; report.cipherVersion = null }
  }
  return report
}

