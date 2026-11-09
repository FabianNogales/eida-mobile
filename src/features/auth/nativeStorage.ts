import { createSessionStorage, type SecureDriver } from './storage'

const options = { keychainService: 'bo.eida.control.session', requireAuthentication: false }
const driver: SecureDriver = {
  async getItem(key) { const store = await import('expo-secure-store'); return store.getItemAsync(key, options) },
  async setItem(key, value) { const store = await import('expo-secure-store'); await store.setItemAsync(key, value, options) },
  async deleteItem(key) { const store = await import('expo-secure-store'); await store.deleteItemAsync(key, options) },
}

export const nativeSessionStorage = createSessionStorage(driver, async () => {
  const { default: crypto } = await import('react-native-quick-crypto')
  return crypto.randomUUID()
})
