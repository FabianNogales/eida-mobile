import type { StoredSession } from '../auth/contracts'
import { instant } from '../../utils/dates'
import { anchoredNow } from './clock'
import { sameBinding, type ClockSample, type OfflineBinding, type TimeAnchor } from './contracts'
import { OfflineProtectionError, protectedOperation } from './protection'

export const vaultStorage = {
  keychainService: 'bo.eida.control.offline.v2',
  databasePrefix: 'eida-v2-',
  requireAuthentication: false,
} as const
export const previousVaultServices = ['bo.eida.control.offline.v1', 'bo.eida.control.offline.lab.v1'] as const

export async function checkPreviousVault(readMarker: (service: typeof previousVaultServices[number]) => Promise<string | null>) {
  for (const service of previousVaultServices) {
    if (await protectedOperation(() => readMarker(service)) !== null) throw new OfflineProtectionError('PREVIOUS_VAULT')
  }
}

export interface VaultGrant {
  binding: OfflineBinding
  expiresAt: string
  anchor: TimeAnchor
}

export function checkVaultSession(credential: StoredSession | null, binding: OfflineBinding): asserts credential is StoredSession {
  if (!credential || credential.logoutPending || credential.apiBase !== binding.apiBase ||
      String(credential.userId) !== binding.userId || String(credential.deviceId) !== binding.deviceId ||
      credential.installationId !== binding.installationId) throw new OfflineProtectionError('SESSION_REQUIRED')
}

export function checkOfflineGrant(grant: VaultGrant | null, credential: StoredSession | null, sample: ClockSample) {
  if (!grant) throw new OfflineProtectionError('SESSION_REQUIRED')
  checkVaultSession(credential, grant.binding)
  if (credential.expiresAt !== grant.expiresAt) throw new OfflineProtectionError('SESSION_REQUIRED')
  let now: number
  try { now = anchoredNow(grant.anchor, sample) }
  catch { throw new OfflineProtectionError('SESSION_REQUIRED') }
  const expires = instant(grant.expiresAt)
  if (!Number.isFinite(expires) || now >= expires) throw new OfflineProtectionError('SESSION_REQUIRED')
  return expires - now
}

export function onlineGrant(binding: OfflineBinding, credential: StoredSession, sample: ClockSample, now: number,
  prior: VaultGrant | null): VaultGrant {
  let serverMs = now + credential.serverOffsetMs
  if (prior && sameBinding(prior.binding, binding) && prior.expiresAt === credential.expiresAt && prior.anchor.boot === sample.boot) {
    serverMs = Math.max(serverMs, anchoredNow(prior.anchor, sample))
  }
  return { binding, expiresAt: credential.expiresAt, anchor: { ...sample, serverMs } }
}
