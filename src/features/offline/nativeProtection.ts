import * as SecureStore from 'expo-secure-store'
import { inspectProtection } from './protection'

// A real, empty in-memory connection: no application DB, key, DDL or student
// data. This diagnosis never grants access or replaces initializeCipher's guard.
export function inspectNativeProtection() {
  return inspectProtection(() => SecureStore.canUseBiometricAuthentication(), async () => {
    const sqlite = await import('expo-sqlite')
    const db = await sqlite.openDatabaseAsync(':memory:', { useNewConnection: true })
    return { version: () => db.getFirstAsync('PRAGMA cipher_version'), close: () => db.closeAsync() }
  })
}
