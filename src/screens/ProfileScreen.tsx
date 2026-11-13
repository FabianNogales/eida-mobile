import { useCallback, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusBadge } from '../components/StatusBadge'
import { IdentityBlock } from '../components/general/IdentityBlock'
import { ExamIcon, type ExamIconName } from '../components/general/ExamIcon'
import { QueryFeedback } from '../components/general/QueryFeedback'
import { OperationDetails } from '../components/operations/OperationDetails'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import type { CurrentUser } from '../features/auth/contracts'
import { canAccessPrivate } from '../features/auth/guards'
import { devices } from '../features/exams/api'
import { useOffline } from '../features/offline/OfflineProvider'
import { useRemoteQuery } from '../hooks/useRemoteQuery'
import { usePrivateRefresh } from '../hooks/usePrivateRefresh'
import { logoutConfirmation } from '../ui/generalScreens'
import { pendingSummary } from '../ui/pendingSummary'
import { useQueueReadiness } from '../ui/useQueueReadiness'
import { laPazInstant } from '../utils/dates'

type ProfilePanel = 'connectivity' | 'help' | 'about'
const panelTitles: Record<ProfilePanel, string> = { connectivity: 'Conectividad', help: 'Ayuda', about: 'Acerca de' }
const institutionalRoles = new Map([
  ['DOCENTE', 'Docente'],
  ['COLABORADOR', 'Colaborador'],
  ['ADMINISTRADOR', 'Administrador'],
])

export function ProfileScreen() {
  const { session } = useAuth()
  return session.user && canAccessPrivate(session) ? <AccountProfile key={session.user.id} user={session.user} /> : null
}

function AccountProfile({ user }: { user: CurrentUser }) {
  const { session, controller } = useAuth(), router = useRouter()
  const offline = useOffline()
  const [panel, setPanel] = useState<ProfilePanel | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const load = useCallback((signal: AbortSignal) => devices(controller!, signal), [controller, user.id])
  const query = useRemoteQuery(load)
  const refresh = usePrivateRefresh(query.reload, query.loading || session.busy || confirmLogout || panel !== null)
  const known = useQueueReadiness(offline.runtime, offline.busy)
  const summary = pendingSummary(known, offline.syncItems, offline.incidentItems)
  const roles = [...new Set(user.roles.map((role) => institutionalRoles.get(role) ?? role))]
  const connectivity = query.loading ? 'Comprobando' : query.data ? 'Respondió' : 'Sin comprobar'
  const deviceHint = query.data ? `${query.data.filter((device) => device.status === 'ACTIVE').length} dispositivos activos` : 'Administrar accesos'
  const version = Constants.expoConfig?.version
  const closePanel = () => setPanel(null)

  return <Screen refresh={refresh}>
    <IdentityBlock name={user.display_name} detail={user.email} roles={roles} />
    <Card style={s.menu}>
      <ProfileRow icon="wifi" label="Conectividad" hint="Consulta al servidor y sesión" onPress={() => setPanel('connectivity')}
        trailing={<StatusBadge label={connectivity} tone={query.data ? 'success' : 'neutral'} />} />
      <ProfileRow icon="person" label="Dispositivos autorizados" hint={deviceHint} onPress={() => router.push('/(private)/devices')} />
      <ProfileRow icon="help" label="Ayuda" hint="Guía rápida de EIDA Control" onPress={() => setPanel('help')} />
      <ProfileRow icon="info" label="Acerca de" hint={version ? `EIDA Control · Versión ${version}` : 'Información de la aplicación'}
        onPress={() => setPanel('about')} last />
    </Card>
    <ActionButton secondary label="Cerrar sesión" icon={<ExamIcon name="logout" />} busy={session.busy} onPress={() => setConfirmLogout(true)} />
    {panel && <OperationDetails title={panelTitles[panel]} footerBack onClose={closePanel}>
      {panel === 'connectivity' && <>
        {query.data && <StatusBadge label="El servidor respondió a la última consulta" tone="success" />}
        <QueryFeedback loading={query.loading} error={query.error} label="Comprobando acceso al servidor" retry={() => { void query.reload() }} />
        {session.validatedAt && <AppText>Última validación de sesión: {laPazInstant(session.validatedAt)}</AppText>}
        {session.expiresAt && <AppText>Vencimiento: {laPazInstant(session.expiresAt)}</AppText>}
        <ActionButton secondary label="Volver a validar sesión" busy={session.busy} onPress={() => {
          closePanel()
          void controller?.restore()
        }} />
      </>}
      {panel === 'help' && <>
        <AppText>Abre un examen y prepara tu lista con conexión antes de controlar ingresos sin internet.</AppText>
        <AppText>Escanea un QR o busca al estudiante en tu lista. Revisa su identidad antes de confirmar el ingreso.</AppText>
        <AppText>Abre Pendientes para enviar registros y revisar el resultado del servidor.</AppText>
        <ActionButton secondary label="Abrir Pendientes" onPress={() => {
          closePanel()
          router.navigate('/(private)/(tabs)/pending')
        }} />
      </>}
      {panel === 'about' && <>
        <AppText variant="subtitle">EIDA Control</AppText>
        {version && <AppText>Versión {version}</AppText>}
        <AppText>Control de ingreso a exámenes de la Universidad Mayor de San Simón.</AppText>
        {__DEV__ && <ActionButton secondary label="Diagnóstico QR v3" onPress={() => {
          closePanel()
          router.push('/qr-diagnostics')
        }} />}
      </>}
      <ActionButton secondary label="Volver" onPress={closePanel} />
    </OperationDetails>}
    <ConfirmDialog visible={confirmLogout && canAccessPrivate(session)} title="¿Cerrar sesión?"
      message={logoutConfirmation(summary)} confirmLabel="Cerrar sesión" destructive onCancel={() => setConfirmLogout(false)}
      onConfirm={() => {
        setConfirmLogout(false)
        const current = controller?.getSnapshot()
        if (controller && current && canAccessPrivate(current) && !current.busy) void controller.logout()
      }} />
  </Screen>
}

function ProfileRow({ label, hint, icon, onPress, trailing, last = false }: {
  label: string; hint: string; icon: ExamIconName; onPress(): void; trailing?: ReactNode; last?: boolean
}) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [s.row, last && s.last, pressed && s.pressed]}>
    <ExamIcon name={icon} />
    <View style={s.copy}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="caption" style={s.muted}>{hint}</AppText>
    </View>
    <View style={s.end}>{trailing ?? <ExamIcon name="chevron" />}</View>
  </Pressable>
}

const s = StyleSheet.create({
  menu: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { minHeight: 60, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border },
  last: { borderBottomWidth: 0 },
  pressed: { backgroundColor: theme.colors.background },
  copy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  end: { maxWidth: '42%', alignItems: 'flex-end' },
  muted: { color: theme.colors.muted },
})
