import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { FormField } from '../components/FormField'
import { contentStyles as s } from '../components/contentStyles'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { useDiscipline } from '../features/incidents/useDiscipline'
import { useOffline } from '../features/offline/OfflineProvider'
import { infractionTypes, statusLabels, type InfractionType, type InfractionStatus, type OfficialInfraction, type Person } from '../features/incidents/contracts'
import { ApiError } from '../services/http/errors'

export function InfractionsScreen() {
  const { examId = '', draftId } = useLocalSearchParams<{ examId: string; draftId?: string }>()
  const { api, context } = useDiscipline(examId), offline = useOffline(), [page, setPage] = useState(1)
  const [type, setType] = useState<InfractionType>('COPYING'), [body, setBody] = useState(''), [reason, setReason] = useState('')
  const [term, setTerm] = useState(''), [studentPage, setStudentPage] = useState(1), [student, setStudent] = useState<Person | null>(null)
  const [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false)
  const [draftScope, setDraftScope] = useState<{ runtime: typeof offline.runtime; id: string } | null>(null)
  const work = useRef(false), active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const p = context.data
  const load = useCallback(async () => api && p?.manage ? api.infractions(examId, p, page) : null, [api, p, examId, page])
  const query = useRemoteQuery(load)
  const lookup = useCallback(async () => api && p?.manage ? api.students(examId, p, 'infractions', term, studentPage) : null, [api, p, examId, term, studentPage])
  const students = useRemoteQuery(lookup)
  useEffect(() => {
    let current = true; setBody(''); setStudent(null); setSubmitted(false); setDraftScope(null)
    const r = offline.runtime
    if (draftId && r && p?.manage) void (async () => {
      const draft = (await r.incidents.drafts()).find((d) => d.id === draftId && d.examId === examId)
      if (!draft) throw new Error('No existe este borrador en el almacén del actor actual.')
      const member = await r.repo.student(draft.packageId, draft.studentId)
      r.check()
      if (current) { setType(draft.type); setBody(draft.description); setStudent({ id: Number(member.student_id), first_names: member.first_names, last_names: member.last_names, sis_code: member.sis_code }); setDraftScope({ runtime: r, id: draftId }) }
    })().catch(() => { if (current) setMessage('No se pudo abrir el borrador protegido. No se enviará.') })
    return () => { current = false }
  }, [draftId, offline.runtime, examId, p?.manage])
  const create = async () => {
    if (!api || !p?.manage || !student || work.current || submitted) return
    const r = offline.runtime
    if (draftId && !r) return
    work.current = true; setBusy(true); setMessage(null)
    let began = false
    try {
      const fresh = await api.context(examId)
      if (!active.current || !fresh.manage) throw new Error('No hay autorización actual para registrar infracciones.')
      if (draftId && r) { await r.incidents.beginDraft(draftId); began = true }
      const result = await api.createInfraction(examId, fresh, { studentId: student.id, type, description: body })
      if (draftId && r) await r.incidents.finishDraft(draftId, result.id)
      if (active.current) { setSubmitted(true); setMessage(`Infracción ${result.id} registrada en Laravel como ${statusLabels[result.status]}. No fue confirmada automáticamente.`); query.refresh() }
    } catch (error) {
      const uncertain = !(error instanceof ApiError) || ['timeout', 'network', 'cancelled'].includes(error.kind) || (error.status ?? 0) >= 500
      if (began && draftId && r) { try { await r.incidents.finishDraft(draftId, null, uncertain) } catch { /* SUBMITTING becomes UNCERTAIN on unlock */ } }
      if (active.current) { setSubmitted(uncertain); setMessage(uncertain ? 'Resultado no confirmado. Consulta las infracciones online antes de intentar otro registro. No se reenviará automáticamente.' : error instanceof Error ? error.message : 'Operación denegada.') }
    } finally { work.current = false; if (active.current) setBusy(false) }
  }
  const change = (item: OfficialInfraction, status: InfractionStatus) => Alert.alert('Cambiar estado online', `Confirma el cambio a ${statusLabels[status]}. Laravel comprobará autorización y revisión vigente.`, [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar cambio', onPress: () => { void (async () => {
      if (!api || work.current || !active.current) return
      work.current = true; setBusy(true); setMessage(null)
      try {
        const fresh = await api.context(examId)
        if (!active.current) return
        const result = await api.changeStatus(examId, fresh, item.id, status, reason, item.revision)
        if (active.current) { setMessage(`Laravel confirmó el estado ${statusLabels[result.status]}.`); setReason(''); query.refresh() }
      } catch (e) { if (active.current) { setMessage(e instanceof Error ? e.message : 'Cambio no confirmado. Recarga antes de reintentar.'); query.refresh() } }
      finally { work.current = false; if (active.current) setBusy(false) }
    })() } },
  ])
  if (!p?.manage) return <Screen><Notice message={context.error ?? 'Validando online al docente responsable. Los colaboradores no pueden gestionar infracciones.'} />
    <ActionButton secondary label="Revalidar autorización" onPress={context.refresh} /></Screen>
  if (draftId && (!offline.runtime || draftScope?.runtime !== offline.runtime || draftScope?.id !== draftId)) return <Screen><Notice message={message ?? 'El borrador permanece cifrado. Desbloquea su almacén y espera la revisión de identidad antes de abrirlo.'} /></Screen>
  return <Screen><Text style={s.title}>Infracciones · docente responsable</Text>
    <Notice message="Registro y cambios de estado exclusivamente online. Un borrador no es una infracción oficial. La confirmación no provoca acciones nuevas desde la APK." />
    {(message || query.error || students.error) && <Notice message={message ?? query.error ?? students.error ?? ''} />}
    <ActionButton secondary label="Actualizar listado y autorización" onPress={() => { context.refresh(); query.refresh() }} />
    <Text style={s.subtitle}>{draftId ? 'Revisar borrador antes de registrar online' : 'Registrar una infracción'}</Text>
    <FormField label="Buscar estudiante autorizado online" value={term} onChangeText={(value) => { setTerm(value); setStudentPage(1) }} maxLength={255} />
    {students.data?.data.map((item) => <ActionButton secondary key={item.id} label={`${item.last_names}, ${item.first_names} · SIS ${item.sis_code}`} onPress={() => setStudent(item)} />)}
    {students.data && <><ActionButton secondary label="Estudiantes anteriores" disabled={studentPage <= 1} onPress={() => setStudentPage(studentPage - 1)} />
      <ActionButton secondary label="Más estudiantes" disabled={studentPage >= students.data.lastPage} onPress={() => setStudentPage(studentPage + 1)} /></>}
    <Text style={s.body}>{student ? `Seleccionado: ${student.last_names}, ${student.first_names}` : 'Selecciona un estudiante.'}</Text>
    {infractionTypes.map((item) => <ActionButton key={item.value} label={item.label} secondary={type !== item.value} onPress={() => setType(item.value)} />)}
    <FormField label="Descripción obligatoria" value={body} onChangeText={setBody} maxLength={4000} multiline />
    <ActionButton label="Registrar online como reportada" disabled={!student || !body.trim() || submitted} busy={busy} onPress={() => { void create() }} />
    <Text style={s.subtitle}>Infracciones del examen</Text>
    <FormField label="Motivo obligatorio para un cambio de estado" value={reason} onChangeText={setReason} maxLength={4000} multiline />
    {query.data?.data.map((item) => <View key={item.id} style={s.card}>
      <Text style={s.subtitle}>{item.student.last_names}, {item.student.first_names}</Text>
      <Text style={s.body}>{infractionTypes.find((type) => type.value === item.type)?.label} · {statusLabels[item.status]}</Text>
      <Text style={s.body}>{item.description}</Text>
      {item.allowed.map((status) => <ActionButton secondary key={status} label={`Cambiar a ${statusLabels[status]} · online`} disabled={busy || !reason.trim()} onPress={() => change(item, status)} />)}
    </View>)}
    {query.data && <><ActionButton secondary label="Página anterior" disabled={page <= 1} onPress={() => setPage(page - 1)} />
      <ActionButton secondary label="Página siguiente" disabled={page >= query.data.lastPage} onPress={() => setPage(page + 1)} /></>}
  </Screen>
}
