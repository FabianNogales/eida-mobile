import { theme } from '../config/theme'

export type Tone = 'info' | 'success' | 'warning' | 'error' | 'neutral'
export const tones = {
  info: { foreground: theme.colors.primary, background: theme.colors.background },
  success: { foreground: theme.colors.success, background: theme.colors.successSoft },
  warning: { foreground: theme.colors.warning, background: theme.colors.warningSoft },
  error: { foreground: theme.colors.error, background: theme.colors.errorSoft },
  neutral: { foreground: theme.colors.muted, background: theme.colors.background },
} as const satisfies Record<Tone, { foreground: string; background: string }>

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export function buttonColors(variant: ButtonVariant, disabled: boolean, pressed: boolean) {
  if (disabled) return { foreground: theme.colors.muted, background: theme.colors.background, border: theme.colors.inputBorder }
  if (variant === 'secondary') return { foreground: theme.colors.primary, background: pressed ? theme.colors.background : theme.colors.surface, border: theme.colors.primary }
  if (variant === 'danger') return { foreground: theme.colors.onPrimary, background: theme.colors.error, border: theme.colors.error }
  return { foreground: theme.colors.onPrimary, background: pressed ? theme.colors.primaryPressed : theme.colors.primary, border: theme.colors.primary }
}

// Screen coordinates, not a guessed keyboard/status-bar height. If adjustResize has
// already shrunk the viewport, overlap is zero: do not subtract the IME twice.
export function keyboardOverlap(viewportTop: number, viewportHeight: number, keyboardTop: number | null): number {
  if (keyboardTop === null || ![viewportTop, viewportHeight, keyboardTop].every(Number.isFinite) || viewportHeight <= 0) return 0
  return Math.min(viewportHeight, Math.max(0, viewportTop + viewportHeight - keyboardTop))
}
export function screenEdges(header: 'native' | 'none', bottomOwnedByNavigator: boolean, keyboardVisible: boolean): ('top' | 'left' | 'right' | 'bottom')[] {
  return [...(header === 'none' ? ['top' as const] : []), 'left', 'right',
    ...(!bottomOwnedByNavigator && !keyboardVisible ? ['bottom' as const] : [])]
}
export function progressValue(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
