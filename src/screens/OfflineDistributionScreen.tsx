import { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { StatusBadge } from '../components/StatusBadge'
import { DistributionListCard } from '../components/control/DistributionListCard'
import { ExamHero } from '../components/control/ExamHero'
import { PreparationStatus } from '../components/control/PreparationStatus'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import { OfflineApi } from '../features/offline/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { ApiError } from '../services/http/errors'
import { distributionAccess, examPendingSummary, listDestination, ownExamPackages, scanDestination } from '../ui/controlScreens'
import { laPazInstant } from '../utils/dates'

export function OfflineDistributionScreen() {
  const params = useLocalSearchParams<{ examId: string }>(), { session } = useAuth()
  const examId = typeof params.examId === 'string' ? params.examId : ''
  return <DistributionView key={String(session.user?.id) + ':' + examId} examId={examId} />
}
function DistributionView({ examId }: { examId: string }) {
  const { controller } = useAuth(), offline = useOffline(), router = useRouter()
  const [preparing, setPreparing] = useState(false), [prepareError, setPrepareError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const api = useCallback(() => new OfflineApi(controller!, offline.runtime?.digest ?? (() => { throw new Error('Desbloquea primero el almacén.')})), [controller, offline.runtime])
  const load = useCallback(async () => {
    const context = await api().context(examId).catch(async (error: unknown) => {
      if (error instanceof ApiError && error.status === 403 && offline.runtime) {
        for (const p of await offline.runtime.repo.list()) if (p.examId === examId) await offline.runtime.repo.setState(p.id, 'DESACTUALIZADO')
        await offline.refresh()
      }
      throw error
    })
    // Keep the established owner-only assignments endpoint; never request it as collaborator.
    if (context.can_prepare && context.distribution_id) await api().assignments(examId)
    if ((context.stale || context.unavailable_reason) && offline.runtime) {
      for (const p of await offline.runtime.repo.list()) if (p.examId === examId) await offline.runtime.repo.setState(p.id, 'DESACTUALIZADO')
      await offline.refresh()
    }
    return context
  }, [api, examId, offline.runtime, offline.refresh])
  const query = useRemoteQuery(load)
  const c = query.data && String(query.data.exam.id) === examId ? query.data : null
  const access = c ? distributionAccess(c, offline.runtime !== null) : null
  const own = c ? ownExamPackages(c, offline.packages, offline.runtime !== null) : []
  const local = own.find((p) => p.active && p.state === 'PREPARADO')
  const latest = own[0]
  const canOpen = !!(local && access?.download)
  const summary = examPendingSummary(examId, offline.runtime !== null && !offline.busy, offline.syncItems, offline.incidentItems)
  const download = async () => {
    setDownloading(true)
    try { await offline.download(examId) } finally { setDownloading(false) }
  }
  return <Screen>
    <ActionButton secondary label="Actualizar examen y autorización" busy={query.loading} onPress={query.refresh} />
    <QueryFeedback loading={query.loading} error={query.error} label="Consultando examen y distribución" retry={query.refresh} />
    {prepareError && <Notice tone="error" message={prepareError} />}
    {offline.error && <Notice tone="error" message={offline.error} />}
    {c && access && <>
      <ExamHero exam={c.exam} relation={access.supervise ? 'Supervisión de distribución autorizada' : c.own_list_id ? 'Acceso a lista propia asignada' : 'Sin lista personal asignada'} />
      {c.stale && <Notice message="Distribución desactualizada: cambió el examen, la matrícula o la autorización. No se reasignan estudiantes ni se crea otra versión automáticamente." />}
      {c.unavailable_reason && <Notice tone="error" message={`Operación bloqueada por el servidor: ${c.unavailable_reason}`} />}
      <Card>
        <AppText variant="subtitle" accessibilityRole="header">Mi lista y control</AppText>
        {offline.runtime && offline.busy && !downloading && !latest ? <StatusBadge label="Comprobando estado local" tone="info" /> : offline.runtime || downloading ? <PreparationStatus state={downloading ? 'DESCARGANDO' : latest?.state ?? 'NO_DESCARGADO'} active={latest?.active} />
          : <StatusBadge label="Estado local desconocido · almacén bloqueado" />}
        {local && latest && local.id !== latest.id && <Notice tone="info" message="Se conserva una copia activa anterior mientras la nueva preparación termina. Su vigencia se comprueba al abrirla." />}
        {c.own_list_id ? <>
          <AppText>Lista asignada: {c.own_list_id}{access.ownList ? ` · ${access.ownList.student_count} estudiantes autorizados` : ''}</AppText>
          {!offline.runtime && <Notice message="Desbloquea el almacén antes de consultar copias locales. El estado de descarga no se puede comprobar mientras está bloqueado." />}
          {canOpen && local && <>
            <ActionButton label="Ver mi lista" disabled={offline.busy} onPress={() => router.push(listDestination(local.id))} />
            <ActionButton secondary label="Buscar estudiante" disabled={offline.busy} onPress={() => router.push(listDestination(local.id, true))} />
            <ActionButton secondary label="Escanear QR" disabled={offline.busy || !local.manifest.qr.available} onPress={() => router.push(scanDestination(local.id))} />
            {!local.manifest.qr.available && <AppText>QR v3 no disponible para esta copia. La identificación manual sigue disponible.</AppText>}
          </>}
          <ActionButton label={local ? 'Actualizar mi paquete con internet' : 'Preparar mi paquete offline'} busy={downloading}
            disabled={!access.download || !controller?.offlineBinding() || offline.busy} onPress={() => { void download() }} />
        </> : <EmptyState title={access.supervise ? 'Supervisión sin paquete personal' : 'Sin lista asignada'}
          message={access.supervise ? 'Puedes revisar la distribución. Esto no concede acceso a los estudiantes asignados a otros responsables.' : 'El servidor aún no te asignó una lista propia en esta distribución.'} />}
        {!offline.runtime && <ActionButton secondary label="Desbloquear almacén protegido" busy={offline.busy} onPress={() => { void offline.unlock() }} />}
        <ActionButton secondary label="Paquetes, descarga y recuperación" onPress={() => router.push('/offline')} />
      </Card>
      <Card>
        <AppText variant="subtitle" accessibilityRole="header">Operaciones de este examen</AppText>
        <AppText>{summary ? `${summary.pending} por enviar · ${summary.attention} conflictos o rechazos` : offline.runtime ? 'Actualizando los pendientes locales…' : 'Desbloquea el almacén para consultar los pendientes locales.'}</AppText>
        <ActionButton secondary label="Consultar sincronización y recibos" onPress={() => router.push('/offline/sync')} />
        <ActionButton secondary label="Consultar incidencias y permisos" onPress={() => router.push({ pathname: '/(private)/incidents', params: { examId } })} />
        <AppText variant="caption">Estas pantallas comprueban sus permisos. Una copia preparada no concede atribuciones disciplinarias ni confirma ingresos.</AppText>
      </Card>
      <View style={s.section}>
        <AppText variant="subtitle" accessibilityRole="header">{access.supervise ? 'Distribución de listas' : 'Asignación personal'}</AppText>
        <StatusBadge label={c.frozen ? 'Distribución congelada' : 'Distribución sin congelar'} tone={c.stale ? 'warning' : 'neutral'} />
        <AppText>{c.distribution_id ? `Distribución ${c.distribution_id} · versión ${c.version}` : 'Distribución aún no preparada'}</AppText>
        {c.prepared_at && <AppText>Preparación conocida: {laPazInstant(c.prepared_at)}</AppText>}
        {access.lists.map((list) => <DistributionListCard key={list.list_id} list={list} own={list.list_id === c.own_list_id} />)}
        {access.lists.length === 0 && <AppText>No hay listas visibles para esta autorización.</AppText>}
        {c.can_prepare && <ActionButton secondary label={c.frozen ? 'Comprobar preparación HU35' : 'Preparar distribución en el servidor'} disabled={!access.prepare || offline.busy} busy={preparing}
          onPress={() => { setPreparing(true); setPrepareError(null); void api().prepare(examId).then(query.refresh)
            .catch((e) => setPrepareError(e instanceof Error ? e.message : 'No se pudo preparar.')).finally(() => setPreparing(false)) }} />}
        <AppText variant="caption">HU35 realiza el reparto en Laravel. Android reutiliza esa operación; no redistribuye estudiantes ni permite descargar listas de otros responsables.</AppText>
      </View>
    </>}
    {!c && !query.loading && !query.error && <Notice message="No hay un contexto autorizado disponible para este examen." />}
  </Screen>
}
const s = StyleSheet.create({ section: { gap: theme.spacing.md } })
