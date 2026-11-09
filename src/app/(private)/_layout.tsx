import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { canAccessPrivate } from '../../features/auth/guards'
import { theme } from '../../config/theme'

export default function PrivateLayout() {
  const { session } = useAuth()
  if (!canAccessPrivate(session)) return <Redirect href="/" />
  return <Stack screenOptions={{ headerTintColor: theme.colors.navy, contentStyle: { backgroundColor: theme.colors.background } }}>
    <Stack.Screen name="index" options={{ title: 'EIDA Control' }} />
    <Stack.Screen name="exams" options={{ title: 'Mis exámenes' }} />
    <Stack.Screen name="collaborations" options={{ title: 'Mis colaboraciones' }} />
    <Stack.Screen name="profile" options={{ title: 'Mi cuenta' }} />
    <Stack.Screen name="devices" options={{ title: 'Mis dispositivos' }} />
    <Stack.Screen name="offline-distribution" options={{ title: 'Listas exclusivas y preparación' }} />
    <Stack.Screen name="incidents" options={{ title: 'Incidencias del examen' }} />
    <Stack.Screen name="incident" options={{ title: 'Detalle de incidencia' }} />
    <Stack.Screen name="infractions" options={{ title: 'Infracciones' }} />
    <Stack.Screen name="discipline-actions" options={{ title: 'Acciones online' }} />
  </Stack>
}
