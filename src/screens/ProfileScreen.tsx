import { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Notice } from '../components/Notice'
import { StatusBadge } from '../components/StatusBadge'
import { IdentityBlock } from '../components/general/IdentityBlock'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'
import { devices } from '../features/exams/api'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { logoutConfirmation } from '../ui/generalScreens'
import { pendingSummary } from '../ui/pendingSummary'
import { laPazInstant } from '../utils/dates'

export function ProfileScreen() {
  const { session } = useAuth()
  return session.user ? <AccountProfile key={session.user.id} /> : null
}
function AccountProfile() {
  const { session, controller } = useAuth(), router = useRouter()
  const offline = useOffline()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const load = useCallback((signal: AbortSignal) => devices(controller!, signal), [controller, session.user?.id])
  const query = useRemoteQuery(load)
  const summary = pendingSummary(offline.runtime !== null, offline.syncItems, offline.incidentItems)
  const currentDevice = query.data?.find((device) => device.id === session.deviceId)
  return <Screen>
    <IdentityBlock name={session.user?.display_name ?? ''} detail={session.user?.email} />
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">Cuenta institucional</AppText>
      <StatusBadge label={session.user?.status === 'ACTIVE' ? 'Cuenta activa' : session.user?.status ?? 'Estado no disponible'}
        tone={session.user?.status === 'ACTIVE' ? 'success' : 'warning'} />
      <AppText>Funciones de cuenta: {session.user?.roles.join(' · ') || 'Sin rol global declarado'}</AppText>
      <AppText style={s.muted}>La colaboración y las acciones docentes se autorizan para cada examen. Un rol visible no concede permisos adicionales.</AppText>
    </Card>
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">Sesión</AppText>
      <StatusBadge label="Sesión validada" tone="info" />
      {session.validatedAt && <AppText>Última validación: {laPazInstant(session.validatedAt)}</AppText>}
      {session.expiresAt && <AppText>Vencimiento informado: {laPazInstant(session.expiresAt)}</AppText>}
      <AppText variant="caption" style={s.muted}>America/La_Paz. La última validación no acredita conexión continua.</AppText>
      <ActionButton secondary label="Volver a validar con el servidor" busy={session.busy} onPress={() => { void controller?.restore() }} />
    </Card>
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">Dispositivos autorizados</AppText>
      <QueryFeedback loading={query.loading} error={query.error} label="Consultando dispositivos" retry={query.refresh} />
      {query.data && <AppText>{query.data.filter((device) => device.status === 'ACTIVE').length} activos · {query.data.filter((device) => device.status === 'REVOKED').length} revocados</AppText>}
      {query.data && <AppText variant="caption" style={s.muted}>Estado según la última consulta. Actualiza después de administrar dispositivos.</AppText>}
      {currentDevice && <AppText>Esta sesión: {currentDevice.device_name}</AppText>}
      {query.data?.length === 0 && <AppText>No hay dispositivos en la consulta actual.</AppText>}
      <ActionButton secondary label="Actualizar dispositivos" busy={query.loading} onPress={query.refresh} />
      <ActionButton secondary label="Administrar dispositivos" onPress={() => router.push('/(private)/devices')} />
    </Card>
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">Antes de cerrar sesión</AppText>
      <Notice tone={summary && summary.pending + summary.attention === 0 ? 'info' : 'warning'} message={summary
        ? `${summary.pending} operaciones por enviar · ${summary.attention} conflictos o rechazos. Las colas se revisan por separado.`
        : 'El almacén está bloqueado. Desbloquéalo desde Pendientes para revisar si hay operaciones locales.'} />
      <ActionButton secondary label="Revisar pendientes" onPress={() => router.push('/(private)/pending')} />
      <ActionButton variant="danger" label="Cerrar sesión" busy={session.busy} onPress={() => setConfirmLogout(true)} />
    </Card>
    <TextAction label="Diagnóstico QR v3 · desarrollo" onPress={() => router.push('/qr-diagnostics')} />
    <ConfirmDialog visible={confirmLogout && canAccessPrivate(session)} title="¿Cerrar sesión?"
      message={logoutConfirmation(summary)} confirmLabel="Cerrar sesión" destructive onCancel={() => setConfirmLogout(false)}
      onConfirm={() => { setConfirmLogout(false); if (canAccessPrivate(session) && !session.busy) void controller?.logout() }} />
  </Screen>
}
const s = StyleSheet.create({ muted: { color: theme.colors.muted } })
