import { Stack } from 'expo-router'
import { useOffline } from '../../features/offline/OfflineProvider'
import { Screen } from '../../components/Screen'
import { LoadingState } from '../../components/FeedbackStates'
import { nativeStackScreenOptions } from '../../navigation/nativeOptions'

export const unstable_settings = { initialRouteName: '(tabs)' }

export default function PrivateLayout() {
  const { access } = useOffline()
  // Render no private content during invalidation. The root Protected guard is
  // the sole owner of history removal/navigation; do not dispatch another redirect.
  if (access === 'blocked') return null
  if (access === 'checking') return <Screen><LoadingState label="Comprobando acceso local" /></Screen>
  return <Stack screenOptions={nativeStackScreenOptions}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="offline-distribution" options={{ title: 'Detalle del examen' }} />
    <Stack.Screen name="devices" options={{ title: 'Perfil' }} />
    <Stack.Protected guard={access === 'online-session'}>
      <Stack.Screen name="collaborations" options={{ title: 'Mis colaboraciones' }} />
      <Stack.Screen name="prepare-offline" options={{ title: 'Preparar mi copia' }} />
      <Stack.Screen name="incidents" options={{ title: 'Incidencias del examen' }} />
      <Stack.Screen name="incident" options={{ title: 'Detalle de incidencia' }} />
      <Stack.Screen name="infractions" options={{ title: 'Infracciones' }} />
      <Stack.Screen name="discipline-actions" options={{ title: 'Acciones online' }} />
    </Stack.Protected>
  </Stack>
}
