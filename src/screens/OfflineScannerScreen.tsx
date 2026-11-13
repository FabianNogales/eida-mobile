import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { Card } from '../components/Card'
import { LoadingState } from '../components/FeedbackStates'
import { EntryResult, EntryReview } from '../components/control/EntryReview'
import { OfflineAccessStatus } from '../components/control/OfflineAccessStatus'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { goBack } from '../navigation/back'
import { listDestination } from '../ui/controlScreens'
import { scanIssue } from '../ui/entryPresentation'
import { examHeading } from '../ui/examPresentation'
import { useOffline } from '../features/offline/OfflineProvider'
import { nativeClock } from '../features/offline/clock'
import { QrScanSession, type QrScanState } from '../features/scanner/scanSession'
import type { NativeQrCameraProps } from '../features/scanner/NativeQrCamera'
import type { VaultRuntime } from '../features/offline/nativeVault'

interface ScanView { session: QrScanSession; state: QrScanState; runtime: VaultRuntime; packageId: string }
export function OfflineScannerScreen() {
  const { packageId: param } = useLocalSearchParams<{ packageId: string }>(), router = useRouter(), offline = useOffline()
  const packageId = typeof param === 'string' ? param : '', runtime = offline.runtime
  const [focused, setFocused] = useState(false)
  const [foreground, setForeground] = useState(() => AppState.currentState == null || AppState.currentState === 'active')
  const [view, setView] = useState<ScanView | null>(null), sessionRef = useRef<QrScanSession | null>(null)
  const [granted, setGranted] = useState(false)
  const [Camera, setCamera] = useState<ComponentType<NativeQrCameraProps> | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const started = useRef<QrScanSession | null>(null)
  const cameraAllowed = !!view && view.session === sessionRef.current && view.runtime === runtime &&
    view.packageId === packageId && !['checking', 'blocked', 'closed'].includes(view.state.phase)

  useFocusEffect(useCallback(() => {
    setFocused(true)
    return () => { sessionRef.current?.close(); sessionRef.current = null; setFocused(false) }
  }, []))
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { sessionRef.current?.close(); sessionRef.current = null }
      setForeground(state === 'active')
    })
    return () => sub.remove()
  }, [])
  useEffect(() => {
    setView(null); setGranted(false)
    if (!runtime || !packageId || !focused || !foreground) return
    let current = true, timer: ReturnType<typeof setTimeout> | undefined
    const session = new QrScanSession(packageId, {
      ...runtime, sample: () => nativeClock.sample(),
      photoUri: async (bytes, mime) => {
        const { Buffer } = await import('react-native-quick-crypto')
        return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
      },
    }, (state) => { if (current) setView({ session, state, runtime, packageId }) })
    sessionRef.current = session
    setView({ session, state: session.state, runtime, packageId })
    const check = async () => {
      const remaining = await session.revalidate()
      if (current && remaining !== null) timer = setTimeout(() => { void check() }, Math.max(1, Math.min(remaining, 1000)))
    }
    void check()
    return () => {
      current = false; if (timer) clearTimeout(timer)
      session.close(); if (sessionRef.current === session) sessionRef.current = null
    }
  }, [runtime, packageId, focused, foreground])
  useEffect(() => {
    if (!cameraAllowed || !focused || !foreground) return
    let current = true
    setCameraError(null)
    void import('../features/scanner/NativeQrCamera').then((module) => {
      if (current) setCamera(() => module.NativeQrCamera)
    }).catch(() => {
      if (current) setCameraError('No se pudo cargar la cámara de esta instalación. Puedes buscar al estudiante manualmente.')
    })
    return () => { current = false }
  }, [cameraAllowed, focused, foreground])

  const session = view?.session
  usePreventRemove(!!runtime && view?.runtime === runtime && view?.state.phase === 'saving')
  const onAccess = useCallback((allowed: boolean) => { session?.cameraAccess(allowed); setGranted(allowed) }, [session])
  const onReady = useCallback((scanId: number) => session?.cameraReady(scanId), [session])
  const onDetection = useCallback((scanId: number, detection: Parameters<QrScanSession['detect']>[1]) => {
    if (session) void session.detect(scanId, detection)
  }, [session])
  const onFailure = useCallback((scanId: number) => session?.cameraFailed(scanId), [session])
  useEffect(() => {
    if (!session || session !== sessionRef.current || view?.state.phase !== 'idle' || !focused || !foreground ||
        !Camera || !granted || cameraError || started.current === session) return
    started.current = session
    session.start()
  }, [session, view?.state.phase, focused, foreground, Camera, granted, cameraError])

  if (!packageId) return <Screen><Notice message="Abre el escáner desde una lista autorizada." />
    <ActionButton label="Ver paquetes" onPress={() => router.replace('/offline')} /></Screen>
  if (!runtime) return <Screen><OfflineAccessStatus loadingLabel="Abriendo tu lista" />
    <TextAction label="Buscar manualmente" onPress={() => router.dismissTo(listDestination(packageId, true))} /></Screen>
  if (!focused || !foreground || !view || view.runtime !== runtime || view.packageId !== packageId) {
    return <Screen><LoadingState label="Preparando escáner" /></Screen>
  }
  const state = view.state
  const close = () => { view.session.close(); goBack(router, listDestination(packageId)) }
  const search = () => { view.session.close(); router.dismissTo(listDestination(packageId, true)) }
  const result = state.phase === 'saved' || state.phase === 'duplicate' ? state : null
  const reviewing = state.phase === 'review' || state.phase === 'saving'
  const title = result ? 'Resultado del ingreso' : reviewing ? 'Revisar ingreso' : 'Escanear QR'
  const exam = offline.packages.find((p) => p.id === packageId)?.manifest.exam
  const heading = exam ? examHeading(exam) : null
  const examName = heading ? [heading.title, heading.subtitle].filter(Boolean).join(' · ') : 'Examen de tu lista'
  const cameraActive = state.phase === 'idle' || state.phase === 'scanning' || state.phase === 'error'
  const showPreview = state.phase === 'scanning' || (cameraActive && (!granted || !!cameraError))
  return <Screen>
    <Stack.Screen options={{ title, headerBackVisible: state.phase !== 'saving', gestureEnabled: state.phase !== 'saving' }} />
    {state.phase === 'checking' && <LoadingState label="Comprobando tu lista" />}
    {(state.phase === 'error' || state.phase === 'blocked') && <Notice tone="error" message={scanIssue(state.message)} />}
    <Card style={showPreview ? s.panel : s.hidden}>
      <View style={s.camera} importantForAccessibility={showPreview ? 'auto' : 'no-hide-descendants'}>
        {showPreview && !Camera && !cameraError && <LoadingState label="Preparando cámara" />}
        {showPreview && cameraError && <Notice tone="error" message={cameraError} />}
        {Camera && !cameraError && cameraAllowed &&
          <Camera scanId={state.phase === 'scanning' ? state.scanId : null}
            onAccess={onAccess} onReady={onReady} onDetection={onDetection} onFailure={onFailure} />}
        {granted && state.phase === 'scanning' && !cameraError && <View pointerEvents="none" accessible={false}
          importantForAccessibility="no-hide-descendants" style={s.guide} />}
      </View>
    </Card>
    {cameraActive && state.phase !== 'scanning' && !!Camera && granted && !cameraError &&
      <ActionButton label={state.phase === 'error' ? 'Reintentar escaneo' : 'Iniciar escaneo'} onPress={() => { view.session.start() }} />}
    {(state.phase === 'detected' || state.phase === 'verifying') && <LoadingState label="Verificando QR" />}
    {state.phase === 'saving' && <LoadingState label="Guardando ingreso" />}
    {state.phase === 'review' && <EntryReview student={state.identity.student} photos={state.identity.photos} exam={examName}
      method="QR" onCancel={close} onConfirm={() => {
        void view.session.confirm().then((saved) => { if (saved) void offline.refresh().catch(() => {}) })
      }} />}
    {result && <>
      <EntryResult event={result.event} item={offline.syncItems.find((row) => row.eventId === result.event.event_id)}
        duplicate={result.phase === 'duplicate'} onContinue={close} />
      {granted && <TextAction label="Escanear otro QR" onPress={() => { view.session.start() }} />}
    </>}
    {!result && !reviewing && <>
      <ActionButton secondary label="Buscar manualmente" onPress={search} />
      <TextAction label="Cancelar" onPress={close} />
    </>}
  </Screen>
}
const s = StyleSheet.create({
  panel: { padding: theme.spacing.md },
  hidden: { display: 'none' },
  camera: { position: 'relative', gap: theme.spacing.md },
  // The unchanged native adapter renders a 300 dp preview. This decorative guide
  // sits inside that preview; it is never a detection/cropping constraint.
  guide: { position: 'absolute', left: theme.spacing.xl, right: theme.spacing.xl, bottom: theme.spacing.xxl,
    height: 252, borderWidth: 2, borderColor: theme.colors.onPrimary, borderRadius: theme.radius.card },
})
