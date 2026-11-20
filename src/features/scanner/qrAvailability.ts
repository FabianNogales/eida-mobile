import type { Manifest } from '../offline/contracts'

export function offlineQrBlock(qr: Manifest['qr']) {
  if (!qr.available && qr.reason === 'PRODUCTION_QR_V3_NOT_CONFIRMED') {
    return 'El escaneo sin conexión no está disponible para esta lista.'
  }
  if (qr.keys.length === 0) return 'Esta copia no permite verificar códigos QR sin conexión.'
  if (!qr.available || !qr.issuer || !qr.audience) return 'La verificación QR sin conexión no está habilitada para esta lista.'
  return null
}
