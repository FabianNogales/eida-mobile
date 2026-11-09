import { useState } from 'react'
import { Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import type { OutboxState } from '../features/offline/sync/contracts'
import { laPazInstant } from '../utils/dates'

const labels: Record<OutboxState, string> = { PENDING: 'Pendiente', SENDING: 'En proceso', CONFIRMED: 'Confirmado por el servidor',
  DUPLICATE: 'Duplicado oficial', CONFLICT: 'Conflicto · requiere revisión', REJECTED: 'Rechazado por el servidor' }
const filters: OutboxState[] = ['PENDING', 'SENDING', 'CONFIRMED', 'DUPLICATE', 'CONFLICT', 'REJECTED']
export function OfflineSyncScreen() {
  const o = useOffline(), { controller } = useAuth()
  const [filter, setFilter] = useState<OutboxState | null>(null), [selected, setSelected] = useState<string | null>(null)
  const rows = filter ? o.syncItems.filter((item) => item.state === filter) : o.syncItems
  return <Screen>
    <Text style={s.title}>Sincronización de ingresos</Text>
    <Text style={s.body}>Se envían las operaciones originales de esta cuenta. Un reintento conserva UUID, paquete y evidencia.</Text>
    {o.error && <Notice message={o.error} />}
    {!o.runtime ? <ActionButton label="Desbloquear cola cifrada" busy={o.busy} onPress={() => { void o.unlock() }} /> : <>
      {!controller?.offlineBinding() && <Notice message="Puedes revisar la cola local. Para enviar debes validar con internet la misma cuenta y el mismo dispositivo." />}
      <ActionButton label={o.syncProgress.running ? 'Sincronizando…' : 'Sincronizar ahora / reintentar pendientes'} busy={o.busy}
        disabled={!controller?.offlineBinding()} onPress={() => { void o.synchronize() }} />
      <Text style={s.body}>Lotes enviados: {o.syncProgress.batches} · recibos conservados: {o.syncProgress.processed} de {o.syncProgress.total} operaciones consideradas.</Text>
      {o.syncProgress.message && <Notice message={o.syncProgress.message} />}
      <ActionButton secondary label={`Todos (${o.syncItems.length})`} onPress={() => setFilter(null)} />
      {filters.map((state) => <ActionButton secondary key={state} label={`${labels[state]} (${o.syncItems.filter((i) => i.state === state).length})`} onPress={() => setFilter(state)} />)}
      {!rows.length && <Text style={s.body}>No hay operaciones en esta vista.</Text>}
      {rows.map((item) => <View style={s.card} key={item.eventId}>
        <Text style={s.subtitle}>Examen {item.examId} · estudiante {item.studentId}</Text>
        <Text style={s.label}>{labels[item.state]}</Text>
        <Text style={s.body}>{item.method} · captura estimada: {laPazInstant(item.capturedAt)}</Text>
        <ActionButton secondary label={selected === item.eventId ? 'Ocultar resultado' : 'Ver resultado y último intento'} onPress={() => setSelected(selected === item.eventId ? null : item.eventId)} />
        {selected === item.eventId && <>
          <Text style={s.body}>Operación: {item.eventId} · paquete original: {item.packageId} · actor: {item.actorId}</Text>
          <Text style={s.body}>Intentos: {item.attempts}{item.lastAttemptAt ? ` · último: ${laPazInstant(item.lastAttemptAt)}` : ''}</Text>
          {item.errorMessage && <Notice message={`${item.errorCode}: ${item.errorMessage}`} />}
          {item.receipt && <>
            <Text style={s.body}>{item.receipt.code}: {item.receipt.message}</Text>
            <Text style={s.body}>Recibido por Laravel: {laPazInstant(item.receipt.received_at)}</Text>
            {item.receipt.status === 'ACCEPTED' && <Notice message={`INGRESO OFICIAL CONFIRMADO por Laravel · registro ${item.receipt.entry_id}.`} />}
            {item.receipt.status === 'DUPLICATE' && <Notice message={`Ya existía un ingreso oficial (${item.receipt.entry_id}). Esta operación no creó otro ingreso.`} />}
          </>}
          {item.state === 'CONFLICT' && <Notice message="Evidencia conservada para revisión. Reenviar el mismo UUID no cambia la decisión; no hay aprobación automática ni botón de aprobar asistencia." />}
        </>}
      </View>)}
    </>}
    <Text style={s.body}>La evidencia tardía y la hora declarada del dispositivo no acreditan por sí solas asistencia durante el examen.</Text>
  </Screen>
}
