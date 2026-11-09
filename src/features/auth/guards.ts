import type { SessionSnapshot } from './contracts'

export function canAccessPrivate(session: SessionSnapshot): boolean {
  return session.status === 'authenticated' && session.user !== null && session.user.status === 'ACTIVE' &&
    !session.user.must_change_password && !session.logoutPending
}
