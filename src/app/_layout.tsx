import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { OfflineProvider } from '../features/offline/OfflineProvider'

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><OfflineProvider><Navigation /></OfflineProvider></AuthProvider></SafeAreaProvider>
}

function Navigation() {
  const { session } = useAuth()
  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: 'white' }, headerTintColor: theme.colors.navy, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="session" options={{ headerShown: false }} />
      <Stack.Screen name="qr-diagnostics" options={{ title: 'Prueba QR v3' }} />
      <Stack.Screen name="offline" options={{ headerShown: false }} />
      <Stack.Protected guard={canAccessPrivate(session)}>
        <Stack.Screen name="(private)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  </>
}

