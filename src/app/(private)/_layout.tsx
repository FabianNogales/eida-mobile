import { Stack } from 'expo-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { canAccessPrivate } from '../../features/auth/guards'
import { stackScreenOptions } from '../../navigation/options'

export const unstable_settings = { initialRouteName: '(tabs)' }

export default function PrivateLayout() {
  const { session } = useAuth()
  // Render no private content during invalidation. The root Protected guard is
  // the sole owner of history removal/navigation; do not dispatch another redirect.
  if (!canAccessPrivate(session)) return null
  return <Stack screenOptions={stackScreenOptions}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="collaborations" options={{ title: 'Mis colaboraciones' }} />
    <Stack.Screen name="devices" options={{ title: 'Mis dispositivos' }} />
    <Stack.Screen name="offline-distribution" options={{ title: 'Detalle del examen' }} />
    <Stack.Screen name="prepare-offline" options={{ title: 'Preparar lista offline' }} />
    <Stack.Screen name="incidents" options={{ title: 'Incidencias del examen' }} />
    <Stack.Screen name="incident" options={{ title: 'Detalle de incidencia' }} />
    <Stack.Screen name="infractions" options={{ title: 'Infracciones' }} />
    <Stack.Screen name="discipline-actions" options={{ title: 'Acciones online' }} />
  </Stack>
}
