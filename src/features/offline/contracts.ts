export interface OfflineBinding { apiBase: string; userId: string; deviceId: string; installationId: string }
export type PreparationState = 'NO_DESCARGADO' | 'DESCARGANDO' | 'INCOMPLETA' | 'PREPARADO' | 'DESACTUALIZADO' | 'VENCIDO' | 'ERROR'
export type Photo = { kind: 'profile' | 'historical'; state: 'ABSENT' } | {
  kind: 'profile' | 'historical'; state: 'PRESENT'; mime: string; size: number; sha256: string; revision: string; path: string
}
export interface OfflineStudent {
  student_id: string; first_names: string; last_names: string; sis_code: string; identity_number: string
  student_status: string; enrollment_status: string | null; eligibility_status: string | null
  eligibility_revision: number | null; entry_status: 'PENDING' | 'REGISTERED'; photos: Photo[]
}
export interface OfflineExam {
  id: number; name: string; subject_name: string | null; exam_date: string; start_time: string
  duration_minutes: number; status: string; entry_opens_at: string; entry_closes_at: string
  room: { id: number; name: string; code: string; location: string | null } | null
}
export interface Manifest {
  schema_version: 1; package_id: string; exam_id: string; distribution_id: string; list_id: string; version: number
  exam: OfflineExam; binding: { user_id: string; device_id: string; installation_id: string }
  authorization_id: string; responsible_name: string; prepared_at: string; server_time: string; expires_at: string
  timezone: 'America/La_Paz'; room_id: string; surname_range: { from: string | null; to: string | null }
  students: OfflineStudent[]
  qr: { available: boolean; reason: string | null; issuer: string | null; audience: string | null
    keys: { kid: string; algorithm: 'RS256'; pem: string }[]; revoked_jtis: string[] | null }
}
export interface Envelope { manifest_json: string; manifest_sha256: string; schema_version: 1 }
export interface ClockSample { boot: string; elapsed: number }
export interface TimeAnchor { serverMs: number; boot: string; elapsed: number }
export interface PackageRecord {
  id: string; examId: string; state: PreparationState; manifest: Manifest; envelope: Envelope
  anchor: TimeAnchor; active: boolean; error: string | null
}
export interface DistributionContext {
  exam: OfflineExam; can_prepare: boolean; unavailable_reason: string | null
  distribution_id: string | null; version: number | null; frozen: boolean; stale: boolean
  prepared_at: string | null; own_list_id: string | null
  lists: { list_id: string; responsible_id: string; responsible_name: string | null; student_count: number
    surname_range: { from: string | null; to: string | null } }[]
}
// HU37 v1 accepts QR v2 only. V3 evidence cannot be submitted to that service yet.
// Local extra fields stay OUTSIDE the existing wire event; no sender exists in phase 4.
export interface ProvisionalEvent {
  event_id: string; exam_id: string; package_id: string; list_id: string; version: number; room_id: string
  student_id: string; method: 'MANUAL' | 'QR'; captured_at: string; device_id: string; qr_token?: string
  local_status: 'PENDING_SYNC'
  sync_compatibility: 'HU37_MANUAL_V1' | 'QR_V3_REQUIRES_BACKEND_EXTENSION'
  time_evidence: TimeAnchor & { capturedElapsed: number; source: 'SERVER_ANCHORED_ESTIMATE' }
}
export type Digest = (data: string | Uint8Array) => string
export const sameBinding = (a: OfflineBinding, b: OfflineBinding) =>
  a.apiBase === b.apiBase && a.userId === b.userId && a.deviceId === b.deviceId && a.installationId === b.installationId
export function assertBinding(manifest: Manifest, binding: OfflineBinding) {
  if (manifest.binding.user_id !== binding.userId || manifest.binding.device_id !== binding.deviceId ||
      manifest.binding.installation_id !== binding.installationId) throw new Error('El paquete pertenece a otra cuenta o dispositivo.')
}
