import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Notice } from '../components/Notice'
import { StatusBadge } from '../components/StatusBadge'
import { IdentityBlock } from '../components/general/IdentityBlock'
import { ControlHelp } from '../components/general/ControlHelp'
import { ExamIcon, type ExamIconName } from '../components/general/ExamIcon'
import { OperationDetails } from '../components/operations/OperationDetails'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { useOffline } from '../features/offline/OfflineProvider'
import type { LocalProfile } from '../features/offline/vaultAccess'
import { useNetwork } from '../features/connectivity/NetworkProvider'
import { connectionLabels } from '../features/connectivity/state'
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
  const { access, runtime } = useOffline()
  if (access !== 'online-session' && access !== 'local-session') return null
  const profile = access === 'online-session' ? session.user : runtime?.profile
  return <AccountProfile key={profile?.id ?? runtime?.repo.binding.userId} user={profile ?? null} />
}

function AccountProfile({ user }: { user: LocalProfile | null }) {
  const { session, controller } = useAuth(), router = useRouter()
  const offline = useOffline()
  const network = useNetwork()
  const [panel, setPanel] = useState<ProfilePanel | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const known = useQueueReadiness(offline.runtime, offline.busy)
  const summary = pendingSummary(known, offline.syncItems, offline.incidentItems)
  const roles = [...new Set(user?.roles.map((role) => institutionalRoles.get(role) ?? role))]
  const version = Constants.expoConfig?.version
  const closePanel = () => setPanel(null)

  return <Screen>
    {user ? <IdentityBlock name={user.display_name} detail={user.email} roles={roles} />
      : <Notice message="Conéctate para consultar los datos de tu perfil. Puedes seguir usando tus listas descargadas y Pendientes." />}
    <AppText variant="caption">Tus funciones de docente o colaborador dependen del examen asignado.</AppText>
    <Card style={s.menu}>
      <ProfileRow icon="wifi" label="Conectividad" hint="Estado de red y sesión" onPress={() => setPanel('connectivity')}
        trailing={<StatusBadge label={connectionLabels[network]} tone={network === 'online' ? 'success' : 'neutral'} />} />
      <ProfileRow icon="help" label="Ayuda" hint="Guía rápida de EIDA Control" onPress={() => setPanel('help')} />
      <ProfileRow icon="info" label="Acerca de" hint={version ? `EIDA Control · Versión ${version}` : 'Información de la aplicación'}
        onPress={() => setPanel('about')} last />
    </Card>
    <ActionButton secondary label="Cerrar sesión" icon={<ExamIcon name="logout" />} busy={session.busy} onPress={() => setConfirmLogout(true)} />
    {panel && <OperationDetails title={panelTitles[panel]} footerBack onClose={closePanel}>
      {panel === 'connectivity' && <>
        <AppText>{connectionLabels[network]}</AppText>
        {offline.access === 'local-session' && session.message && <Notice message={session.message} />}
        {session.validatedAt && <AppText>Última validación de sesión: {laPazInstant(session.validatedAt)}</AppText>}
        {session.expiresAt && <AppText>Vencimiento: {laPazInstant(session.expiresAt)}</AppText>}
        <ActionButton secondary label="Volver a validar sesión" busy={session.busy} disabled={network === 'offline'} onPress={() => {
          void controller?.restore()
        }} />
      </>}
      {panel === 'help' && <>
        <ControlHelp />
        <ActionButton secondary label="Abrir Pendientes" onPress={() => {
          closePanel()
          router.navigate('/(private)/(tabs)/pending')
        }} />
        <ActionButton secondary label="Ver listas descargadas" onPress={() => {
          closePanel()
          router.push('/offline')
        }} />
      </>}
      {panel === 'about' && <>
        <AppText variant="subtitle">EIDA Control</AppText>
        {version && <AppText>Versión {version}</AppText>}
        <AppText>Control de ingreso a exámenes de la Universidad Mayor de San Simón.</AppText>
      </>}
      <ActionButton secondary label="Volver" onPress={closePanel} />
    </OperationDetails>}
    <ConfirmDialog visible={confirmLogout} title="¿Cerrar sesión?"
      message={logoutConfirmation(summary)} confirmLabel="Cerrar sesión" destructive onCancel={() => setConfirmLogout(false)}
      onConfirm={() => {
        setConfirmLogout(false)
        const current = controller?.getSnapshot()
        if (controller && current?.hasCredential && !current.logoutPending && !current.busy) void controller.logout()
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
