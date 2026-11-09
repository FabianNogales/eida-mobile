import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Keyboard, StyleSheet, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ListScreen } from '../components/ListScreen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { EmptyState, LoadingState } from '../components/FeedbackStates'
import { Notice } from '../components/Notice'
import { FormField } from '../components/FormField'
import type { TextInputHandle } from '../components/keyboardFocus'
import { StudentRow } from '../components/control/StudentRow'
import { StudentDetailModal } from '../components/control/StudentDetailModal'
import { theme } from '../config/theme'
import { useOffline } from '../features/offline/OfflineProvider'
import { nativeClock, anchoredNow } from '../features/offline/clock'
import { captureProvisional, identifyQr } from '../features/offline/identity'
import type { OfflineStudent, PackageRecord, ProvisionalEvent } from '../features/offline/contracts'
import { packageViewAllowed, scanDestination, searchPageMatches } from '../ui/controlScreens'
import { laPazInstant } from '../utils/dates'

export function OfflineListScreen() {
  const params = useLocalSearchParams<{ packageId: string; focusSearch?: string }>()
  const packageId = typeof params.packageId === 'string' ? params.packageId : ''
  return <LocalList key={packageId} packageId={packageId} focusSearch={params.focusSearch === '1'} />
}
function LocalList({ packageId, focusSearch }: { packageId: string; focusSearch: boolean }) {
  const offline = useOffline(), router = useRouter(), r = offline.runtime
  const viewScope = useRef(r), work = useRef(false), mounted = useRef(true)
  const pageScope = useRef<{ runtime: typeof r; term: string; offset: number } | null>(null)
  const searchInput = useRef<TextInputHandle | null>(null), didFocus = useRef(false)
  const currentState = offline.packages.find((item) => item.id === packageId)
  const blocked = !!currentState && (!currentState.active || currentState.state !== 'PREPARADO')
  const [p, setPackage] = useState<PackageRecord | null>(null), [term, setTerm] = useState(''), [offset, setOffset] = useState(0)
  const [searchTerm, setSearchTerm] = useState(''), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<OfflineStudent[]>([]), [selected, setSelected] = useState<OfflineStudent | null>(null)
  const [photos, setPhotos] = useState<{ kind: string; uri: string }[]>([]), [event, setEvent] = useState<ProvisionalEvent | null>(null)
  const [error, setError] = useState<string | null>(null), [token, setToken] = useState(''), [busy, setBusy] = useState(false)
  const [canDraft, setCanDraft] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(term), 200)
    return () => clearTimeout(timer)
  }, [term])
  useFocusEffect(useCallback(() => {
    let current = true; setCanDraft(false)
    if (r) void nativeClock.sample().then((sample) => r.incidents.canDraft(packageId, sample)).then((allowed) => {
      r.check(); if (current) setCanDraft(allowed)
    }).catch(() => {})
    return () => { current = false }
  }, [r, packageId, currentState]))
  const receipt = offline.syncItems.find((item) => item.eventId === event?.event_id)?.receipt
  useEffect(() => {
    let current = true
    setLoading(true); setStudents([]); setSelected(null); setPhotos([]); setEvent(null); setToken(''); setError(null)
    if (r && !blocked) void (async () => {
      const pkg = await r.repo.usable(packageId, await nativeClock.sample())
      const rows = await r.repo.search(packageId, searchTerm, offset)
      r.check(); if (current) {
        viewScope.current = r; pageScope.current = { runtime: r, term: searchTerm, offset }
        setPackage(pkg); setStudents(rows)
      }
    })().catch((e) => { if (current) { setPackage(null); setError(e instanceof Error ? e.message : 'Consulta bloqueada.') } })
      .finally(() => { if (current) setLoading(false) })
    else setLoading(false)
    return () => { current = false }
  }, [r, packageId, searchTerm, offset, revision, blocked])
  useEffect(() => {
    if (blocked) { setPackage(null); setStudents([]); setSelected(null); setPhotos([]); setEvent(null); setToken('') }
  }, [blocked])
  useEffect(() => {
    if (!p || !r) return
    let current = true, timer: ReturnType<typeof setTimeout> | undefined
    const clear = () => {
      if (!current) return
      setPackage(null); setStudents([]); setSelected(null); setPhotos([]); setEvent(null); setToken('')
      setError('La consulta local perdió su vigencia o referencia horaria. Revalida con internet.')
    }
    void nativeClock.sample().then((sample) => {
      const remaining = Date.parse(p.manifest.expires_at) - anchoredNow(p.anchor, sample)
      if (remaining <= 0) { clear(); return }
      if (current) timer = setTimeout(clear, Math.min(remaining, 2147483647))
    }).catch(clear)
    return () => { current = false; if (timer) clearTimeout(timer) }
  }, [p, r])
  const visible = packageViewAllowed(p, packageId, viewScope.current === r, blocked)
  useEffect(() => {
    if (!visible || !focusSearch || didFocus.current) return
    const frame = requestAnimationFrame(() => { searchInput.current?.focus(); didFocus.current = true })
    return () => cancelAnimationFrame(frame)
  }, [visible, focusSearch])
  const entries = useMemo(() => new Map(offline.syncItems.filter((item) => item.examId === p?.examId)
    .map((item) => [item.studentId, item] as const)), [offline.syncItems, p?.examId])
  const action = async (fn: () => Promise<void>) => {
    if (!r || busy || work.current) return
    work.current = true; setBusy(true); setError(null)
    try { await fn() } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Operación local bloqueada.') }
    finally { work.current = false; if (mounted.current) setBusy(false) }
  }
  const show = async (student: OfflineStudent) => {
    if (!r) return
    const pkg = await r.repo.usable(packageId, await nativeClock.sample())
    const images: { kind: string; uri: string }[] = []
    const { Buffer } = await import('react-native-quick-crypto')
    for (const photo of student.photos) if (photo.state === 'PRESENT') {
      const bytes = await r.repo.photo(packageId, student.student_id, photo.kind)
      if (!bytes || r.digest(bytes) !== photo.sha256) throw new Error('La fotografía local no pasó la comprobación de integridad.')
      images.push({ kind: photo.kind, uri: `data:${photo.mime};base64,${Buffer.from(bytes).toString('base64')}` })
    }
    const local = await r.repo.event(pkg.examId, student.student_id)
    r.check()
    if (mounted.current) { Keyboard.dismiss(); setSelected(student); setPhotos(images); setEvent(local) }
  }
  const capture = (method: 'MANUAL' | 'QR') => {
    if (!r || !selected) return
    Alert.alert('Registrar provisionalmente', 'Confirma la identidad y las fotos. El registro quedará PENDIENTE DE SINCRONIZACIÓN; el servidor decidirá su aceptación.', [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Guardar pendiente', onPress: () => { void action(async () => {
        const result = await captureProvisional(r.repo, packageId, selected.student_id, method, await nativeClock.sample(), r.uuid, r.provider, token)
        r.check(); if (mounted.current) { setEvent(result); setToken('') }
        await offline.refresh()
      }) } },
    ])
  }
  const closeDetail = () => { setSelected(null); setPhotos([]); setEvent(null); setToken('') }
  const openScan = () => { Keyboard.dismiss(); closeDetail(); router.push(scanDestination(packageId)) }
  const openIncident = () => { Keyboard.dismiss(); closeDetail(); router.push({ pathname: '/offline/report-incident', params: { packageId } }) }
  if (!r) return <Screen><Notice message="El almacén está bloqueado. Desbloquéalo con biometría para consultar tu lista." />
    <ActionButton label="Ir al desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (blocked && currentState) return <Screen><Notice message={`Consulta bloqueada: ${currentState.state}. Los eventos pendientes se conservan protegidos.`} />
    <ActionButton label="Ver paquetes y estado" onPress={() => router.replace('/offline')} /></Screen>
  if (!visible || !p) return <Screen>
    {error ? <Notice tone="error" message={error} /> : <LoadingState label="Comprobando copia, vigencia y autorización local" />}
    <ActionButton secondary label="Reintentar consulta local" disabled={loading} onPress={() => setRevision((v) => v + 1)} />
    <ActionButton secondary label="Ver paquetes y estado" onPress={() => router.push('/offline')} />
  </Screen>
  const settled = term === searchTerm
  const rowsVisible = searchPageMatches(pageScope.current, r, term, searchTerm, offset)
  return <>
    <ListScreen data={rowsVisible ? students : []} keyExtractor={(student) => student.student_id}
      ListHeaderComponent={<View style={s.section}>
        <AppText variant="subtitle" accessibilityRole="header">{p.manifest.exam.name}</AppText>
        <AppText>{p.manifest.responsible_name} · Lista {p.manifest.list_id} · v{p.manifest.version}</AppText>
        <AppText>{p.manifest.exam.room?.name ?? 'Ambiente no informado'} · {p.manifest.students.length} estudiantes en la copia</AppText>
        <Notice message={`Datos conocidos al ${laPazInstant(p.manifest.prepared_at)}. Cambios y revocaciones posteriores pueden desconocerse. Vigencia: ${laPazInstant(p.manifest.expires_at)}.`} />
        <FormField ref={searchInput} label="Buscar estudiante" hint="Nombre, apellidos, SIS o CI. %, _ y ! se buscan literalmente."
          value={term} maxLength={120} editable={!busy} autoCorrect={false} autoCapitalize="none"
          onChangeText={(value) => { setOffset(0); setTerm(value) }} returnKeyType="search" />
        {error && <Notice tone="error" message={error} />}
        {(loading || !settled || busy) && <LoadingState label={busy ? 'Comprobando identificación' : 'Buscando en tu lista local'} />}
      </View>}
      renderItem={({ item }) => <StudentRow student={item} item={entries.get(item.student_id)} disabled={busy}
        onOpen={() => { void action(() => show(item)) }} />}
      ListEmptyComponent={!loading && settled && !error ? <EmptyState title="Sin coincidencias"
        message="Prueba otro nombre, SIS o CI dentro de tu lista autorizada. No se consultan estudiantes de otras listas." /> : undefined}
      ListFooterComponent={<View style={s.section}>
        <View style={s.pagination}>
          <View style={s.pageButton}><ActionButton secondary label="Página anterior" disabled={offset === 0 || busy || loading}
            onPress={() => setOffset(Math.max(0, offset - 50))} /></View>
          <View style={s.pageButton}><ActionButton secondary label="Página siguiente" disabled={students.length < 50 || busy || loading || !settled}
            onPress={() => setOffset(offset + 50)} /></View>
        </View>
        <AppText variant="caption">Página local {Math.floor(offset / 50) + 1} · hasta 50 coincidencias por consulta</AppText>
        <ActionButton label="Escanear QR" disabled={busy || !p.manifest.qr.available} onPress={openScan} />
        <AppText>{p.manifest.qr.available ? 'QR v3 verificable con el material público de la copia. Las revocaciones posteriores pueden desconocerse.' : 'QR v3 no disponible. QR v2 no se autentica offline; utiliza la identificación manual.'}</AppText>
        <FormField label="Contenido QR de un lector externo" value={token} maxLength={4096} editable={!busy} onChangeText={setToken}
          autoCapitalize="none" autoCorrect={false} multiline hint="Este contenido no identifica a nadie hasta superar la verificación existente." />
        <ActionButton secondary label="Verificar QR e identificar" disabled={!token || busy} onPress={() => { void action(async () => {
          const pkg = await r.repo.usable(packageId, await nativeClock.sample())
          const result = await identifyQr(token, pkg, await nativeClock.sample(), r.provider)
          const duplicate = await r.repo.event(pkg.examId, result.student.student_id)
          if (duplicate) throw new Error('Duplicado local conocido: ya existe una operación pendiente para este estudiante.')
          await show(result.student)
        }) }} />
        <ActionButton secondary label="Reportar incidencia de esta lista" disabled={busy} onPress={openIncident} />
        {canDraft && <ActionButton secondary label="Preparar borrador de infracción · docente validado" disabled={busy}
          onPress={() => router.push({ pathname: '/offline/infraction-draft', params: { packageId } })} />}
        <ActionButton secondary label="Consultar sincronización y recibos" onPress={() => router.push('/offline/sync')} />
      </View>} />
    {selected && <StudentDetailModal student={selected} record={p} photos={photos} event={event} receipt={receipt}
      error={error} busy={busy} canQrRecord={!!token && p.manifest.qr.available} onClose={closeDetail}
      onManual={() => capture('MANUAL')} onQrRecord={() => capture('QR')} onScan={openScan} onIncident={openIncident} />}
  </>
}
const s = StyleSheet.create({ section: { gap: theme.spacing.md },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }, pageButton: { flexBasis: 130, flexGrow: 1 } })
