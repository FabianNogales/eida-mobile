import { ActionButton } from '../ActionButton'
import { LoadingState } from '../FeedbackStates'
import { Notice } from '../Notice'
import { useOffline } from '../../features/offline/OfflineProvider'
import { useAuth } from '../../features/auth/AuthProvider'
import { canAccessPrivate } from '../../features/auth/guards'

export function OfflineAccessStatus({ loadingLabel = 'Abriendo información local' }: { loadingLabel?: string }) {
  const { busy, error, open } = useOffline()
  const { session } = useAuth()
  const eligible = !session.logoutPending && (canAccessPrivate(session) || (session.status === 'offline' && session.hasCredential))
  if (busy || session.busy || (eligible && !error)) return <LoadingState label={loadingLabel} />
  return <>
    <Notice tone="warning" message={error ?? 'Inicia sesión en EIDA para consultar la información local.'} />
    {eligible && canAccessPrivate(session) &&
      <ActionButton secondary label="Reintentar apertura" onPress={() => { void open() }} />}
  </>
}
