import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { Notice } from '../components/Notice'
import { FormField } from '../components/FormField'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { EmptyState } from '../components/FeedbackStates'
import { StatusBadge } from '../components/StatusBadge'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { ChoiceChips } from '../components/operations/ChoiceChips'
import { FormExitDialog } from '../components/operations/FormExitDialog'
import { OnlineAccessState } from '../components/operations/OnlineAccessState'
import { OperationDetails } from '../components/operations/OperationDetails'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { useUnsavedChanges } from '../navigation/useUnsavedChanges'
import { reportDescriptionError } from '../ui/operations'
import { infractionFormPolicy, sameInfractionFormScope, type InfractionFormScope } from '../ui/infractionFormScope'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { useDiscipline } from '../features/incidents/useDiscipline'
import { useOffline } from '../features/offline/OfflineProvider'
import { infractionTypes, statusLabels, type InfractionType, type InfractionStatus, type OfficialInfraction, type Person } from '../features/incidents/contracts'
import { ApiError } from '../services/http/errors'

export function InfractionsScreen() {
  const { examId = '', draftId } = useLocalSearchParams<{ examId: string; draftId?: string }>()
  const { api, context } = useDiscipline(examId), offline = useOffline(), [page, setPage] = useState(1)
  const { session: authSession } = useAuth()
  const canAccess = canAccessPrivate(authSession)
  const initializedScope = useRef<InfractionFormScope | null>(null), hydratedScope = useRef<InfractionFormScope | null>(null)
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
    let current = true
    const r = offline.runtime
    const scope: InfractionFormScope = { actorId: authSession.user?.id ?? null, deviceId: authSession.deviceId,
      examId, draftId: draftId ?? null, runtime: r }
    const policy = infractionFormPolicy(initializedScope.current, scope, canAccess,
      p && String(p.examId) === examId ? p.manage : undefined)
    const clearFields = () => { setBody(''); setStudent(null); setReason(''); setTerm(''); setType('COPYING'); setDraftScope(null) }
    if (policy.resetScope) {
      initializedScope.current = scope; hydratedScope.current = null
      clearFields(); setMessage(null)
      if (policy.resetSubmission) setSubmitted(false)
    }
    if (policy.clearPrivateFields) {
      clearFields(); hydratedScope.current = null
      // Do not reset submitted here: a denial/revalidation must not enable a retry.
      return
    }
    // Loading/refreshing permissions for the same actor/exam hides the form but
    // leaves its in-memory input and existing submitted barrier unchanged.
    if (draftId && r && policy.canHydrateDraft && !sameInfractionFormScope(hydratedScope.current, scope)) void (async () => {
      const draft = (await r.incidents.drafts()).find((d) => d.id === draftId && d.examId === examId)
      if (!draft) throw new Error('No existe este borrador en el almacén del actor actual.')
      const member = await r.repo.student(draft.packageId, draft.studentId)
      r.check()
      if (current) { hydratedScope.current = scope; setType(draft.type); setBody(draft.description); setStudent({ id: Number(member.student_id), first_names: member.first_names, last_names: member.last_names, sis_code: member.sis_code }); setDraftScope({ runtime: r, id: draftId }) }
    })().catch(() => { if (current) setMessage('No se pudo abrir el borrador protegido. No se enviará.') })
    return () => { current = false }
  }, [draftId, offline.runtime, examId, p?.examId, p?.manage, authSession.user?.id, authSession.deviceId, canAccess])
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
  const [detailId, setDetailId] = useState<number | null>(null)
  const dirty = !!reason.trim() || (!submitted && (!!body.trim() || !!term || student !== null || type !== 'COPYING'))
  const exit = useUnsavedChanges({
    hasUnsavedChanges: dirty,
    canProtectRoute: canAccessPrivate(authSession) && !!p?.manage && String(p.examId) === examId,
    onDiscard() { setBody(''); setReason(''); setStudent(null); setTerm('') },
  })
  const descriptionError = body.length > 0 ? reportDescriptionError(body) : null
  const allowed = canAccess && p?.manage && String(p.examId) === examId
  const detail = allowed ? query.data?.data.find((item) => item.id === detailId && String(item.examId) === examId) : null
  if (!allowed) return <Screen><OnlineAccessState loading={context.loading} error={context.error}
    message="Solo el docente autorizado puede gestionar infracciones de este examen." retry={context.refresh} /></Screen>
  if (draftId && (!offline.runtime || draftScope?.runtime !== offline.runtime || draftScope?.id !== draftId)) return <Screen>
    <Notice message={message ?? 'El borrador permanece cifrado. Desbloquea su almacén y espera la revisión de identidad antes de abrirlo.'} /></Screen>
  return <Screen>
    <AppText variant="subtitle" accessibilityRole="header">Gestión docente de infracciones</AppText>
    <Notice tone="info" message="Registro y cambios de estado solo online. Un borrador local no es una infracción oficial y no se envía automáticamente." />
    {message && <Notice message={message} />}
    <ActionButton secondary label="Actualizar autorización y listado" disabled={busy} busy={context.loading}
      onPress={() => { context.refresh(); query.refresh() }} />
    {dirty && <AppText variant="caption">Los cambios se conservan mientras continúe tu autorización.</AppText>}
    <ActionButton secondary label="Actualizar solo el listado oficial" disabled={busy} onPress={query.refresh} />
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">{draftId ? 'Revisar borrador protegido' : 'Nuevo reporte de infracción'}</AppText>
      <QueryFeedback loading={students.loading} error={students.error} label="Consultando estudiantes autorizados" retry={students.refresh} />
      <FormField label="Buscar estudiante autorizado online" value={term} editable={!busy && !submitted}
        onChangeText={(value) => { setTerm(value); setStudentPage(1) }} maxLength={255} />
      {students.data?.data.map((item) => <ActionButton secondary key={item.id} disabled={busy || submitted}
        label={`${item.last_names}, ${item.first_names} · SIS ${item.sis_code}`} onPress={() => setStudent(item)} />)}
      {students.data?.data.length === 0 && <AppText>No hay estudiantes en esta consulta.</AppText>}
      {students.data && <><ActionButton secondary label="Estudiantes anteriores" disabled={studentPage <= 1 || busy || submitted} onPress={() => setStudentPage(studentPage - 1)} />
        <ActionButton secondary label="Más estudiantes" disabled={studentPage >= students.data.lastPage || busy || submitted} onPress={() => setStudentPage(studentPage + 1)} /></>}
      <AppText>{student ? `Seleccionado: ${student.last_names}, ${student.first_names}` : 'Selecciona un estudiante autorizado.'}</AppText>
      <ChoiceChips options={infractionTypes} value={type} onChange={setType} disabled={busy || submitted} />
      <FormField label="Descripción obligatoria" value={body} editable={!busy && !submitted} onChangeText={setBody} maxLength={4000} multiline error={descriptionError} />
      <ActionButton label="Registrar online como reportada" disabled={!student || !body.trim() || !!descriptionError || submitted} busy={busy} onPress={() => { void create() }} />
      {submitted && <Notice message="El formulario no se reenviará. Consulta el resultado en el listado oficial antes de iniciar otra operación." />}
    </Card>
    <QueryFeedback loading={query.loading} error={query.error} label="Consultando infracciones oficiales" retry={query.refresh} />
    <AppText variant="subtitle" accessibilityRole="header">Infracciones del examen</AppText>
    <FormField label="Motivo obligatorio para cambiar un estado" value={reason} editable={!busy} onChangeText={setReason} maxLength={4000} multiline />
    {query.data?.data.filter((item) => String(item.examId) === examId).map((item) => <Card key={item.id}>
      <StatusBadge label={statusLabels[item.status] ?? item.status} />
      <AppText variant="subtitle">{item.student.last_names}, {item.student.first_names}</AppText>
      <AppText>{infractionTypes.find((type) => type.value === item.type)?.label}</AppText>
      <ActionButton secondary label="Detalle de infracción" onPress={() => setDetailId(item.id)} />
      {item.allowed.map((status) => <ActionButton secondary key={status} label={`Cambiar a ${statusLabels[status]} · online`}
        disabled={busy || !reason.trim()} onPress={() => change(item, status)} />)}
    </Card>)}
    {query.data?.data.length === 0 && <EmptyState title="Sin infracciones en esta página" message="No se incorporan infracciones de demostración." />}
    {query.data && <><ActionButton secondary label="Página anterior" disabled={page <= 1 || busy} onPress={() => setPage(page - 1)} />
      <ActionButton secondary label="Página siguiente" disabled={page >= query.data.lastPage || busy} onPress={() => setPage(page + 1)} /></>}
    <FormExitDialog exit={exit} />
    {detail && <OperationDetails title="Detalle de infracción oficial" backLabel="Volver a infracciones" onClose={() => setDetailId(null)}>
      <StatusBadge label={statusLabels[detail.status] ?? detail.status} />
      <AppText variant="subtitle">{detail.student.last_names}, {detail.student.first_names}</AppText>
      <AppText>SIS {detail.student.sis_code} · examen {detail.examId}</AppText>
      <AppText>{detail.description}</AppText><AppText>Revisión oficial: {detail.revision}</AppText>
    </OperationDetails>}
  </Screen>
}
