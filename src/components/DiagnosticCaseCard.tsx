import { StyleSheet, Text, View } from 'react-native'
import type { VectorResult } from '../features/diagnostics/runVectors'
import { theme } from '../config/theme'
import { Card } from './Card'

export function DiagnosticCaseCard({ result }: { result: VectorResult }) {
  return <Card style={styles.card}>
    <View style={styles.row}>
      <Text style={styles.name}>{result.name}</Text>
      <Text accessibilityLabel={result.passed ? 'Prueba correcta' : 'Prueba fallida'}
        style={[styles.badge, result.passed ? styles.pass : styles.fail]}>{result.passed ? 'OK' : 'FALLÓ'}</Text>
    </View>
    <Text style={styles.source}>{result.source}</Text>
    <Text style={styles.code}>{result.actual}</Text>
    {!result.passed && <Text style={styles.error}>Esperado: {result.expected}</Text>}
  </Card>
}
const styles = StyleSheet.create({
  card: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md },
  name: { flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pass: { color: theme.colors.success, backgroundColor: theme.colors.successSoft },
  fail: { color: theme.colors.error, backgroundColor: theme.colors.errorSoft },
  source: { color: theme.colors.muted, fontSize: 12 },
  code: { color: theme.colors.muted, fontSize: 12, fontFamily: 'monospace' },
  error: { color: theme.colors.error, fontSize: 12 },
})

