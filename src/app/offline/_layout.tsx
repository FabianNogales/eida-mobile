import { Stack } from 'expo-router'
import { nativeStackScreenOptions } from '../../navigation/nativeOptions'
export default function OfflineLayout() {
  return <Stack screenOptions={nativeStackScreenOptions}>
    <Stack.Screen name="index" options={{ title: 'Listas descargadas' }} />
    <Stack.Screen name="list" options={{ title: 'Control de ingreso' }} />
    <Stack.Screen name="scan" options={{ title: 'Escanear QR' }} />
    <Stack.Screen name="sync" options={{ title: 'Sincronización' }} />
    <Stack.Screen name="incidents" options={{ title: 'Incidencias y resultados' }} />
    <Stack.Screen name="report-incident" options={{ title: 'Reportar incidencia' }} />
    <Stack.Screen name="infraction-draft" options={{ title: 'Borrador provisional' }} />
  </Stack>
}
