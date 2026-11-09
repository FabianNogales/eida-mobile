// Pure validation: reading configuration never starts a network request.
export function apiBaseUrl(value: string | undefined): string | null {
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('La URL de API debe usar HTTPS y no incluir credenciales ni parámetros.')
  }
  return url.toString().replace(/\/$/, '')
}

export function resolveApiBase(value: string | undefined): string {
  let base: string | null
  try { base = apiBaseUrl(value?.trim()) }
  catch { throw new Error('EXPO_PUBLIC_EIDA_API_BASE_URL debe ser una URL HTTPS válida, sin credenciales, parámetros ni fragmentos.') }
  if (!base) throw new Error('Configura EXPO_PUBLIC_EIDA_API_BASE_URL con la URL HTTPS del backend.')
  const url = new URL(base)
  if (url.hostname.endsWith('.invalid')) throw new Error('La URL de ejemplo no es un backend. Configura EXPO_PUBLIC_EIDA_API_BASE_URL.')
  const path = url.pathname.replace(/\/+$/, '')
  if (/%2f|%5c|\\/i.test(path) || /\/api\/v1(?:\/|$)/.test(path.replace(/\/api\/v1$/, ''))) {
    throw new Error('La URL contiene un prefijo /api/v1 repetido o una ruta no válida.')
  }
  url.pathname = path.endsWith('/api/v1') ? path : path + '/api/v1'
  return url.toString().replace(/\/$/, '')
}

export function apiEndpoint(base: string, path: string): string {
  // Only application-owned relative routes. Never consume pagination URLs.
  if (!/^[a-z0-9][a-z0-9/-]*$/i.test(path) || path.includes('//') || path === 'api/v1' || path.startsWith('api/v1/')) throw new Error('Ruta API no permitida.')
  const url = new URL(base + '/' + path)
  if (url.origin !== new URL(base).origin || !url.pathname.startsWith(new URL(base).pathname + '/')) {
    throw new Error('La ruta no pertenece al backend configurado.')
  }
  return url.toString()
}

