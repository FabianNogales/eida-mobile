import test from 'node:test'
import assert from 'node:assert/strict'
import { verify as rsaVerify, constants } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import original from '../src/features/qr/fixtures/php-vectors.json'
import supplemental from '../src/features/qr/fixtures/supplemental-vectors.json'
import { verifyQrV3, validIdentifier } from '../src/features/qr/verifyQrV3'
import { decodeBase64url, encodeBase64url } from '../src/features/qr/codec'
import { runVectors } from '../src/features/diagnostics/runVectors'
import { apiBaseUrl } from '../src/config/api'
import type { Rs256Provider } from '../src/features/qr/contracts'

const provider: Rs256Provider = {
  name: 'Node OpenSSL (desktop test, not Android)',
  verify: (input, signature, key) => rsaVerify('sha256', Buffer.from(input, 'ascii'),
    { key: key.pem, padding: constants.RSA_PKCS1_PADDING }, signature),
}
const trust = {
  issuer: original.issuer, audience: original.audience,
  keys: new Map([[original.kid, { kid: original.kid, pem: original.public_key_pem, algorithm: 'RS256' as const }]]),
}

for (const fixture of [original, supplemental]) {
  for (const vector of fixture.cases) {
    test('RS256 ' + fixture.kid + ': ' + vector.name, async () => {
      const keyTrust = { ...trust, keys: new Map([[fixture.kid,
        { kid: fixture.kid, pem: fixture.public_key_pem, algorithm: 'RS256' as const }]]) }
      const actual = await verifyQrV3(vector.token,
        { expectedExamId: String(vector.exam_id), expectedStudentId: String(vector.student_id), clock: () => vector.now },
        keyTrust, provider)
      assert.equal(actual.ok ? 'VALID' : actual.code, vector.valid ? 'VALID' : vector.reason)
    })
  }
}
test('original PHP fixture remains byte-for-byte identical', () => {
  const local = readFileSync(resolve('src/features/qr/fixtures/php-vectors.json'))
  assert.equal(createHash('sha256').update(local).digest('hex').toUpperCase(),
    '4F03499E524EB3B0A099C5E7D7BB4AA788E74EAF3BC7E1C5ABBDC0A5A582B2C4')
})
test('diagnostic runner uses the real verifier and checks every expected reason', async () => {
  const results = await runVectors(provider, [original, supplemental])
  assert.equal(results.length, 29)
  assert.ok(results.every((result) => result.passed))
  assert.equal(results.filter((result) => result.actual === 'VALID').length, 2)
})
test('expiration boundary remains enforced with an injected clock', async () => {
  const expired = await verifyQrV3(original.cases[0]!.token, {
    expectedExamId: '42', clock: () => original.claims.exp,
  }, trust, provider)
  assert.deepEqual(expired, { ok: false, code: 'TIME_INVALID' })
})
test('omitting an injected clock reads Date.now and keeps expiration enabled', async (t) => {
  let seconds = original.claims.iat + 60
  t.mock.method(Date, 'now', () => seconds * 1000)
  const valid = await verifyQrV3(original.cases[0]!.token, { expectedExamId: '42' }, trust, provider)
  assert.equal(valid.ok, true)
  seconds = original.claims.exp
  const expired = await verifyQrV3(original.cases[0]!.token, { expectedExamId: '42' }, trust, provider)
  assert.deepEqual(expired, { ok: false, code: 'TIME_INVALID' })
})
test('unknown key and forbidden headers never call cryptography', async () => {
  let calls = 0
  const counting: Rs256Provider = { name: 'counting', verify: () => { calls++; return false } }
  for (const name of ['unexpected-header', 'unknown-kid']) {
    const vector = original.cases.find((item) => item.name === name)!
    const result = await verifyQrV3(vector.token, { expectedExamId: '42' }, trust, counting)
    assert.deepEqual(result, { ok: false, code: vector.reason })
  }
  assert.equal(calls, 0)
})
test('a failed provider is reported as unavailable, never as successful crypto', async () => {
  const broken: Rs256Provider = { name: 'unavailable', verify: () => { throw new Error('native failure') } }
  const result = await verifyQrV3(original.cases[0]!.token, { expectedExamId: '42' }, trust, broken)
  assert.deepEqual(result, { ok: false, code: 'CRYPTO_UNAVAILABLE' })
})

// Added in the code-only session. These tests have NOT been executed.
test('header and kid errors precede malformed signatures as in Laravel', async () => {
  const mustNotRun: Rs256Provider = { name: 'guard', verify: () => { throw new Error('unexpected crypto call') } }
  for (const name of ['wrong-algorithm', 'unexpected-header', 'unknown-kid']) {
    const vector = original.cases.find((item) => item.name === name)!
    const segments = vector.token.split('.')
    const malformed = segments[0] + '.' + segments[1] + '.='
    const actual = await verifyQrV3(malformed, { expectedExamId: '42' }, trust, mustNotRun)
    assert.deepEqual(actual, { ok: false, code: vector.reason })
  }
})

test('an incompatible provider cannot authenticate by returning a truthy value', async () => {
  for (const value of [1, 'true', {}, undefined]) {
    const incompatible: Rs256Provider = { name: 'incompatible', verify: () => value as unknown as boolean }
    const result = await verifyQrV3(original.cases[0]!.token, { expectedExamId: '42' }, trust, incompatible)
    assert.deepEqual(result, { ok: false, code: 'CRYPTO_UNAVAILABLE' })
  }
})

test('identifiers reject whitespace and final line terminators', () => {
  for (const value of ['42\n', '42\r', '42\u2028', '42\u2029', ' 42', '42 ']) {
    assert.equal(validIdentifier(value), false)
  }
})

test('a caller may verify an exam without supplying a student id', async () => {
  const result = await verifyQrV3(original.cases[0]!.token, {
    expectedExamId: '42', clock: () => original.claims.iat + 60,
  }, trust, provider)
  assert.ok(result.ok)
  assert.equal(result.claims.sub, '101')
  assert.equal(result.claims.exam_id, '42')
})
test('no claims are returned from an unauthenticated payload', async () => {
  const vector = original.cases.find((item) => item.name === 'tampered-payload')!
  const result = await verifyQrV3(vector.token, { expectedExamId: '42' }, trust, provider)
  assert.deepEqual(result, { ok: false, code: 'SIGNATURE_INVALID' })
  assert.ok(!Object.hasOwn(result, 'claims'))
})
test('base64url matches binary reference encoding without padding', () => {
  for (let length = 1; length <= 260; length++) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 97 + length) & 255)
    const encoded = encodeBase64url(bytes)
    assert.equal(encoded, Buffer.from(bytes).toString('base64url'))
    assert.deepEqual(decodeBase64url(encoded), bytes)
  }
  for (const bad of ['', 'A', 'AB', 'AA=', 'AA+', 'AA/', 'AA\n']) assert.throws(() => decodeBase64url(bad))
})
test('identifiers preserve 64-bit values without JavaScript numeric conversion', () => {
  assert.ok(validIdentifier('9223372036854775807'))
  for (const value of ['9223372036854775808', '01', '0', '-1', 42, '1.0']) assert.equal(validIdentifier(value), false)
})
test('invalid expected context is rejected', async () => {
  assert.deepEqual(await verifyQrV3(original.cases[0]!.token,
    { expectedExamId: '042' }, trust, provider), { ok: false, code: 'CONTEXT_INVALID' })
})
test('future API configuration accepts only credential-free HTTPS URLs', () => {
  assert.equal(apiBaseUrl(undefined), null)
  assert.equal(apiBaseUrl('https://test.example/api/v1/'), 'https://test.example/api/v1')
  for (const value of ['http://test.example', 'https://user:password@test.example', 'https://test.example?token=secret']) {
    assert.throws(() => apiBaseUrl(value))
  }
})

