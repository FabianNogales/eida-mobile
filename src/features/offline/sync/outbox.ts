import type { SqlPort } from '../repository'
import { sameBinding, type Digest, type OfflineBinding } from '../contracts'
import { object, text } from '../../../services/http/schema'
import { id } from '../manifest'
import { buildBatch, projectEvent } from './wire'
import { parseReceipt } from './schema'
import { receiptState, terminalStates, type OutboxState, type PendingEvent, type SyncFailure, type SyncItem, type SyncReceipt } from './contracts'

interface Row {
  event_id: string; actor_binding: string; wire_context: string; wire_event: string; request_hash: string
  needs_qr_v3: number; state: OutboxState; attempts: number; last_attempt_at: string | null
  error_code: string | null; error_message: string | null; attempt_id: string | null; result?: string | null
  receipt_request_hash?: string | null
}
function bindingFrom(raw: string): OfflineBinding {
  const b = object(JSON.parse(raw))
  return { apiBase: text(b.apiBase), userId: id(b.userId), deviceId: id(b.deviceId), installationId: text(b.installationId) }
}

export class OutboxRepository {
  constructor(private db: SqlPort, readonly binding: OfflineBinding, private digest: Digest, private check: () => void = () => {}) {}
  private assertActor(raw: string) { if (!sameBinding(bindingFrom(raw), this.binding)) throw new Error('La cola pertenece a otro usuario, servidor o dispositivo.') }
  private decode(row: Row): PendingEvent {
    this.check(); this.assertActor(row.actor_binding)
    if (this.digest(row.wire_context + '\n' + row.wire_event) !== row.request_hash) throw new Error('La solicitud local no supera su comprobación de integridad.')
    const c = object(JSON.parse(row.wire_context)), w = object(JSON.parse(row.wire_event))
    const projection = projectEvent({ ...c, ...w, sync_compatibility: row.needs_qr_v3 ? 'QR_V3_REQUIRES_BACKEND_EXTENSION' : 'HU37_MANUAL_V1' }, this.binding)
    if (projection.wire.event_id !== row.event_id || c.protocol_version !== 2) throw new Error('El identificador de la cola es inconsistente.')
    return { id: row.event_id, binding: this.binding, context: projection.context, wire: projection.wire,
      requestHash: row.request_hash, needsQrV3: row.needs_qr_v3 === 1 }
  }
  async reconcile() {
    this.check()
    const missing = await this.db.getAllAsync<{ payload: string; binding: string }>(`SELECT e.payload,p.binding FROM events e
      JOIN packages p ON p.id=e.package_id LEFT JOIN sync_outbox o ON o.event_id=e.event_id WHERE o.event_id IS NULL ORDER BY e.rowid`)
    await this.db.transactionAsync(async (tx) => {
      for (const row of missing) {
        this.check(); this.assertActor(row.binding)
        const { context, wire, needsQrV3 } = projectEvent(JSON.parse(row.payload), bindingFrom(row.binding))
        const c = JSON.stringify(context), w = JSON.stringify(wire)
        await tx.runAsync(`INSERT OR IGNORE INTO sync_outbox(event_id,actor_binding,wire_context,wire_event,request_hash,needs_qr_v3)
          VALUES(?,?,?,?,?,?)`, wire.event_id, row.binding, c, w, this.digest(c + '\n' + w), needsQrV3 ? 1 : 0)
      }
    })
  }
  /** Only after the old vault/connection has closed; never reset another active worker's lease. */
  async recoverInterrupted(at: string) {
    this.check()
    await this.db.transactionAsync(async (tx) => {
      await tx.runAsync(`UPDATE sync_outbox SET state='PENDING',attempt_id=NULL,error_code='PROCESS_INTERRUPTED',
        error_message='La aplicación se interrumpió. El servidor pudo haber procesado el evento; reintenta con el mismo UUID.' WHERE state='SENDING'`)
      await tx.runAsync("UPDATE sync_attempts SET finished_at=?,outcome='INTERRUPTED' WHERE finished_at IS NULL", at)
      await tx.runAsync('UPDATE sync_lease SET owner=NULL WHERE id=1')
    })
  }
  async items(): Promise<SyncItem[]> {
    this.check()
    const rows = await this.db.getAllAsync<Row>(`SELECT o.*,r.result,r.request_hash AS receipt_request_hash FROM sync_outbox o LEFT JOIN sync_receipts r ON r.event_id=o.event_id ORDER BY o.rowid DESC`)
    return rows.map((row) => {
      const e = this.decode(row)
      const receipt = row.result ? parseReceipt(JSON.parse(row.result)) : null
      const terminal = terminalStates.includes(row.state)
      if ((terminal && !receipt) || (receipt && (!terminal || receiptState(receipt.status) !== row.state ||
          receipt.event_id.toLowerCase() !== row.event_id.toLowerCase() || row.receipt_request_hash !== row.request_hash))) {
        throw new Error('La cola no contiene un recibo definitivo coherente; no se mostrará confirmación oficial.')
      }
      return { eventId: e.id, examId: e.context.exam_id, packageId: e.context.package_id, studentId: e.wire.student_id,
        actorId: e.binding.userId, method: e.wire.method, capturedAt: e.wire.captured_at, state: row.state, attempts: row.attempts,
        lastAttemptAt: row.last_attempt_at, errorCode: row.error_code, errorMessage: row.error_message,
        receipt }
    })
  }
  async pending(): Promise<PendingEvent[]> {
    this.check()
    return (await this.db.getAllAsync<Row>("SELECT * FROM sync_outbox WHERE state='PENDING' ORDER BY rowid")).map((r) => this.decode(r))
  }
  async acquire(lease: string) {
    this.check()
    await this.db.transactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<{ owner: string | null }>('SELECT owner FROM sync_lease WHERE id=1')
      if (row?.owner) throw new Error('Ya existe una sincronización en curso.')
      await tx.runAsync('UPDATE sync_lease SET owner=? WHERE id=1', lease)
    })
  }
  async release(lease: string) { this.check(); await this.db.runAsync('UPDATE sync_lease SET owner=NULL WHERE id=1 AND owner=?', lease) }
  private async owns(tx: SqlPort, lease: string) {
    this.check()
    const row = await tx.getFirstAsync<{ owner: string | null }>('SELECT owner FROM sync_lease WHERE id=1')
    if (row?.owner !== lease) throw new Error('La sincronización perdió su autorización local.')
  }
  async begin(lease: string, attempt: string, events: PendingEvent[], at: string) {
    let batch = buildBatch(events)
    await this.db.transactionAsync(async (tx) => {
      await this.owns(tx, lease)
      const frozen: PendingEvent[] = []
      for (const e of events) {
        const row = await tx.getFirstAsync<Row>('SELECT * FROM sync_outbox WHERE event_id=?', e.id)
        if (!row || row.state !== 'PENDING' || this.decode(row).requestHash !== e.requestHash ||
            this.digest(JSON.stringify(e.context) + '\n' + JSON.stringify(e.wire)) !== row.request_hash) throw new Error('La operación local cambió antes del envío.')
        frozen.push(this.decode(row))
      }
      batch = buildBatch(frozen) // Send from persisted originals, never from mutable caller data.
      await tx.runAsync('INSERT INTO sync_attempts(id,actor_binding,exam_id,request_json,started_at) VALUES(?,?,?,?,?)',
        attempt, JSON.stringify(this.binding), events[0]!.context.exam_id, JSON.stringify(batch), at)
      for (const e of events) await tx.runAsync(`UPDATE sync_outbox SET state='SENDING',attempt_id=?,attempts=attempts+1,
        last_attempt_at=?,error_code=NULL,error_message=NULL WHERE event_id=?`, attempt, at, e.id)
    })
    return batch
  }
  async finish(lease: string, attempt: string, events: PendingEvent[], receipts: SyncReceipt[], at: string) {
    const known = new Map(events.map((e) => [e.id.toLowerCase(), e])), accepted = new Map<string, SyncReceipt>()
    for (const value of receipts) {
      const r = parseReceipt(value), key = r.event_id.toLowerCase()
      if (!known.has(key) || accepted.has(key)) throw new Error('Recibos duplicados o ajenos al lote local.')
      accepted.set(key, r)
    }
    await this.db.transactionAsync(async (tx) => {
      await this.owns(tx, lease)
      for (const e of events) {
        const row = await tx.getFirstAsync<Row>('SELECT * FROM sync_outbox WHERE event_id=?', e.id)
        if (!row || row.state !== 'SENDING' || row.attempt_id !== attempt) throw new Error('El recibo pertenece a otro intento local.')
        if (this.decode(row).requestHash !== e.requestHash) throw new Error('El recibo no corresponde a la solicitud original.')
        const receipt = accepted.get(e.id.toLowerCase())
        if (receipt) {
          await tx.runAsync('INSERT INTO sync_receipts(event_id,result,received_local_at,request_hash) VALUES(?,?,?,?)', e.id, JSON.stringify(receipt), at, row.request_hash)
          await tx.runAsync('UPDATE sync_outbox SET state=?,attempt_id=NULL,error_code=NULL,error_message=NULL WHERE event_id=?', receiptState(receipt.status), e.id)
        } else {
          await tx.runAsync(`UPDATE sync_outbox SET state='PENDING',attempt_id=NULL,error_code='PARTIAL_RESPONSE',
            error_message='No llegó un resultado para este UUID. Reintenta sin cambiar su contenido.' WHERE event_id=?`, e.id)
        }
      }
      await tx.runAsync('UPDATE sync_attempts SET finished_at=?,outcome=? WHERE id=?', at, accepted.size === events.length ? 'RECEIVED' : 'PARTIAL', attempt)
    })
  }
  async fail(lease: string, attempt: string, events: PendingEvent[], failure: SyncFailure, at: string) {
    await this.db.transactionAsync(async (tx) => {
      await this.owns(tx, lease)
      for (const e of events) await tx.runAsync(`UPDATE sync_outbox SET state='PENDING',attempt_id=NULL,error_code=?,error_message=?
        WHERE event_id=? AND state='SENDING' AND attempt_id=?`, failure.code, failure.message, e.id, attempt)
      await tx.runAsync('UPDATE sync_attempts SET finished_at=?,outcome=? WHERE id=?', at, failure.code, attempt)
    })
  }
  async defer(events: PendingEvent[], failure: SyncFailure) {
    this.check()
    await this.db.transactionAsync(async (tx) => {
      for (const e of events) await tx.runAsync("UPDATE sync_outbox SET error_code=?,error_message=? WHERE event_id=? AND state='PENDING'",
        failure.code, failure.message, e.id)
    })
  }
}
