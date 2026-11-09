import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { identity } from '../src/config/identity'
import { theme } from '../src/config/theme'
import { stackScreenOptions } from '../src/navigation/options'
import { infractionFormPolicy, sameInfractionFormScope, type InfractionFormScope } from '../src/ui/infractionFormScope'
import { canAccessPrivate } from '../src/features/auth/guards'
import type { SessionSnapshot } from '../src/features/auth/contracts'

const asset = (name: string) => readFileSync(new URL(`../assets/brand/${name}`, import.meta.url))
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

// Read the actual PNG, not a replacement graphic. Standard PNG filters and zlib
// are decoded in this test only; production uses React Native Image.
function pngPixels(bytes: Buffer) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  const data: Buffer[] = []
  let width = 0, height = 0
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8)
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4)
      assert.equal(chunk[8], 8); assert.equal(chunk[9], 6) // 8-bit RGBA, with transparency.
      assert.equal(chunk[10], 0); assert.equal(chunk[11], 0); assert.equal(chunk[12], 0)
    }
    if (type === 'IDAT') data.push(chunk)
    offset += length + 12
    if (type === 'IEND') break
  }
  assert.ok(width > 0 && height > 0)
  const raw = inflateSync(Buffer.concat(data)), stride = width * 4, pixels = Buffer.alloc(stride * height)
  assert.equal(raw.length, (stride + 1) * height)
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)]!
    assert.ok(filter >= 0 && filter <= 4)
    for (let x = 0; x < stride; x++) {
      const pos = row * stride + x, left = x >= 4 ? pixels[pos - 4]! : 0
      const up = row > 0 ? pixels[pos - stride]! : 0, corner = row > 0 && x >= 4 ? pixels[pos - stride - 4]! : 0
      const p = left + up - corner, dl = Math.abs(p - left), du = Math.abs(p - up), dc = Math.abs(p - corner)
      const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
        : filter === 4 ? dl <= du && dl <= dc ? left : du <= dc ? up : corner : 0
      pixels[pos] = (raw[row * (stride + 1) + 1 + x]! + predictor) & 255
    }
  }
  return { width, height, pixels }
}
test('official source SVG and derived raster match their recorded provenance', () => {
  assert.equal(sha256(asset('eida-logo.svg')), identity.logo.sourceSha256)
  assert.equal(sha256(asset('eida-logo.png')), identity.logo.rasterSha256)
  const svg = asset('eida-logo.svg').toString('utf8')
  assert.match(svg, /viewBox="0 0 760 760"/)
  assert.equal((svg.match(/<path\b/g) ?? []).length, 25)
  assert.deepEqual([...new Set([...svg.matchAll(/<path\b[^>]*\bfill="(#[A-Fa-f0-9]+)"/g)].map((m) => m[1]))].sort(), [...identity.logo.colors].sort())
})
test('actual logo bitmap is square, transparent and retains both original solid colors', () => {
  const raster = pngPixels(asset('eida-logo.png'))
  assert.equal(raster.width, identity.logo.width); assert.equal(raster.height, identity.logo.height)
  assert.equal(raster.width / raster.height, 1)
  let transparent = 0, red = 0, blue = 0
  for (let pos = 0; pos < raster.pixels.length; pos += 4) {
    const r = raster.pixels[pos], g = raster.pixels[pos + 1], b = raster.pixels[pos + 2], a = raster.pixels[pos + 3]
    if (a === 0) transparent++
    if (a === 255 && r === 236 && g === 28 && b === 36) red++
    if (a === 255 && r === 1 && g === 57 && b === 117) blue++
  }
  assert.ok(transparent > 0); assert.ok(red > 0); assert.ok(blue > 0)
  assert.ok(asset('eida-logo.png').length < 150_000)
})
test('visual integration retains the official palette, system fallback and shared header scale', () => {
  assert.deepEqual([theme.colors.primary, theme.colors.navy, theme.colors.accent, theme.colors.background], ['#0049a8', '#172554', '#8b1e3f', '#eaf3ff'])
  assert.equal(identity.font.active, 'system'); assert.equal(identity.font.poppinsAvailable, false)
  assert.equal(stackScreenOptions.headerTitleStyle.fontSize, theme.typography.subtitle.fontSize)
  assert.ok(theme.typography.input.fontSize >= 16)
  assert.ok(identity.sizes.loginLogo * 4 <= identity.logo.width)
})
const runtime = {}, nextRuntime = {}
const scope: InfractionFormScope = { actorId: 7, deviceId: 11, examId: '42', draftId: null, runtime }
test('temporary permission revalidation keeps the same form scope and does not reset its submission barrier', () => {
  for (const manage of [true, undefined, true]) {
    const decision = infractionFormPolicy(scope, { ...scope }, true, manage)
    assert.equal(decision.resetScope, false)
    assert.equal(decision.resetSubmission, false)
    assert.equal(decision.clearPrivateFields, false)
  }
  assert.equal(infractionFormPolicy(null, scope, true, true).resetScope, true)
})
test('permission denial or session loss clears private fields instead of retaining accessible inputs', () => {
  assert.equal(infractionFormPolicy(scope, scope, true, false).clearPrivateFields, true)
  assert.equal(infractionFormPolicy(scope, scope, false, true).clearPrivateFields, true)
  assert.equal(infractionFormPolicy(scope, scope, true, false).resetScope, false)
  assert.equal(infractionFormPolicy(scope, scope, true, false).resetSubmission, false)
  const session: SessionSnapshot = { status: 'expired', user: null, message: null, busy: false, hasCredential: false,
    logoutPending: false, expiresAt: null, deviceId: null, validatedAt: null }
  assert.equal(canAccessPrivate(session), false)
})
test('account/device/exam/draft changes are new UI scopes, while unrelated vault locks do not clear an online form', () => {
  for (const next of [{ ...scope, actorId: 8 }, { ...scope, deviceId: 12 }, { ...scope, examId: '43' }, { ...scope, draftId: 'draft-A' }]) {
    assert.equal(sameInfractionFormScope(scope, next), false)
  }
  assert.equal(sameInfractionFormScope(scope, { ...scope, runtime: nextRuntime }), true)
})
test('protected draft hydration requires a matching live vault and current owner permission', () => {
  const draft = { ...scope, draftId: 'draft-A' }
  assert.equal(infractionFormPolicy(null, draft, true, true).canHydrateDraft, true)
  assert.equal(infractionFormPolicy(draft, draft, true, undefined).canHydrateDraft, false)
  assert.equal(infractionFormPolicy(draft, draft, true, false).canHydrateDraft, false)
  assert.equal(infractionFormPolicy(draft, { ...draft, runtime: null }, true, true).canHydrateDraft, false)
  assert.equal(sameInfractionFormScope(draft, { ...draft, runtime: nextRuntime }), false)
  assert.equal(infractionFormPolicy(draft, { ...draft, runtime: nextRuntime }, true, true).resetSubmission, false)
})
