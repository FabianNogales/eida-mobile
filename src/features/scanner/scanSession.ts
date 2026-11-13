import type { Rs256Provider } from '../qr/contracts'
import type { ClockSample, Digest, OfflineStudent, ProvisionalEvent } from '../offline/contracts'
import type { OfflineRepository } from '../offline/repository'
import { anchoredNow } from '../offline/clock'
import { captureProvisional, identifyQr } from '../offline/identity'
import { offlineQrBlock } from './qrAvailability'

export interface ScanIdentity {
  student: OfflineStudent
  photos: { kind: string; uri: string }[]
}
export type QrScanState =
  | { phase: 'checking' | 'idle' | 'detected' | 'verifying' | 'saving' | 'closed' }
  | { phase: 'scanning'; scanId: number }
  | { phase: 'error' | 'blocked'; message: string }
  | { phase: 'review'; identity: ScanIdentity }
  | { phase: 'duplicate' | 'saved'; identity: ScanIdentity; event: ProvisionalEvent }

export interface ScanServices {
  repo: OfflineRepository; digest: Digest; provider: Rs256Provider
  uuid(): string; check(): void; sample(): Promise<ClockSample>
  photoUri(bytes: Uint8Array, mime: string): Promise<string>
}
export interface ScanDetection { type: string; data: string }

// Camera adapter only supplies text. Identity, capture and UUID/idempotency remain HU36's.
// The raw token stays in this scoped memory until confirmation/cancel/lock, never in navigation.
export class QrScanSession {
  state: QrScanState = { phase: 'checking' }
  private epoch = 0
  private disposed = false
  private granted = false
  private ready = false
  private token: string | null = null
  constructor(private readonly packageId: string, private readonly services: ScanServices,
    private readonly changed: (state: QrScanState) => void = () => {}) {}

  private publish(state: QrScanState) { this.state = state; this.changed(state) }
  private reset() { this.epoch++; this.token = null; this.ready = false }
  private current(epoch: number) { return !this.disposed && this.epoch === epoch }

  // Called on entry and while visible: expiry/boot mismatch also clears any displayed identity.
  async revalidate(): Promise<number | null> {
    if (this.disposed || this.state.phase === 'blocked') return null
    try {
      const sample = await this.services.sample()
      const pkg = await this.services.repo.usable(this.packageId, sample)
      this.services.check()
      if (this.disposed) return null
      const qrBlock = offlineQrBlock(pkg.manifest.qr)
      if (qrBlock) {
        this.reset()
        this.publish({ phase: 'blocked', message: qrBlock })
        return null
      }
      const remaining = Date.parse(pkg.manifest.expires_at) - anchoredNow(pkg.anchor, sample)
      if (this.state.phase === 'checking') this.publish({ phase: 'idle' })
      return remaining
    } catch (error) {
      if (!this.disposed) {
        this.reset()
        this.publish({ phase: 'blocked', message: error instanceof Error ? error.message : 'Acceso offline no disponible.' })
      }
      return null
    }
  }

  cameraAccess(granted: boolean) {
    if (this.disposed) return
    this.granted = granted
    if (!granted && !['checking', 'blocked'].includes(this.state.phase)) {
      this.reset(); this.publish({ phase: 'idle' })
    }
  }
  start(): boolean {
    if (this.disposed || !this.granted || ['checking', 'blocked', 'saving', 'verifying', 'detected', 'scanning'].includes(this.state.phase)) return false
    try { this.services.check() } catch {
      this.reset(); this.publish({ phase: 'blocked', message: 'El almacén está bloqueado. Desbloquéalo para escanear.' }); return false
    }
    this.reset(); this.publish({ phase: 'scanning', scanId: this.epoch }); return true
  }
  cameraReady(scanId: number) {
    if (this.current(scanId) && this.state.phase === 'scanning') this.ready = true
  }
  cameraFailed(scanId: number) {
    if (!this.current(scanId) || this.state.phase !== 'scanning') return
    this.reset(); this.publish({ phase: 'error', message: 'Cámara no disponible. Revisa el permiso, cierra otras aplicaciones que la usen o vuelve a intentarlo.' })
  }
  cancel() {
    if (this.disposed || this.state.phase === 'blocked' || this.state.phase === 'checking') return
    this.reset(); this.publish({ phase: 'idle' })
  }
  close() {
    if (this.disposed) return
    this.disposed = true; this.granted = false; this.reset(); this.publish({ phase: 'closed' })
  }

  async detect(scanId: number, detection: ScanDetection): Promise<boolean> {
    if (!this.current(scanId) || !this.granted || !this.ready || this.state.phase !== 'scanning' || detection.type !== 'qr') return false
    // Synchronous gate before the first await; repeated native callbacks cannot race a React render.
    this.ready = false
    this.publish({ phase: 'detected' })
    try {
      if (!detection.data || detection.data.length > 4096) throw new Error('QR malformado o demasiado grande.')
      const token = detection.data // No trimming, URL dereference, logging or reserialization.
      this.publish({ phase: 'verifying' })
      const sample = await this.services.sample()
      const pkg = await this.services.repo.usable(this.packageId, sample)
      const signed = await identifyQr(token, pkg, sample, this.services.provider)
      if (!this.current(scanId)) return false
      const photos: ScanIdentity['photos'] = []
      for (const photo of signed.student.photos) if (photo.state === 'PRESENT') {
        const bytes = await this.services.repo.photo(this.packageId, signed.student.student_id, photo.kind)
        if (!bytes || bytes.length !== photo.size || this.services.digest(bytes) !== photo.sha256) {
          throw new Error('La fotografía local no pasó la comprobación de integridad.')
        }
        if (!this.current(scanId)) return false
        photos.push({ kind: photo.kind, uri: await this.services.photoUri(bytes, photo.mime) })
      }
      const existing = await this.services.repo.event(pkg.examId, signed.student.student_id)
      await this.services.repo.usable(this.packageId, await this.services.sample())
      this.services.check()
      if (!this.current(scanId)) return false
      const identity = { student: signed.student, photos }
      if (existing) {
        this.token = null
        this.publish({ phase: 'duplicate', identity, event: existing })
      } else {
        this.token = token
        this.publish({ phase: 'review', identity })
      }
      return true
    } catch (error) {
      if (this.current(scanId)) {
        this.reset()
        this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'QR rechazado.' })
      }
      return false
    }
  }

  // Only the explicit confirmation button calls this; detect() never writes an event.
  async confirm(): Promise<ProvisionalEvent | null> {
    if (this.disposed || this.state.phase !== 'review' || !this.token) return null
    const epoch = this.epoch, identity = this.state.identity, token = this.token
    this.publish({ phase: 'saving' })
    try {
      const sample = await this.services.sample()
      if (!this.current(epoch)) return null
      this.services.check()
      const event = await captureProvisional(this.services.repo, this.packageId, identity.student.student_id,
        'QR', sample, this.services.uuid, this.services.provider, token)
      this.services.check()
      if (!this.current(epoch)) return null
      this.token = null
      this.publish({ phase: 'saved', identity, event })
      return event
    } catch (error) {
      if (this.current(epoch)) {
        this.reset()
        this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'No se pudo guardar. Los pendientes anteriores se conservan.' })
      }
      return null
    }
  }
}
