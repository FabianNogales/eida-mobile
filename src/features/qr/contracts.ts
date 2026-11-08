export type QrFailureCode =
  | 'FORMAT_INVALID' | 'HEADER_INVALID' | 'UNKNOWN_KID' | 'SIGNATURE_INVALID'
  | 'CLAIMS_INVALID' | 'SUBJECT_EXAM_MISMATCH' | 'TIME_INVALID'
  | 'CONTEXT_INVALID' | 'CRYPTO_UNAVAILABLE'

export interface QrV3Claims {
  v: 3
  jti: string
  sub: string
  exam_id: string
  iss: string
  aud: string
  iat: number
  nbf: number
  exp: number
}
export type QrVerificationResult =
  | { ok: true; claims: Readonly<QrV3Claims>; kid: string }
  | { ok: false; code: QrFailureCode }

export interface TrustedRsaKey { readonly kid: string; readonly pem: string; readonly algorithm: 'RS256' }
export interface Rs256Provider {
  readonly name: string
  verify(input: string, signature: Uint8Array, key: TrustedRsaKey): boolean | Promise<boolean>
}
export interface QrTrust {
  readonly issuer: string
  readonly audience: string
  readonly keys: ReadonlyMap<string, TrustedRsaKey>
}
export interface VerificationContext {
  expectedExamId: string
  expectedStudentId?: string
  clock?: () => number
}
export interface VectorCase {
  name: string
  token: string
  student_id: number
  exam_id: number
  now: number
  valid: boolean
  reason: string | null
}
export interface VectorFixture {
  kid: string
  issuer: string
  audience: string
  public_key_pem: string
  cases: VectorCase[]
}

