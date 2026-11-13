import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { ActionButton } from '../../components/ActionButton'
import { Notice } from '../../components/Notice'
import type { ScanDetection } from './scanSession'

export interface NativeQrCameraProps {
  scanId: number | null
  onAccess(granted: boolean): void
  onReady(scanId: number): void
  onDetection(scanId: number, detection: ScanDetection): void
  onFailure(scanId: number): void
}

// Imported lazily by the screen so an old native binary reports a missing module here.
export function NativeQrCamera(props: NativeQrCameraProps) {
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false })
  const [requesting, setRequesting] = useState(false), [error, setError] = useState<string | null>(null)
  const requestInProgress = useRef(false)
  const checkPermission = useCallback(() => {
    setError(null)
    void getPermission().catch(() => setError('No se pudo consultar el permiso de cámara.'))
  }, [getPermission])
  useEffect(checkPermission, [checkPermission])
  const { onAccess } = props
  useEffect(() => { onAccess(permission?.granted === true) }, [permission?.granted, onAccess])
  if (!permission) return error ? <View style={styles.controls}>
    <Notice message={error} />
    <ActionButton secondary label="Reintentar comprobación" onPress={checkPermission} />
  </View> : <Text>Consultando permiso de cámara…</Text>
  if (!permission.granted) return <View style={styles.controls}>
    <Notice message={permission.status === 'undetermined' ? 'La cámara necesita tu permiso para leer QR. No se tomarán fotografías ni se grabará audio o video.' : 'Permiso de cámara denegado. Puedes seguir usando la consulta manual.'} />
    {error && <Notice message={error} />}
    {permission.canAskAgain ? <ActionButton label="Permitir cámara" busy={requesting} onPress={() => {
      if (requestInProgress.current) return
      requestInProgress.current = true
      setRequesting(true); setError(null)
      void requestPermission().catch(() => setError('No se pudo solicitar el permiso. Revisa los ajustes de Android.')).finally(() => {
        requestInProgress.current = false
        setRequesting(false)
      })
    }} /> : <ActionButton secondary label="Abrir ajustes de la aplicación" onPress={() => {
      void Linking.openSettings().catch(() => setError('Abre los ajustes de Android y concede el permiso Cámara a EIDA Control.'))
    }} />}
  </View>
  return props.scanId === null ? <Text>Permiso de cámara concedido. Preview detenido.</Text> :
    <Preview key={props.scanId} {...props} scanId={props.scanId} />
}

function Preview({ scanId, onReady, onDetection, onFailure }: NativeQrCameraProps & { scanId: number }) {
  const ready = useRef(false)
  useEffect(() => {
    // Availability is reported by the Android preview; isAvailableAsync is web-only in SDK 58.
    const timer = setTimeout(() => { if (!ready.current) onFailure(scanId) }, 15000)
    return () => clearTimeout(timer)
  }, [scanId, onFailure])
  return <View>
    <Text>Enfoca un único QR. La lectura se detendrá para verificarlo.</Text>
    <CameraView style={styles.preview} facing="back" mode="picture" mute
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onCameraReady={() => { ready.current = true; onReady(scanId) }}
      onMountError={() => onFailure(scanId)}
      onBarcodeScanned={({ type, data }) => onDetection(scanId, { type, data })} />
  </View>
}
const styles = StyleSheet.create({ preview: { height: 300, width: '100%', marginTop: 12 }, controls: { gap: 12 } })
