import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { PackageCard } from '../components/control/PackageCard'
import { ProtectionDiagnostics } from '../components/control/ProtectionDiagnostics'
import { OfflineAccessStatus } from '../components/control/OfflineAccessStatus'
import { theme } from '../config/theme'
import { useOffline } from '../features/offline/OfflineProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { listDestination } from '../ui/controlScreens'
import { pendingSummary } from '../ui/pendingSummary'

export function OfflinePackagesScreen() {
  const offline = useOffline(), { controller } = useAuth(), router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const localAction = (action: () => Promise<void>) => { setMessage(null); void action().catch((e) => setMessage(e instanceof Error ? e.message : 'Operación bloqueada.')) }
  const summary = pendingSummary(offline.runtime !== null && !offline.busy, offline.syncItems, offline.incidentItems)
  return <Screen>
    <AppText variant="subtitle" accessibilityRole="header">Preparación y acceso sin conexión</AppText>
    <AppText>Tus listas se guardan cifradas en este dispositivo y se abren con una autorización vigente.</AppText>
    {offline.runtime && (offline.error || message) && <Notice tone="error" message={offline.error ?? message!} />}
    {!offline.runtime ? <Card>
      <OfflineAccessStatus />
    </Card> : <>
      <Card>
        <AppText variant="subtitle" accessibilityRole="header">Colas protegidas</AppText>
        <AppText>{summary ? `${summary.pending} operaciones por enviar · ${summary.attention} conflictos o rechazos` : 'Actualizando las colas protegidas…'}</AppText>
        <View style={s.actions}>
          <ActionButton secondary label="Ingresos y recibos" onPress={() => router.push('/offline/sync')} />
          <ActionButton secondary label="Incidencias locales y resultados" onPress={() => router.push('/offline/incidents')} />
        </View>
      </Card>
      {offline.busy && <LoadingState label="Hay una operación local en curso. Los estados de cada copia se muestran debajo." />}
      <ActionButton secondary label="Verificar vigencia de copias locales" disabled={offline.busy} onPress={() => localAction(offline.refresh)} />
      {offline.packages.length === 0 && !offline.busy && <EmptyState title="No hay listas descargadas"
        message="Abre un examen o colaboración autorizado con internet para preparar tu propia lista." />}
      {offline.packages.map((p) => <PackageCard key={p.id} record={p} online={!!controller?.offlineBinding()} busy={offline.busy}
        onOpen={() => router.push(listDestination(p.id))}
        onResume={() => { void offline.download(p.examId, p.id) }}
        onRevalidate={() => { void offline.download(p.examId, p.id) }} />)}
    </>}
    <ProtectionDiagnostics />
    <AppText variant="caption">Un registro local es provisional. Solo los recibos del servidor confirman su aceptación; cerrar sesión no sincroniza ni elimina los eventos cifrados.</AppText>
  </Screen>
}
const s = StyleSheet.create({ actions: { gap: theme.spacing.sm } })
