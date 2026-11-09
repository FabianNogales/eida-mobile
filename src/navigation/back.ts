import type { Href } from 'expo-router'

export interface BackPort { canGoBack(): boolean; back(): void; replace(href: Href): void }
// Only use an explicit caller-supplied destination on a direct entry without history.
// Do not serialize QR, student photos, credentials or form contents into route params.
export function goBack(router: BackPort, fallback?: Href): boolean {
  if (router.canGoBack()) { router.back(); return true }
  if (fallback) { router.replace(fallback); return true }
  return false // Root: leave Android's normal Back/exit behavior alone.
}

// Used by the opt-in form guard and tested without native dialogs. Never deletes a saved event.
export function createExitConfirmation() {
  let pending: (() => void) | null = null
  return {
    request(repeat: () => void) { if (pending) return false; pending = repeat; return true },
    cancel() { pending = null },
    confirm() { const repeat = pending; pending = null; repeat?.() },
    clear() { pending = null },
  }
}
