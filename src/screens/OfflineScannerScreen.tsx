import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { LoadingState } from '../components/FeedbackStates'
import { OperationState } from '../components/operations/OperationState'
import { ScanIdentityCard } from '../components/operations/ScanIdentityCard'
import { theme } from '../config/theme'
import { goBack } from '../navigation/back'
import { listDestination } from '../ui/controlScreens'
import { scanPresentation } from '../ui/operations'
import { useOffline } from '../features/offline/OfflineProvider'
import { nativeClock } from '../features/offline/clock'
import { QrScanSession, type QrScanState } from '../features/scanner/scanSession'
import type { NativeQrCameraProps } from '../features/scanner/NativeQrCamera'
import type { VaultRuntime } from '../features/offline/nativeVault'

interface ScanView { session: QrScanSession; state: QrScanState; runtime: VaultRuntime; packageId: string }
export function OfflineScannerScreen() {
  const { packageId: param } = useLocalSearchParams<{ packageId: string }>(), router = useRouter(), offline = useOffline()
  const packageId = typeof param === 'string' ? param : '', runtime = offline.runtime
  const [focused, setFocused] = useState(false), [foreground, setForeground] = useState(AppState.currentState === 'active')
  const [view, setView] = useState<ScanView | null>(null), sessionRef = useRef<QrScanSession | null>(null)
  const [granted, setGranted] = useState(false)
  const [Camera, setCamera] = useState<ComponentType<NativeQrCameraProps> | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

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
    if (!runtime || !focused || !foreground) return
    let current = true
    setCameraError(null)
    void import('../features/scanner/NativeQrCamera').then((module) => {
      if (current) setCamera(() => module.NativeQrCamera)
    }).catch(() => { if (current) setCameraError('La cámara no está disponible en esta instalación. Utiliza la consulta manual y solicita revisar la aplicación.') })
    return () => { current = false }
  }, [runtime, focused, foreground])

  const session = view?.session
  const onAccess = useCallback((allowed: boolean) => { session?.cameraAccess(allowed); setGranted(allowed) }, [session])
  const onReady = useCallback((scanId: number) => session?.cameraReady(scanId), [session])
  const onDetection = useCallback((scanId: number, detection: Parameters<QrScanSession['detect']>[1]) => {
    if (session) void session.detect(scanId, detection)
  }, [session])
  const onFailure = useCallback((scanId: number) => session?.cameraFailed(scanId), [session])

  if (!runtime) return <Screen><Notice message="El almacén está bloqueado. Desbloquea el almacén protegido antes de escanear. Si el permiso de cámara interrumpió la aplicación, vuelve a desbloquearlo." />
    <ActionButton label="Ir al desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (!packageId) return <Screen><Notice message="Falta la referencia de la lista descargada." />
    <ActionButton label="Ver paquetes" onPress={() => router.replace('/offline')} /></Screen>
  if (!focused || !foreground || !view || view.runtime !== runtime || view.packageId !== packageId) return <Screen><AppText>Escáner detenido.</AppText></Screen>
  const state = view.state
  const identity = state.phase === 'review' || state.phase === 'duplicate' || state.phase === 'saved' ? state.identity : null
  const event = state.phase === 'duplicate' || state.phase === 'saved' ? state.event : null
  const receipt = event ? offline.syncItems.find((item) => item.eventId === event.event_id)?.receipt : null
  const permitted = !['checking', 'blocked', 'closed'].includes(state.phase)
  const canStart = ['idle', 'error', 'review', 'duplicate', 'saved'].includes(state.phase)
  return <Screen>
    <AppText variant="subtitle" accessibilityRole="header">Lectura segura de identidad</AppText>
    <AppText>Enfoca un único QR. La lectura se pausa para verificarlo; detectar un código no registra un ingreso.</AppText>
    <OperationState {...scanPresentation(state)} />
    {state.phase === 'checking' && <LoadingState label="Comprobando acceso al paquete" />}
    {(state.phase === 'error' || state.phase === 'blocked') && <Notice tone="error" message={state.message} />}
    {permitted && <>
      <Card>
        <View style={s.camera}>
          {!Camera && !cameraError && <LoadingState label="Preparando cámara nativa" />}
          {cameraError ? <Notice tone="error" message={cameraError} /> : Camera && <Camera scanId={state.phase === 'scanning' ? state.scanId : null}
            onAccess={onAccess} onReady={onReady} onDetection={onDetection} onFailure={onFailure} />}
          {granted && state.phase === 'scanning' && !cameraError && <View pointerEvents="none" accessible={false}
            importantForAccessibility="no-hide-descendants" style={s.guide} />}
        </View>
        {canStart && <ActionButton label={state.phase === 'idle' ? 'Iniciar escaneo' : 'Escanear otro código'}
          disabled={!Camera || !granted || !!cameraError} onPress={() => { view.session.start() }} />}
      </Card>
      {(state.phase === 'detected' || state.phase === 'verifying') && <LoadingState label="Verificando firma, vigencia, examen y pertenencia a tu lista" />}
      {state.phase === 'saving' && <LoadingState label="Guardando evidencia provisional" />}
      {identity && <ScanIdentityCard identity={identity}
        examName={offline.packages.find((p) => p.id === packageId)?.manifest.exam.name ?? 'Examen del paquete autorizado'}
        review={state.phase === 'review'} event={event} receipt={receipt}
        onCancel={() => view.session.cancel()} onConfirm={() => {
          void view.session.confirm().then((saved) => { if (saved) void offline.refresh().catch(() => {}) })
        }} />}
      {state.phase === 'duplicate' && <Notice message="Ya existe una operación local. Se conservan su UUID y evidencia; no se crea otro evento." />}
      {!['idle', 'saving', 'review'].includes(state.phase) && <ActionButton secondary label="Cancelar lectura" onPress={() => view.session.cancel()} />}
    </>}
    <Notice tone="info" message="QR v2 no se autentica offline. Puedes usar la consulta manual. Las revocaciones posteriores a la descarga pueden desconocerse." />
    <ActionButton secondary label="Volver al origen" disabled={state.phase === 'saving'} onPress={() => {
      view.session.close(); goBack(router, listDestination(packageId))
    }} />
  </Screen>
}
const s = StyleSheet.create({
  camera: { position: 'relative', gap: theme.spacing.md },
  // The unchanged native adapter renders a 300 dp preview. This decorative guide
  // sits inside that preview; it is never a detection/cropping constraint.
  guide: { position: 'absolute', left: theme.spacing.xl, right: theme.spacing.xl, bottom: theme.spacing.xxl,
    height: 252, borderWidth: 2, borderColor: theme.colors.onPrimary, borderRadius: theme.radius.card },
})
