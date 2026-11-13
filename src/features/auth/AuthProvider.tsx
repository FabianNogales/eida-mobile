import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import Constants from 'expo-constants'
import { resolveApiBase } from '../../config/api'
import { HttpClient } from '../../services/http/client'
import { nativeTransport } from '../../services/http/nativeTransport'
import { AuthApi } from './api'
import { nativeSessionStorage } from './nativeStorage'
import { SessionController } from './session'
import type { SessionSnapshot } from './contracts'
import { nextResumeState, shouldRestoreOnResume } from './resume'

const emptySubscribe = () => () => {}
const Context = createContext<{ session: SessionSnapshot; controller: SessionController | null } | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [runtime] = useState(() => {
    try {
      const base = resolveApiBase(process.env.EXPO_PUBLIC_EIDA_API_BASE_URL)
      const http = new HttpClient(base, nativeTransport)
      return { controller: new SessionController(http, new AuthApi(http, Constants.expoConfig?.version ?? '0.1.0'), nativeSessionStorage), fallback: null }
    } catch (error) {
      const fallback: SessionSnapshot = { status: 'recoverable-error', user: null,
        message: error instanceof Error ? error.message : 'La configuración de API no es válida.',
        busy: false, hasCredential: false, logoutPending: false, expiresAt: null, deviceId: null, validatedAt: null }
      return { controller: null, fallback }
    }
  })
  const controller = runtime.controller
  const session = useSyncExternalStore(controller?.subscribe ?? emptySubscribe,
    controller?.getSnapshot ?? (() => runtime.fallback!), controller?.getSnapshot ?? (() => runtime.fallback!))

  useEffect(() => {
    void controller?.restore()
    let previous: string | null = AppState.currentState
    const subscription = AppState.addEventListener('change', (state) => {
      const restore = controller && shouldRestoreOnResume(previous, state, controller.getSnapshot())
      previous = nextResumeState(previous, state)
      if (restore) void controller?.restore()
    })
    return () => subscription.remove()
  }, [controller])
  useEffect(() => {
    if (!controller || session.status !== 'authenticated') return
    const timer = setTimeout(() => { void controller.checkExpiry() }, Math.min(2147483647, Math.max(0, controller.remainingMs())))
    return () => clearTimeout(timer)
  }, [controller, session.status, session.expiresAt, session.validatedAt])
  return <Context.Provider value={{ session, controller }}>{children}</Context.Provider>
}

export function useAuth() {
  const context = useContext(Context)
  if (!context) throw new Error('AuthProvider no está disponible.')
  return context
}
