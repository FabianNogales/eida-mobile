import { useEffect, useRef } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { DiagnosticCaseCard } from '../components/DiagnosticCaseCard'
import { theme } from '../config/theme'
import { useQrDiagnostics } from '../features/diagnostics/useQrDiagnostics'

export function QrDiagnosticsScreen() {
  const diagnostics = useQrDiagnostics()
  const { autorun } = useLocalSearchParams<{ autorun?: string }>()
  const autoran = useRef(false)
  useEffect(() => {
    if (autorun === '1' && !autoran.current) {
      autoran.current = true
      void diagnostics.run()
    }
  }, [autorun, diagnostics.run])
  const report = diagnostics.report
  const passed = report?.results.filter((entry) => entry.passed).length ?? 0
  const allPassed = !!report && report.results.length > 0 && passed === report.results.length
  return <Screen>
    <Text style={styles.eyebrow}>PRUEBA DE INTEROPERABILIDAD</Text>
    <Text style={styles.title}>Verificación QR v3</Text>
    <Text style={styles.body}>La firma proviene del prototipo PHP. Este diagnóstico comprueba firmas y rechazos esperados con un reloj fijo de prueba de 2030.</Text>
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Firma válida ≠ ingreso confirmado</Text>
      <Text style={styles.body}>No se comprueban listas, habilitación ni asistencia. Ningún evento se envía a Laravel.</Text>
    </View>
    <ActionButton label={diagnostics.status === 'running' ? 'Verificando en Android…' : 'Ejecutar vectores en Android'}
      busy={diagnostics.status === 'running'} onPress={() => { void diagnostics.run() }} />
    {diagnostics.message && <View style={styles.notice}><Text style={styles.error}>{diagnostics.message}</Text></View>}
    {report && <View style={[styles.summary, { borderColor: allPassed ? theme.colors.success : theme.colors.error }]}>
      <Text style={styles.score}>{passed} / {report.results.length}</Text>
      <Text style={styles.summaryTitle}>{allPassed ? 'Comprobación ejecutada en Android' : 'Hay resultados que requieren revisión'}</Text>
      <Text style={styles.body}>{report.engine} · Android API {report.androidApi}</Text>
      <Text style={styles.code}>{report.provider}</Text>
      <ActionButton secondary label="Compartir informe de diagnóstico" onPress={() => { void diagnostics.shareReport().catch(() => {}) }} />
    </View>}
    {report?.results.map((result) => <DiagnosticCaseCard key={result.name} result={result} />)}
    <Text style={styles.footer}>Solo claves públicas y tokens sintéticos. La expiración del verificador permanece activa.</Text>
  </Screen>
}
const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.accent, fontWeight: '800', fontSize: 10, letterSpacing: 1.4, marginTop: 8 },
  title: { fontSize: 30, fontWeight: '700', color: theme.colors.navy },
  body: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
  notice: { padding: 18, backgroundColor: theme.colors.warningSoft, borderRadius: 14, gap: 8 },
  noticeTitle: { color: theme.colors.warning, fontWeight: '700', fontSize: 14 },
  summary: { padding: 20, backgroundColor: 'white', borderWidth: 1, borderRadius: 20, gap: 12 },
  score: { color: theme.colors.navy, fontSize: 38, fontWeight: '800' },
  summaryTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  code: { fontFamily: 'monospace', color: theme.colors.muted, fontSize: 11, lineHeight: 18 },
  error: { color: theme.colors.error, lineHeight: 21 },
  footer: { color: theme.colors.muted, fontSize: 12, lineHeight: 19 },
})

