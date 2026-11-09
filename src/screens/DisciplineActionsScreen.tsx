import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { ChoiceChips } from '../components/operations/ChoiceChips'
import { FormExitDialog } from '../components/operations/FormExitDialog'
import { OnlineAccessState } from '../components/operations/OnlineAccessState'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { useUnsavedChanges } from '../navigation/useUnsavedChanges'
import { useDiscipline } from '../features/incidents/useDiscipline'
import { useRemoteQuery } from '../hooks/useRemoteQuery'

export function DisciplineActionsScreen() {
  const { examId = '' } = useLocalSearchParams<{ examId: string }>(), { api, context } = useDiscipline(examId), p = context.data
  const [mode, setMode] = useState<'expulsions' | 'entries'>('expulsions'), [page, setPage] = useState(1)
  const [studentPage, setStudentPage] = useState(1), [term, setTerm] = useState(''), [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false), work = useRef(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const loadExpulsions = useCallback(async () => api && p?.manage && mode === 'expulsions' ? api.expulsions(examId, p, page) : null, [api, p, mode, examId, page])
  const expulsions = useRemoteQuery(loadExpulsions)
  const loadEntries = useCallback(async () => api && p?.manage && mode === 'entries' ? api.entries(examId, p, page) : null, [api, p, mode, examId, page])
  const entries = useRemoteQuery(loadEntries)
  const lookup = useCallback(async () => api && p?.manage && mode === 'expulsions' ? api.students(examId, p, 'expulsions', term, studentPage) : null, [api, p, mode, examId, term, studentPage])
  const students = useRemoteQuery(lookup)
  const perform = (target: number, label: string) => Alert.alert(mode === 'expulsions' ? 'Registrar expulsión online' : 'Anular ingreso online',
    `${label}. Confirma esta acción oficial. Laravel comprobará sus reglas y autorización vigente.`, [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar online', style: 'destructive', onPress: () => { void (async () => {
        if (!api || work.current || !active.current) return
        work.current = true; setBusy(true); setMessage(null)
        try {
          const fresh = await api.context(examId)
          if (!active.current) return
          if (mode === 'expulsions') { const id = await api.expel(examId, fresh, target, reason); setMessage(`Laravel confirmó la expulsión ${id}.`) }
          else { await api.annul(examId, fresh, target, reason); setMessage(`Laravel confirmó la anulación del ingreso ${target}.`) }
          setReason(''); expulsions.refresh(); entries.refresh()
        } catch (error) { setMessage(`${error instanceof Error ? error.message + ' ' : ''}Operación no confirmada. Revisa el estado online antes de reintentar. No se ejecutó ninguna sanción en SQLite.`); expulsions.refresh(); entries.refresh() }
        finally { work.current = false; setBusy(false) }
      })() } },
    ])
  const { session: authSession } = useAuth()
  const exit = useUnsavedChanges({
    hasUnsavedChanges: !!reason.trim(), canProtectRoute: canAccessPrivate(authSession) && !!p?.manage && String(p.examId) === examId,
    onDiscard() { setReason(''); setTerm('') },
  })
  const options: { value: 'expulsions' | 'entries'; label: string }[] = [
    { value: 'expulsions', label: 'Expulsiones' }, { value: 'entries', label: 'Anulación de ingresos' },
  ]
  const changeMode = (next: 'expulsions' | 'entries') => {
    if (next === mode) return
    const change = () => { setMode(next); setPage(1); setReason('') }
    if (reason.trim()) Alert.alert('Cambiar de operación', 'Se descartará el motivo que aún no has enviado.', [
      { text: 'Seguir editando', style: 'cancel' }, { text: 'Descartar motivo', style: 'destructive', onPress: change },
    ])
    else change()
  }
  if (!p?.manage || String(p.examId) !== examId) return <Screen>
    <OnlineAccessState loading={context.loading} error={context.error}
      message="Esta cuenta no está autorizada como docente responsable para estas acciones." retry={context.refresh} /></Screen>
  const lastPage = mode === 'expulsions' ? expulsions.data?.lastPage : entries.data?.lastPage
  return <Screen>
    <AppText variant="subtitle" accessibilityRole="header">Acciones sensibles · solo online</AppText>
    <Notice message="Las expulsiones y anulaciones afectan registros oficiales. No se ejecutan ni se encolan en SQLite; requieren autorización actual de Laravel." />
    {message && <Notice message={message} />}
    <ChoiceChips options={options} value={mode} disabled={busy} onChange={changeMode} />
    <ActionButton secondary label="Actualizar autorización y estados oficiales" disabled={busy || !!reason.trim()}
      onPress={() => { context.refresh(); expulsions.refresh(); entries.refresh(); students.refresh() }} />
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">{mode === 'expulsions' ? 'Motivo de expulsión' : 'Motivo de anulación'}</AppText>
      <FormField label="Motivo obligatorio" value={reason} editable={!busy} onChangeText={setReason} maxLength={4000} multiline />
      <AppText>La acción requiere una confirmación explícita. Cancelar no envía ninguna solicitud.</AppText>
    </Card>
    {mode === 'expulsions' ? <>
      <QueryFeedback loading={students.loading} error={students.error} label="Consultando estudiantes autorizados" retry={students.refresh} />
      <FormField label="Buscar estudiante autorizado" value={term} editable={!busy} onChangeText={(value) => { setTerm(value); setStudentPage(1) }} maxLength={255} />
      {students.data?.data.map((student) => <Card key={student.id}>
        <AppText variant="subtitle">{student.last_names}, {student.first_names}</AppText>
        <AppText>SIS {student.sis_code}</AppText>
        <ActionButton variant="danger" label="Solicitar expulsión online" disabled={!reason.trim() || busy}
          onPress={() => perform(student.id, `${student.last_names}, ${student.first_names}`)} />
      </Card>)}
      {students.data?.data.length === 0 && <AppText>No hay estudiantes en esta consulta.</AppText>}
      {students.data && <><ActionButton secondary label="Estudiantes anteriores" disabled={studentPage <= 1 || busy} onPress={() => setStudentPage(studentPage - 1)} />
        <ActionButton secondary label="Más estudiantes" disabled={studentPage >= students.data.lastPage || busy} onPress={() => setStudentPage(studentPage + 1)} /></>}
      <AppText variant="subtitle" accessibilityRole="header">Expulsiones oficiales</AppText>
      <QueryFeedback loading={expulsions.loading} error={expulsions.error} label="Consultando expulsiones oficiales" retry={expulsions.refresh} />
      {expulsions.data?.data.map((item) => <Card key={item.id}>
        <StatusBadge label={`Expulsión oficial ${item.id}`} tone="error" />
        <AppText variant="subtitle">{item.student.last_names}, {item.student.first_names}</AppText><AppText>{item.reason}</AppText>
      </Card>)}
      {expulsions.data?.data.length === 0 && <AppText>No hay expulsiones en esta página oficial.</AppText>}
    </> : <>
      <QueryFeedback loading={entries.loading} error={entries.error} label="Consultando ingresos oficiales" retry={entries.refresh} />
      {entries.data?.data.map((entry) => <Card key={entry.id}>
        <AppText variant="subtitle">{entry.name}</AppText>
        <StatusBadge label={entry.status === 'ANNULLED' ? 'Ingreso anulado' : entry.status === 'VALID' ? 'Ingreso válido' : entry.status}
          tone={entry.status === 'ANNULLED' ? 'error' : 'neutral'} />
        {entry.canAnnul && <ActionButton variant="danger" label="Solicitar anulación online" disabled={!reason.trim() || busy}
          onPress={() => perform(entry.id, `Ingreso ${entry.id} de ${entry.name}`)} />}
      </Card>)}
      {entries.data?.data.length === 0 && <AppText>No hay ingresos en esta página oficial.</AppText>}
    </>}
    <ActionButton secondary label="Página anterior" disabled={page <= 1 || busy} onPress={() => setPage(page - 1)} />
    <ActionButton secondary label="Página siguiente" disabled={lastPage === undefined || page >= lastPage || busy} onPress={() => setPage(page + 1)} />
    <FormExitDialog exit={exit} />
  </Screen>
}
