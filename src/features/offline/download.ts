import type { OfflineApi } from './api'
import type { OfflineClock } from './clock'
import { assertBinding, type Manifest, type TimeAnchor } from './contracts'
import { ApiError } from '../../services/http/errors'
import type { OfflineRepository } from './repository'

export class PackageDownloader {
  private busy = false
  constructor(private api: Pick<OfflineApi, 'package' | 'resume' | 'photo'>, private repo: OfflineRepository,
    private clock: OfflineClock, private validateKeys: (m: Manifest) => Promise<void>, private changed: () => void = () => {}) {}
  async run(examId: string, resumeId?: string) {
    if (this.busy) throw new Error('Ya hay una preparación en curso.')
    this.busy = true
    let id: string | undefined
    let wasActive = false
    try {
      const start = await this.clock.sample()
      const previous = resumeId ? await this.repo.package(resumeId) : null
      wasActive = previous?.active ?? false
      id = previous?.id
      const value = previous ? await this.api.resume(previous.manifest) : await this.api.package(examId)
      const { manifest, envelope } = value
      assertBinding(manifest, this.repo.binding)
      if (manifest.exam_id !== examId || (previous && (manifest.package_id !== previous.id || envelope.manifest_sha256 !== previous.envelope.manifest_sha256))) {
        throw new Error('El paquete recibido no corresponde a la solicitud.')
      }
      // Conservatively include round-trip time; never extend server expiry by network delay.
      const anchor: TimeAnchor = { ...start, serverMs: Date.parse(value.serverTime) }
      if (anchor.serverMs < Date.parse(manifest.server_time)) throw new Error('La hora del servidor retrocedió. Requiere revisión antes de preparar.')
      if ((await this.clock.sample()).boot !== start.boot) throw new Error('El teléfono se reinició durante la descarga.')
      await this.validateKeys(manifest)
      id = manifest.package_id
      await this.repo.stage(envelope, manifest, anchor)
      this.changed()
      for (const student of manifest.students) for (const photo of student.photos) {
        if (photo.state === 'ABSENT') continue
        if (!await this.repo.hasPhoto(id, student.student_id, photo.kind, photo.sha256)) {
          const bytes = await this.api.photo(photo)
          await this.repo.savePhoto(id, student.student_id, photo.kind, photo.sha256, bytes)
        }
      }
      // Reauthorize before publication even when there were no photos.
      const finalStart = await this.clock.sample()
      const final = await this.api.resume(manifest)
      if (final.envelope.manifest_sha256 !== envelope.manifest_sha256) throw new Error('El snapshot cambió durante la descarga.')
      if (Date.parse(final.serverTime) < anchor.serverMs) throw new Error('La hora del servidor retrocedió durante la preparación.')
      // Keep original snapshot age but refresh the trusted clock after a reboot/resume.
      await this.repo.stage(envelope, manifest, { ...finalStart, serverMs: Date.parse(final.serverTime) })
      await this.repo.publish(id, await this.clock.sample())
      this.changed()
      return id
    } catch (error) {
      const rejected = error instanceof ApiError && (error.status === 403 || ['DISTRIBUTION_STALE', 'EXAM_CANCELLED', 'EXAM_ENDED', 'EXAM_FINISHED', 'EXAM_STATE_NOT_ALLOWED'].includes(error.code ?? ''))
      if (rejected) {
        try { for (const p of await this.repo.list()) if (p.examId === examId) await this.repo.setState(p.id, 'DESACTUALIZADO') } catch { /* locked */ }
      } else if (id && !wasActive) {
        // Fixed local message: do not persist remote errors that could contain personal data.
        try { await this.repo.setState(id, 'INCOMPLETA', 'Preparación interrumpida. Reintenta con sesión validada e internet.') } catch { /* locked: retain encrypted stage */ }
      }
      throw error
    } finally { this.busy = false; this.changed() }
  }
}
