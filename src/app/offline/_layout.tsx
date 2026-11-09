import { Stack } from 'expo-router'
export default function OfflineLayout() {
  return <Stack><Stack.Screen name="index" options={{ title: 'Paquetes protegidos' }} /><Stack.Screen name="list" options={{ title: 'Mi lista offline' }} /><Stack.Screen name="sync" options={{ title: 'Sincronización' }} /></Stack>
}
