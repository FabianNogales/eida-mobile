// No requests are made in phase 2. A future API client must use this validated origin.
export function apiBaseUrl(value: string | undefined): string | null {
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('La URL de API debe usar HTTPS y no incluir credenciales ni parámetros.')
  }
  return url.toString().replace(/\/$/, '')
}

