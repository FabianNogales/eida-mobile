import { useRouter } from 'expo-router'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { Screen } from '../components/Screen'
import { StatusBadge } from '../components/StatusBadge'
import { ConnectionBanner, EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import { pendingSummary, type QueueSummary } from '../ui/pendingSummary'
import { useQueueReadiness } from '../ui/useQueueReadiness'
import { latestEntryAttempt } from '../ui/operations'
import { laPazInstant } from '../utils/dates'

export function PendingOverviewScreen() {
  const router = useRouter(), { session } = useAuth()
  const o = useOffline(), known = useQueueReadiness(o.runtime, o.busy)
  const summary = pendingSummary(known, o.syncItems, o.incidentItems)
  const lastAttempt = known ? latestEntryAttempt(o.syncItems) : null
  return <Screen>
    <AppText variant="title" accessibilityRole="header">{summary ? summary.pending > 0 ? `${summary.pending} operaciones por enviar`
      : summary.attention > 0 ? 'Hay resultados por revisar' : 'Sin pendientes de envío' : o.runtime ? 'Consultando las colas' : 'Almacén bloqueado'}</AppText>
    <AppText>Ingresos e incidencias conservan su evidencia y se envían por separado.</AppText>
    {o.error && <Notice tone="error" message={o.error} />}
    <ConnectionBanner state={session.status === 'offline' ? 'offline' : 'unknown'}
      message="Cada envío comprueba conexión y sesión de la cuenta original. Una sesión validada no indica conexión continua." />
    {lastAttempt && <AppText variant="caption">Último intento de ingresos: {laPazInstant(lastAttempt)}</AppText>}
    {!o.runtime ? <Card>
      <AppText variant="subtitle">Información protegida</AppText>
      <AppText>Las cantidades son desconocidas hasta desbloquear y consultar el almacén.</AppText>
      <ActionButton label="Desbloquear almacén" busy={o.busy} onPress={() => { void o.unlock() }} />
    </Card> : !known ? <LoadingState label="Leyendo las colas autorizadas" /> : summary && <>
      {summary.pending + summary.attention === 0 && <EmptyState title="Sin operaciones por enviar o revisar" message="Puedes consultar también los resultados anteriores de cada cola." />}
      <QueueCard title="Ingresos HU37" counts={summary.entry} onOpen={() => router.push('/offline/sync')} />
      <QueueCard title="Incidencias HU27" counts={summary.incident} onOpen={() => router.push('/offline/incidents')} />
    </>}
    <ActionButton secondary label="Abrir paquetes protegidos" onPress={() => router.push('/offline')} />
    <AppText>Un provisional no confirma un ingreso; un reporte no confirma una infracción. Los conflictos y rechazos permanecen en su cola.</AppText>
  </Screen>
}
function QueueCard({ title, counts, onOpen }: { title: string; counts: QueueSummary; onOpen(): void }) {
  return <Card>
    <AppText variant="subtitle" accessibilityRole="header">{title}</AppText>
    <StatusBadge label={`${counts.pending} pendientes · ${counts.sending} enviando`} tone={counts.pending + counts.sending > 0 ? 'warning' : 'neutral'} />
    <AppText>{counts.conflicts} conflictos · {counts.rejected} rechazos</AppText>
    <ActionButton secondary label={`Revisar ${title}`} onPress={onOpen} />
  </Card>
}
