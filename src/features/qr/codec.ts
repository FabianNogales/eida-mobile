const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export class QrFormatError extends Error {}

export function encodeBase64url(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    result += alphabet[a >> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]!
    if (b !== undefined) result += alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]!
    if (c !== undefined) result += alphabet[c & 63]!
  }
  return result
}

export function decodeBase64url(value: string): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new QrFormatError()
  const bytes: number[] = []
  let bits = 0
  let buffer = 0
  for (const char of value) {
    buffer = (buffer << 6) | alphabet.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 255)
      buffer &= (1 << bits) - 1
    }
  }
  const result = new Uint8Array(bytes)
  if (encodeBase64url(result) !== value) throw new QrFormatError()
  return result
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// PHP json_encode without JSON_UNESCAPED_UNICODE emits ASCII JSON. Preserve that
// narrow profile, including compact encoding, and reject duplicate keys by roundtrip.
export function phpCompactJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g,
    (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'))
}

export function decodeObject(segment: string): Record<string, unknown> {
  const bytes = decodeBase64url(segment)
  if (bytes.some((byte) => byte > 127)) throw new QrFormatError()
  const raw = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || phpCompactJson(value) !== raw) throw new QrFormatError()
  return value
}

