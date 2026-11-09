import type { PrivateApi } from '../exams/api'
import { array, boolean, integer, object, text } from '../../services/http/schema'
import { protocolError } from '../../services/http/errors'
import { id, timestamp } from '../offline/manifest'
import { description, infractionType, infractionStatus, officialIncident, officialInfraction, parseReceipt, person, type InfractionStatus } from './contracts'

export interface DisciplinePermissions { examId: number; read: boolean; report: boolean; manage: boolean; observedAt: string }
export class DisciplineApi {
  constructor(private api: PrivateApi) {}
  private base(examId: string) { return `exams/${id(examId)}` }
  async context(examId: string): Promise<DisciplinePermissions> {
    const r = object(object(await this.api.request(`${this.base(examId)}/discipline-context`)).data)
    if (String(integer(r.exam_id)) !== examId) throw protocolError()
    return { examId: integer(r.exam_id), read: boolean(r.can_read_incidents), report: boolean(r.can_report_incidents), manage: boolean(r.can_manage_discipline), observedAt: timestamp(r.server_time) }
  }
  async incidents(examId: string, page = 1, signal?: AbortSignal) {
    const r = object(await this.api.request(`${this.base(examId)}/incidents`, { query: { page, per_page: 15 }, signal })), meta = object(r.meta)
    return { data: array(r.data, officialIncident), page: integer(meta.current_page), lastPage: integer(meta.last_page) }
  }
  async incident(examId: string, incidentId: string, signal?: AbortSignal) {
    if (!/^(?:qr-)?[1-9][0-9]*$/.test(incidentId)) throw protocolError()
    return officialIncident(object(await this.api.request(`${this.base(examId)}/incidents/${incidentId}`, { signal })).data)
  }
  async sync(examId: string, json: string, hash: string) {
    return parseReceipt(object(await this.api.request(`${this.base(examId)}/offline/incidents`, { method: 'POST', body: { event_json: json, event_sha256: hash } })).data)
  }
  private requireOwner(p: DisciplinePermissions, examId: string) {
    if (!p.manage || String(p.examId) !== examId) throw new Error('Esta acción online requiere al docente responsable del examen.')
  }
  async infractions(examId: string, p: DisciplinePermissions, page = 1) {
    this.requireOwner(p, examId)
    const r = object(await this.api.request(`${this.base(examId)}/infractions`, { query: { page, per_page: 15 } })), meta = object(r.meta)
    return { data: array(r.data, officialInfraction), page: integer(meta.current_page), lastPage: integer(meta.last_page) }
  }
  async createInfraction(examId: string, p: DisciplinePermissions, form: { studentId: number; type: unknown; description: string }) {
    this.requireOwner(p, examId)
    return officialInfraction(object(await this.api.request(`${this.base(examId)}/infractions`, { method: 'POST', expectedStatus: 201,
      body: { student_id: integer(form.studentId), type: infractionType(form.type), description: description(form.description) } })).data)
  }
  async changeStatus(examId: string, p: DisciplinePermissions, infractionId: number, status: InfractionStatus, reason: string, revision: number) {
    this.requireOwner(p, examId)
    return officialInfraction(object(await this.api.request(`${this.base(examId)}/infractions/${integer(infractionId)}/status`, { method: 'PATCH',
      body: { status: infractionStatus(status), reason: description(reason), expected_revision: integer(revision, 0) } })).data)
  }
  async students(examId: string, p: DisciplinePermissions, kind: 'infractions' | 'expulsions', search: string, page = 1) {
    this.requireOwner(p, examId)
    const r = object(await this.api.request(`${this.base(examId)}/${kind}/students`, { query: { search, page, per_page: 15 } }))
    return { data: array(r.data, person), page: integer(r.current_page), lastPage: integer(r.last_page) }
  }
  async expulsions(examId: string, p: DisciplinePermissions, page = 1) {
    this.requireOwner(p, examId)
    const r = object(await this.api.request(`${this.base(examId)}/expulsions`, { query: { page, per_page: 15 } })), meta = object(r.meta)
    return { data: array(r.data, (value) => { const e = object(value); return { id: integer(e.id), student: person(e.student), reason: text(e.reason) } }), page: integer(meta.current_page), lastPage: integer(meta.last_page) }
  }
  async expel(examId: string, p: DisciplinePermissions, studentId: number, reason: string) {
    this.requireOwner(p, examId)
    const r = object(object(await this.api.request(`${this.base(examId)}/expulsions`, { method: 'POST', expectedStatus: 201,
      body: { student_id: integer(studentId), reason: description(reason) } })).data)
    if (r.status !== 'EXPELLED' || integer(r.exam_id) !== p.examId || integer(r.student_id) !== studentId) throw protocolError()
    return integer(r.id)
  }
  async entries(examId: string, p: DisciplinePermissions, page = 1) {
    this.requireOwner(p, examId)
    const r = object(await this.api.request(`${this.base(examId)}/entry-control/entries`, { query: { page, per_page: 15 } })), meta = object(r.meta)
    return { data: array(r.data, (value) => { const row = object(value), e = object(row.entry), s = object(row.student)
      return { id: integer(e.id), name: `${text(s.last_names)}, ${text(s.first_names)}`, canAnnul: boolean(object(row.permissions).can_annul), status: text(e.status) } }),
      page: integer(meta.current_page), lastPage: integer(meta.last_page) }
  }
  async annul(examId: string, p: DisciplinePermissions, entryId: number, reason: string) {
    this.requireOwner(p, examId)
    const r = object(object(await this.api.request(`${this.base(examId)}/entry-control/entries/${integer(entryId)}/annulment`,
      { method: 'POST', body: { reason: description(reason) } })).data), entry = object(r.entry)
    if (entry.status !== 'ANNULLED' || integer(entry.id) !== entryId) throw protocolError()
    return entryId
  }
}
