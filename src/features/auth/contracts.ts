export interface CurrentUser {
  id: number
  display_name: string
  email: string
  status: string
  must_change_password: boolean
  roles: string[]
}
export interface MobileDevice {
  id: number
  installation_id: string
  device_name: string
  platform: 'android'
  app_version: string | null
  status: 'ACTIVE' | 'REVOKED'
  last_login_at: string
  revoked_at: string | null
}
export interface MobileLogin {
  access_token: string
  token_type: 'Bearer'
  expires_at: string
  server_time: string
  abilities: string[]
  device: MobileDevice
  user: CurrentUser
}
export interface StoredSession {
  version: 1
  apiBase: string
  token: string
  expiresAt: string
  serverOffsetMs: number
  userId: number
  deviceId: number
  installationId: string
  logoutPending: boolean
}
export interface SessionStorage {
  load(): Promise<StoredSession | null>
  save(session: StoredSession): Promise<void>
  clear(): Promise<void>
  installationId(): Promise<string>
}
export type SessionStatus = 'initializing' | 'unauthenticated' | 'authenticating' | 'authenticated' | 'expired' | 'offline' | 'recoverable-error'
export interface SessionSnapshot {
  status: SessionStatus
  user: CurrentUser | null
  message: string | null
  busy: boolean
  hasCredential: boolean
  logoutPending: boolean
  expiresAt: string | null
  deviceId: number | null
  validatedAt: string | null
}
