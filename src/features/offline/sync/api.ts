import type { SessionController } from '../../auth/session'
import { id } from '../manifest'
import type { WireBatch } from './contracts'
import { parseCapabilities, parseSyncResponse } from './schema'

export class SyncApi {
  constructor(private session: Pick<SessionController, 'request'>) {}
  async capabilities(examId: string) {
    return parseCapabilities(await this.session.request(`exams/${id(examId)}/offline/sync-capabilities`))
  }
  async send(examId: string, batch: WireBatch) {
    const value = await this.session.request(`exams/${id(examId)}/offline/sync`, { method: 'POST', body: batch, expectedStatus: 200 })
    return parseSyncResponse(value, examId, batch.events.map((e) => e.event_id))
  }
}
