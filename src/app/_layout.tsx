import { DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { AuthProvider } from '../features/auth/AuthProvider'
import { OfflineProvider, useOffline } from '../features/offline/OfflineProvider'
import { NetworkProvider } from '../features/connectivity/NetworkProvider'
import { nativeStackScreenOptions } from '../navigation/nativeOptions'

const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors,
  primary: theme.colors.primary, background: theme.colors.background, card: theme.colors.surface,
  text: theme.colors.text, border: theme.colors.border, notification: theme.colors.actionAccent } }

// Protected route removal lands directly here, without an index/session redirect chain.
export const unstable_settings = { initialRouteName: 'login' }

export default function RootLayout() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><ThemeProvider value={navigationTheme}>
    <NetworkProvider><AuthProvider><OfflineProvider><Navigation /></OfflineProvider></AuthProvider></NetworkProvider>
  </ThemeProvider></SafeAreaProvider>
}

function Navigation() {
  const { access } = useOffline()
  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={nativeStackScreenOptions}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="session" options={{ headerShown: false }} />
      <Stack.Protected guard={access !== 'blocked'}>
        <Stack.Screen name="offline" options={{ headerShown: false }} />
        <Stack.Screen name="(private)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  </>
}

