export const theme = {
  // Exact official light palette from EIDA Web global.css. No remote fonts/assets.
  colors: {
    navy: '#172554', primary: '#0049a8', accent: '#8b1e3f',
    blue: '#2563eb', actionAccent: '#d9153b', decorative: '#d67a8c',
    accentSoft: '#f7e9ed', azureMist: '#e9f9f6', warmWhite: '#fafafa',
    background: '#eaf3ff', surface: '#ffffff', text: '#172554',
    muted: '#52627a', border: '#dce5f2', inputBorder: '#5b6a80',
    primaryPressed: '#002f7a', onPrimary: '#ffffff',
    scrim: 'rgba(23,37,84,0.48)', success: '#15803d',
    successSoft: '#dcfce7', error: '#b91c1c', errorSoft: '#fee2e2',
    warning: '#b45309', warningSoft: '#fef3c7',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, pageBottom: 36 },
  radius: { small: 6, control: 12, card: 20, pill: 9999 },
  // Preserve the existing scale. Poppins remains pending approved local font files.
  typography: {
    title: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
    subtitle: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
    body: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
    input: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    label: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
    caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
    button: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  },
  layout: { minTouch: 48, controlMinHeight: 54, contentMaxWidth: 720, dialogMaxWidth: 560 },
} as const

