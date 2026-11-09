import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { laPazInstant } from '../utils/dates'

export function HomeScreen() {
  const { session, controller } = useAuth()
  const router = useRouter()
  return <Screen>
    <Text style={s.label}>EIDA CONTROL</Text>
    <Text style={s.title}>Hola, {session.user?.display_name}</Text>
    <View style={s.card}>
      <Text style={s.subtitle}>Sesión validada con el servidor</Text>
      <Text style={s.body}>Funciones de cuenta: {session.user?.roles.join(' · ') || 'Sin rol global declarado'}</Text>
      <Text style={s.body}>La colaboración se autoriza por examen; puede coexistir con tu función docente.</Text>
      {session.validatedAt && <Text style={s.body}>Última validación: {laPazInstant(session.validatedAt)}</Text>}
    </View>
    <ActionButton label="Mis exámenes" onPress={() => router.push('/(private)/exams')} />
    <ActionButton secondary label="Mis colaboraciones" onPress={() => router.push('/(private)/collaborations')} />
    <ActionButton secondary label="Paquetes y consulta offline" onPress={() => router.push('/offline')} />
    <ActionButton secondary label="Mi cuenta" onPress={() => router.push('/(private)/profile')} />
    <ActionButton secondary label="Mis dispositivos" onPress={() => router.push('/(private)/devices')} />
    <ActionButton secondary label="Diagnóstico QR v3 · desarrollo" onPress={() => router.push('/qr-diagnostics')} />
    <ActionButton secondary label="Cerrar sesión" busy={session.busy} onPress={() => { void controller?.logout() }} />
    <Text style={s.body}>Los registros offline quedan pendientes de sincronización. Su confirmación oficial requiere una respuesta del servidor en HU37.</Text>
  </Screen>
}
