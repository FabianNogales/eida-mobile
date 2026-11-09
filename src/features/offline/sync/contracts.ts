import type { OfflineBinding } from '../contracts'

export type OutboxState = 'PENDING' | 'SENDING' | 'CONFIRMED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED'
export type ReceiptStatus = 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED'
export interface SyncReceipt {
  event_id: string; status: ReceiptStatus; code: string; message: string; entry_id: number | null
  review_required: boolean; received_at: string
}
export interface WireContext { protocol_version: 2; exam_id: string; package_id: string; list_id: string; version: number; room_id: string }
// The wire contains only the declared HU37 fields. Local source/extra timing fields are projected in wire.ts.
export interface WireBatch {
  protocol_version: 2; package_id: string; list_id: string; version: number; room_id: string
  events: { event_id: string; student_id: string; method: 'MANUAL' | 'QR'; captured_at: string; device_id: string
    qr_token?: string; time_evidence: { serverMs: number; boot: string; elapsed: number; capturedElapsed: number; source: 'SERVER_ANCHORED_ESTIMATE' } }[]
}
export interface PendingEvent {
  id: string; context: WireContext; wire: WireBatch['events'][number]; binding: OfflineBinding
  requestHash: string; needsQrV3: boolean
}
export interface SyncItem {
  eventId: string; examId: string; packageId: string; studentId: string; actorId: string
  method: 'MANUAL' | 'QR'; capturedAt: string; state: OutboxState; attempts: number
  lastAttemptAt: string | null; errorCode: string | null; errorMessage: string | null; receipt: SyncReceipt | null
}
export interface SyncCapabilities { protocols: number[]; maxEvents: number; qrVersions: number[]; lateEvidence: boolean }
export interface SyncFailure { code: string; message: string; stop: boolean }
export interface SyncProgress { running: boolean; total: number; processed: number; batches: number; message: string | null }
export const terminalStates: readonly OutboxState[] = ['CONFIRMED', 'DUPLICATE', 'CONFLICT', 'REJECTED']
export function receiptState(status: ReceiptStatus): OutboxState { return status === 'ACCEPTED' ? 'CONFIRMED' : status }
