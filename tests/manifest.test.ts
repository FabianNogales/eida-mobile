import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEnvelope, parseManifest } from '../src/features/offline/manifest'
import type { Manifest, OfflineStudent, Photo } from '../src/features/offline/contracts'
import { digest, envelope, manifest } from './support/offlineFixtures'

function firstStudent(value: Manifest): OfflineStudent {
  const student = value.students[0]
  assert.ok(student, 'The existing synthetic fixture must have a student')
  return student
}

function presentPhoto(value: Manifest, kind: Photo['kind']): Photo {
  const student = firstStudent(value), bytes = new Uint8Array([1, 2, 3])
  return { kind, state: 'PRESENT', mime: 'image/png', size: bytes.length, sha256: digest(bytes), revision: '1',
    path: `exams/${value.exam_id}/offline/packages/${value.package_id}/photos/${student.student_id}/${kind}` }
}

// Deliberately untyped wire data reaches the real parser; no assertions bypass validation.
function withPhoto(photo: unknown) {
  const valid = manifest(), student = firstStudent(valid)
  return { ...valid, students: [{ ...student, photos: [photo, { kind: 'historical', state: 'ABSENT' }] }] }
}

function withEntryStatus(entryStatus: unknown) {
  const valid = manifest(), student = firstStudent(valid)
  return { ...valid, students: [{ ...student, entry_status: entryStatus }] }
}

const kinds: Photo['kind'][] = ['profile', 'historical']
for (const kind of kinds) {
  test(`manifest accepts ${kind} with ABSENT`, () => {
    const parsed = parseManifest(manifest()), photo = firstStudent(parsed).photos.find((p) => p.kind === kind)
    assert.deepEqual(photo, { kind, state: 'ABSENT' })
  })
  test(`manifest accepts ${kind} with PRESENT and preserves metadata`, () => {
    const valid = manifest(), student = firstStudent(valid), photo = presentPhoto(valid, kind)
    student.photos = student.photos.map((p) => p.kind === kind ? photo : p)
    const parsed = parseManifest(valid)
    assert.deepEqual(firstStudent(parsed).photos.find((p) => p.kind === kind), photo)
  })
}

const invalidKinds: unknown[] = ['avatar', 'PROFILE', '', null, undefined, 42, {}, []]
for (const kind of invalidKinds) {
  test(`manifest rejects unexpected photo kind ${JSON.stringify(kind)} in both states`, () => {
    assert.throws(() => parseManifest(withPhoto({ kind, state: 'ABSENT' })), /contrato/)
    const photo = presentPhoto(manifest(), 'profile')
    assert.throws(() => parseManifest(withPhoto({ ...photo, kind })), /contrato/)
  })
}

const entryStatuses: OfflineStudent['entry_status'][] = ['PENDING', 'REGISTERED']
for (const status of entryStatuses) {
  test(`manifest accepts known entry status ${status}`, () => {
    const parsed = parseManifest(withEntryStatus(status))
    assert.equal(firstStudent(parsed).entry_status, status)
  })
}

const invalidStatuses: unknown[] = ['ACCEPTED', 'pending', '', null, undefined, 42, {}, []]
for (const status of invalidStatuses) {
  test(`manifest rejects unknown entry status ${JSON.stringify(status)}`, () => {
    assert.throws(() => parseManifest(withEntryStatus(status)), /contrato/)
  })
}

test('malformed manifests and photo descriptors are rejected', () => {
  const malformed: unknown[] = [null, undefined, [], 'not an object', 42, {},
    { ...manifest(), students: [null] }, { ...manifest(), students: 'not an array' },
    withPhoto(null), withPhoto({ state: 'ABSENT' }), withPhoto({ kind: 'profile', state: 'UNKNOWN' })]
  for (const value of malformed) assert.throws(() => parseManifest(value))
  const raw = '{"schema_version":'
  assert.throws(() => parseEnvelope({ data: { mobile: {
    schema_version: 1, manifest_json: raw, manifest_sha256: digest(raw),
  } } }, digest), SyntaxError)
})

test('PRESENT still requires allowed MIME, positive bounded size, SHA-256 and exact path', () => {
  const photo = presentPhoto(manifest(), 'profile')
  const invalid: Record<string, unknown>[] = [
    { size: 0 }, { size: 5242881 }, { size: '3' }, { sha256: 'bad hash' }, { sha256: undefined },
    { mime: 'text/html' }, { path: 'https://foreign.example.test/photo' },
    { path: 'exams/42/offline/packages/foreign/photos/999/profile' },
  ]
  for (const changes of invalid) assert.throws(() => parseManifest(withPhoto({ ...photo, ...changes })))
})

test('existing valid synthetic manifest and envelope remain unchanged after parsing', () => {
  const valid = manifest(), before = JSON.stringify(valid), originalEnvelope = envelope(valid)
  assert.deepEqual(parseManifest(valid), valid)
  assert.deepEqual(parseEnvelope({ data: { mobile: originalEnvelope } }, digest), { envelope: originalEnvelope, manifest: valid })
  assert.equal(JSON.stringify(valid), before)
})
