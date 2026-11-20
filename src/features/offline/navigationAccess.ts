import { canAccessPrivate } from '../auth/guards'
import type { SessionSnapshot } from '../auth/contracts'

export function navigationAccess(session: SessionSnapshot, local: { opened: boolean; error: string | null }) {
  if (canAccessPrivate(session)) return 'online-session'
  if (session.status === 'initializing' || session.status === 'authenticating') return 'checking'
  if (session.status === 'offline' && session.hasCredential && !session.logoutPending) {
    if (local.opened) return 'local-session'
    if (session.busy || !local.error) return 'checking'
  }
  return 'blocked'
}
