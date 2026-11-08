import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../config/theme'

export default function RootLayout() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: 'white' }, headerTintColor: theme.colors.navy, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="qr-diagnostics" options={{ title: 'Prueba QR v3' }} />
    </Stack>
  </SafeAreaProvider>
}

