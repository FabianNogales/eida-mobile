// The bitmap is a deterministic 2x rendering of the original public SVG paths.
// It is deliberately independent from the palette used by controls.
export const identity = {
  logo: { width: 1520, height: 1520, sourceViewBox: '0 0 760 760',
    colors: ['#EC1C24', '#013975'], accessibilityLabel: 'Logotipo oficial de EIDA',
    sourceSha256: 'bb52c4f7b10ea81dda83dea764bb285285bf1d90edefc6e0adc0f210bd0f58c9',
    rasterSha256: '22c16696158fdeb9a2f79aead87539069021f4264fb9df4ea2ebbf5984d01cc8' },
  sizes: { loginLogo: 96, headerLogo: 40 },
  font: { active: 'system', poppinsAvailable: false },
} as const
