import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { ExamIcon } from '../components/general/ExamIcon'
import { TextAction } from '../components/general/TextAction'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { OfflineApi } from '../features/offline/api'
import { anchoredNow, nativeClock } from '../features/offline/clock'
import { sameBinding, type PackageRecord } from '../features/offline/contracts'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { ApiError } from '../services/http/errors'
import { listDestination, ownExamPackages } from '../ui/controlScreens'
import { preparationPresentation } from '../ui/entryPresentation'
import { examHeading } from '../ui/examPresentation'
import { tones } from '../ui/presentation'

export function PrepareOfflineScreen() {
  const { session } = useAuth()
  const params = useLocalSearchParams<{ examId: string }>()
  const examId = typeof params.examId === 'string' ? params.examId : ''
  return <Preparation key={`${session.user?.id}:${examId}`} examId={examId} />
}

function Preparation({ examId }: { examId: string }) {
  const { controller } = useAuth(), offline = useOffline(), router = useRouter(), runtime = offline.runtime
  const [running, setRunning] = useState(false), [attempted, setAttempted] = useState(false)
  const [verification, setVerification] = useState<{ runtime: typeof runtime; candidate: PackageRecord; record: PackageRecord | null; error: string | null } | null>(null)
  const work = useRef(false)
  const load = useCallback(async () => {
    if (!controller || !/^\d+$/.test(examId)) return null
    try {
      const context = await new OfflineApi(controller, () => { throw new Error('La consulta de contexto no utiliza fotografías.') }).context(examId)
      return String(context.exam.id) === examId ? context : null
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null
      throw error
    }
  }, [controller, examId])
  const query = useRemoteQuery(load), context = query.data
  const authorized = !!context?.own_list_id && !context.stale && !context.unavailable_reason
  const packages = context && authorized ? ownExamPackages(context, offline.packages, !!runtime) : []
  const latest = packages[0]
  const candidate = packages.find((pkg) => pkg.active && pkg.state === 'PREPARADO')
  useFocusEffect(useCallback(() => {
    if (!runtime || !candidate || running) return
    let current = true, timer: ReturnType<typeof setTimeout> | undefined
    const verify = async () => {
      try {
        const sample = await nativeClock.sample()
        const record = await runtime.repo.usable(candidate.id, sample)
        runtime.check()
        if (!current) return
        setVerification({ runtime, candidate, record, error: null })
        timer = setTimeout(() => { void verify() }, Math.max(1, Math.min(
          Date.parse(record.manifest.expires_at) - anchoredNow(record.anchor, sample), 2147483647)))
      } catch (error) {
        const record = await runtime.repo.package(candidate.id).catch(() => null)
        if (current) setVerification({ runtime, candidate, record, error: error instanceof Error ? error.message : 'No se pudo verificar la copia local.' })
      }
    }
    void verify()
    return () => { current = false; if (timer) clearTimeout(timer) }
  }, [runtime, candidate, running]))
  const currentCheck = verification && verification.runtime === runtime && verification.candidate === candidate ? verification : null
  const verified = currentCheck?.record ?? null
  const checkError = currentCheck?.error ?? null
  const checked = checkError ? null : verified
  const checking = !!candidate && !running && !currentCheck
  const count = context?.lists.find((list) => list.list_id === context.own_list_id)?.student_count ??
    checked?.manifest.students.length
  const downloading = running || (offline.busy && latest?.state === 'DESCARGANDO')
  const state = preparationPresentation({ authorized, unlocked: !!runtime, downloading,
    checked, latest: verified?.state === 'VENCIDO' ? verified : latest, failed: attempted })
  const working = checking || downloading
  const binding = controller?.offlineBinding()
  const canPrepare = !!(authorized && runtime && binding && sameBinding(binding, runtime.repo.binding))
  const start = async () => {
    if (work.current || !canPrepare || offline.busy) return
    work.current = true
    setRunning(true); setAttempted(false); setVerification(null)
    try {
      await offline.download(examId, latest?.state === 'INCOMPLETA' ? latest.id : undefined)
    } finally { work.current = false; setAttempted(true); setRunning(false) }
  }
  const heading = context ? examHeading(context.exam) : null
  const color = tones[state.tone]
  return <Screen>
    <QueryFeedback loading={query.loading} error={query.error} label="Consultando tu lista" retry={query.refresh} />
    {!query.loading && !query.error && <>
      {context && <View style={s.heading}>
        <AppText variant="label" style={s.exam}>{heading?.title}</AppText>
        {heading?.subtitle && <AppText variant="caption">{heading.subtitle}</AppText>}
        <AppText variant="title" accessibilityRole="header">Mi lista asignada</AppText>
        {authorized && count != null && <AppText style={s.muted}>{count} estudiantes</AppText>}
      </View>}
      <Card style={s.state}>
        <View style={[s.mark, { backgroundColor: color.background }]}>
          {working ? <ActivityIndicator color={theme.colors.primary} importantForAccessibility="no" />
            : state.ready ? <AppText importantForAccessibility="no" style={{ color: color.foreground, fontSize: 26 }}>✓</AppText>
              : <ExamIcon name={state.tone === 'error' || !authorized ? 'alert' : 'download'} color={color.foreground} />}
        </View>
        <AppText variant="subtitle" accessibilityLiveRegion="polite" style={s.center}>{checking ? 'Comprobando lista' : state.label}</AppText>
        {!checking && <AppText style={[s.center, s.muted]}>{state.message}</AppText>}
      </Card>
      {(checkError || (authorized && offline.error)) && <Notice tone="error" message={checkError ?? offline.error!} />}
      {state.ready && checked && latest?.state === 'INCOMPLETA' && latest.id !== checked.id &&
        <Notice message="La descarga nueva quedó incompleta. Tu copia anterior sigue disponible." />}
      {authorized && (!runtime ? <ActionButton label="Desbloquear mi lista" busy={offline.busy} onPress={() => { void offline.unlock() }} />
        : state.ready && checked ? <>
          <ActionButton label="Ir al control de ingreso" icon={<ExamIcon name="qr" color={theme.colors.onPrimary} />}
            disabled={offline.busy} onPress={() => router.push(listDestination(checked.id))} />
          <TextAction label={latest?.state === 'INCOMPLETA' ? 'Reintentar preparación' : 'Preparar una copia nueva'}
            disabled={!canPrepare || offline.busy} onPress={() => { void start() }} />
        </> : <ActionButton label={attempted || latest?.state === 'INCOMPLETA' ? 'Reintentar preparación' : 'Preparar lista'}
          busy={running} disabled={checking || !canPrepare || offline.busy} onPress={() => { void start() }} />)}
      {authorized && !!runtime && !canPrepare && !state.ready && <Notice message="Valida tu sesión con conexión para preparar la lista." />}
    </>}
  </Screen>
}

const s = StyleSheet.create({
  heading: { gap: theme.spacing.xs }, exam: { color: theme.colors.accent }, muted: { color: theme.colors.muted },
  state: { alignItems: 'center', paddingVertical: theme.spacing.xxxl }, center: { textAlign: 'center' },
  mark: { width: 56, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
})
