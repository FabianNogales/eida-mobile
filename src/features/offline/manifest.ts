import { array, boolean, integer, nullableText, object, text } from '../../services/http/schema'
import { validIdentifier } from '../qr/verifyQrV3'
import type { Digest, Envelope, Manifest, OfflineExam, OfflineStudent, Photo, DistributionContext } from './contracts'

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const hashPattern = /^[a-f0-9]{64}$/
const fail = (): never => { throw new Error('El contrato del paquete offline no es válido o está incompleto.') }
const requiredText = (value: unknown): string => { const s = text(value); return s.trim() ? s : fail() }
function parsePhotoKind(value: unknown): Photo['kind'] {
  if (value === 'profile' || value === 'historical') return value
  return fail()
}
function parseEntryStatus(value: unknown): OfflineStudent['entry_status'] {
  if (value === 'PENDING' || value === 'REGISTERED') return value
  return fail()
}
export function id(v: unknown): string { return validIdentifier(v) ? v : fail() }
export function uuid(v: unknown): string { return typeof v === 'string' && uuidPattern.test(v) ? v : fail() }
export function timestamp(v: unknown): string {
  const s = text(v)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(s) || !Number.isFinite(Date.parse(s))) fail()
  return s
}
const range = (v: unknown) => { const r = object(v); return { from: nullableText(r.from), to: nullableText(r.to) } }
export function parseExam(v: unknown): OfflineExam {
  const r = object(v), room = r.room === null ? null : object(r.room)
  return { id: integer(r.id), name: requiredText(r.name), subject_name: nullableText(r.subject_name), exam_date: requiredText(r.exam_date),
    start_time: text(r.start_time), duration_minutes: integer(r.duration_minutes), status: text(r.status),
    entry_opens_at: timestamp(r.entry_opens_at), entry_closes_at: timestamp(r.entry_closes_at),
    room: room ? { id: integer(room.id), name: text(room.name), code: text(room.code), location: nullableText(room.location) } : null }
}
export function parseContext(value: unknown): DistributionContext {
  const r = object(object(value).data)
  return { exam: parseExam(r.exam), can_prepare: boolean(r.can_prepare), unavailable_reason: nullableText(r.unavailable_reason),
    distribution_id: r.distribution_id === null ? null : id(r.distribution_id), version: r.version === null ? null : integer(r.version),
    frozen: boolean(r.frozen), stale: boolean(r.stale), prepared_at: r.prepared_at === null ? null : timestamp(r.prepared_at),
    own_list_id: r.own_list_id === null ? null : id(r.own_list_id), lists: array(r.lists, (item) => {
      const l = object(item); return { list_id: id(l.list_id), responsible_id: id(l.responsible_id),
        responsible_name: nullableText(l.responsible_name), student_count: integer(l.student_count, 0), surname_range: range(l.surname_range) }
    }) }
}
export function parseEnvelope(value: unknown, digest: Digest): { envelope: Envelope; manifest: Manifest } {
  const r = object(object(object(value).data).mobile)
  if (r.schema_version !== 1) fail()
  const raw = text(r.manifest_json), hash = text(r.manifest_sha256)
  if (raw.length > 32 * 1024 * 1024 || !hashPattern.test(hash) || digest(raw) !== hash) throw new Error('Integridad del manifiesto incorrecta.')
  const manifest = parseManifest(JSON.parse(raw))
  return { envelope: { schema_version: 1, manifest_json: raw, manifest_sha256: hash }, manifest }
}
export function parseManifest(value: unknown): Manifest {
  const r = object(value), binding = object(r.binding), q = object(r.qr)
  if (r.schema_version !== 1 || r.timezone !== 'America/La_Paz') fail()
  const packageId = uuid(r.package_id), examId = id(r.exam_id)
  const students = array(r.students, (value): OfflineStudent => {
    const s = object(value), studentId = id(s.student_id)
    const photos = array(s.photos, (value): Photo => {
      const p = object(value), kind = parsePhotoKind(p.kind)
      if (p.state === 'ABSENT') return { kind, state: 'ABSENT' }
      if (p.state !== 'PRESENT') fail()
      const expected = `exams/${examId}/offline/packages/${packageId}/photos/${studentId}/${kind}`
      const size = integer(p.size), mime = text(p.mime), sha256 = text(p.sha256)
      if (text(p.path) !== expected || size > 5242880 || !['image/jpeg', 'image/png', 'image/webp'].includes(mime) || !hashPattern.test(sha256)) fail()
      return { kind, state: 'PRESENT', size, mime, sha256, revision: text(p.revision), path: expected }
    })
    if (photos.length !== 2 || new Set(photos.map((p) => p.kind)).size !== 2) fail()
    const entryStatus = parseEntryStatus(s.entry_status)
    return { student_id: studentId, first_names: requiredText(s.first_names), last_names: requiredText(s.last_names), sis_code: requiredText(s.sis_code),
      identity_number: requiredText(s.identity_number), student_status: text(s.student_status), enrollment_status: nullableText(s.enrollment_status),
      eligibility_status: nullableText(s.eligibility_status), eligibility_revision: s.eligibility_revision === null ? null : integer(s.eligibility_revision, 0),
      entry_status: entryStatus, photos }
  })
  if (students.length > 50000 || new Set(students.map((s) => s.student_id)).size !== students.length) fail()
  const keys = array(q.keys, (value) => {
    const k = object(value), kid = text(k.kid), pem = text(k.pem)
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid) || k.algorithm !== 'RS256' || pem.length > 8192 ||
        !pem.trim().startsWith('-----BEGIN PUBLIC KEY-----') || pem.includes('PRIVATE')) fail()
    return { kid, algorithm: 'RS256' as const, pem }
  })
  const available = boolean(q.available), issuer = nullableText(q.issuer), audience = nullableText(q.audience)
  if (new Set(keys.map((k) => k.kid)).size !== keys.length || (available && (!keys.length || !issuer || !audience))) fail()
  const preparedAt = timestamp(r.prepared_at), serverTime = timestamp(r.server_time), expiresAt = timestamp(r.expires_at)
  const exam = parseExam(r.exam)
  if (String(exam.id) !== examId || Date.parse(expiresAt) <= Date.parse(serverTime) || Date.parse(serverTime) < Date.parse(preparedAt) ||
      Date.parse(expiresAt) > Date.parse(exam.entry_closes_at)) fail()
  return { schema_version: 1, package_id: packageId, exam_id: examId, distribution_id: id(r.distribution_id), list_id: id(r.list_id),
    version: integer(r.version), exam, binding: { user_id: id(binding.user_id), device_id: id(binding.device_id), installation_id: uuid(binding.installation_id) },
    authorization_id: uuid(r.authorization_id), responsible_name: requiredText(r.responsible_name), prepared_at: preparedAt, server_time: serverTime,
    expires_at: expiresAt, timezone: 'America/La_Paz', room_id: id(r.room_id), surname_range: range(r.surname_range), students,
    qr: { available, issuer, audience, reason: nullableText(q.reason), keys,
      revoked_jtis: q.revoked_jtis === null ? null : array(q.revoked_jtis, uuid) } }
}
