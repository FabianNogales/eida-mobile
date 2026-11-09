import { useRouter } from 'expo-router'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { Screen } from '../components/Screen'
import { StatusBadge } from '../components/StatusBadge'
import { useOffline } from '../features/offline/OfflineProvider'
import { pendingSummary, type QueueSummary } from '../ui/pendingSummary'

// Navigation landing only. Both existing queue screens retain their own receipts,
// permissions, retries and send buttons; there is no combined synchronization.
export function PendingOverviewScreen() {
  const router = useRouter()
  const { runtime, syncItems, incidentItems, busy, error, unlock } = useOffline()
  const summary = pendingSummary(runtime !== null, syncItems, incidentItems)
  return <Screen>
    <AppText variant="title" accessibilityRole="header">Colas locales</AppText>
    <AppText>Los ingresos y las incidencias se revisan y sincronizan por separado. Un registro local no confirma su aceptación en el servidor.</AppText>
    {error && <AppText accessibilityRole="alert">{error}</AppText>}
    {!summary ? <Card>
      <AppText variant="subtitle">Almacén bloqueado</AppText>
      <AppText>Desbloquea el almacén de tu cuenta para consultar las cantidades y los resultados locales.</AppText>
      <ActionButton label="Desbloquear almacén" busy={busy} onPress={() => { void unlock() }} />
    </Card> : <>
      <QueueCard title="Ingresos" counts={summary.entry} onOpen={() => router.push('/offline/sync')} />
      <QueueCard title="Incidencias" counts={summary.incident} onOpen={() => router.push('/offline/incidents')} />
    </>}
    <ActionButton secondary label="Abrir paquetes protegidos" onPress={() => router.push('/offline')} />
    <AppText>Para enviar necesitas validar con internet la cuenta original. Los conflictos, rechazos y restricciones de permisos permanecen visibles en cada cola.</AppText>
  </Screen>
}
function QueueCard({ title, counts, onOpen }: { title: string; counts: QueueSummary; onOpen(): void }) {
  return <Card>
    <AppText variant="subtitle" accessibilityRole="header">{title}</AppText>
    <StatusBadge label={`${counts.pending} pendientes · ${counts.sending} enviando`} tone={counts.pending + counts.sending > 0 ? 'warning' : 'neutral'} />
    <AppText>{counts.conflicts} conflictos · {counts.rejected} rechazos</AppText>
    <ActionButton secondary label={`Revisar ${title.toLocaleLowerCase('es')}`} onPress={onOpen} />
  </Card>
}
