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
  </Stack>
}
