import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../navigation/options'
export default function OfflineLayout() {
  return <Stack screenOptions={stackScreenOptions}>
    <Stack.Screen name="index" options={{ title: 'Paquetes protegidos' }} />
    <Stack.Screen name="list" options={{ title: 'Control de ingreso' }} />
    <Stack.Screen name="scan" options={{ title: 'Escanear QR' }} />
    <Stack.Screen name="sync" options={{ title: 'Sincronización' }} />
    <Stack.Screen name="incidents" options={{ title: 'Incidencias y resultados' }} />
    <Stack.Screen name="report-incident" options={{ title: 'Reportar incidencia' }} />
    <Stack.Screen name="infraction-draft" options={{ title: 'Borrador provisional' }} />
  </Stack>
}
