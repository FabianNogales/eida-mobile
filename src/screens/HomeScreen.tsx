import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { theme } from '../config/theme'

export function HomeScreen() {
  const router = useRouter()
  return <Screen home>
    <View style={styles.brand}>
      <View style={styles.logo}><Text style={styles.logoText}>E</Text></View>
      <View><Text style={styles.brandName}>EIDA <Text style={styles.brandControl}>Control</Text></Text>
        <Text style={styles.caption}>CONTROL DE INGRESO</Text></View>
      <View style={styles.tag}><Text style={styles.tagText}>FASE 2</Text></View>
    </View>
    <View style={styles.hero}>
      <View style={styles.accent} />
      <Text style={styles.eyebrow}>BASE MÓVIL · ANDROID</Text>
      <Text style={styles.title}>Identidad verificada.{"\n"}Control sin conexión.</Text>
      <Text style={styles.body}>Primero comprobamos la firma QR en este dispositivo. Después integraremos el control del examen.</Text>
    </View>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.step}>01</Text><Text style={styles.cardTitle}>Verificación QR v3</Text></View>
      <Text style={styles.description}>Ejecuta los vectores firmados por PHP usando únicamente claves públicas de prueba.</Text>
      <View style={styles.chips}>{['RS256', 'Clave pública', 'Sin backend'].map((label) =>
        <Text key={label} style={styles.chip}>{label}</Text>)}</View>
      <ActionButton label="Abrir prueba criptográfica" onPress={() => router.push('/qr-diagnostics')} />
    </View>
    <View style={styles.next}>
      <Text style={styles.cardTitle}>Lo que sigue</Text>
      {['Acceso docente y exámenes asignados', 'Listas, fotografía y control offline', 'Incidencias y sincronización segura'].map((label, i) =>
        <View style={styles.row} key={label}><Text style={styles.number}>{i + 2}</Text><Text style={styles.description}>{label}</Text></View>)}
    </View>
    <Text style={styles.footer}>Entorno de prueba · sin datos personales ni conexión a producción</Text>
  </Screen>
}
const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: theme.colors.navy, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: 'white', fontSize: 29, fontWeight: '800' },
  brandName: { color: theme.colors.navy, fontWeight: '800', fontSize: 22 },
  brandControl: { fontWeight: '400' },
  caption: { color: theme.colors.muted, fontSize: 9, letterSpacing: 1.6, marginTop: 3 },
  tag: { marginLeft: 'auto', backgroundColor: 'white', padding: 8, borderRadius: 20 },
  tagText: { color: theme.colors.accent, fontSize: 10, fontWeight: '800' },
  hero: { backgroundColor: theme.colors.navy, borderRadius: 24, padding: 24, gap: 16, overflow: 'hidden' },
  accent: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#d67a8c' },
  eyebrow: { color: '#b8c9e1', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: 'white', fontWeight: '700', fontSize: 27, lineHeight: 35 },
  body: { color: '#dce5f2', fontSize: 14, lineHeight: 22 },
  card: { borderRadius: 20, backgroundColor: 'white', padding: 20, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { color: theme.colors.accent, fontSize: 14, fontWeight: '800', padding: 10, backgroundColor: '#f7e9ed', borderRadius: 12 },
  cardTitle: { color: theme.colors.navy, fontWeight: '700', fontSize: 18 },
  description: { color: theme.colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { color: theme.colors.primary, backgroundColor: theme.colors.background, padding: 8, borderRadius: 8, fontSize: 11, fontWeight: '600' },
  next: { padding: 4, gap: 18 },
  number: { fontSize: 12, color: theme.colors.muted, borderColor: '#b8c9e1', borderWidth: 1, width: 26, height: 26, textAlign: 'center', textAlignVertical: 'center', borderRadius: 13 },
  footer: { color: theme.colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 18 },
})

