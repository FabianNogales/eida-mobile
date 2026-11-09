import { ActivityIndicator, Alert, Text } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Notice } from '../components/Notice'
import { ActionButton } from '../components/ActionButton'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'

export function SessionScreen() {
  const { session, controller } = useAuth()
  const router = useRouter()
  if (canAccessPrivate(session)) return <Redirect href="/(private)" />
  if (session.status === 'unauthenticated' || (session.status === 'expired' && !session.busy)) return <Redirect href="/login" />
  return <Screen home>
    <Text style={s.title}>{session.busy || session.status === 'initializing' ? 'Validando sesión' : 'Validación pendiente'}</Text>
    {session.busy && <ActivityIndicator size="large" />}
    {session.message && <Notice message={session.message} />}
    <Text style={s.body}>Las consultas privadas requieren una sesión validada con Laravel. Un fallo de conexión no elimina automáticamente tu credencial.</Text>
    <ActionButton secondary label="Consultar paquetes ya descargados" onPress={() => router.push('/offline')} />
    {controller && <>
      <ActionButton label="Reintentar validación" busy={session.busy} onPress={() => { void controller.restore() }} />
      <ActionButton secondary label="Cerrar solo en este dispositivo" disabled={session.busy} onPress={() => Alert.alert('Cierre local',
        'Se eliminará la credencial local. No se confirmará su revocación remota; puedes revocarla desde EIDA Web.',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Cerrar localmente', style: 'destructive', onPress: () => { void controller.forgetLocal() } }])} />
    </>}
    <ActionButton secondary label="Diagnóstico QR v3 · desarrollo" onPress={() => router.push('/qr-diagnostics')} />
  </Screen>
}
