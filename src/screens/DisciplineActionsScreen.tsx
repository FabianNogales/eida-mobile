import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
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
        } catch { setMessage('Operación no confirmada. Revisa el estado online antes de reintentar. No se ejecutó ninguna sanción en SQLite.'); expulsions.refresh(); entries.refresh() }
        finally { work.current = false; setBusy(false) }
      })() } },
    ])
  if (!p?.manage) return <Screen><Notice message={context.error ?? 'Esta pantalla requiere conexión y autorización actual del docente responsable.'} />
    <ActionButton secondary label="Validar autorización online" onPress={context.refresh} /></Screen>
  const lastPage = mode === 'expulsions' ? expulsions.data?.lastPage : entries.data?.lastPage
  return <Screen><Text style={s.title}>Acciones disciplinarias online</Text>
    <Notice message="Solo docente responsable. No se crean expulsiones ni anulaciones offline. La APK conserva las reglas institucionales de Laravel." />
    {[message, expulsions.error, entries.error, students.error].filter(Boolean).map((text, index) => <Notice key={index} message={text ?? ''} />)}
    <ActionButton secondary={mode !== 'expulsions'} label="Expulsiones" disabled={busy} onPress={() => { setMode('expulsions'); setPage(1); setReason('') }} />
    <ActionButton secondary={mode !== 'entries'} label="Anulación de ingresos" disabled={busy} onPress={() => { setMode('entries'); setPage(1); setReason('') }} />
    <ActionButton secondary label="Actualizar autorización y estados oficiales" onPress={() => { context.refresh(); expulsions.refresh(); entries.refresh(); students.refresh() }} />
    <FormField label="Motivo obligatorio" value={reason} onChangeText={setReason} maxLength={4000} multiline />
    {mode === 'expulsions' ? <>
      <FormField label="Buscar estudiante autorizado" value={term} onChangeText={(value) => { setTerm(value); setStudentPage(1) }} maxLength={255} />
      {students.data?.data.map((student) => <ActionButton key={student.id} secondary label={`Expulsar a ${student.last_names}, ${student.first_names} · online`}
        disabled={!reason.trim() || busy} onPress={() => perform(student.id, `${student.last_names}, ${student.first_names}`)} />)}
      {students.data && <><ActionButton secondary label="Estudiantes anteriores" disabled={studentPage <= 1} onPress={() => setStudentPage(studentPage - 1)} />
        <ActionButton secondary label="Más estudiantes" disabled={studentPage >= students.data.lastPage} onPress={() => setStudentPage(studentPage + 1)} /></>}
      {expulsions.data?.data.map((item) => <View key={item.id} style={s.card}><Text style={s.subtitle}>Expulsión oficial {item.id}</Text>
        <Text style={s.body}>{item.student.last_names}, {item.student.first_names}</Text><Text style={s.body}>{item.reason}</Text></View>)}
    </> : entries.data?.data.map((entry) => <View key={entry.id} style={s.card}><Text style={s.subtitle}>{entry.name}</Text>
      <Text style={s.body}>{entry.status === 'ANNULLED' ? 'Ingreso anulado' : entry.status === 'VALID' ? 'Ingreso válido' : 'Consultar estado con el responsable'}</Text>
      {entry.canAnnul && <ActionButton secondary label="Anular ingreso · online" disabled={!reason.trim() || busy} onPress={() => perform(entry.id, `Ingreso ${entry.id} de ${entry.name}`)} />}</View>)}
    <ActionButton secondary label="Página anterior" disabled={page <= 1 || busy} onPress={() => setPage(page - 1)} />
    <ActionButton secondary label="Página siguiente" disabled={lastPage === undefined || page >= lastPage || busy} onPress={() => setPage(page + 1)} />
  </Screen>
}
