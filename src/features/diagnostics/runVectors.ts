import type { Rs256Provider, VectorFixture } from '../qr/contracts'
import { verifyQrV3 } from '../qr/verifyQrV3'

export interface VectorResult {
  name: string
  source: 'PHP fase 1' | 'PHP adicionales'
  expected: string
  actual: string
  passed: boolean
}
export async function runVectors(provider: Rs256Provider, fixtures: readonly VectorFixture[]): Promise<VectorResult[]> {
  const results: VectorResult[] = []
  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index]!
    const trust = {
      issuer: fixture.issuer, audience: fixture.audience,
      keys: new Map([[fixture.kid, { kid: fixture.kid, pem: fixture.public_key_pem, algorithm: 'RS256' as const }]]),
    }
    for (const vector of fixture.cases) {
      const result = await verifyQrV3(vector.token, {
        expectedExamId: String(vector.exam_id), expectedStudentId: String(vector.student_id),
        clock: () => vector.now,
      }, trust, provider)
      const actual = result.ok ? 'VALID' : result.code
      const expected = vector.valid ? 'VALID' : vector.reason!
      results.push({ name: vector.name, source: index === 0 ? 'PHP fase 1' : 'PHP adicionales',
        expected, actual, passed: actual === expected })
    }
  }
  return results
}

