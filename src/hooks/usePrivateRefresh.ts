import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { useScreenRefresh } from './useScreenRefresh'

export function usePrivateRefresh(reload: () => Promise<unknown>, blocked = false) {
  const { session, controller } = useAuth()
  const enabled = !!controller && canAccessPrivate(session) && !session.busy && !blocked
  return useScreenRefresh(reload, enabled, () => {
    if (!controller) return false
    const current = controller.getSnapshot()
    return canAccessPrivate(current) && !current.busy && controller.remainingMs() > 0
  })
}
