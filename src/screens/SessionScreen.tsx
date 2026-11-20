import { ActivityIndicator, Alert, Text } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Notice } from '../components/Notice'
import { ActionButton } from '../components/ActionButton'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'

export function SessionScreen() {
  const { session, controller } = useAuth()
  const router = useRouter()
  const { access, error } = useOffline()
  if (access === 'online-session' || access === 'local-session') return <Redirect href="/(private)" />
  if (session.status === 'unauthenticated' || (session.status === 'expired' && !session.busy)) return <Redirect href="/login" />
  return <Screen home>
    <Text style={s.title}>{access === 'checking' ? 'Comprobando acceso' : 'Validación pendiente'}</Text>
    {access === 'checking' && <ActivityIndicator size="large" />}
    {access === 'blocked' && error && <Notice message={error} />}
    {session.message && <Notice message={session.message} />}
    {access === 'blocked' && <Text style={s.body}>Conéctate para volver a validar la sesión y recuperar el acceso a tu cuenta.</Text>}
    {controller && access !== 'checking' && <>
      <ActionButton label="Reintentar validación" busy={session.busy} onPress={() => { void controller.restore() }} />
      <ActionButton secondary label="Cerrar solo en este dispositivo" disabled={session.busy} onPress={() => Alert.alert('Cierre local',
        'Se eliminará la credencial local. No se confirmará su revocación remota; puedes revocarla desde EIDA Web.',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Cerrar localmente', style: 'destructive', onPress: () => { void controller.forgetLocal() } }])} />
    </>}
    {__DEV__ && <ActionButton secondary label="Diagnóstico QR v3 · desarrollo" onPress={() => router.push('/qr-diagnostics')} />}
  </Screen>
}
