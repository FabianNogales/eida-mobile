import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useOffline } from '../features/offline/OfflineProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { laPazInstant } from '../utils/dates'

export function OfflinePackagesScreen() {
  const offline = useOffline(), { controller } = useAuth(), router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const localAction = (action: () => Promise<void>) => { setMessage(null); void action().catch((e) => setMessage(e instanceof Error ? e.message : 'Operación bloqueada.')) }
  return <Screen>
    <Text style={s.title}>Paquetes offline</Text>
    <Text style={s.body}>Acceso local con biometría y vigencia limitada. No requiere validar primero la sesión remota.</Text>
    <Text style={s.label}>Preparación: {offline.preparation.replaceAll('_', ' ')}</Text>
    {(offline.error || message) && <Notice message={offline.error ?? message!} />}
    {!offline.runtime ? <ActionButton label="Desbloquear almacén protegido" busy={offline.busy} onPress={() => { void offline.unlock() }} /> : <>
      <Text style={s.body}>Operaciones locales pendientes de envío: {offline.pending}. Se conservan cifradas al cerrar sesión.</Text>
      <ActionButton secondary label="Sincronización y resultados" onPress={() => router.push('/offline/sync')} />
      <ActionButton secondary label="Incidencias locales, borradores y resultados" onPress={() => router.push('/offline/incidents')} />
      <ActionButton secondary label="Bloquear consulta local" onPress={() => localAction(offline.lock)} />
      <ActionButton secondary label="Actualizar estados locales" onPress={() => localAction(offline.refresh)} />
      {offline.packages.length === 0 && <Notice message="NO DESCARGADO. Abre un examen o colaboración con internet para preparar tu lista." />}
      {offline.packages.map((p) => <View key={p.id} style={s.card}>
        <Text style={s.subtitle}>{p.manifest.exam.name}</Text>
        <Text style={s.body}>{p.manifest.exam.subject_name ?? 'Asignatura no informada'} · lista {p.manifest.list_id} · distribución v{p.manifest.version} · esquema {p.manifest.schema_version}</Text>
        <Text style={s.label}>{p.state.replaceAll('_', ' ')}{p.active ? ' · snapshot publicado' : ''}</Text>
        <Text style={s.body}>Actualización: {laPazInstant(p.manifest.prepared_at)}. Vigencia: {laPazInstant(p.manifest.expires_at)}.</Text>
        <Text style={s.body}>Consulta offline: {p.state === 'PREPARADO' ? 'preparada, sujeta a vigencia' : 'bloqueada'}. QR v3: {p.manifest.qr.available ? 'material público disponible' : 'NO DISPONIBLE'}.</Text>
        {p.error && <Notice message={p.error} />}
        {p.active && p.state === 'PREPARADO' && <ActionButton label="Abrir mi lista local" onPress={() => router.push({ pathname: '/offline/list', params: { packageId: p.id } })} />}
        {!p.active && !['VENCIDO', 'DESACTUALIZADO'].includes(p.state) && <ActionButton secondary label="Reanudar descarga con internet" busy={offline.busy}
          disabled={!controller?.offlineBinding()} onPress={() => { void offline.download(p.examId, p.id) }} />}
        {p.active && <ActionButton secondary label="Revalidar paquete con internet" busy={offline.busy} disabled={!controller?.offlineBinding()}
          onPress={() => { void offline.download(p.examId, p.id) }} />}
      </View>)}
    </>}
    <Text style={s.body}>Consulta los recibos de Laravel en Sincronización. Un registro local por sí solo no confirma un ingreso oficial.</Text>
  </Screen>
}
