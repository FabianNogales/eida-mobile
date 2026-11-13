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
import { theme } from '../config/theme'
import { offlineLabWarning, offlineProtection } from '../config/offlineLab'
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
    <AppText>{offlineProtection.laboratory
      ? 'Tu lista se guarda cifrada en el almacén de laboratorio. Abrirla requiere una autorización local vigente.'
      : 'Tu lista se guarda protegida en este dispositivo. Abrirla requiere biometría y una autorización local vigente.'}</AppText>
    {offlineProtection.laboratory && <Notice tone="warning" message={offlineLabWarning} />}
    {(offline.error || message) && <Notice tone="error" message={offline.error ?? message!} />}
    {!offline.runtime ? <Card>
      <AppText variant="subtitle">Almacén bloqueado</AppText>
      <AppText>No se muestran listas, estudiantes ni cantidades personales hasta desbloquearlo.</AppText>
      <ActionButton label="Desbloquear almacén protegido" busy={offline.busy} onPress={() => { void offline.unlock() }} />
      <ProtectionDiagnostics />
      <Notice tone="info" message="Una copia vigente puede consultarse sin validar primero la sesión remota. Si reiniciaste el teléfono o se cerró la concesión local, puede ser necesaria una nueva validación con internet de la cuenta original." />
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
      <ActionButton secondary label="Bloquear consulta local" onPress={() => localAction(offline.lock)} />
    </>}
    <AppText variant="caption">Un registro local es provisional. Solo los recibos del servidor confirman su aceptación; cerrar sesión no sincroniza ni elimina los eventos cifrados.</AppText>
  </Screen>
}
const s = StyleSheet.create({ actions: { gap: theme.spacing.sm } })
