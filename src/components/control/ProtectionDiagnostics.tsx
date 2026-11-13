import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Notice } from '../Notice'
import type { ProtectionReport } from '../../features/offline/protection'
import { offlineProtection } from '../../config/offlineLab'

export function ProtectionDiagnostics() {
  const [report, setReport] = useState<ProtectionReport | null>(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState(false), working = useRef(false), active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const inspect = async () => {
    if (working.current) return
    working.current = true; setBusy(true); setError(false); setReport(null)
    try {
      const { inspectNativeProtection } = await import('../../features/offline/nativeProtection')
      const result = await inspectNativeProtection()
      if (active.current) setReport(result)
    } catch { if (active.current) setError(true) }
    finally { working.current = false; if (active.current) setBusy(false) }
  }
  return <>
    <ActionButton secondary label="Comprobar biometría y SQLCipher" busy={busy} onPress={() => { void inspect() }} />
    {error && <Notice message="No se pudo completar el diagnóstico nativo. Revisa los módulos de la APK. No se abrió ninguna lista protegida." />}
    {report && <>
      <Notice tone={report.biometric === 'available' ? 'info' : 'warning'} message={offlineProtection.laboratory
        ? `${report.biometric === 'available' ? 'Android confirma biometría fuerte disponible.' : report.biometric === 'unavailable' ? 'Android no confirma biometría fuerte disponible.' : 'No se pudo comprobar la biometría del dispositivo.'} En este almacén de laboratorio no se exige biometría. SecureStore y SQLCipher deben seguir funcionando.`
        : report.biometricMessage} />
      <AppText accessibilityLiveRegion="polite">{report.cipher === 'available'
        ? `SQLCipher ${report.cipherVersion} respondió en la conexión de diagnóstico. Todavía debes desbloquear el almacén y verificar el paquete.`
        : report.cipher === 'missing' ? 'SQLCipher no respondió a PRAGMA cipher_version. Requiere revisar o recompilar la APK con SQLCipher; la persistencia de listas seguirá bloqueada.'
          : 'No se pudo comprobar SQLCipher. Revisa la integración nativa SQLite de la APK. Esto no identifica un fallo biométrico.'}</AppText>
    </>}
  </>
}
