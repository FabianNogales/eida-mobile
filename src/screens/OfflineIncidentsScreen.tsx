import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { Notice } from '../components/Notice'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { infractionTypes } from '../features/incidents/contracts'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { laPazInstant } from '../utils/dates'
import { PendingQueues } from './PendingOverviewScreen'

export function OfflineIncidentsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>(), router = useRouter()
  const id = typeof eventId === 'string' ? eventId : undefined
  return <PendingQueues only="incidents" eventId={id} footer={id
    ? <TextAction label="Ver todas las incidencias" onPress={() => router.replace('/offline/incidents')} />
    : <LocalDrafts />} />
}

function LocalDrafts() {
  const offline = useOffline(), runtime = offline.runtime, { controller } = useAuth(), router = useRouter()
  const focused = useIsFocused()
  const load = useCallback(async () => {
    if (!runtime || !focused) return null
    const drafts = await runtime.incidents.drafts()
    runtime.check()
    return drafts
  }, [runtime, focused, offline.incidentItems])
  const query = useRemoteQuery(load)
  if (!runtime || !focused) return null
  return <View style={s.drafts}>
    {query.error && <><Notice message="No se pudieron leer los borradores protegidos." />
      <TextAction label="Reintentar lectura de borradores" onPress={() => { void query.reload() }} /></>}
    {query.data && query.data.length > 0 && <AppText variant="label" accessibilityRole="header">Borradores de infracción</AppText>}
    {query.data?.map((draft) => <Card key={draft.id}>
      <AppText variant="label">{infractionTypes.find(({ value }) => value === draft.type)?.label}</AppText>
      <AppText variant="caption">Borrador local · sin envío automático</AppText>
      <AppText>{draft.description}</AppText>
      <AppText variant="caption">Examen {draft.examId} · estudiante {draft.studentId} · {laPazInstant(draft.capturedAt)}</AppText>
      <ActionButton secondary label="Solicitar revisión docente online" disabled={!controller?.offlineBinding()}
        onPress={() => router.push({ pathname: '/(private)/infractions', params: { examId: draft.examId, draftId: draft.id } })} />
    </Card>)}
    <TextAction label="Paquetes protegidos" onPress={() => router.replace('/offline')} />
  </View>
}

const s = StyleSheet.create({ drafts: { gap: theme.spacing.md } })
