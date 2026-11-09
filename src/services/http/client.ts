import { apiEndpoint, resolveApiBase } from '../../config/api'
import { ApiError, httpError, protocolError } from './errors'

export interface ResponsePort {
  status: number
  url: string
  redirected?: boolean
  type?: string
  text(): Promise<string>
  arrayBuffer?(): Promise<ArrayBuffer>
}
export type Transport = (url: string, init: RequestInit) => Promise<ResponsePort>
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  token?: string
  body?: unknown
  query?: Record<string, string | number>
  signal?: AbortSignal
  expectedStatus?: number
  responseType?: 'bytes'
}

export class HttpClient {
  private readonly pending = new Set<AbortController>()
  constructor(readonly baseUrl: string, private readonly transport: Transport, private readonly timeoutMs = 15000) {
    if (resolveApiBase(baseUrl) !== baseUrl) throw new ApiError('configuration', 'Usa la URL base API normalizada, sin barra final ni prefijos omitidos.')
  }

  abortAll() { for (const controller of this.pending) controller.abort(); this.pending.clear() }

  async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const url = new URL(apiEndpoint(this.baseUrl, path))
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, String(value))
    if (options.token && /[\r\n]/.test(options.token)) throw protocolError()
    const controller = new AbortController()
    this.pending.add(controller)
    let timedOut = false
    const cancel = () => controller.abort()
    options.signal?.addEventListener('abort', cancel, { once: true })
    if (options.signal?.aborted) cancel()
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, this.timeoutMs)
    try {
      if (controller.signal.aborted) throw new ApiError('cancelled', 'Solicitud cancelada.')
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (options.token) headers.Authorization = 'Bearer ' + options.token
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      const response = await this.transport(url.toString(), {
        method: options.method ?? 'GET', headers, signal: controller.signal,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'omit', redirect: 'manual',
      })
      if (response.type === 'opaqueredirect' || response.redirected || (response.status >= 300 && response.status < 400)) {
        throw new ApiError('configuration', 'La API está redirigiendo solicitudes. Configura su URL HTTPS final, incluido el prefijo del proxy.')
      }
      if (response.url && response.url !== url.toString()) throw new ApiError('configuration', 'La respuesta no corresponde a la URL solicitada.')
      if (response.status >= 200 && response.status < 300 && options.expectedStatus !== undefined && response.status !== options.expectedStatus) throw protocolError()
      if (response.status === 204) return undefined
      if (options.responseType === 'bytes' && response.status >= 200 && response.status < 300) {
        if (!response.arrayBuffer) throw protocolError()
        return new Uint8Array(await response.arrayBuffer())
      }
      const raw = await response.text()
      let data: unknown
      try { data = raw ? JSON.parse(raw) : null } catch {
        if (response.status < 200 || response.status >= 300) throw httpError(response.status, null)
        throw protocolError()
      }
      if (response.status < 200 || response.status >= 300) throw httpError(response.status, data)
      return data
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (timedOut) throw new ApiError('timeout', 'El servidor tardó demasiado en responder. Puedes reintentar manualmente.')
      if (controller.signal.aborted) throw new ApiError('cancelled', 'Solicitud cancelada.')
      throw new ApiError('network', 'No se pudo conectar con el backend. Comprueba la conexión e intenta nuevamente.')
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', cancel)
      this.pending.delete(controller)
    }
  }
}
