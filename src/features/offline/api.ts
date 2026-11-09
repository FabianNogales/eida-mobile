import type { SessionController } from '../auth/session'
import { object } from '../../services/http/schema'
import { parseContext, parseEnvelope, timestamp, id, uuid } from './manifest'
import type { Digest, Manifest, Photo } from './contracts'

export class OfflineApi {
  constructor(private session: SessionController, private digest: Digest, private beforePhoto: () => Promise<void> = async () => {}) {}
  context(examId: string) { return this.session.request(`exams/${id(examId)}/offline/mobile-context`).then(parseContext) }
  // HU35 remains on the server. No Android allocation algorithm.
  async prepare(examId: string) { await this.session.request(`exams/${id(examId)}/offline/prepare`, { method: 'POST' }) }
  async assignments(examId: string) { return this.session.request(`exams/${id(examId)}/offline/assignments`) }
  async package(examId: string) {
    const value = await this.session.request(`exams/${id(examId)}/offline/package`, { query: { schema_version: 2 } })
    const parsed = parseEnvelope(value, this.digest)
    return { ...parsed, serverTime: parsed.manifest.server_time }
  }
  async resume(manifest: Manifest) {
    const value = await this.session.request(`exams/${id(manifest.exam_id)}/offline/packages/${uuid(manifest.package_id)}`)
    return { ...parseEnvelope(value, this.digest), serverTime: timestamp(object(object(value).data).server_time) }
  }
  async photo(photo: Extract<Photo, { state: 'PRESENT' }>): Promise<Uint8Array> {
    // path is exact-validated against package, exam, member and kind in manifest.ts.
    await this.beforePhoto()
    const value = await this.session.request(photo.path, { responseType: 'bytes', expectedStatus: 200 })
    if (!(value instanceof Uint8Array) || value.byteLength !== photo.size || this.digest(value) !== photo.sha256) {
      throw new Error('La fotografía descargada no coincide con el manifiesto. No se publicará el paquete.')
    }
    return value
  }
}
