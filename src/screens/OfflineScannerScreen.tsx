import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { AppState, Image, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useOffline } from '../features/offline/OfflineProvider'
import { nativeClock } from '../features/offline/clock'
import { QrScanSession, type QrScanState } from '../features/scanner/scanSession'
import type { NativeQrCameraProps } from '../features/scanner/NativeQrCamera'
import type { VaultRuntime } from '../features/offline/nativeVault'
import { laPazInstant } from '../utils/dates'

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
    }).catch(() => { if (current) setCameraError('Cámara nativa no disponible. Instala expo-camera y genera una nueva APK; actualizar JavaScript no añade módulos nativos.') })
    return () => { current = false }
  }, [runtime, focused, foreground])

  const session = view?.session
  const onAccess = useCallback((allowed: boolean) => { session?.cameraAccess(allowed); setGranted(allowed) }, [session])
  const onReady = useCallback((scanId: number) => session?.cameraReady(scanId), [session])
  const onDetection = useCallback((scanId: number, detection: Parameters<QrScanSession['detect']>[1]) => {
    if (session) void session.detect(scanId, detection)
  }, [session])
  const onFailure = useCallback((scanId: number) => session?.cameraFailed(scanId), [session])

  if (!runtime) return <Screen><Notice message="El almacén está bloqueado. Desbloquéalo con biometría antes de escanear. Si el permiso de cámara interrumpió la aplicación, vuelve a desbloquearlo." />
    <ActionButton label="Ir al desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (!packageId) return <Screen><Notice message="Falta la referencia de la lista descargada." />
    <ActionButton label="Ver paquetes" onPress={() => router.replace('/offline')} /></Screen>
  if (!focused || !foreground || !view || view.runtime !== runtime || view.packageId !== packageId) return <Screen><Text>Escáner detenido.</Text></Screen>
  const state = view.state
  const identity = state.phase === 'review' || state.phase === 'duplicate' || state.phase === 'saved' ? state.identity : null
  const event = state.phase === 'duplicate' || state.phase === 'saved' ? state.event : null
  const receipt = event ? offline.syncItems.find((item) => item.eventId === event.event_id)?.receipt : null
  const permitted = !['checking', 'blocked', 'closed'].includes(state.phase)
  const canStart = ['idle', 'error', 'review', 'duplicate', 'saved'].includes(state.phase)
  return <Screen>
    <Text style={s.title}>Escanear QR</Text>
    <Text style={s.body}>Solo QR v3 con firma confiable permite identificar offline. Un QR v2 no puede verificarse offline; usa la consulta manual. Revocaciones posteriores a la descarga pueden desconocerse.</Text>
    {state.phase === 'checking' && <Text>Comprobando acceso al paquete…</Text>}
    {(state.phase === 'error' || state.phase === 'blocked') && <Notice message={state.message} />}
    {permitted && <>
      {cameraError ? <Notice message={cameraError} /> : Camera && <Camera scanId={state.phase === 'scanning' ? state.scanId : null}
        onAccess={onAccess} onReady={onReady} onDetection={onDetection} onFailure={onFailure} />}
      {canStart && <ActionButton label={state.phase === 'idle' ? 'Iniciar escaneo' : 'Volver a escanear'} disabled={!Camera || !granted || !!cameraError}
        onPress={() => { view.session.start() }} />}
      {(state.phase === 'detected' || state.phase === 'verifying') && <Notice message="QR detectado. Cámara pausada; verificando firma, vigencia, examen y lista local…" />}
      {state.phase === 'saving' && <Notice message="Guardando evidencia local pendiente de sincronización…" />}
      {identity && <View style={s.card}>
        <Text style={s.subtitle}>Identidad verificada con QR v3</Text>
        <Text style={s.subtitle}>{identity.student.last_names}, {identity.student.first_names}</Text>
        <Text style={s.body}>SIS: {identity.student.sis_code} · CI: {identity.student.identity_number}</Text>
        <Text style={s.body}>Inscripción: {identity.student.enrollment_status} · habilitación conocida: {identity.student.eligibility_status} · revisión: {identity.student.eligibility_revision}</Text>
        {identity.student.photos.filter((photo) => photo.state === 'ABSENT').map((photo) => <Text key={photo.kind} style={s.body}>Fotografía {photo.kind}: ausencia informada por el servidor.</Text>)}
        {identity.photos.map((photo) => <View key={photo.kind}><Text style={s.label}>Fotografía {photo.kind}</Text>
          <Image source={{ uri: photo.uri }} accessibilityLabel={`Fotografía ${photo.kind} institucional`} style={{ width: 220, height: 260 }} resizeMode="contain" /></View>)}
        {state.phase === 'review' && <>
          <Notice message="Comprueba la identidad y las fotografías antes de confirmar. Aún no se creó ningún ingreso." />
          <ActionButton label="Confirmar ingreso provisional · guardar pendiente" onPress={() => {
            void view.session.confirm().then((saved) => { if (saved) void offline.refresh().catch(() => {}) })
          }} />
        </>}
        {state.phase === 'duplicate' && <Notice message="Ingreso local ya registrado. Se conserva el UUID y su evidencia original; no se creará otro evento." />}
        {event && (receipt?.status === 'ACCEPTED' ? <Notice message={`INGRESO OFICIAL CONFIRMADO por ACK de Laravel · registro ${receipt.entry_id}.`} /> :
          receipt?.status === 'DUPLICATE' ? <Notice message={`ACK de Laravel: ingreso oficial existente ${receipt.entry_id}; esta operación es un duplicado.`} /> :
          receipt ? <Notice message={`${receipt.status}: ${receipt.code}. ${receipt.message} Sin nuevo ingreso oficial confirmado.`} /> :
          <Notice message={`PENDIENTE DE SINCRONIZACIÓN · UUID ${event.event_id} · ${laPazInstant(event.captured_at)}. Sin confirmación oficial.`} />)}
      </View>}
      {!['idle', 'saving'].includes(state.phase) && <ActionButton secondary label="Cancelar lectura" onPress={() => view.session.cancel()} />}
    </>}
    <ActionButton secondary label="Volver a la lista" disabled={state.phase === 'saving'} onPress={() => {
      view.session.close(); router.back()
    }} />
  </Screen>
}
