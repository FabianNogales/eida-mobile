import type { SessionSnapshot } from './contracts'

export function nextResumeState(previous: string | null, next: string) {
  return next === 'inactive' ? previous : next
}

// A biometric prompt can temporarily make an activity inactive. Only an actual
// background/resume cycle revalidates an existing credential, never a logged-out one.
export function shouldRestoreOnResume(previous: string | null, next: string, session: SessionSnapshot) {
  return previous === 'background' && next === 'active' && session.hasCredential &&
    !session.logoutPending && session.status !== 'unauthenticated' && !session.busy
}
