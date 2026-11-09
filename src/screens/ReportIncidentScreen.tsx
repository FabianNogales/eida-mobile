import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { FormField } from '../components/FormField'
import { contentStyles as s } from '../components/contentStyles'
import { useProtectedPackage } from '../features/incidents/useProtectedPackage'
import { useOffline } from '../features/offline/OfflineProvider'
import { nativeClock } from '../features/offline/clock'
import { incidentTypes, infractionTypes, type IncidentType, type InfractionType } from '../features/incidents/contracts'
import type { VaultRuntime } from '../features/offline/nativeVault'
import type { OfflineStudent, PackageRecord } from '../features/offline/contracts'

export function ReportIncidentScreen({ draft = false }: { draft?: boolean }) {
  const params = useLocalSearchParams<{ packageId: string }>(), packageId = typeof params.packageId === 'string' ? params.packageId : ''
  const { runtime, pkg, error } = useProtectedPackage(packageId), router = useRouter()
  const [ownerAllowed, setOwnerAllowed] = useState(false)
  useEffect(() => {
    let current = true; setOwnerAllowed(false)
    if (runtime && draft) void nativeClock.sample().then((sample) => runtime.incidents.canDraft(packageId, sample)).then((allowed) => {
      runtime.check(); if (current) setOwnerAllowed(allowed)
    }).catch(() => {})
    return () => { current = false }
  }, [runtime, draft, packageId])
  return <Screen><Text style={s.title}>{draft ? 'Borrador de infracción' : 'Reportar incidencia'}</Text>
    {runtime && pkg && (!draft || ownerAllowed) ? <LocalReportForm runtime={runtime} pkg={pkg} draft={draft} /> : <Notice message={error ?? (draft ? 'Primero valida online tu permiso de docente responsable para este paquete. Un colaborador no puede preparar infracciones.' : 'Comprobando la autorización del paquete…')} />}
    <ActionButton secondary label="Ver reportes locales" onPress={() => router.replace('/offline/incidents')} />
    <ActionButton secondary label="Paquetes protegidos" onPress={() => router.replace('/offline')} />
  </Screen>
}
function LocalReportForm({ runtime: r, pkg: p, draft }: { runtime: VaultRuntime; pkg: PackageRecord; draft: boolean }) {
  const offline = useOffline(), router = useRouter(), work = useRef(false), active = useRef(true)
  const [type, setType] = useState<IncidentType>('IDENTIFICATION'), [infraction, setInfraction] = useState<InfractionType>('COPYING')
  const [body, setBody] = useState(''), [term, setTerm] = useState(''), [offset, setOffset] = useState(0)
  const [students, setStudents] = useState<OfflineStudent[]>([]), [selected, setSelected] = useState<OfflineStudent | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState<string | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    let current = true; setStudents([])
    void r.repo.search(p.id, term, offset).then((rows) => { r.check(); if (current) setStudents(rows) }).catch(() => { if (current) setError('Consulta local bloqueada.') })
    return () => { current = false }
  }, [r, p.id, term, offset])
  const save = async () => {
    if (work.current || saved) return
    work.current = true; setBusy(true); setError(null)
    try {
      const sample = await nativeClock.sample()
      if (!active.current) return
      const result = draft ? await r.incidents.saveDraft(p.id, { studentId: selected?.student_id ?? '', type: infraction, description: body }, sample, r.uuid) :
        await r.incidents.capture(p.id, { type, description: body, studentId: selected?.student_id ?? null }, sample, r.uuid)
      r.check()
      if (!active.current) return
      setSaved('event_id' in result ? result.event_id : result.id); setBody('')
      await offline.refresh()
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'No se pudo guardar el reporte.') }
    finally { work.current = false; if (active.current) setBusy(false) }
  }
  if (saved) return <View style={s.card}><Notice message={draft ? `BORRADOR LOCAL · ${saved}. No es una infracción registrada ni confirmada. No se enviará automáticamente.` : `PENDIENTE DE SINCRONIZACIÓN · UUID ${saved}. Aún no está registrada en Laravel.`} />
    <ActionButton label="Ver detalle y estado" onPress={() => router.replace({ pathname: '/offline/incidents', params: draft ? {} : { eventId: saved } })} /></View>
  return <>
    <Text style={s.subtitle}>{p.manifest.exam.name}</Text>
    <Notice message={draft ? 'Solo preparación cifrada para el docente responsable previamente validado online. Confirmaciones y cambios de estado requieren internet; este borrador no se convierte automáticamente en infracción.' : 'Reporte descriptivo, sin sanción automática. Los estudiantes seleccionables pertenecen exclusivamente a tu lista descargada.'} />
    {error && <Notice message={error} />}
    {draft ? infractionTypes.map((item) => <ActionButton key={item.value} secondary={infraction !== item.value} label={item.label} onPress={() => setInfraction(item.value)} />) :
      incidentTypes.map((item) => <ActionButton key={item.value} secondary={type !== item.value} label={item.label} onPress={() => setType(item.value)} />)}
    <FormField label="Descripción obligatoria" value={body} onChangeText={setBody} multiline maxLength={4000} />
    <Text style={s.body}>{selected ? `Estudiante: ${selected.last_names}, ${selected.first_names} · SIS ${selected.sis_code}` : draft ? 'Selecciona un estudiante de tu lista.' : 'Incidencia general, sin estudiante relacionado.'}</Text>
    {!draft && <ActionButton secondary label="Sin estudiante · incidencia general" onPress={() => setSelected(null)} />}
    <FormField label="Buscar estudiante en mi lista" value={term} maxLength={120} onChangeText={(value) => { setTerm(value); setOffset(0) }} />
    {students.map((student) => <ActionButton secondary key={student.student_id} label={`${student.last_names}, ${student.first_names} · SIS ${student.sis_code}`} onPress={() => setSelected(student)} />)}
    <ActionButton secondary label="Página anterior" disabled={!offset} onPress={() => setOffset(Math.max(0, offset - 50))} />
    <ActionButton secondary label="Página siguiente" disabled={students.length < 50} onPress={() => setOffset(offset + 50)} />
    <ActionButton label={draft ? 'Guardar borrador provisional' : 'Guardar incidencia pendiente'} busy={busy} disabled={!body.trim() || (draft && !selected)} onPress={() => { void save() }} />
  </>
}
