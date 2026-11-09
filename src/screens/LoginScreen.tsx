import { useState } from 'react'
import { Alert, Text } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { ActionButton } from '../components/ActionButton'
import { FormField } from '../components/FormField'
import { Notice } from '../components/Notice'
import { contentStyles as s } from '../components/contentStyles'
import { useAuth } from '../features/auth/AuthProvider'
import { canAccessPrivate } from '../features/auth/guards'

export function LoginScreen() {
  const { session, controller } = useAuth()
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  if (canAccessPrivate(session)) return <Redirect href="/(private)" />
  if (session.status === 'initializing' || (controller && (session.status === 'recoverable-error' ||
      (session.status === 'offline' && session.hasCredential)))) return <Redirect href="/session" />
  const disabled = !controller || session.busy || session.hasCredential
  const submit = () => {
    if (disabled || !controller) return
    const submitted = password
    setPassword('')
    void controller.login(identifier, submitted)
  }
  return <Screen home>
    <Text style={s.label}>EIDA CONTROL · ANDROID</Text>
    <Text style={s.title}>Iniciar sesión</Text>
    <Text style={s.body}>Accede con tu cuenta institucional para consultar tus exámenes y colaboraciones autorizadas.</Text>
    {session.message && <Notice message={session.message} />}
    <FormField label="Correo o código institucional" value={identifier} onChangeText={setIdentifier}
      autoCapitalize="none" autoCorrect={false} autoComplete="username" keyboardType="email-address" maxLength={100} editable={!disabled} />
    <FormField label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry
      autoCapitalize="none" autoCorrect={false} autoComplete="current-password" maxLength={20} editable={!disabled}
      returnKeyType="go" onSubmitEditing={submit} />
    <ActionButton label="Ingresar" busy={session.status === 'authenticating'} disabled={disabled} onPress={submit} />
    {session.logoutPending && <>
      <ActionButton secondary label="Reintentar revocación remota" busy={session.busy} onPress={() => { void controller?.logout() }} />
      <ActionButton secondary label="Olvidar credencial local" disabled={session.busy} onPress={() => Alert.alert('Eliminar solo del celular',
        'El token podría seguir vigente en el servidor. Puedes revocarlo desde EIDA Web. ¿Eliminarlo de este dispositivo?',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar localmente', style: 'destructive', onPress: () => { void controller?.forgetLocal() } }])} />
    </>}
    {!controller && <Text style={s.body}>Configura EXPO_PUBLIC_EIDA_API_BASE_URL y vuelve a cargar la aplicación. Consulta la documentación de fase 3.</Text>}
    <Text style={s.body}>Si tienes una contraseña inicial, cámbiala en EIDA Web antes de ingresar. No guardamos tu contraseña.</Text>
    <ActionButton secondary label="Desbloquear mis paquetes offline" onPress={() => router.push('/offline')} />
    <ActionButton secondary label="Diagnóstico QR v3 · desarrollo" onPress={() => router.push('/qr-diagnostics')} />
  </Screen>
}
