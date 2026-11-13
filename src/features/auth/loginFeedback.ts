import { ApiError } from '../../services/http/errors'

export function loginFields(identifier: string, password: string) {
  return {
    identifier: !identifier.trim() ? 'Ingresa tu correo o código institucional.'
      : identifier.trim().length > 100 ? 'El correo o código no puede superar 100 caracteres.' : null,
    password: !password.trim() ? 'Ingresa tu contraseña.'
      : password.length < 8 || password.length > 20 ? 'La contraseña debe tener entre 8 y 20 caracteres.' : null,
  }
}

// Login-specific presentation only: preserve status/code/fields and never infer
// a role or the existence of an account from a generic validation failure.
export function loginFailure(error: unknown): unknown {
  if (!(error instanceof ApiError) || error.kind !== 'http') return error
  let message = error.message
  if ((error.status ?? 0) >= 500) message = 'El inicio de sesión no está disponible temporalmente. Intenta nuevamente más tarde.'
  else if (error.status === 401 || error.status === 422) message = 'No se pudo iniciar sesión con esos datos. Revisa tu correo o código y tu contraseña.'
  else if (error.status === 403 && error.code === 'MOBILE_OPERATOR_REQUIRED') {
    message = 'La cuenta no tiene acceso móvil a EIDA Control. Se requiere un examen propio o una colaboración vigente; consulta con la administración.'
  } else if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED') {
    message = 'Cambia tu contraseña inicial en EIDA Web antes de iniciar sesión en EIDA Control.'
  } else if (error.status === 403) message = 'El servidor no autorizó el inicio de sesión. Consulta con la administración.'
  return new ApiError(error.kind, message, error.status, error.code, error.fields)
}
