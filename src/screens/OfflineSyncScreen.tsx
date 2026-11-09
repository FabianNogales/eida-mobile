import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ListScreen } from '../components/ListScreen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { ProgressBar } from '../components/ProgressBar'
import { ChoiceChips } from '../components/operations/ChoiceChips'
import { EntryDetails } from '../components/operations/EntryDetails'
import { OperationDetails } from '../components/operations/OperationDetails'
import { OperationState } from '../components/operations/OperationState'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import type { OutboxState } from '../features/offline/sync/contracts'
import { entryDelivery, entryLabels, entryStates, latestEntryAttempt } from '../ui/operations'
import { useQueueReadiness } from '../ui/useQueueReadiness'
import { laPazInstant } from '../utils/dates'

export function OfflineSyncScreen() {
  const o = useOffline(), { controller } = useAuth(), known = useQueueReadiness(o.runtime, o.busy)
  const [filter, setFilter] = useState<OutboxState | 'ALL'>('ALL')
  const [selected, setSelected] = useState<{ runtime: typeof o.runtime; id: string } | null>(null)
  const rows = known ? o.syncItems.filter((item) => filter === 'ALL' || item.state === filter) : []
  const item = known && selected && selected.runtime === o.runtime ? o.syncItems.find((row) => row.eventId === selected.id) : null
  const lastAttempt = known ? latestEntryAttempt(o.syncItems) : null
  const options: { value: OutboxState | 'ALL'; label: string }[] = [{ value: 'ALL', label: `Todos (${o.syncItems.length})` },
    ...entryStates.map((state) => ({ value: state, label: `${entryLabels[state].label} (${o.syncItems.filter((i) => i.state === state).length})` }))]
  return <>
    <ListScreen data={rows} keyExtractor={(row) => row.eventId} ListHeaderComponent={<View style={s.section}>
      <AppText variant="subtitle" accessibilityRole="header">Ingresos y resultados HU37</AppText>
      <AppText>Se conservan UUID, paquete y evidencia originales. Reintentar no duplica el registro ni cambia una decisión de conflicto.</AppText>
      {o.error && <Notice tone="error" message={o.error} />}
      {!o.runtime ? <Card><AppText>Desbloquea la cola cifrada para conocer sus eventos.</AppText>
        <ActionButton label="Desbloquear cola" busy={o.busy} onPress={() => { void o.unlock() }} /></Card> : <>
        {!controller?.offlineBinding() && <Notice message="Puedes revisar los registros locales. Enviar requiere validar con internet la misma cuenta y dispositivo." />}
        <ActionButton label="Sincronizar ahora / reintentar pendientes" busy={o.busy} disabled={!controller?.offlineBinding()} onPress={() => { void o.synchronize() }} />
        {o.syncProgress.running && <ProgressBar label="Recibos procesados; no equivale a ingresos aceptados"
          value={o.syncProgress.total > 0 ? o.syncProgress.processed / o.syncProgress.total : null} />}
        {o.syncProgress.total > 0 && <AppText>Lotes: {o.syncProgress.batches} · recibos conservados: {o.syncProgress.processed} de {o.syncProgress.total} operaciones consideradas.</AppText>}
        {o.syncProgress.message && <Notice message={o.syncProgress.message} />}
        {lastAttempt && <AppText variant="caption">Último intento conocido: {laPazInstant(lastAttempt)}</AppText>}
        {known ? <ChoiceChips options={options} value={filter} onChange={setFilter} /> : <LoadingState label="Consultando cola autorizada" />}
      </>}
    </View>}
      renderItem={({ item: row }) => <Card>
        <OperationState {...entryDelivery(row)} />
        <AppText variant="subtitle">Examen {row.examId} · estudiante {row.studentId}</AppText>
        <AppText>{row.method} · {laPazInstant(row.capturedAt)}</AppText>
        {row.receipt?.review_required && <Notice message="Evidencia pendiente de revisión" />}
        <ActionButton secondary label="Ver recibo y último intento" onPress={() => setSelected({ runtime: o.runtime, id: row.eventId })} />
      </Card>}
      ListEmptyComponent={known ? <EmptyState title="Sin eventos en esta vista" message="Los resultados de otros estados siguen disponibles en sus filtros." /> : undefined}
      ListFooterComponent={<AppText variant="caption">La evidencia tardía y la hora declarada del dispositivo no acreditan por sí solas asistencia.</AppText>} />
    {item && <OperationDetails title="Resultado del ingreso" onClose={() => setSelected(null)}><EntryDetails item={item} /></OperationDetails>}
  </>
}
const s = StyleSheet.create({ section: { gap: theme.spacing.md } })
