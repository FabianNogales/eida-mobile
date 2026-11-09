import { Redirect } from 'expo-router'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { SessionScreen } from './SessionScreen'

export function EntryScreen() {
  const { session, controller } = useAuth()
  if (canAccessPrivate(session)) return <Redirect href="/(private)" />
  if (session.status === 'initializing' || session.status === 'authenticating') return <SessionScreen />
  if (controller && (session.status === 'recoverable-error' || (session.status === 'offline' && session.hasCredential))) return <Redirect href="/session" />
  return <Redirect href="/login" />
}
