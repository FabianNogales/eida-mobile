import test from 'node:test'
import assert from 'node:assert/strict'
import { theme } from '../src/config/theme'
import { buttonColors, keyboardOverlap, progressValue, screenEdges, tones } from '../src/ui/presentation'
import { stackScreenOptions } from '../src/navigation/options'
import { createDialogDecision } from '../src/ui/dialogDecision'

// Independent WCAG sRGB contrast calculation, not a screenshot or a native rendering test.
function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}
function contrast(a: string, b: string) {
  const light = luminance(a), dark = luminance(b)
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)
}
test('official EIDA brand roles retain exact values and sufficient normal-text contrast', () => {
  assert.equal(theme.colors.primary, '#0049a8')
  assert.equal(theme.colors.navy, '#172554')
  assert.equal(theme.colors.accent, '#8b1e3f')
  assert.equal(theme.colors.actionAccent, '#d9153b')
  for (const surface of [theme.colors.surface, theme.colors.background]) {
    for (const foreground of [theme.colors.text, theme.colors.muted, theme.colors.primary, theme.colors.accent]) {
      assert.ok(contrast(foreground, surface) >= 4.5, `${foreground} on ${surface}`)
    }
  }
  assert.ok(contrast(theme.colors.inputBorder, theme.colors.surface) >= 3)
})
test('button labels and secondary loading indicators retain readable color in every state', () => {
  for (const kind of ['primary', 'secondary', 'danger'] as const) for (const disabled of [false, true]) for (const pressed of [false, true]) {
    const c = buttonColors(kind, disabled, pressed)
    assert.ok(contrast(c.foreground, c.background) >= 4.5, `${kind}, disabled=${disabled}, pressed=${pressed}`)
  }
  assert.ok(theme.layout.controlMinHeight >= 48)
  assert.ok(theme.layout.minTouch >= 48)
})
test('semantic badges and notices meet normal-text contrast, including warning and error', () => {
  for (const [name, c] of Object.entries(tones)) assert.ok(contrast(c.foreground, c.background) >= 4.5, name)
})
test('native header owns the top inset; standalone content owns it exactly once', () => {
  assert.deepEqual(screenEdges('native', false, false), ['left', 'right', 'bottom'])
  assert.deepEqual(screenEdges('none', false, false), ['top', 'left', 'right', 'bottom'])
  assert.deepEqual(screenEdges('native', true, false), ['left', 'right'])
  assert.deepEqual(screenEdges('none', false, true), ['top', 'left', 'right'])
})
test('IME calculation does not double-shrink adjustResize and accounts for actual header coordinates', () => {
  assert.equal(keyboardOverlap(80, 720, 500), 300) // Overlaid keyboard.
  assert.equal(keyboardOverlap(80, 420, 500), 0) // Android already resized.
  assert.equal(keyboardOverlap(80, 420, null), 0) // Dismissed keyboard.
  assert.equal(keyboardOverlap(0, 0, 500), 0) // Not yet measured.
  assert.equal(keyboardOverlap(80, 720, Number.NaN), 0)
  assert.equal(keyboardOverlap(80, 720, 0), 720) // Never reserve more than the viewport.
  for (const width of [360, 393, 720]) assert.ok(width - theme.spacing.xl * 2 >= theme.layout.minTouch)
})
test('progress remains bounded and never treats invalid/unknown measurements as completed', () => {
  assert.equal(progressValue(-1), 0); assert.equal(progressValue(2), 1)
  assert.equal(progressValue(0.35), 0.35)
  assert.equal(progressValue(Number.NaN), 0); assert.equal(progressValue(Number.POSITIVE_INFINITY), 0)
})
test('native navigation keeps system bars visible without deprecated Android 35 color hacks', () => {
  assert.equal(stackScreenOptions.statusBarStyle, 'dark')
  assert.equal(stackScreenOptions.statusBarHidden, false)
  assert.equal(stackScreenOptions.navigationBarHidden, false)
  assert.equal('navigationBarColor' in stackScreenOptions, false)
  assert.equal('statusBarTranslucent' in stackScreenOptions, false)
})
test('dialog Back/cancel never confirms a sensitive action and double taps resolve once', () => {
  const dialog = createDialogDecision(), calls: string[] = []
  const callbacks = { cancel: () => { calls.push('cancel') }, confirm: () => { calls.push('confirm') } }
  assert.equal(dialog.choose('cancel', callbacks), true)
  assert.equal(dialog.choose('confirm', callbacks), false)
  assert.deepEqual(calls, ['cancel'])
  dialog.reset()
  assert.equal(dialog.choose('confirm', callbacks), true)
  assert.equal(dialog.choose('confirm', callbacks), false)
  assert.deepEqual(calls, ['cancel', 'confirm'])
})
