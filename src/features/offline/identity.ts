import type { Rs256Provider } from '../qr/contracts'
import { verifyQrV3 } from '../qr/verifyQrV3'
import { decodeObject } from '../qr/codec'
import type { OfflineStudent, PackageRecord, ProvisionalEvent, ClockSample } from './contracts'
import { anchoredNow } from './clock'
import type { OfflineRepository } from './repository'

export function eligible(student: OfflineStudent) {
  if (student.student_status !== 'ACTIVE' || student.enrollment_status !== 'ACTIVE' || student.eligibility_status !== 'ELIGIBLE') {
    throw new Error('La habilitación conocida no permite registrar este estudiante.')
  }
  if (student.entry_status !== 'PENDING') throw new Error('El servidor ya informaba un ingreso para este estudiante.')
}
export async function identifyQr(token: string, p: PackageRecord, sample: ClockSample, provider: Rs256Provider): Promise<{ student: OfflineStudent; jti: string }> {
  // Detect v2 for an actionable error, never use its unsigned payload as identity.
  try {
    if (decodeObject(token.split('.')[1] ?? '').v === 2) throw new Error('QR_V2')
  } catch (e) {
    if (e instanceof Error && e.message === 'QR_V2') throw new Error('QR v2 no es verificable criptográficamente offline. Usa consulta manual.')
  }
  const q = p.manifest.qr
  if (!q.available || !q.issuer || !q.audience) throw new Error('El servidor no ofrece QR v3 productivo y claves públicas para este paquete.')
  const now = anchoredNow(p.anchor, sample)
  const result = await verifyQrV3(token, { expectedExamId: p.examId, clock: () => Math.floor(now / 1000) },
    { issuer: q.issuer, audience: q.audience, keys: new Map(q.keys.map((k) => [k.kid, k])) }, provider)
  if (!result.ok) throw new Error(`QR rechazado: ${result.code}.`)
  const student = p.manifest.students.find((s) => s.student_id === result.claims.sub)
  if (!student) throw new Error('El estudiante firmado no pertenece a tu lista descargada.')
  if (q.revoked_jtis?.includes(result.claims.jti)) throw new Error('QR con revocación conocida en este snapshot.')
  eligible(student)
  return { student, jti: result.claims.jti }
}
export async function captureProvisional(repo: OfflineRepository, packageId: string, studentId: string,
  method: 'MANUAL' | 'QR', sample: ClockSample, newUuid: () => string, provider: Rs256Provider,
  token?: string): Promise<ProvisionalEvent> {
  const p = await repo.usable(packageId, sample)
  const now = anchoredNow(p.anchor, sample)
  if (now < Date.parse(p.manifest.exam.entry_opens_at)) throw new Error('El examen todavía no abrió el control de ingreso.')
  const student = await repo.student(packageId, studentId)
  eligible(student)
  if (method === 'QR') {
    if (!token) throw new Error('Falta la evidencia QR.')
    const signed = await identifyQr(token, p, sample, provider)
    if (signed.student.student_id !== studentId) throw new Error('El QR no corresponde al estudiante seleccionado.')
  }
  const existing = await repo.event(p.examId, studentId)
  if (existing) return existing // Stable UUID on retry, never duplicate or mutate evidence.
  const event: ProvisionalEvent = {
    event_id: newUuid(), exam_id: p.examId, package_id: p.id, list_id: p.manifest.list_id, version: p.manifest.version,
    room_id: p.manifest.room_id, student_id: studentId, method, captured_at: new Date(Math.floor(now / 1000) * 1000).toISOString(),
    device_id: repo.binding.installationId, ...(method === 'QR' ? { qr_token: token! } : {}), local_status: 'PENDING_SYNC',
    sync_compatibility: method === 'QR' ? 'QR_V3_REQUIRES_BACKEND_EXTENSION' : 'HU37_MANUAL_V1',
    time_evidence: { ...p.anchor, capturedElapsed: sample.elapsed, source: 'SERVER_ANCHORED_ESTIMATE' },
  }
  try { await repo.append(event) } catch (error) {
    // Database UNIQUE is the final guard against simultaneous taps.
    const committed = await repo.event(p.examId, studentId)
    if (committed) return committed
    throw error
  }
  return event
}
