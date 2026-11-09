import { Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { laPazInstant } from '../utils/dates'

export function ProfileScreen() {
  const { session, controller } = useAuth()
  return <Screen>
    <Text style={s.title}>Mi cuenta</Text>
    <View style={s.card}>
      <Text style={s.subtitle}>{session.user?.display_name}</Text>
      <Text style={s.body}>{session.user?.email}</Text>
      <Text style={s.body}>Estado de cuenta: {session.user?.status}</Text>
      <Text style={s.body}>Funciones: {session.user?.roles.join(' · ') || 'Sin rol global declarado'}</Text>
      {session.expiresAt && <Text style={s.body}>Vencimiento informado: {laPazInstant(session.expiresAt)} · America/La_Paz</Text>}
    </View>
    <ActionButton secondary label="Volver a validar con el servidor" busy={session.busy} onPress={() => { void controller?.restore() }} />
    <ActionButton label="Cerrar sesión" busy={session.busy} onPress={() => { void controller?.logout() }} />
  </Screen>
}
