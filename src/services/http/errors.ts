export type ErrorKind = 'configuration' | 'network' | 'timeout' | 'cancelled' | 'http' | 'protocol' | 'storage'

export class ApiError extends Error {
  constructor(public readonly kind: ErrorKind, message: string, public readonly status?: number,
    public readonly code?: string, public readonly fields: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
  }
}

export function httpError(status: number, body: unknown): ApiError {
  const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const code = typeof value.code === 'string' ? value.code : undefined
  const fields: Record<string, string[]> = {}
  if (value.errors && typeof value.errors === 'object') {
    for (const key of ['identifier', 'password', 'installation_id', 'device_name', 'app_version', 'page', 'view', 'search']) {
      const messages = (value.errors as Record<string, unknown>)[key]
      if (Array.isArray(messages)) fields[key] = messages.filter((m): m is string => typeof m === 'string')
    }
  }
  let message = status >= 500 ? 'El servidor no está disponible. Intenta nuevamente más tarde.' : 'No se pudo completar la solicitud.'
  if (status === 401) message = 'La sesión venció o ya no es válida. Inicia sesión nuevamente.'
  if (status === 403) message = 'El servidor no autoriza esta consulta para tu usuario.'
  if (status === 404) message = 'El recurso o la ruta solicitada no está disponible.'
  if (status === 422) message = 'Revisa los datos enviados. El identificador o la contraseña pueden ser incorrectos.'
  if (status === 429) message = 'Demasiados intentos. Espera antes de volver a intentarlo.'
  if (fields.identifier?.includes('La cuenta se encuentra inactiva.')) message = 'La cuenta se encuentra inactiva. Contacta con la administración.'
  if (code === 'ACCOUNT_INACTIVE') message = 'La cuenta se encuentra inactiva. Contacta con la administración.'
  if (code === 'PASSWORD_CHANGE_REQUIRED') message = 'Debes cambiar tu contraseña inicial en EIDA Web antes de continuar.'
  if (code === 'MOBILE_OPERATOR_REQUIRED') message = 'Se requiere un examen propio o una colaboración vigente para usar EIDA Control.'
  if (code === 'MOBILE_CONFIGURATION_INVALID') message = 'La autenticación móvil no está habilitada correctamente en el servidor.'
  if (code === 'MOBILE_DEVICE_REVOKED') message = 'Esta instalación fue revocada. Inicia sesión nuevamente.'
  if (code === 'DISTRIBUTION_FROZEN') message = 'DISTRIBUTION_FROZEN: la distribución está congelada y sus datos cambiaron. Requiere revisión; no se regenerará ni reasignará automáticamente.'
  if (code === 'DISTRIBUTION_STALE') message = 'DISTRIBUTION_STALE: el examen, los miembros o la autorización cambiaron. El paquete requiere revisión.'
  if (code === 'PHOTO_CHANGED') message = 'La fotografía institucional cambió durante la preparación. Solicita un paquete nuevo.'
  if (code === 'MOBILE_ABILITY_REQUIRED') message = 'La credencial móvil no tiene el permiso necesario para esta operación.'
  if (['EXAM_CANCELLED', 'EXAM_ENDED', 'EXAM_FINISHED', 'EXAM_STATE_NOT_ALLOWED'].includes(code ?? '')) message = 'El estado o la vigencia del examen impide preparar el paquete offline.'
  return new ApiError('http', message, status, code, fields)
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Puedes volver a intentarlo.'
}

export const protocolError = () => new ApiError('protocol', 'El servidor devolvió una respuesta inesperada. Verifica la versión de la API móvil.')
