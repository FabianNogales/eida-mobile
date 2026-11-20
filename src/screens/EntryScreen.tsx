import { Redirect } from 'expo-router'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import { SessionScreen } from './SessionScreen'

export function EntryScreen() {
  const { session, controller } = useAuth()
  const { access } = useOffline()
  if (access === 'online-session' || access === 'local-session') return <Redirect href="/(private)" />
  if (access === 'checking') return <SessionScreen />
  if (controller && (session.status === 'recoverable-error' || (session.status === 'offline' && session.hasCredential))) return <Redirect href="/session" />
  return <Redirect href="/login" />
}
