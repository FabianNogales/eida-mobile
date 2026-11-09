import { Stack } from 'expo-router'
export default function OfflineLayout() {
  return <Stack><Stack.Screen name="index" options={{ title: 'Paquetes protegidos' }} /><Stack.Screen name="list" options={{ title: 'Mi lista offline' }} /><Stack.Screen name="scan" options={{ title: 'Escanear QR' }} /><Stack.Screen name="sync" options={{ title: 'Sincronización' }} /><Stack.Screen name="incidents" options={{ title: 'Incidencias y resultados' }} /><Stack.Screen name="report-incident" options={{ title: 'Reportar incidencia' }} /><Stack.Screen name="infraction-draft" options={{ title: 'Borrador provisional' }} /></Stack>
}
