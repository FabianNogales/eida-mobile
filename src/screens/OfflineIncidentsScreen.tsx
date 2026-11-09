import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useOffline } from '../features/offline/OfflineProvider'
import { deliveryLabels, incidentTypes, infractionTypes } from '../features/incidents/contracts'
import { incidentErrorLabels } from '../features/incidents/sync'
import type { InfractionDraft } from '../features/incidents/repository'
import { laPazInstant } from '../utils/dates'

export function OfflineIncidentsScreen() {
  const offline = useOffline(), r = offline.runtime, router = useRouter(), params = useLocalSearchParams<{ eventId?: string }>()
  const [focused, setFocused] = useState(false), [drafts, setDrafts] = useState<{ runtime: typeof r; items: InfractionDraft[] } | null>(null)
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setDrafts(null) } }, []))
  useEffect(() => {
    let current = true; setDrafts(null)
    if (r && focused) void r.incidents.drafts().then((items) => { r.check(); if (current) setDrafts({ runtime: r, items }) }).catch(() => {})
    return () => { current = false }
  }, [r, focused])
  if (!r) return <Screen><Notice message="Desbloquea el almacén con biometría. Las incidencias pendientes siguen cifradas." /><ActionButton label="Desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (!focused) return <Screen><Text>Consulta detenida.</Text></Screen>
  const items = params.eventId ? offline.incidentItems.filter((item) => item.event.event_id === params.eventId) : offline.incidentItems
  return <Screen><Text style={s.title}>Incidencias locales y resultados</Text>
    <Notice message="Registrar un reporte no confirma una infracción ni aplica sanciones. El envío necesita internet y la cuenta/dispositivo originales; los pendientes se conservan al perder conexión." />
    {offline.error && <Notice message={offline.error} />}
    <ActionButton label="Sincronizar incidencias con Laravel" busy={offline.busy} onPress={() => { void offline.synchronizeIncidents() }} />
    <ActionButton secondary label="Actualizar estados locales" onPress={() => { void offline.refresh().catch(() => {}) }} />
    {!items.length && <Text style={s.body}>No hay incidencias para esta consulta local.</Text>}
    {items.map(({ event: e, receipt, state, attempts, errorCode }) => <View key={e.event_id} style={s.card}>
      <Text style={s.subtitle}>{incidentTypes.find((type) => type.value === e.type)?.label}</Text>
      <Text style={s.label}>{deliveryLabels[state]}</Text><Text style={s.body}>{e.description}</Text>
      <Text style={s.body}>Examen {e.exam_id} · estudiante {e.student_id ?? 'sin relación individual'} · actor original {e.actor_id}</Text>
      <Text style={s.body}>Captura declarada: {laPazInstant(e.captured_at)} · UUID {e.event_id} · intentos {attempts}</Text>
      {errorCode && <Notice message={incidentErrorLabels[errorCode] ?? 'Envío pendiente de revisión; el contenido original se conserva.'} />}
      {receipt && <Notice message={receipt.status === 'REGISTERED' ? `Laravel confirmó el reporte ${receipt.incident_id}. Recepción: ${laPazInstant(receipt.received_at)}. No constituye una infracción confirmada.${receipt.review_required ? ' Requiere revisión por recepción tardía.' : ''}` : `Laravel conservó un resultado ${deliveryLabels[receipt.status].toLowerCase()}. Código técnico: ${receipt.code}. No hay reporte oficial nuevo confirmado.`} />}
      {receipt?.incident_id && <ActionButton secondary label="Consultar detalle oficial online" onPress={() => router.push({ pathname: '/(private)/incident', params: { examId: e.exam_id, incidentId: String(receipt.incident_id) } })} />}
    </View>)}
    {drafts?.runtime === r && !params.eventId && drafts.items.map((draft) => <View key={draft.id} style={s.card}>
      <Text style={s.subtitle}>BORRADOR LOCAL · {infractionTypes.find((type) => type.value === draft.type)?.label}</Text>
      <Text style={s.body}>{draft.description}</Text><Text style={s.body}>Examen {draft.examId} · estudiante {draft.studentId} · {laPazInstant(draft.capturedAt)}</Text>
      <Notice message="No está registrado como infracción. No se sincroniza automáticamente. El docente debe revisar y registrar online con la autorización actual." />
      <ActionButton secondary label="Revisar y registrar online" onPress={() => router.push({ pathname: '/(private)/infractions', params: { examId: draft.examId, draftId: draft.id } })} />
    </View>)}
    {params.eventId && <ActionButton secondary label="Ver todas las incidencias locales" onPress={() => router.replace('/offline/incidents')} />}
    <ActionButton secondary label="Paquetes protegidos" onPress={() => router.replace('/offline')} />
  </Screen>
}
