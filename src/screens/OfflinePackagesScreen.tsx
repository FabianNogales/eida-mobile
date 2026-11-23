import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { PackageCard } from '../components/control/PackageCard'
import { OfflineAccessStatus } from '../components/control/OfflineAccessStatus'
import { theme } from '../config/theme'
import { useOffline } from '../features/offline/OfflineProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { listDestination } from '../ui/controlScreens'
import { pendingSummary } from '../ui/pendingSummary'
import { OfflineApi } from '../features/offline/api'
import { currentDistribution } from '../features/offline/distribution'
import { nativeClock } from '../features/offline/clock'
import { ApiError } from '../services/http/errors'
import { useNetwork } from '../features/connectivity/NetworkProvider'

export function OfflinePackagesScreen() {
  const offline = useOffline(), { controller } = useAuth(), router = useRouter()
  const network = useNetwork()
  const [message, setMessage] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const working = useRef(false)
  const localAction = (action: () => Promise<void>) => {
    if (working.current || offline.busy) return
    working.current = true; setMessage(null); setChecking(true)
    void action().catch((e) => setMessage(e instanceof Error ? e.message : 'No se pudo abrir la lista. Reintenta con internet.'))
      .finally(() => { working.current = false; setChecking(false) })
  }
  const openCopy = async (id: string) => {
    const runtime = offline.runtime
    if (!runtime) return
    const copy = await runtime.repo.package(id)
    if (controller?.offlineBinding() && network !== 'offline') {
      try { await currentDistribution(new OfflineApi(controller, runtime.digest), runtime.repo, copy.examId) }
      catch (error) {
        // Losing connectivity does not erase a still-authorized offline copy.
        if (!(error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout'))) throw error
      } finally { await offline.refresh() }
    }
    await runtime.repo.usable(id, await nativeClock.sample())
    runtime.check()
    router.push(listDestination(id))
  }
  const summary = pendingSummary(offline.runtime !== null && !offline.busy, offline.syncItems, offline.incidentItems)
  return <Screen>
    <AppText variant="subtitle" accessibilityRole="header">Listas descargadas</AppText>
    <AppText>Abre una lista preparada o actualiza la copia de un examen con internet.</AppText>
    {offline.runtime && (offline.error || message) && <Notice tone="error" message={offline.error ?? message!} />}
    {!offline.runtime ? <Card>
      <OfflineAccessStatus />
    </Card> : <>
      <Card>
        <AppText variant="subtitle" accessibilityRole="header">Pendientes</AppText>
        <AppText>{summary ? `${summary.pending} por enviar · ${summary.attention} por revisar` : 'Consultando pendientes…'}</AppText>
        <View style={s.actions}>
          <ActionButton secondary label="Ver ingresos pendientes" onPress={() => router.push('/offline/sync')} />
          <ActionButton secondary label="Ver reportes y resultados" onPress={() => router.push('/offline/incidents')} />
        </View>
      </Card>
      {offline.busy && <LoadingState label="Hay una operación local en curso. Los estados de cada copia se muestran debajo." />}
      <ActionButton secondary label="Revisar listas descargadas" busy={checking} disabled={offline.busy} onPress={() => localAction(offline.refresh)} />
      {offline.packages.length === 0 && !offline.busy && <EmptyState title="No hay listas descargadas"
        message="Abre un examen o colaboración autorizado con internet para preparar tu propia lista." />}
      {offline.packages.map((p) => <PackageCard key={p.id} record={p} online={!!controller?.offlineBinding() && network !== 'offline'} busy={offline.busy || checking}
        onOpen={() => localAction(() => openCopy(p.id))}
        onResume={() => router.push({ pathname: '/(private)/prepare-offline', params: { examId: p.examId } })}
        onRevalidate={() => router.push({ pathname: '/(private)/prepare-offline', params: { examId: p.examId } })} />)}
    </>}
    <AppText variant="caption">Actualizar una copia no elimina tus ingresos ni reportes pendientes. Envíalos desde Pendientes cuando tengas internet.</AppText>
  </Screen>
}
const s = StyleSheet.create({ actions: { gap: theme.spacing.sm } })
