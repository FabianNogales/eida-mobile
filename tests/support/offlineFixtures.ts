// Synthetic fixtures and in-memory desktop SQL only. Not an encryption substitute.
import { DatabaseSync } from 'node:sqlite'
import { createHash, constants, verify } from 'node:crypto'
import vectors from '../../src/features/qr/fixtures/php-vectors.json'
import type { Manifest, Envelope, OfflineBinding, Digest, TimeAnchor, ClockSample } from '../../src/features/offline/contracts'
import { initializeCipher, OfflineRepository, type SqlPort } from '../../src/features/offline/repository'
import type { Rs256Provider } from '../../src/features/qr/contracts'
import { SerializedSql } from '../../src/features/offline/serializedSql'

export const binding: OfflineBinding = { apiBase: 'https://eida.example.test/api/v1', userId: '7', deviceId: '11', installationId: '7c4dfeaf-e588-4db1-9524-496a7905582d' }
export const packageId = '01234567-89ab-4cde-8f01-23456789abcd'
export const digest: Digest = (data) => createHash('sha256').update(data).digest('hex')
export const sample: ClockSample = { boot: '3', elapsed: 100000 }
export const anchor: TimeAnchor = { ...sample, serverMs: 1893456060000 }
export const provider: Rs256Provider = { name: 'Desktop OpenSSL test only', verify: (input, signature, key) =>
  verify('sha256', Buffer.from(input, 'ascii'), { key: key.pem, padding: constants.RSA_PKCS1_PADDING }, signature) }
export function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return { schema_version: 1, package_id: packageId, exam_id: '42', distribution_id: '1', list_id: '2', version: 1,
    exam: { id: 42, name: 'Examen sintético', subject_name: 'Asignatura sintética', exam_date: '2030-01-01', start_time: '00:00:00',
      duration_minutes: 60, status: 'ACTIVE', entry_opens_at: '2030-01-01T00:00:00Z', entry_closes_at: '2030-01-01T01:00:00Z',
      room: { id: 1, name: 'Aula sintética', code: 'TEST', location: null } },
    binding: { user_id: binding.userId, device_id: binding.deviceId, installation_id: binding.installationId }, authorization_id: packageId,
    responsible_name: 'Responsable sintético', prepared_at: '2030-01-01T00:01:00Z', server_time: '2030-01-01T00:01:00Z',
    expires_at: '2030-01-01T01:00:00Z', timezone: 'America/La_Paz', room_id: '1', surname_range: { from: 'Álvarez', to: 'Álvarez' },
    students: [{ student_id: '101', first_names: 'Ana', last_names: 'Álvarez', sis_code: '203000101', identity_number: 'CI-101',
      student_status: 'ACTIVE', enrollment_status: 'ACTIVE', eligibility_status: 'ELIGIBLE', eligibility_revision: 1, entry_status: 'PENDING',
      photos: [{ kind: 'profile', state: 'ABSENT' }, { kind: 'historical', state: 'ABSENT' }] }],
    qr: { available: true, reason: null, issuer: vectors.issuer, audience: vectors.audience,
      keys: [{ kid: vectors.kid, algorithm: 'RS256', pem: vectors.public_key_pem }], revoked_jtis: null }, ...overrides }
}
export function envelope(m: Manifest): Envelope {
  const json = JSON.stringify(m)
  return { schema_version: 1, manifest_json: json, manifest_sha256: digest(json) }
}
export class TestSql implements SqlPort {
  readonly native = new DatabaseSync(':memory:')
  async execAsync(sql: string) { this.native.exec(sql) }
  async runAsync(sql: string, ...params: (string | number | null | Uint8Array)[]) { return this.native.prepare(sql).run(...params) }
  async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null> {
    // Cipher availability is mocked ONLY in tests of SQL behavior. Android needs real SQLCipher.
    if (sql === 'PRAGMA cipher_version') return { cipher_version: '4.0-test-double' } as T
    return (this.native.prepare(sql).get(...params) as T | undefined) ?? null
  }
  async getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]> { return this.native.prepare(sql).all(...params) as T[] }
  async transactionAsync(action: (tx: SqlPort) => Promise<void>) {
    this.native.exec('BEGIN IMMEDIATE')
    try { await action(this); this.native.exec('COMMIT') } catch (e) { this.native.exec('ROLLBACK'); throw e }
  }
  async closeAsync() { this.native.close() }
}
export async function harnessOffline() {
  const db = new TestSql()
  const connection = new SerializedSql(db)
  await initializeCipher(connection, 'ab'.repeat(32))
  return { db, connection, repo: new OfflineRepository(connection, binding, digest) }
}
export function mockApi(m: Manifest) {
  const value = () => ({ manifest: m, envelope: envelope(m), serverTime: m.server_time })
  return { package: async () => value(), resume: async () => value(), photo: async () => new Uint8Array() }
}
