import { useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormField } from '../components/FormField'
import type { TextInputHandle } from '../components/keyboardFocus'
import { Notice } from '../components/Notice'
import { EidaBrand } from '../components/general/EidaBrand'
import { TextAction } from '../components/general/TextAction'
import { theme } from '../config/theme'
import { useAuth } from '../features/auth/AuthProvider'
import { loginPresentation } from '../ui/generalScreens'

export function LoginScreen() {
  const { session, controller } = useAuth()
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [forget, setForget] = useState(false)
  const passwordInput = useRef<TextInputHandle | null>(null)
  const view = loginPresentation(session, controller !== null)
  if (view.destination) return <Redirect href={view.destination} />
  const submit = () => {
    if (view.disabled || !controller) return
    const submitted = password
    setPassword(''); setVisible(false)
    void controller.login(identifier, submitted)
  }
  return <Screen home contentStyle={s.content}>
    <View style={s.hero}>
      <EidaBrand />
      <AppText variant="title" accessibilityRole="header">Control de ingreso</AppText>
      <AppText style={s.muted}>Acceso para personal autorizado de la UMSS.</AppText>
    </View>
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">Inicia sesión</AppText>
      {view.message && <Notice message={view.message} />}
      <FormField label="Correo o código institucional" value={identifier} onChangeText={setIdentifier}
        autoCapitalize="none" autoCorrect={false} autoComplete="username" keyboardType="email-address"
        maxLength={100} editable={!view.disabled} returnKeyType="next" submitBehavior="submit"
        onSubmitEditing={() => passwordInput.current?.focus()} />
      <FormField ref={passwordInput} label="Contraseña" value={password} onChangeText={setPassword}
        secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="current-password"
        maxLength={20} editable={!view.disabled} returnKeyType="go" onSubmitEditing={submit} />
      <TextAction label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} disabled={view.disabled}
        onPress={() => setVisible((old) => !old)} />
      <ActionButton label="Iniciar sesión" busy={view.loading} disabled={view.disabled} onPress={submit} />
      <TextAction label="¿Problemas para ingresar?" onPress={() => Alert.alert('Ayuda para ingresar',
        'Utiliza tu cuenta institucional. Si tienes una contraseña inicial, cámbiala en EIDA Web. Si la cuenta está inactiva o no tienes una asignación vigente, consulta con la administración.')} />
    </Card>
    {session.logoutPending && <Card>
      <AppText variant="subtitle">Cierre pendiente de confirmación</AppText>
      <AppText>La revocación remota aún no se confirmó. Puedes reintentar o eliminar únicamente la credencial de este celular.</AppText>
      <ActionButton secondary label="Reintentar revocación remota" busy={session.busy} onPress={() => { void controller?.logout() }} />
      <TextAction label="Olvidar credencial local" disabled={session.busy} onPress={() => setForget(true)} />
    </Card>}
    {!controller && <Notice tone="error" message="No se pudo configurar la conexión con EIDA. Solicita la revisión de la configuración de la aplicación." />}
    <ActionButton secondary label="Abrir mis paquetes offline" onPress={() => router.push('/offline')} />
    <AppText variant="caption" style={s.footer}>No guardamos tu contraseña. Los permisos los determina EIDA para tu cuenta y cada examen.</AppText>
    <TextAction label="Diagnóstico QR v3 · desarrollo" onPress={() => router.push('/qr-diagnostics')} />
    <AppText variant="caption" style={s.footer}>Universidad Mayor de San Simón · Cochabamba</AppText>
    <ConfirmDialog visible={forget && session.logoutPending} title="Eliminar solo del celular"
      message="El token podría seguir vigente en el servidor. Puedes revocarlo desde EIDA Web. Esta acción no confirma su revocación remota."
      confirmLabel="Eliminar credencial local" destructive onCancel={() => setForget(false)}
      onConfirm={() => { setForget(false); if (!session.busy && session.logoutPending) void controller?.forgetLocal() }} />
  </Screen>
}
const s = StyleSheet.create({
  content: { maxWidth: theme.layout.dialogMaxWidth },
  hero: { gap: theme.spacing.lg, paddingVertical: theme.spacing.lg },
  muted: { color: theme.colors.muted }, footer: { color: theme.colors.muted, textAlign: 'center' },
})
