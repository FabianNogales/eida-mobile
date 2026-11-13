export type ProtectionCode = 'BIOMETRY_UNAVAILABLE' | 'BIOMETRY_NOT_ENROLLED' | 'BIOMETRY_UNSUPPORTED' |
  'AUTH_CANCELLED' | 'AUTH_LOCKED' | 'INTERRUPTED' | 'KEY_UNAVAILABLE' | 'SECURE_STORE_ERROR' | 'NATIVE_CONFIGURATION'

const messages: Record<ProtectionCode, string> = {
  BIOMETRY_UNAVAILABLE: 'Android no confirma biometría fuerte disponible. Revisa que el lector funcione y haya una huella registrada con bloqueo seguro. El PIN por sí solo no permite abrir estas listas. No se guardarán datos sin protección.',
  BIOMETRY_NOT_ENROLLED: 'Android informa que no hay biometría registrada. Configura una huella compatible y un bloqueo de pantalla seguro antes de reintentar.',
  BIOMETRY_UNSUPPORTED: 'Android informa que no dispone del hardware biométrico requerido. Utiliza un dispositivo compatible con biometría fuerte operativa.',
  AUTH_CANCELLED: 'La autenticación biométrica fue cancelada. Puedes intentarlo nuevamente; los datos protegidos se conservan.',
  AUTH_LOCKED: 'Android bloqueó la autenticación biométrica. Sigue las indicaciones del sistema, desbloquea el teléfono y vuelve a intentar.',
  INTERRUPTED: 'El acceso protegido se interrumpió o se bloqueó. Vuelve a abrir la aplicación y reintenta con la cuenta autorizada.',
  KEY_UNAVAILABLE: 'La clave protegida no está disponible. Puede haberse invalidado o perdido; no se puede determinar la causa con esta respuesta. Se conservan la base y los pendientes. No borres datos ni reinstales: solicita revisión.',
  SECURE_STORE_ERROR: 'No se pudo acceder al almacenamiento protegido de Android. Reintenta; si persiste, solicita revisar SecureStore y Android Keystore. Los datos existentes se conservan.',
  NATIVE_CONFIGURATION: 'No está disponible la integración nativa de almacenamiento protegido. Revisa la APK y sus módulos/permisos antes de continuar; no se habilitará almacenamiento sin protección.',
}
export class OfflineProtectionError extends Error {
  constructor(readonly code: ProtectionCode) { super(messages[code]); this.name = 'OfflineProtectionError' }
}

export function protectionFailure(error: unknown): OfflineProtectionError {
  if (error instanceof OfflineProtectionError) return error
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : ''
  // Match only the stable English prefixes emitted by the installed Android
  // SecureStore implementation, never display its raw message/keychain/key.
  if (code === 'ERR_AUTHENTICATION') {
    if (message.includes('User canceled the authentication')) return new OfflineProtectionError('AUTH_CANCELLED')
    if (message.includes('Lockout permanent') || message.includes('Lockout')) return new OfflineProtectionError('AUTH_LOCKED')
    if (message.includes('No biometrics enrolled') || message.includes('No biometrics are currently enrolled')) return new OfflineProtectionError('BIOMETRY_NOT_ENROLLED')
    if (message.includes('Hardware not present') || message.includes('Biometric authentication is unsupported')) return new OfflineProtectionError('BIOMETRY_UNSUPPORTED')
    if (message.includes('Hardware unavailable') || message.includes('No hardware available')) return new OfflineProtectionError('BIOMETRY_UNAVAILABLE')
    return new OfflineProtectionError('INTERRUPTED')
  }
  if (code === 'ERR_UNAVAILABLE' || code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_MISSING_PERMISSION') return new OfflineProtectionError('NATIVE_CONFIGURATION')
  if (code === 'ERR_KEY_PERMANENTLY_INVALIDATED') return new OfflineProtectionError('KEY_UNAVAILABLE')
  return new OfflineProtectionError('SECURE_STORE_ERROR')
}
export async function protectedOperation<T>(action: () => Promise<T>): Promise<T> {
  try { return await action() } catch (error) { throw protectionFailure(error) }
}
export function requireStrongBiometry(canUse: () => boolean) {
  let available: boolean
  try { available = canUse() } catch { throw new OfflineProtectionError('NATIVE_CONFIGURATION') }
  // SecureStore exposes a boolean, not Android's hardware/enrollment reason.
  if (!available) throw new OfflineProtectionError('BIOMETRY_UNAVAILABLE')
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
  biometric: 'available' | 'unavailable' | 'error'
  biometricMessage: string
  cipher: 'available' | 'missing' | 'error'
  cipherVersion: string | null
}
export async function inspectProtection(canUse: () => boolean, openProbe: () => Promise<CipherProbe>): Promise<ProtectionReport> {
  const report: ProtectionReport = { biometric: 'error', biometricMessage: '', cipher: 'error', cipherVersion: null }
  try {
    requireStrongBiometry(canUse)
    report.biometric = 'available'
    report.biometricMessage = 'Android confirma biometría fuerte disponible. El desbloqueo protegido todavía debe completarse.'
  } catch (error) {
    report.biometric = error instanceof OfflineProtectionError && error.code === 'BIOMETRY_UNAVAILABLE' ? 'unavailable' : 'error'
    report.biometricMessage = protectionFailure(error).message
  }
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

