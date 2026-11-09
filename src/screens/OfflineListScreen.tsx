import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Image, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { FormField } from '../components/FormField'
import { contentStyles as s } from '../components/contentStyles'
import { useOffline } from '../features/offline/OfflineProvider'
import { nativeClock } from '../features/offline/clock'
import { anchoredNow } from '../features/offline/clock'
import { captureProvisional, identifyQr } from '../features/offline/identity'
import type { OfflineStudent, PackageRecord, ProvisionalEvent } from '../features/offline/contracts'
import { laPazInstant } from '../utils/dates'

export function OfflineListScreen() {
  const params = useLocalSearchParams<{ packageId: string }>(), offline = useOffline(), router = useRouter()
  const packageId = typeof params.packageId === 'string' ? params.packageId : '', r = offline.runtime
  const viewScope = useRef(r)
  const currentState = offline.packages.find((item) => item.id === packageId)
  const blocked = currentState && (!currentState.active || currentState.state !== 'PREPARADO')
  const [p, setPackage] = useState<PackageRecord | null>(null), [term, setTerm] = useState(''), [offset, setOffset] = useState(0)
  const [students, setStudents] = useState<OfflineStudent[]>([]), [selected, setSelected] = useState<OfflineStudent | null>(null)
  const [photos, setPhotos] = useState<{ kind: string; uri: string }[]>([]), [event, setEvent] = useState<ProvisionalEvent | null>(null)
  const [error, setError] = useState<string | null>(null), [token, setToken] = useState(''), [busy, setBusy] = useState(false)
  const [canDraft, setCanDraft] = useState(false)
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
    setPackage(null); setStudents([]); setSelected(null); setPhotos([]); setEvent(null); setToken('')
    if (r) void (async () => {
      const pkg = await r.repo.usable(packageId, await nativeClock.sample())
      const rows = await r.repo.search(packageId, term, offset)
      r.check(); if (current) { viewScope.current = r; setPackage(pkg); setStudents(rows); setError(null) }
    })().catch((e) => { if (current) setError(e instanceof Error ? e.message : 'Consulta bloqueada.') })
    return () => { current = false }
  }, [r, packageId, term, offset])
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
  const action = async (fn: () => Promise<void>) => {
    if (!r || busy) return
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Operación local bloqueada.') }
    finally { setBusy(false) }
  }
  const show = async (student: OfflineStudent) => {
    if (!r) return
    await r.repo.usable(packageId, await nativeClock.sample())
    const images: { kind: string; uri: string }[] = []
    const { Buffer } = await import('react-native-quick-crypto')
    for (const photo of student.photos) if (photo.state === 'PRESENT') {
      const bytes = await r.repo.photo(packageId, student.student_id, photo.kind)
      if (!bytes || r.digest(bytes) !== photo.sha256) throw new Error('La fotografía local no pasó la comprobación de integridad.')
      images.push({ kind: photo.kind, uri: `data:${photo.mime};base64,${Buffer.from(bytes).toString('base64')}` })
    }
    const local = await r.repo.event(p!.examId, student.student_id)
    r.check(); setSelected(student); setPhotos(images); setEvent(local)
  }
  const capture = (method: 'MANUAL' | 'QR') => {
    if (!r || !selected) return
    Alert.alert('Registrar provisionalmente', 'Confirma la identidad y las fotos. El registro quedará PENDIENTE DE SINCRONIZACIÓN; el servidor decidirá su aceptación.', [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Guardar pendiente', onPress: () => { void action(async () => {
        const result = await captureProvisional(r.repo, packageId, selected.student_id, method, await nativeClock.sample(), r.uuid, r.provider, token)
        r.check(); setEvent(result); setToken(''); await offline.refresh()
      }) } },
    ])
  }
  if (!r) return <Screen><Notice message="El almacén está bloqueado. Desbloquéalo con biometría para consultar tu lista." />
    <ActionButton label="Ir al desbloqueo" onPress={() => router.replace('/offline')} /></Screen>
  if (blocked && currentState) return <Screen><Notice message={`Consulta bloqueada: ${currentState.state}. Los eventos pendientes se conservan protegidos.`} />
    <ActionButton label="Ver paquetes y estado" onPress={() => router.replace('/offline')} /></Screen>
  return <Screen>
    <Text style={s.title}>Mi lista offline</Text>
    {error && <Notice message={error} />}
    {p && viewScope.current === r && <>
      <Text style={s.subtitle}>{p.manifest.exam.name} · {p.manifest.responsible_name}</Text>
      <ActionButton secondary label="Reportar incidencia offline" onPress={() => router.push({ pathname: '/offline/report-incident', params: { packageId } })} />
      {canDraft && <ActionButton secondary label="Preparar borrador de infracción · docente validado" onPress={() => router.push({ pathname: '/offline/infraction-draft', params: { packageId } })} />}
      <Text style={s.body}>Lista {p.manifest.list_id} · v{p.manifest.version} · {p.manifest.surname_range.from ?? '—'} a {p.manifest.surname_range.to ?? '—'}</Text>
      <Notice message={`Habilitación e ingreso conocidos al ${laPazInstant(p.manifest.prepared_at)}. Los cambios y revocaciones posteriores pueden desconocerse. Vigencia: ${laPazInstant(p.manifest.expires_at)}.`} />
      <FormField label="Buscar localmente por nombre, apellidos, SIS o CI" value={term} maxLength={120} onChangeText={(v) => { setOffset(0); setTerm(v) }} />
      {students.map((student) => <ActionButton key={student.student_id} secondary label={`${student.last_names}, ${student.first_names} · SIS ${student.sis_code}`}
        disabled={busy} onPress={() => { void action(() => show(student)) }} />)}
      {!students.length && <Text style={s.body}>No hay coincidencias en esta página local.</Text>}
      <ActionButton secondary label="Página anterior" disabled={offset === 0 || busy} onPress={() => setOffset(Math.max(0, offset - 50))} />
      <ActionButton secondary label="Página siguiente" disabled={students.length < 50 || busy} onPress={() => setOffset(offset + 50)} />
      <Text style={s.subtitle}>Identificar mediante QR v3</Text>
      <ActionButton label="Escanear QR" disabled={busy} onPress={() => router.push({ pathname: '/offline/scan', params: { packageId } })} />
      <Text style={s.body}>{p.manifest.qr.available ? 'Firma y lista verificables con material público del snapshot. Revocaciones posteriores desconocidas.' : 'NO DISPONIBLE: el servidor actual emite QR v2. La consulta manual sigue disponible.'}</Text>
      <FormField label="Contenido QR (lector externo o pegado manual)" value={token} maxLength={4096} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} multiline />
      <ActionButton label="Verificar QR e identificar" disabled={!token || busy} onPress={() => { void action(async () => {
        const pkg = await r.repo.usable(packageId, await nativeClock.sample())
        const result = await identifyQr(token, pkg, await nativeClock.sample(), r.provider)
        const duplicate = await r.repo.event(pkg.examId, result.student.student_id)
        if (duplicate) throw new Error('Duplicado local conocido: ya existe una operación pendiente para este estudiante.')
        await show(result.student)
      }) }} />
      {selected && <View style={s.card}>
        <Text style={s.subtitle}>{selected.last_names}, {selected.first_names}</Text>
        <Text style={s.body}>SIS: {selected.sis_code} · CI: {selected.identity_number}</Text>
        <Text style={s.body}>Inscripción: {selected.enrollment_status ?? 'Desconocida'} · habilitación: {selected.eligibility_status ?? 'Desconocida'} · revisión: {selected.eligibility_revision ?? '—'}</Text>
        <Text style={s.body}>Ingreso conocido al descargar: {selected.entry_status}</Text>
        {selected.photos.filter((f) => f.state === 'ABSENT').map((f) => <Text key={f.kind} style={s.body}>Fotografía {f.kind}: ausencia informada por el servidor.</Text>)}
        {photos.map((f) => <View key={f.kind}><Text style={s.label}>Fotografía {f.kind}</Text><Image accessibilityLabel={`Fotografía ${f.kind} institucional`} source={{ uri: f.uri }} style={{ width: 220, height: 260 }} resizeMode="contain" /></View>)}
        {event ? <>
          {receipt?.status === 'ACCEPTED' ? <Notice message={`INGRESO OFICIAL CONFIRMADO por Laravel · registro ${receipt.entry_id}.`} /> :
            receipt?.status === 'DUPLICATE' ? <Notice message={`El servidor informa un ingreso oficial existente (${receipt.entry_id}); esta operación es un duplicado.`} /> :
            receipt ? <Notice message={`${receipt.status}: ${receipt.code}. ${receipt.message} Sin nuevo ingreso oficial confirmado.`} /> :
            <Notice message={`REGISTRADO LOCALMENTE · PENDIENTE DE SINCRONIZACIÓN. UUID: ${event.event_id}. Hora estimada: ${laPazInstant(event.captured_at)}. Sin confirmación oficial.`} />}
        </> : <>
          <ActionButton label="Registro manual provisional" busy={busy} onPress={() => capture('MANUAL')} />
          <ActionButton secondary label="Registro QR provisional" disabled={!token || !p.manifest.qr.available || busy} onPress={() => capture('QR')} />
        </>}
        {p.manifest.qr.available && <Notice message="La sincronización QR v3 requiere que Laravel anuncie su soporte y verifique la evidencia. La firma del celular no constituye confirmación oficial." />}
      </View>}
    </>}
  </Screen>
}
