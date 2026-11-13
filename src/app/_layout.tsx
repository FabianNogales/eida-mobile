import { DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { OfflineProvider } from '../features/offline/OfflineProvider'
import { stackScreenOptions } from '../navigation/options'

const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors,
  primary: theme.colors.primary, background: theme.colors.background, card: theme.colors.surface,
  text: theme.colors.text, border: theme.colors.border, notification: theme.colors.actionAccent } }

// Protected route removal lands directly here, without an index/session redirect chain.
export const unstable_settings = { initialRouteName: 'login' }

export default function RootLayout() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><ThemeProvider value={navigationTheme}>
    <AuthProvider><OfflineProvider><Navigation /></OfflineProvider></AuthProvider>
  </ThemeProvider></SafeAreaProvider>
}

function Navigation() {
  const { session } = useAuth()
  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="session" options={{ headerShown: false }} />
      <Stack.Screen name="qr-diagnostics" options={{ title: 'Prueba QR v3' }} />
      <Stack.Screen name="offline" options={{ headerShown: false }} />
      <Stack.Protected guard={canAccessPrivate(session)}>
        <Stack.Screen name="(private)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  </>
}

