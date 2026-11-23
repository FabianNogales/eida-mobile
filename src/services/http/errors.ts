export type ErrorKind = 'configuration' | 'network' | 'timeout' | 'cancelled' | 'http' | 'protocol' | 'storage'

export class ApiError extends Error {
  constructor(public readonly kind: ErrorKind, message: string, public readonly status?: number,
    public readonly code?: string, public readonly fields: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
  }
}

export function httpError(status: number, body: unknown, request?: string): ApiError {
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
  if (code === 'DISTRIBUTION_FROZEN') message = 'El servidor bloqueó la actualización de esta distribución. Solicita al responsable de EIDA que revise el cambio. Cuando esté resuelto, vuelve a pulsar Actualizar copia. Tus pendientes se conservan.'
  if (code === 'DISTRIBUTION_STALE') message = 'Cambió la distribución de estudiantes. Conéctate, abre el examen y pulsa Actualizar copia antes de continuar. Tus pendientes se conservan.'
  if (code === 'PHOTO_CHANGED') message = 'Una fotografía cambió durante la descarga. Vuelve al examen y prepara una copia nueva.'
  if (code === 'OFFLINE_PHOTO_UNAVAILABLE') {
    message = 'No se pudo obtener una fotografía de tu lista. Prepara una copia nueva; si persiste, solicita al responsable revisar las fotos del examen. Tus pendientes se conservan.'
    // Only the bounded error contract is displayed; never remote messages, paths or image data.
    const detail = value.photo_error && typeof value.photo_error === 'object'
      ? value.photo_error as Record<string, unknown> : {}
    const stage = detail.stage === 'manifest' ? 'generación del manifiesto' : detail.stage === 'photo' ? 'descarga de fotografía' : null
    const kind = detail.kind === 'profile' ? 'perfil' : detail.kind === 'historical' ? 'histórica' : null
    const reasons = ['STORED_IMAGE_REFERENCE_INVALID', 'LEGACY_IMAGE_REFERENCE_UNSAFE', 'LEGACY_IMAGE_FILE_MISSING',
      'LEGACY_IMAGE_TOO_LARGE', 'LEGACY_IMAGE_CONTENT_INVALID', 'IMAGE_REFERENCE_UNAVAILABLE']
    const student = typeof detail.student_id === 'string' && /^[1-9][0-9]{0,18}$/.test(detail.student_id) ? detail.student_id : null
    const reason = typeof detail.reason === 'string' && reasons.includes(detail.reason) ? detail.reason : null
    message += ` HTTP ${status} · OFFLINE_PHOTO_UNAVAILABLE.`
    if (request) message += ` Petición: ${request}.`
    message += stage && kind && student && reason
      ? ` Etapa: ${stage}; estudiante ${student}; foto ${kind}; motivo: ${reason}.`
      : ' El servidor no incluyó una etapa y un motivo válidos; falta comprobar la versión desplegada y su respuesta JSON.'
  }
  if (code === 'MOBILE_ABILITY_REQUIRED') message = 'La credencial móvil no tiene el permiso necesario para esta operación.'
  if (['EXAM_CANCELLED', 'EXAM_ENDED', 'EXAM_FINISHED', 'EXAM_STATE_NOT_ALLOWED'].includes(code ?? '')) message = 'Este examen ya no permite preparar una lista para controlar ingresos.'
  return new ApiError('http', message, status, code, fields)
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Puedes volver a intentarlo.'
}

export const protocolError = () => new ApiError('protocol', 'El servidor devolvió una respuesta inesperada. Verifica la versión de la API móvil.')
