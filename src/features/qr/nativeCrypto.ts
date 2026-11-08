import type { Rs256Provider } from './contracts'

// No Node/browser fallback. Import lazily so a missing native module produces an
// honest diagnostic instead of crashing the navigation shell.
export async function loadNativeCrypto(): Promise<Rs256Provider> {
  const module = await import('react-native-quick-crypto')
  const crypto = module.default
  const Buffer = module.Buffer
  return {
    name: 'react-native-quick-crypto / RSA PKCS#1 v1.5 / SHA-256',
    verify: (input, signature, key) => crypto.verify(
      'sha256', Buffer.from(input, 'ascii'),
      { key: key.pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(signature),
    ),
  }
}

