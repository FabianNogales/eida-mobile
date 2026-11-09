import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { devices, revokeDevice } from '../features/exams/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { errorMessage } from '../services/http/errors'
import { laPazInstant } from '../utils/dates'

export function DevicesScreen() {
  const { controller, session } = useAuth()
  const [revoking, setRevoking] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const revokeLock = useRef(false)
  const load = useCallback((signal: AbortSignal) => devices(controller!, signal), [controller])
  const query = useRemoteQuery(load)
  async function revoke(id: number) {
    if (!controller || revokeLock.current) return
    revokeLock.current = true
    setRevoking(id); setError(null)
    try {
      await revokeDevice(controller, id)
      if (id === session.deviceId) await controller.currentDeviceRevoked(id)
      else query.refresh()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { revokeLock.current = false; setRevoking(null) }
  }
  return <Screen>
    <Text style={s.title}>Mis dispositivos</Text>
    <ActionButton secondary label="Actualizar" busy={query.loading} disabled={revoking !== null} onPress={query.refresh} />
    {query.loading && <ActivityIndicator />}
    {(error || query.error) && <Notice message={error || query.error!} />}
    {query.data?.length === 0 && <Notice message="No hay dispositivos registrados en esta consulta." />}
    {query.data?.map((device) => <View style={s.card} key={device.id}>
      <Text style={s.subtitle}>{device.device_name}</Text>
      {device.id === session.deviceId && <Text style={s.label}>Esta sesión</Text>}
      <Text style={s.body}>{device.status === 'ACTIVE' ? 'Activo' : 'Revocado'} · Android</Text>
      <Text style={s.body}>Último acceso: {laPazInstant(device.last_login_at)}</Text>
      <ActionButton secondary label="Revocar dispositivo" busy={revoking === device.id}
        disabled={device.status === 'REVOKED' || revoking !== null} onPress={() => Alert.alert('Revocar dispositivo',
          device.id === session.deviceId ? 'Se cerrará esta sesión. ¿Continuar?' : 'Se revocarán los tokens de esta instalación. ¿Continuar?',
          [{ text: 'Cancelar', style: 'cancel' }, { text: 'Revocar', style: 'destructive', onPress: () => { void revoke(device.id) } }])} />
    </View>)}
  </Screen>
}
