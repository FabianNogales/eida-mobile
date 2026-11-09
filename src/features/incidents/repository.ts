import type { OfflineRepository, SqlPort } from '../offline/repository'
import { sameBinding, type ClockSample, type Digest, type OfflineBinding } from '../offline/contracts'
import { anchoredNow } from '../offline/clock'
import { id, uuid } from '../offline/manifest'
import { object, text } from '../../services/http/schema'
import { description, infractionType, incidentType, parseEvent, parseReceipt, type IncidentEvent, type IncidentItem, type IncidentReceipt, type IncidentState, type InfractionType } from './contracts'
import type { DisciplinePermissions } from './api'

interface Row { event_id: string; actor_binding: string; event_json: string; request_hash: string; state: string; attempts: number; error_code: string | null; payload: string | null }
export interface InfractionDraft { id: string; packageId: string; examId: string; studentId: string; type: InfractionType; description: string; capturedAt: string }
export class IncidentRepository {
  constructor(private db: SqlPort, readonly repo: OfflineRepository, private digest: Digest, private check: () => void = () => {}) {}
  get binding() { return this.repo.binding }
  private actor(raw: string) {
    this.check()
    const b = object(JSON.parse(raw))
    const binding: OfflineBinding = { apiBase: text(b.apiBase), userId: id(b.userId), deviceId: id(b.deviceId), installationId: uuid(b.installationId) }
    if (!sameBinding(binding, this.binding)) throw new Error('El reporte pertenece a otra cuenta, servidor o dispositivo.')
  }
  private decode(row: Row): IncidentItem {
    this.actor(row.actor_binding)
    if (this.digest(row.event_json) !== row.request_hash) throw new Error('El reporte local perdió su integridad.')
    const event = parseEvent(JSON.parse(row.event_json))
    if (event.event_id !== row.event_id || event.actor_id !== this.binding.userId || event.mobile_device_id !== this.binding.deviceId || event.installation_id !== this.binding.installationId) throw new Error('El actor original del reporte no coincide.')
    const receipt = row.payload === null ? null : parseReceipt(JSON.parse(row.payload))
    if (!['PENDING', 'SENDING', 'REGISTERED', 'CONFLICT', 'REJECTED'].includes(row.state)) throw new Error('Estado de entrega no válido.')
    if (receipt ? receipt.request_hash !== row.request_hash || receipt.event_id !== event.event_id || receipt.status !== row.state : !['PENDING', 'SENDING'].includes(row.state)) throw new Error('Falta un recibo válido para el resultado de la incidencia.')
    const state: IncidentState = receipt?.status ?? (row.state === 'SENDING' ? 'SENDING' : 'PENDING')
    return { event, hash: row.request_hash, state, attempts: row.attempts, errorCode: row.error_code, receipt }
  }
  async items(): Promise<IncidentItem[]> {
    const rows = await this.db.getAllAsync<Row>(`SELECT e.*,d.state,d.attempts,d.error_code,r.payload FROM incident_events e
      JOIN incident_delivery d ON d.event_id=e.event_id LEFT JOIN incident_receipts r ON r.event_id=e.event_id ORDER BY e.rowid DESC`)
    this.check(); return rows.map((row) => this.decode(row))
  }
  async capture(packageId: string, form: { type: unknown; description: string; studentId: string | null }, sample: ClockSample, newUuid: () => string): Promise<IncidentEvent> {
    const type = incidentType(form.type), body = description(form.description)
    const p = await this.repo.usable(packageId, sample), now = anchoredNow(p.anchor, sample)
    if (now < Date.parse(p.manifest.exam.entry_opens_at)) throw new Error('El examen todavía no abrió el control offline.')
    if (form.studentId !== null) await this.repo.student(packageId, id(form.studentId))
    const event: IncidentEvent = { v: 1, event_id: uuid(newUuid()).toLowerCase(), exam_id: p.examId, package_id: p.id,
      actor_id: this.binding.userId, mobile_device_id: this.binding.deviceId, installation_id: this.binding.installationId.toLowerCase(),
      student_id: form.studentId, type, description: body, captured_at: new Date(Math.floor(now / 1000) * 1000).toISOString(),
      time_evidence: { ...p.anchor, capturedElapsed: sample.elapsed, source: 'SERVER_ANCHORED_ESTIMATE' } }
    parseEvent(event)
    const raw = JSON.stringify(event), hash = this.digest(raw)
    await this.db.transactionAsync(async (tx) => {
      this.check()
      const access = await tx.getFirstAsync<{ state: string; active: number }>('SELECT state,active FROM packages WHERE id=?', p.id)
      if (!access?.active || access.state !== 'PREPARADO') throw new Error('La autorización del paquete cambió antes de guardar.')
      await tx.runAsync('INSERT INTO incident_events(event_id,package_id,exam_id,actor_binding,event_json,request_hash) VALUES(?,?,?,?,?,?)',
        event.event_id, p.id, p.examId, JSON.stringify(this.binding), raw, hash)
      await tx.runAsync('INSERT INTO incident_delivery(event_id) VALUES(?)', event.event_id)
      this.check()
    })
    return event
  }
  async recoverInterrupted() {
    this.check()
    await this.items(); await this.drafts() // Verify the original actor before changing any delivery projection.
    await this.db.transactionAsync(async (tx) => {
      await tx.runAsync("UPDATE incident_delivery SET state='PENDING',error_code='INTERRUPTED' WHERE state='SENDING'")
      await tx.runAsync('UPDATE incident_lease SET owner=NULL WHERE id=1')
      await tx.runAsync("UPDATE infraction_draft_submission SET state='UNCERTAIN' WHERE state='SUBMITTING'")
      this.check()
    })
  }
  async acquire(owner: string) {
    await this.db.transactionAsync(async (tx) => {
      this.check()
      const lease = await tx.getFirstAsync<{ owner: string | null }>('SELECT owner FROM incident_lease WHERE id=1')
      if (lease?.owner) throw new Error('Ya hay un envío de incidencias en curso.')
      await tx.runAsync('UPDATE incident_lease SET owner=? WHERE id=1', owner)
    })
  }
  async release(owner: string) { this.check(); await this.db.runAsync('UPDATE incident_lease SET owner=NULL WHERE id=1 AND owner=?', owner) }
  private async lease(tx: SqlPort, owner: string) {
    this.check()
    if ((await tx.getFirstAsync<{ owner: string | null }>('SELECT owner FROM incident_lease WHERE id=1'))?.owner !== owner) throw new Error('El envío perdió su autorización local.')
  }
  async begin(owner: string, eventId: string): Promise<{ json: string; hash: string; event: IncidentEvent }> {
    let result: { json: string; hash: string; event: IncidentEvent } | undefined
    await this.db.transactionAsync(async (tx) => {
      await this.lease(tx, owner)
      const row = await tx.getFirstAsync<Row>(`SELECT e.*,d.state,d.attempts,d.error_code,r.payload FROM incident_events e
        JOIN incident_delivery d ON d.event_id=e.event_id LEFT JOIN incident_receipts r ON r.event_id=e.event_id WHERE e.event_id=?`, eventId)
      if (!row || this.decode(row).state !== 'PENDING') throw new Error('La incidencia ya fue procesada o está en envío.')
      result = { json: row.event_json, hash: row.request_hash, event: parseEvent(JSON.parse(row.event_json)) }
      await tx.runAsync("UPDATE incident_delivery SET state='SENDING',attempts=attempts+1,error_code=NULL WHERE event_id=?", eventId)
    })
    if (!result) throw new Error('No se pudo preparar el envío original.')
    return result
  }
  async finish(owner: string, eventId: string, receipt: IncidentReceipt) {
    const r = parseReceipt(receipt)
    await this.db.transactionAsync(async (tx) => {
      await this.lease(tx, owner)
      const source = await tx.getFirstAsync<{ request_hash: string; state: string }>('SELECT e.request_hash,d.state FROM incident_events e JOIN incident_delivery d ON d.event_id=e.event_id WHERE e.event_id=?', eventId)
      if (!source || source.state !== 'SENDING' || r.event_id !== eventId || r.request_hash !== source.request_hash) throw new Error('El recibo no corresponde al contenido original enviado.')
      await tx.runAsync('INSERT INTO incident_receipts(event_id,payload,request_hash) VALUES(?,?,?)', eventId, JSON.stringify(r), r.request_hash)
      await tx.runAsync('UPDATE incident_delivery SET state=?,error_code=NULL WHERE event_id=?', r.status, eventId)
      this.check()
    })
  }
  async defer(owner: string, eventId: string, code: string) {
    await this.db.transactionAsync(async (tx) => {
      await this.lease(tx, owner)
      await tx.runAsync("UPDATE incident_delivery SET state='PENDING',error_code=? WHERE event_id=? AND state='SENDING'", code, eventId)
    })
  }

  // A bounded cached owner permission is required for drafts; a global DOCENTE role is insufficient.
  async rememberOwner(packageId: string, permission: DisciplinePermissions, sample: ClockSample) {
    const p = await this.repo.usable(packageId, sample)
    if (String(permission.examId) !== p.examId) throw new Error('La autorización pertenece a otro examen.')
    this.check()
    const observed = Date.parse(permission.observedAt)
    if (!Number.isFinite(observed) || observed < Date.parse(p.manifest.server_time) || observed >= Date.parse(p.manifest.expires_at)) throw new Error('La autorización online no corresponde a la vigencia del paquete.')
    await this.db.runAsync(`INSERT INTO discipline_owner_grants(package_id,actor_binding,manifest_hash,allowed,observed_ms) VALUES(?,?,?,?,?)
      ON CONFLICT(package_id) DO UPDATE SET actor_binding=excluded.actor_binding,manifest_hash=excluded.manifest_hash,allowed=excluded.allowed,observed_ms=excluded.observed_ms
      WHERE excluded.observed_ms>discipline_owner_grants.observed_ms OR (excluded.observed_ms=discipline_owner_grants.observed_ms AND excluded.allowed=0)`,
      p.id, JSON.stringify(this.binding), p.envelope.manifest_sha256, permission.manage ? 1 : 0, observed)
  }
  async saveDraft(packageId: string, form: { studentId: string; type: unknown; description: string }, sample: ClockSample, newUuid: () => string): Promise<InfractionDraft> {
    const p = await this.repo.usable(packageId, sample)
    if (anchoredNow(p.anchor, sample) < Date.parse(p.manifest.exam.entry_opens_at)) throw new Error('El examen todavía no abrió el control offline.')
    const grant = await this.db.getFirstAsync<{ actor_binding: string; manifest_hash: string; allowed: number }>('SELECT actor_binding,manifest_hash,allowed FROM discipline_owner_grants WHERE package_id=?', p.id)
    if (!grant?.allowed || grant.manifest_hash !== p.envelope.manifest_sha256) throw new Error('Valida online tu permiso de docente responsable para este paquete antes de preparar un borrador.')
    this.actor(grant.actor_binding)
    await this.repo.student(packageId, id(form.studentId))
    const draft: InfractionDraft = { id: uuid(newUuid()), packageId, examId: p.examId, studentId: form.studentId,
      type: infractionType(form.type), description: description(form.description), capturedAt: new Date(anchoredNow(p.anchor, sample)).toISOString() }
    const raw = JSON.stringify(draft)
    this.check()
    await this.db.transactionAsync(async (tx) => {
      this.check()
      const access = await tx.getFirstAsync<{ active: number; state: string }>('SELECT active,state FROM packages WHERE id=?', p.id)
      const currentGrant = await tx.getFirstAsync<{ allowed: number }>('SELECT allowed FROM discipline_owner_grants WHERE package_id=?', p.id)
      if (!access?.active || access.state !== 'PREPARADO' || !currentGrant?.allowed) throw new Error('La autorización del borrador cambió antes de guardarlo.')
      await tx.runAsync('INSERT INTO infraction_drafts(id,package_id,actor_binding,payload,request_hash) VALUES(?,?,?,?,?)', draft.id, packageId, JSON.stringify(this.binding), raw, this.digest(raw))
      await tx.runAsync('INSERT INTO infraction_draft_submission(draft_id) VALUES(?)', draft.id)
    })
    return draft
  }
  async drafts(): Promise<InfractionDraft[]> {
    const rows = await this.db.getAllAsync<{ actor_binding: string; payload: string; request_hash: string }>('SELECT actor_binding,payload,request_hash FROM infraction_drafts ORDER BY rowid DESC')
    return rows.map((r) => {
      this.actor(r.actor_binding)
      if (this.digest(r.payload) !== r.request_hash) throw new Error('Borrador local sin integridad.')
      const d = object(JSON.parse(r.payload))
      return { id: uuid(d.id), packageId: uuid(d.packageId), examId: id(d.examId), studentId: id(d.studentId), type: infractionType(d.type), description: description(d.description), capturedAt: text(d.capturedAt) }
    })
  }
  async beginDraft(id: string) {
    const found = (await this.drafts()).some((draft) => draft.id === id)
    if (!found) throw new Error('No existe un borrador autorizado.')
    await this.db.transactionAsync(async (tx) => {
      this.check()
      const row = await tx.getFirstAsync<{ state: string }>('SELECT state FROM infraction_draft_submission WHERE draft_id=?', id)
      if (row?.state !== 'DRAFT') throw new Error('Este borrador ya fue enviado o su resultado es incierto. Consulta las infracciones online antes de cualquier revisión manual; no se reenviará.')
      await tx.runAsync("UPDATE infraction_draft_submission SET state='SUBMITTING' WHERE draft_id=?", id)
    })
  }
  async canDraft(packageId: string, sample: ClockSample): Promise<boolean> {
    try {
      const p = await this.repo.usable(packageId, sample)
      const grant = await this.db.getFirstAsync<{ actor_binding: string; manifest_hash: string; allowed: number }>('SELECT actor_binding,manifest_hash,allowed FROM discipline_owner_grants WHERE package_id=?', p.id)
      if (!grant?.allowed || grant.manifest_hash !== p.envelope.manifest_sha256) return false
      this.actor(grant.actor_binding)
      return anchoredNow(p.anchor, sample) >= Date.parse(p.manifest.exam.entry_opens_at)
    } catch { return false }
  }
  async finishDraft(id: string, officialId: number | null, uncertain = false) {
    this.check()
    if (officialId !== null && (!Number.isSafeInteger(officialId) || officialId <= 0)) throw new Error('Respuesta de infracción no válida.')
    await this.db.runAsync("UPDATE infraction_draft_submission SET state=?,official_id=? WHERE draft_id=? AND state='SUBMITTING'",
      officialId !== null ? 'SUBMITTED' : uncertain ? 'UNCERTAIN' : 'DRAFT', officialId, id)
  }
}
