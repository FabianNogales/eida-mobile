import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { FormField } from '../components/FormField'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { LoadingState } from '../components/FeedbackStates'
import { ChoiceChips } from '../components/operations/ChoiceChips'
import { FormExitDialog } from '../components/operations/FormExitDialog'
import { OperationState } from '../components/operations/OperationState'
import { theme } from '../config/theme'
import { useUnsavedChanges } from '../navigation/useUnsavedChanges'
import { reportDescriptionError } from '../ui/operations'
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
  return <Screen><AppText variant="subtitle" accessibilityRole="header">{draft ? 'Borrador de infracción' : 'Reportar incidencia'}</AppText>
    {runtime && pkg && (!draft || ownerAllowed) ? <LocalReportForm key={`${pkg.id}:${draft}`} runtime={runtime} pkg={pkg} draft={draft} /> : <Notice message={error ?? (draft ? 'Primero valida online tu permiso de docente responsable para este paquete. Un colaborador no puede preparar infracciones.' : 'Comprobando la autorización del paquete…')} />}
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
  const [searching, setSearching] = useState(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    let current = true; setStudents([]); setSearching(true)
    void r.repo.search(p.id, term, offset).then((rows) => { r.check(); if (current) setStudents(rows) }).catch(() => { if (current) setError('Consulta local bloqueada.') })
      .finally(() => { if (current) setSearching(false) })
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
  const exit = useUnsavedChanges({
    hasUnsavedChanges: !saved && (!!body || !!term || !!selected || type !== 'IDENTIFICATION' || infraction !== 'COPYING'),
    canProtectRoute: offline.runtime === r && offline.packages.some((item) => item.id === p.id && item.active && item.state === 'PREPARADO'),
    onDiscard() { setBody(''); setTerm(''); setSelected(null) },
  })
  const descriptionError = body.length > 0 ? reportDescriptionError(body) : null
  if (saved) return <Card>
    <OperationState label={draft ? 'Borrador local protegido' : 'Reporte pendiente de sincronización'} icon="…" tone="warning" />
    <Notice message={draft ? `BORRADOR LOCAL · ${saved}. No es una infracción registrada ni confirmada. No se enviará automáticamente.`
      : `Reporte guardado en el dispositivo · UUID ${saved}. Aún no está registrado en Laravel.`} />
    <ActionButton label="Ver detalle y estado" onPress={() => router.replace({ pathname: '/offline/incidents', params: draft ? {} : { eventId: saved } })} />
  </Card>
  return <View style={s.form}>
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">{p.manifest.exam.name}</AppText>
      <Notice tone="info" message={draft ? 'Borrador cifrado para el docente previamente validado. No aplica sanciones ni se convierte automáticamente en infracción.'
        : 'Reporte descriptivo, sin sanción automática. Solo puedes seleccionar estudiantes de tu lista descargada.'} />
      {error && <Notice tone="error" message={error} />}
      <AppText variant="label">Tipo {draft ? 'de infracción propuesta' : 'de incidencia'}</AppText>
      {draft ? <ChoiceChips options={infractionTypes} value={infraction} onChange={setInfraction} disabled={busy} />
        : <ChoiceChips options={incidentTypes} value={type} onChange={setType} disabled={busy} />}
      <FormField label="Descripción obligatoria" value={body} onChangeText={setBody} multiline maxLength={4000} editable={!busy} error={descriptionError} />
    </Card>
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">{draft ? 'Estudiante de tu lista' : 'Estudiante relacionado · opcional'}</AppText>
      <AppText>{selected ? `${selected.last_names}, ${selected.first_names} · SIS ${selected.sis_code}`
        : draft ? 'Selecciona un estudiante de tu lista.' : 'Incidencia general, sin estudiante relacionado.'}</AppText>
      {!draft && <ActionButton secondary label="Sin estudiante · incidencia general" disabled={busy} onPress={() => setSelected(null)} />}
      <FormField label="Buscar estudiante en mi lista" value={term} maxLength={120} editable={!busy}
        onChangeText={(value) => { setTerm(value); setOffset(0) }} />
      {searching && <LoadingState label="Buscando en la lista autorizada" />}
      {!searching && !error && students.length === 0 && <AppText>No hay coincidencias en esta página local.</AppText>}
      {students.map((student) => <ActionButton secondary key={student.student_id} disabled={busy}
        label={`${student.last_names}, ${student.first_names} · SIS ${student.sis_code}`} onPress={() => setSelected(student)} />)}
      <ActionButton secondary label="Página anterior" disabled={!offset || busy} onPress={() => setOffset(Math.max(0, offset - 50))} />
      <ActionButton secondary label="Página siguiente" disabled={students.length < 50 || busy} onPress={() => setOffset(offset + 50)} />
    </Card>
    <ActionButton label={draft ? 'Guardar borrador provisional' : 'Guardar incidencia pendiente'} busy={busy}
      disabled={!body.trim() || !!descriptionError || (draft && !selected)} onPress={() => { void save() }} />
    <FormExitDialog exit={exit} />
  </View>
}
const s = StyleSheet.create({ form: { gap: theme.spacing.lg } })
