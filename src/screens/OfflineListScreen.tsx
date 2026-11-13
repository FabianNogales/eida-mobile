import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'
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
import { offlineQrBlock } from '../features/scanner/qrAvailability'
import { OfflineAccessStatus } from '../components/control/OfflineAccessStatus'
import { StudentDetailModal, type StudentStep } from '../components/control/StudentDetailModal'
import { ExamIcon } from '../components/general/ExamIcon'
import { TextAction } from '../components/general/TextAction'
import { StatusBadge } from '../components/StatusBadge'
import { theme } from '../config/theme'
import { useOffline } from '../features/offline/OfflineProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { nativeClock, anchoredNow } from '../features/offline/clock'
import { captureProvisional, identifyQr } from '../features/offline/identity'
import type { OfflineStudent, PackageRecord, ProvisionalEvent } from '../features/offline/contracts'
import { manualAvailability, packageViewAllowed, scanDestination, searchPageMatches } from '../ui/controlScreens'
import { scanIssue } from '../ui/entryPresentation'
import { briefExamStatus, examHeading } from '../ui/examPresentation'
import { laPazInstant } from '../utils/dates'

export function OfflineListScreen() {
  const params = useLocalSearchParams<{ packageId: string; focusSearch?: string }>()
  const packageId = typeof params.packageId === 'string' ? params.packageId : ''
  return <LocalList key={packageId} packageId={packageId} focusSearch={params.focusSearch === '1'} />
}
function LocalList({ packageId, focusSearch }: { packageId: string; focusSearch: boolean }) {
  const offline = useOffline(), { session } = useAuth(), router = useRouter(), r = offline.runtime
  const viewScope = useRef(r), work = useRef(false), mounted = useRef(true)
  const pageScope = useRef<{ runtime: typeof r; term: string; offset: number } | null>(null)
  const searchInput = useRef<TextInputHandle | null>(null), refreshing = useRef(false)
  const currentState = offline.packages.find((item) => item.id === packageId)
  const blocked = !!currentState && (!currentState.active || currentState.state !== 'PREPARADO')
  const [p, setPackage] = useState<PackageRecord | null>(null), [term, setTerm] = useState(''), [offset, setOffset] = useState(0)
  const [searchTerm, setSearchTerm] = useState(''), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<OfflineStudent[]>([]), [selected, setSelected] = useState<OfflineStudent | null>(null)
  const [photos, setPhotos] = useState<{ kind: string; uri: string }[]>([]), [event, setEvent] = useState<ProvisionalEvent | null>(null)
  const [error, setError] = useState<string | null>(null), [token, setToken] = useState(''), [busy, setBusy] = useState(false)
  const [showExternal, setShowExternal] = useState(false), [step, setStep] = useState<StudentStep>('student')
  const [method, setMethod] = useState<'MANUAL' | 'QR'>('MANUAL')
  const [canRecord, setCanRecord] = useState(false)
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
      .finally(() => { if (current) { refreshing.current = false; setLoading(false) } })
    else { refreshing.current = false; setLoading(false) }
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
  useEffect(() => {
    if (!selected || !p || !r || canRecord) return
    let current = true, timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      try {
        const sample = await nativeClock.sample()
        const pkg = await r.repo.usable(packageId, sample)
        if (!current) return
        const now = anchoredNow(pkg.anchor, sample)
        const wait = Date.parse(pkg.manifest.exam.entry_opens_at) - now
        if (wait <= 0) setCanRecord(true)
        else if (wait < Date.parse(pkg.manifest.expires_at) - now) {
          timer = setTimeout(() => { void check() }, Math.min(wait, 2147483647))
        }
      } catch { /* The current copy or its clock could not be validated. */ }
    }
    void check()
    return () => { current = false; if (timer) clearTimeout(timer) }
  }, [selected, p, r, canRecord, packageId])
  const visible = packageViewAllowed(p, packageId, viewScope.current === r, blocked)
  useFocusEffect(useCallback(() => {
    if (!visible || !focusSearch || !r) return
    const frame = requestAnimationFrame(() => {
      searchInput.current?.focus()
      router.setParams({ focusSearch: '0' })
    })
    return () => cancelAnimationFrame(frame)
  }, [visible, focusSearch, r, router]))
  const entries = useMemo(() => new Map(offline.syncItems.filter((item) => item.examId === p?.examId)
    .map((item) => [item.studentId, item] as const)), [offline.syncItems, p?.examId])
  const action = async (fn: () => Promise<void>) => {
    if (!r || busy || work.current) return
    work.current = true; setBusy(true); setError(null)
    try { await fn() } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Operación local bloqueada.') }
    finally { work.current = false; if (mounted.current) setBusy(false) }
  }
  const show = async (student: OfflineStudent, identification: 'MANUAL' | 'QR' = 'MANUAL') => {
    if (!r) return
    const pkg = await r.repo.usable(packageId, await nativeClock.sample())
    const images: { kind: string; uri: string }[] = []
    const { Buffer } = await import('react-native-quick-crypto')
    for (const photo of student.photos) if (photo.state === 'PRESENT') {
      const bytes = await r.repo.photo(packageId, student.student_id, photo.kind)
      if (!bytes || bytes.length !== photo.size || r.digest(bytes) !== photo.sha256) throw new Error('No se pudo verificar la fotografía guardada.')
      images.push({ kind: photo.kind, uri: `data:${photo.mime};base64,${Buffer.from(bytes).toString('base64')}` })
    }
    const local = await r.repo.event(pkg.examId, student.student_id)
    const sample = await nativeClock.sample()
    const usable = await r.repo.usable(packageId, sample)
    const opened = anchoredNow(usable.anchor, sample) >= Date.parse(usable.manifest.exam.entry_opens_at)
    r.check()
    if (mounted.current) {
      Keyboard.dismiss()
      setMethod(identification); setCanRecord(opened)
      setStep(identification === 'QR' && !local && opened ? 'review' : 'student')
      setSelected(student); setPhotos(images); setEvent(local)
    }
  }
  const capture = () => {
    if (!r || !selected || !visible || step !== 'review' || !canRecord ||
      !manualAvailability(selected, !!event || entries.has(selected.student_id)).allowed) return
    void action(async () => {
      const result = await captureProvisional(r.repo, packageId, selected.student_id, method, await nativeClock.sample(), r.uuid, r.provider, token)
      r.check()
      const deliveryError = await offline.refresh().then(() => null, () => 'No se pudo consultar el estado de sincronización.')
      r.check()
      if (mounted.current) { setEvent(result); setToken(''); setPhotos([]); setError(deliveryError); setStep('result') }
    })
  }
  const closeDetail = () => { setSelected(null); setPhotos([]); setEvent(null); setToken(''); setError(null); setStep('student') }
  const openScan = () => { Keyboard.dismiss(); closeDetail(); router.push(scanDestination(packageId)) }
  const openIncident = () => { Keyboard.dismiss(); closeDetail(); router.push({ pathname: '/offline/report-incident', params: { packageId } }) }
  if (!r) return <Screen><OfflineAccessStatus loadingLabel="Abriendo tu lista" /></Screen>
  if (blocked && currentState) return <Screen><Notice message={currentState.state === 'VENCIDO' ? 'La lista venció. Prepara una copia vigente.'
    : currentState.state === 'INCOMPLETA' || currentState.state === 'DESCARGANDO' ? 'La preparación de esta lista está incompleta.'
      : currentState.state === 'DESACTUALIZADO' ? 'Esta copia ya no está autorizada para el control. Revisa su estado con conexión.'
      : 'Esta copia requiere revisión antes de abrir la lista.'} />
    <ActionButton label="Ver paquetes y estado" onPress={() => router.replace('/offline')} /></Screen>
  if (!visible || !p) return <Screen>
    {error ? <Notice tone="error" message={error} /> : <LoadingState label="Comprobando tu lista" />}
    <ActionButton secondary label="Reintentar consulta local" disabled={loading} onPress={() => setRevision((v) => v + 1)} />
    <ActionButton secondary label="Ver paquetes y estado" onPress={() => router.push('/offline')} />
  </Screen>
  const settled = term === searchTerm
  const rowsVisible = searchPageMatches(pageScope.current, r, term, searchTerm, offset)
  const heading = examHeading(p.manifest.exam)
  const count = p.manifest.students.length
  const qrBlock = offlineQrBlock(p.manifest.qr)
  const refresh = { enabled: !loading && !busy && settled && !selected, refreshing: refreshing.current && loading,
    onRefresh() {
      if (refreshing.current || loading || work.current || !settled || selected) return
      refreshing.current = true; setLoading(true); setRevision((value) => value + 1)
    } }
  return <>
    <ListScreen data={rowsVisible ? students : []} refresh={refresh} scrollKey={offset} keyExtractor={(student) => student.student_id}
      ListHeaderComponent={<View style={s.section}>
        <View style={s.heading}>
          <View style={s.copy}><AppText variant="subtitle" accessibilityRole="header">{heading.title}</AppText>
            {heading.subtitle && <AppText variant="caption">{heading.subtitle}</AppText>}
            <AppText variant="caption" style={s.muted}>{count} estudiantes en tu lista</AppText></View>
          <View style={s.badges}>
            {p.manifest.exam.status && <StatusBadge {...briefExamStatus(p.manifest.exam.status)} />}
            {session.status === 'offline' && <StatusBadge label="Sin conexión" tone="warning" />}
          </View>
        </View>
        <ActionButton label="Escanear QR" icon={<ExamIcon name="qr" color={theme.colors.onPrimary} />}
           disabled={busy || refresh.refreshing || qrBlock !== null} onPress={openScan} />
         {qrBlock && <AppText variant="caption" style={s.muted}>{qrBlock} Usa la búsqueda manual.</AppText>}
        <FormField ref={searchInput} label="Buscar por nombre, SIS o CI" placeholder="Buscar por nombre, SIS o CI" visibleLabel={false}
          value={term} maxLength={120} editable={!busy && !refresh.refreshing} autoCorrect={false} autoCapitalize="none"
          onChangeText={(value) => { setOffset(0); setTerm(value) }} returnKeyType="search" />
        <View style={s.heading}><AppText variant="label" accessibilityRole="header">Mi lista</AppText>
          {rowsVisible && !loading && <AppText variant="caption" style={s.muted}>{students.length} en esta página</AppText>}
        </View>
        {error && !selected && <Notice tone="error" message={error} />}
        {((loading && !refresh.refreshing) || !settled || (busy && !selected)) && <LoadingState label={busy ? 'Comprobando identidad' : 'Buscando en tu lista'} />}
      </View>}
      renderItem={({ item }) => <StudentRow student={item} item={entries.get(item.student_id)} disabled={busy || loading}
        onOpen={() => { void action(() => show(item)) }} />}
      ListEmptyComponent={!loading && settled && !error ? <EmptyState title={count === 0 ? 'Tu lista está vacía' : 'Sin coincidencias'}
        message={count === 0 ? 'La copia autorizada no contiene estudiantes.' : 'Prueba otro nombre, SIS o CI.'} /> : undefined}
      ListFooterComponent={<View style={s.section}>
        {(offset > 0 || (rowsVisible && students.length === 50 && offset + 50 < count)) && <View style={s.pagination}>
          <View style={s.pageButton}><ActionButton secondary label="Página anterior" disabled={offset === 0 || busy || loading}
            onPress={() => setOffset(Math.max(0, offset - 50))} /></View>
          <View style={s.pageButton}><ActionButton secondary label="Página siguiente" disabled={students.length < 50 || offset + 50 >= count || busy || loading || !settled}
            onPress={() => setOffset(offset + 50)} /></View>
        </View>}
        {offset > 0 && <AppText variant="caption">Página {Math.floor(offset / 50) + 1}</AppText>}
         {!qrBlock && <TextAction label={showExternal ? 'Ocultar lector externo' : 'Usar lector externo'} disabled={busy || loading || !settled}
          onPress={() => { setShowExternal(!showExternal); setToken('') }} />}
         {!qrBlock && showExternal && <><FormField label="Contenido QR de un lector externo" value={token} maxLength={4096} editable={!busy && !loading && settled} onChangeText={setToken}
          autoCapitalize="none" autoCorrect={false} multiline hint="Este contenido no identifica a nadie hasta superar la verificación existente." />
        <ActionButton secondary label="Verificar QR e identificar" disabled={!token || busy || loading || !settled} onPress={() => { void action(async () => {
          const pkg = await r.repo.usable(packageId, await nativeClock.sample())
          const result = await identifyQr(token, pkg, await nativeClock.sample(), r.provider).catch((cause: unknown) => {
            throw new Error(scanIssue(cause instanceof Error ? cause.message : 'No se pudo leer el QR.'))
          })
          await show(result.student, 'QR')
        }) }} /></>}
        <ActionButton secondary label="Reportar incidencia de esta lista" disabled={busy} onPress={openIncident} />
        {canDraft && <ActionButton secondary label="Preparar borrador de infracción · docente validado" disabled={busy}
          onPress={() => router.push({ pathname: '/offline/infraction-draft', params: { packageId } })} />}
        <ActionButton secondary label="Consultar sincronización y recibos" onPress={() => router.push('/offline/sync')} />
        <AppText variant="caption" style={s.muted}>Copia del {laPazInstant(p.manifest.prepared_at)}. Vigente hasta {laPazInstant(p.manifest.expires_at)}. Puede haber cambios posteriores a la descarga.</AppText>
      </View>} />
    {selected && <StudentDetailModal student={selected} exam={heading.subtitle ? heading.title + ' · ' + heading.subtitle : heading.title}
      photos={photos} event={event} item={entries.get(selected.student_id)} step={step}
      error={error} busy={busy} canRecord={canRecord} method={method} onClose={closeDetail}
      onBack={() => { if (step === 'review' && method === 'MANUAL') { setStep('student'); setError(null) } else closeDetail() }}
      onReview={() => { setStep('review'); setError(null) }} onConfirm={capture} onIncident={openIncident} />}
  </>
}
const s = StyleSheet.create({ section: { gap: theme.spacing.md },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  badges: { gap: theme.spacing.xs, maxWidth: '100%' },
  copy: { flex: 1, gap: theme.spacing.xs }, muted: { color: theme.colors.muted },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }, pageButton: { flexBasis: 130, flexGrow: 1 } })
