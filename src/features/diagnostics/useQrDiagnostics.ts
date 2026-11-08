import { useRef, useState } from 'react'
import { Platform, Share } from 'react-native'
import Constants from 'expo-constants'
import original from '../qr/fixtures/php-vectors.json'
import supplemental from '../qr/fixtures/supplemental-vectors.json'
import { loadNativeCrypto } from '../qr/nativeCrypto'
import { runVectors, type VectorResult } from './runVectors'

export interface NativeReport {
  executedAt: string
  platform: string
  androidApi: string
  engine: string
  provider: string
  originalFixtureSha256: string
  results: VectorResult[]
}
type State = { status: 'idle' | 'running' | 'complete' | 'unavailable'; report: NativeReport | null; message: string | null }
const fixtureHash = '4F03499E524EB3B0A099C5E7D7BB4AA788E74EAF3BC7E1C5ABBDC0A5A582B2C4'

export function useQrDiagnostics() {
  const [state, setState] = useState<State>({ status: 'idle', report: null, message: null })
  const running = useRef(false)
  async function run() {
    if (running.current) return
    running.current = true
    setState({ status: 'running', report: null, message: null })
    try {
      if (Platform.OS !== 'android' || Constants.executionEnvironment === 'storeClient') {
        setState({ status: 'unavailable', report: null, message: 'Esta prueba requiere una development build Android propia. Expo Go y escritorio no validan el módulo nativo.' })
        return
      }
      const provider = await loadNativeCrypto()
      const results = await runVectors(provider, [original, supplemental])
      const report: NativeReport = {
        executedAt: new Date().toISOString(), platform: Platform.OS, androidApi: String(Platform.Version),
        engine: 'HermesInternal' in globalThis ? 'Hermes' : 'JavaScript Android',
        provider: provider.name, originalFixtureSha256: fixtureHash, results,
      }
      setState({ status: 'complete', report, message: null })
      // Compact, non-sensitive evidence can be collected with adb logcat.
      // Contains no token, PEM, identity or session credential.
      // Android logcat limits each entry. Chunk the report so evidence is not
      // silently truncated when all 29 vector results are included.
      const json = JSON.stringify(report)
      const size = 1800
      const count = Math.ceil(json.length / size)
      for (let index = 0; index < count; index++) {
        console.info('EIDA_QR_DIAGNOSTIC_REPORT ' + report.executedAt + ' ' +
          (index + 1) + '/' + count + ' ' + json.slice(index * size, (index + 1) * size))
      }
    } catch {
      setState({ status: 'unavailable', report: null, message: 'No se pudo ejecutar el módulo criptográfico nativo. Comprueba que esta APK incluye QuickCrypto, Nitro Modules y Quick Base64.' })
    } finally { running.current = false }
  }
  async function shareReport() {
    if (state.report) await Share.share({ title: 'EIDA Control · prueba QR v3', message: JSON.stringify(state.report, null, 2) })
  }
  return { ...state, run, shareReport }
}

