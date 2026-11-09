import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import { OfflineApi } from '../features/offline/api'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { ApiError } from '../services/http/errors'

export function OfflineDistributionScreen() {
  const params = useLocalSearchParams<{ examId: string }>(), { controller } = useAuth(), offline = useOffline(), router = useRouter()
  const examId = typeof params.examId === 'string' ? params.examId : ''
  const [preparing, setPreparing] = useState(false), [prepareError, setPrepareError] = useState<string | null>(null)
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
  const query = useRemoteQuery(load), c = query.data
  return <Screen>
    <Text style={s.title}>Distribución y mi lista</Text>
    <ActionButton secondary label="Consultar distribución en el servidor" busy={query.loading} onPress={query.refresh} />
    {query.error && <Notice message={query.error} />}
    {prepareError && <Notice message={prepareError} />}
    {offline.error && <Notice message={offline.error} />}
    <Text style={s.label}>Preparación: {offline.preparation.replaceAll('_', ' ')}</Text>
    {c && <>
      <Text style={s.subtitle}>{c.exam.name}</Text>
      <Text style={s.body}>{c.exam.subject_name} · {c.exam.exam_date} · {c.exam.start_time} · {c.exam.duration_minutes} min</Text>
      <Text style={s.body}>Ambiente: {c.exam.room?.name ?? 'No informado'}</Text>
      <Text style={s.label}>{c.distribution_id ? `Distribución ${c.distribution_id} · v${c.version} · CONGELADA` : 'Distribución no preparada'}</Text>
      {c.stale && <Notice message="DESACTUALIZADA: cambió el examen, la matrícula o la autorización. No se reasignan estudiantes ni se crea una versión 2 automáticamente." />}
      {c.unavailable_reason && <Notice message={`Operación bloqueada por el servidor: ${c.unavailable_reason}`} />}
      {c.lists.map((l) => <View style={s.card} key={l.list_id}>
        <Text style={s.subtitle}>{l.responsible_name ?? 'Responsable no informado'}</Text>
        <Text style={s.body}>Lista {l.list_id} · {l.student_count} estudiantes · {l.surname_range.from ?? '—'} a {l.surname_range.to ?? '—'}</Text>
        {l.list_id === c.own_list_id && <Text style={s.label}>Mi lista autorizada</Text>}
      </View>)}
      {c.can_prepare && <ActionButton label={c.frozen ? 'Comprobar preparación HU35' : 'Preparar listas exclusivas'} disabled={!!c.unavailable_reason} busy={preparing}
        onPress={() => { setPreparing(true); setPrepareError(null); void api().prepare(examId).then(query.refresh)
          .catch((e) => setPrepareError(e instanceof Error ? e.message : 'No se pudo preparar.')).finally(() => setPreparing(false)) }} />}
      {!c.own_list_id && <Notice message={c.can_prepare ? 'Puedes supervisar esta distribución. No tienes un paquete personal descargable.' : 'Todavía no tienes una lista asignada en esta distribución.'} />}
      {!offline.runtime && <ActionButton secondary label="Desbloquear almacenamiento seguro" busy={offline.busy} onPress={() => { void offline.unlock() }} />}
      {c.own_list_id && <ActionButton label="Preparar mi paquete offline" busy={offline.busy}
        disabled={!offline.runtime || c.stale || !!c.unavailable_reason} onPress={() => { void offline.download(examId) }} />}
    </>}
    <ActionButton secondary label="Ver paquetes y descargas locales" onPress={() => router.push('/offline')} />
    <Text style={s.body}>El reparto lo realiza HU35 en Laravel. Android recibe únicamente el paquete del usuario autorizado.</Text>
  </Screen>
}
