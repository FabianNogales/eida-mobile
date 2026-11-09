import test from 'node:test'
import assert from 'node:assert/strict'
import { apiEndpoint, resolveApiBase } from '../src/config/api'
import { HttpClient, type ResponsePort } from '../src/services/http/client'
import { ApiError } from '../src/services/http/errors'
import { instant, examDate } from '../src/utils/dates'
import { BASE, response } from './support/authFixtures'

test('API base preserves proxy prefix and appends api/v1 exactly once', () => {
  assert.equal(resolveApiBase('https://eida.example.test/backend'), BASE)
  assert.equal(resolveApiBase(BASE + '/'), BASE)
  assert.equal(resolveApiBase('https://eida.example.test'), 'https://eida.example.test/api/v1')
  assert.equal(apiEndpoint(BASE, 'me'), BASE + '/me')
})
test('bad, missing, illustrative or credential-bearing configuration is rejected', () => {
  for (const value of [undefined, '', 'bad url', 'http://eida.example.test', 'https://backend.example.invalid',
    'https://user:secret@eida.example.test', BASE + '?token=x', BASE + '#fragment', BASE + '/api/v1']) assert.throws(() => resolveApiBase(value))
  assert.throws(() => new HttpClient('http://eida.example.test/api/v1', async (url) => response(url, {})))
})
test('request routes cannot escape to another origin or API prefix', () => {
  for (const path of ['https://foreign.example.test', '//foreign.example.test', '../me', '/me', 'api/../me', '%2e%2e/me', 'api/v1/me']) assert.throws(() => apiEndpoint(BASE, path))
})
test('transport omits cookies, disables redirects and sets only an explicit Bearer', async () => {
  let last: RequestInit | undefined
  const client = new HttpClient(BASE, async (url, init) => { last = init; return response(url, { data: [] }) })
  await client.request('me', { token: 'SYNTHETIC_TOKEN' })
  assert.equal(last?.credentials, 'omit')
  assert.equal(last?.redirect, 'manual')
  assert.equal((last?.headers as Record<string, string>).Authorization, 'Bearer SYNTHETIC_TOKEN')
  await client.request('auth/mobile/login', { method: 'POST', body: { identifier: 'synthetic', password: 'synthetic' } })
  assert.equal((last?.headers as Record<string, string>).Authorization, undefined)
})
test('redirects and responses from another URL are rejected', async () => {
  const redirect = new HttpClient(BASE, async (url) => response(url, null, 302))
  await assert.rejects(redirect.request('me'), { kind: 'configuration' })
  const other = new HttpClient(BASE, async () => response('https://foreign.example.test/me', {}))
  await assert.rejects(other.request('me'), { kind: 'configuration' })
})
for (const status of [401, 403, 422, 429, 500]) {
  test('HTTP ' + status + ' becomes a safe normalized error', async () => {
    const client = new HttpClient(BASE, async (url) => response(url, { message: 'UNSAFE_INTERNAL_DETAILS' }, status))
    await assert.rejects(client.request('me'), (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, status)
      assert.ok(!error.message.includes('UNSAFE_INTERNAL_DETAILS'))
      return true
    })
  })
}
test('network failure does not masquerade as an HTTP 401', async () => {
  const client = new HttpClient(BASE, async () => { throw new TypeError('offline') })
  await assert.rejects(client.request('me'), { kind: 'network', status: undefined })
})
test('timeout aborts a request without retrying it', async () => {
  let count = 0
  const client = new HttpClient(BASE, async (_url, init) => {
    count++
    return new Promise<ResponsePort>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
  }, 10)
  await assert.rejects(client.request('me'), { kind: 'timeout' })
  assert.equal(count, 1)
})
test('caller cancellation is distinct from lost connectivity', async () => {
  const controller = new AbortController()
  const client = new HttpClient(BASE, async (_url, init) => new Promise<ResponsePort>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
  }))
  const request = client.request('me', { signal: controller.signal })
  controller.abort()
  await assert.rejects(request, { kind: 'cancelled' })
})
test('Laravel microseconds and calendar dates do not shift exam days', () => {
  assert.equal(instant('2030-01-01T00:00:00.123456Z'), Date.parse('2030-01-01T00:00:00.123Z'))
  assert.equal(examDate('2030-01-01'), '01/01/2030')
  assert.ok(Number.isNaN(instant('2030-01-01 10:00:00')))
})
