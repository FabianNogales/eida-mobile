import type { Transport } from './client'

// Expo SDK 58's Android implementation disables OkHttp redirects for manual
// mode and uses NO_COOKIES for omit. Do not substitute RN's legacy fetch here.
export const nativeTransport: Transport = async (url, options) => {
  const { fetch } = await import('expo/fetch')
  return fetch(url, options)
}
