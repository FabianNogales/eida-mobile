import { anchoredNow } from './clock'
import { parseEnvelope } from './manifest'
import { OUTBOX_SCHEMA } from './sync/storageSchema'
import { INCIDENT_SCHEMA } from '../incidents/storageSchema'
import { assertBinding, sameBinding, type ClockSample, type Digest, type Envelope, type Manifest, type OfflineBinding,
  type OfflineStudent, type PackageRecord, type PreparationState, type ProvisionalEvent, type TimeAnchor } from './contracts'

export interface SqlPort {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, ...params: (string | number | null | Uint8Array)[]): Promise<unknown>
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>
  transactionAsync(action: (tx: SqlPort) => Promise<void>): Promise<void>
  closeAsync(): Promise<void>
}
export class ProtectedStorageError extends Error {}
export async function initializeCipher(db: SqlPort, key: string) {
  // MUST precede key, DDL and any PII. Plain SQLite ignores PRAGMA key silently.
  const cipher = await db.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version')
  if (!cipher || !Object.values(cipher).some((v) => typeof v === 'string' && /^\d+\./.test(v))) {
    throw new ProtectedStorageError('Esta APK no incluye SQLCipher. Se bloqueó el almacenamiento local.')
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new ProtectedStorageError('Clave local no válida. Se conservaron los datos pendientes.')
  await db.execAsync(`PRAGMA key = "x'${key}'"; PRAGMA temp_store=MEMORY; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;`)
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
  if (version && version.user_version > 3) throw new ProtectedStorageError('La base offline requiere una versión más reciente de EIDA Control.')
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY, exam_id TEXT NOT NULL, binding TEXT NOT NULL, state TEXT NOT NULL, envelope TEXT NOT NULL,
      anchor TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, error TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS active_exam ON packages(exam_id) WHERE active=1;
    CREATE TABLE IF NOT EXISTS students (
      package_id TEXT NOT NULL REFERENCES packages(id), student_id TEXT NOT NULL,
      first_names TEXT NOT NULL, last_names TEXT NOT NULL, sis TEXT NOT NULL, ci TEXT NOT NULL,
      search TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(package_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS photos (
      package_id TEXT NOT NULL, student_id TEXT NOT NULL, kind TEXT NOT NULL, hash TEXT NOT NULL, bytes BLOB NOT NULL,
      PRIMARY KEY(package_id, student_id, kind),
      FOREIGN KEY(package_id, student_id) REFERENCES students(package_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY, exam_id TEXT NOT NULL, student_id TEXT NOT NULL,
      package_id TEXT NOT NULL REFERENCES packages(id), payload TEXT NOT NULL,
      UNIQUE(exam_id, student_id)
    );
    CREATE TRIGGER IF NOT EXISTS immutable_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_EVENT'); END;
    CREATE TRIGGER IF NOT EXISTS immutable_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'PENDING_EVENT'); END;
    ${OUTBOX_SCHEMA}
    ${INCIDENT_SCHEMA}
    PRAGMA user_version=3;
  `)
  await db.runAsync('UPDATE packages SET state=?,error=? WHERE state=? AND active=0',
    'INCOMPLETA', 'La aplicación se cerró durante la preparación. Puedes reanudar con internet.', 'DESCARGANDO')
}
interface PackageRow { id: string; exam_id: string; binding: string; state: PreparationState; envelope: string; anchor: string; active: number; error: string | null }
export const searchKey = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

export class OfflineRepository {
  constructor(private db: SqlPort, readonly binding: OfflineBinding, private digest: Digest, private check: () => void = () => {}) {}
  private decode(row: PackageRow): PackageRecord {
    this.check()
    if (!sameBinding(JSON.parse(row.binding) as OfflineBinding, this.binding)) throw new Error('El paquete pertenece a otra cuenta, servidor o dispositivo.')
    const envelope = JSON.parse(row.envelope) as Envelope
    const { manifest } = parseEnvelope({ data: { mobile: envelope } }, this.digest)
    assertBinding(manifest, this.binding)
    return { id: row.id, examId: row.exam_id, state: row.state, envelope, manifest,
      anchor: JSON.parse(row.anchor) as TimeAnchor, active: row.active === 1, error: row.error }
  }
  async list() { this.check(); return (await this.db.getAllAsync<PackageRow>('SELECT * FROM packages ORDER BY rowid DESC')).map((r) => this.decode(r)) }
  async package(id: string) {
    this.check()
    const row = await this.db.getFirstAsync<PackageRow>('SELECT * FROM packages WHERE id=?', id)
    if (!row) throw new Error('Paquete local no encontrado.')
    return this.decode(row)
  }
  async stage(envelope: Envelope, manifest: Manifest, anchor: TimeAnchor) {
    this.check(); assertBinding(manifest, this.binding)
    await this.db.transactionAsync(async (tx) => {
      this.check()
      const existing = await tx.getFirstAsync<{ envelope: string; active: number; binding: string }>('SELECT envelope,active,binding FROM packages WHERE id=?', manifest.package_id)
      if (existing) {
        if (!sameBinding(JSON.parse(existing.binding) as OfflineBinding, this.binding)) throw new Error('El paquete pertenece a otra cuenta, servidor o dispositivo.')
        if (JSON.parse(existing.envelope).manifest_sha256 !== envelope.manifest_sha256) throw new Error('El servidor cambió un snapshot inmutable.')
        // Resume must not demote or rewrite a previously published snapshot.
        if (existing.active) {
          await tx.runAsync('UPDATE packages SET anchor=? WHERE id=?', JSON.stringify(anchor), manifest.package_id)
          return
        }
        await tx.runAsync('UPDATE packages SET state=?,anchor=?,error=NULL WHERE id=?', 'DESCARGANDO', JSON.stringify(anchor), manifest.package_id)
        return
      }
      await tx.runAsync('INSERT INTO packages(id,exam_id,binding,state,envelope,anchor) VALUES(?,?,?,?,?,?)',
        manifest.package_id, manifest.exam_id, JSON.stringify(this.binding), 'DESCARGANDO', JSON.stringify(envelope), JSON.stringify(anchor))
      for (const s of manifest.students) {
        this.check()
        await tx.runAsync('INSERT INTO students(package_id,student_id,first_names,last_names,sis,ci,search,payload) VALUES(?,?,?,?,?,?,?,?)',
          manifest.package_id, s.student_id, s.first_names, s.last_names, s.sis_code, s.identity_number,
          searchKey([s.first_names, s.last_names, s.sis_code, s.identity_number].join(' ')), JSON.stringify(s))
      }
    })
  }
  async setState(id: string, state: PreparationState, error: string | null = null) {
    this.check()
    await this.db.runAsync('UPDATE packages SET state=?,error=? WHERE id=?', state, error, id)
  }
  async hasPhoto(packageId: string, studentId: string, kind: string, hash: string) {
    this.check()
    const row = await this.db.getFirstAsync<{ hash: string; bytes: Uint8Array }>(
      'SELECT hash,bytes FROM photos WHERE package_id=? AND student_id=? AND kind=?', packageId, studentId, kind)
    return !!row && row.hash === hash && this.digest(row.bytes) === hash
  }
  async savePhoto(packageId: string, studentId: string, kind: string, hash: string, bytes: Uint8Array) {
    this.check()
    if (this.digest(bytes) !== hash) throw new Error('Hash de fotografía incorrecto.')
    await this.db.runAsync('INSERT INTO photos(package_id,student_id,kind,hash,bytes) VALUES(?,?,?,?,?) ON CONFLICT(package_id,student_id,kind) DO UPDATE SET hash=excluded.hash,bytes=excluded.bytes',
      packageId, studentId, kind, hash, bytes)
  }
  async publish(id: string, sample: ClockSample) {
    const p = await this.package(id)
    if (anchoredNow(p.anchor, sample) >= Date.parse(p.manifest.expires_at)) throw new Error('El paquete venció durante la descarga.')
    for (const s of p.manifest.students) for (const photo of s.photos) {
      if (photo.state === 'PRESENT' && !await this.hasPhoto(id, s.student_id, photo.kind, photo.sha256)) throw new Error('Faltan fotografías verificadas.')
    }
    await this.db.transactionAsync(async (tx) => {
      this.check()
      const count = await tx.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM students WHERE package_id=?', id)
      if (count?.n !== p.manifest.students.length) throw new Error('La lista almacenada está incompleta.')
      await tx.runAsync('UPDATE packages SET active=0 WHERE exam_id=?', p.examId)
      await tx.runAsync('UPDATE packages SET state=?,active=1,error=NULL WHERE id=?', 'PREPARADO', id)
    })
  }
  async usable(id: string, sample: ClockSample) {
    const p = await this.package(id)
    if (!p.active || p.state !== 'PREPARADO') throw new Error('El paquete no está preparado o requiere revisión.')
    if (anchoredNow(p.anchor, sample) >= Date.parse(p.manifest.expires_at)) {
      await this.setState(id, 'VENCIDO')
      throw new Error('La vigencia autorizada del paquete terminó. Los pendientes permanecen protegidos.')
    }
    return p
  }
  async search(packageId: string, term: string, offset = 0): Promise<OfflineStudent[]> {
    this.check()
    // Escape LIKE metacharacters and the escape itself in a single pass.
    const escaped = searchKey(term).replace(/[!%_]/g, '!$&')
    const rows = await this.db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM students WHERE package_id=? AND search LIKE ? ESCAPE '!' ORDER BY last_names,first_names,student_id LIMIT 50 OFFSET ?",
      packageId, `%${escaped}%`, Math.max(0, offset))
    this.check(); return rows.map((r) => JSON.parse(r.payload) as OfflineStudent)
  }
  async student(packageId: string, studentId: string): Promise<OfflineStudent> {
    this.check()
    const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM students WHERE package_id=? AND student_id=?', packageId, studentId)
    if (!row) throw new Error('Estudiante fuera de la lista descargada.')
    this.check(); return JSON.parse(row.payload) as OfflineStudent
  }
  async photo(packageId: string, studentId: string, kind: string): Promise<Uint8Array | null> {
    this.check()
    const row = await this.db.getFirstAsync<{ bytes: Uint8Array }>('SELECT bytes FROM photos WHERE package_id=? AND student_id=? AND kind=?', packageId, studentId, kind)
    this.check(); return row?.bytes ?? null
  }
  async event(examId: string, studentId: string): Promise<ProvisionalEvent | null> {
    this.check()
    const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM events WHERE exam_id=? AND student_id=?', examId, studentId)
    this.check(); return row ? JSON.parse(row.payload) as ProvisionalEvent : null
  }
  async append(event: ProvisionalEvent) {
    this.check()
    await this.db.runAsync('INSERT INTO events(event_id,exam_id,student_id,package_id,payload) VALUES(?,?,?,?,?)',
      event.event_id, event.exam_id, event.student_id, event.package_id, JSON.stringify(event))
  }
  async pendingCount() {
    this.check()
    return (await this.db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM events e LEFT JOIN sync_outbox o ON o.event_id=e.event_id
      WHERE o.event_id IS NULL OR o.state IN ('PENDING','SENDING')`))?.n ?? 0
  }
}
