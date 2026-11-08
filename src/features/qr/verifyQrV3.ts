import { decodeBase64url, decodeObject } from './codec'
import type { QrFailureCode, QrTrust, QrV3Claims, QrVerificationResult, Rs256Provider, VerificationContext } from './contracts'

const headerKeys = ['alg', 'kid', 'typ']
const claimKeys = ['v', 'jti', 'sub', 'exam_id', 'iss', 'aud', 'iat', 'nbf', 'exp']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const failure = (code: QrFailureCode): QrVerificationResult => ({ ok: false, code })
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))

export function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) &&
    (value.length < 19 || value <= '9223372036854775807')
}
function validClaims(c: Record<string, unknown>, trust: QrTrust): c is Record<string, unknown> & QrV3Claims {
  if (!exact(c, claimKeys) || c.v !== 3 || typeof c.jti !== 'string' || !uuid.test(c.jti) ||
      !validIdentifier(c.sub) || !validIdentifier(c.exam_id) || c.iss !== trust.issuer || c.aud !== trust.audience) return false
  for (const key of ['iat', 'nbf', 'exp']) {
    const value = c[key]
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 253402300799) return false
  }
  const { iat, nbf, exp } = c as unknown as QrV3Claims
  return nbf >= iat && exp > nbf && exp - iat <= 172800
}

export async function verifyQrV3(
  token: string, context: VerificationContext, trust: QrTrust, provider: Rs256Provider,
): Promise<QrVerificationResult> {
  if (!validIdentifier(context.expectedExamId) ||
      (context.expectedStudentId !== undefined && !validIdentifier(context.expectedStudentId))) return failure('CONTEXT_INVALID')
  if (typeof token !== 'string' || token.length > 4096) return failure('FORMAT_INVALID')
  const parts = token.split('.')
  if (parts.length !== 3) return failure('FORMAT_INVALID')
  const [h, p, s] = parts as [string, string, string]
  let header: Record<string, unknown>
  try {
    header = decodeObject(h)
  } catch { return failure('FORMAT_INVALID') }
  if (!exact(header, headerKeys) || header.alg !== 'RS256' || header.typ !== 'eida-entry-qr+jwt' ||
      typeof header.kid !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(header.kid)) return failure('HEADER_INVALID')
  const key = trust.keys.get(header.kid)
  if (!key || key.algorithm !== 'RS256' || key.kid !== header.kid) return failure('UNKNOWN_KID')
  // Match Laravel's rejection order: header, trusted kid, signature encoding.
  let signature: Uint8Array
  try { signature = decodeBase64url(s) } catch { return failure('FORMAT_INVALID') }
  let authentic: boolean
  try {
    // Raw signed bytes: never reconstruct/re-encode the signing input.
    authentic = await provider.verify(h + '.' + p, signature, key)
  } catch { return failure('CRYPTO_UNAVAILABLE') }
  // A provider with an incompatible runtime API must never pass on truthiness.
  if (typeof authentic !== 'boolean') return failure('CRYPTO_UNAVAILABLE')
  if (!authentic) return failure('SIGNATURE_INVALID')
  let claims: Record<string, unknown>
  try { claims = decodeObject(p) } catch { return failure('FORMAT_INVALID') }
  if (!validClaims(claims, trust)) return failure('CLAIMS_INVALID')
  if (claims.exam_id !== context.expectedExamId ||
      (context.expectedStudentId !== undefined && claims.sub !== context.expectedStudentId)) return failure('SUBJECT_EXAM_MISMATCH')
  let now: number
  try { now = (context.clock ?? (() => Math.floor(Date.now() / 1000)))() } catch { return failure('CONTEXT_INVALID') }
  if (!Number.isSafeInteger(now) || now < 0) return failure('CONTEXT_INVALID')
  if (claims.iat > now || claims.nbf > now || claims.exp <= now) return failure('TIME_INVALID')
  return { ok: true, claims: Object.freeze({ ...claims }), kid: header.kid }
}

