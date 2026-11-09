import { Image } from 'react-native'
import { identity } from '../../config/identity'

export function EidaLogo({ compact = false, decorative = false }: { compact?: boolean; decorative?: boolean }) {
  const size = compact ? identity.sizes.headerLogo : identity.sizes.loginLogo
  return <Image source={require('../../../assets/brand/eida-logo.png')}
    accessible={!decorative} accessibilityRole={decorative ? undefined : 'image'}
    accessibilityLabel={decorative ? undefined : identity.logo.accessibilityLabel}
    accessibilityElementsHidden={decorative} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    resizeMode="contain" resizeMethod="resize" style={{ width: size, height: size, flexShrink: 0 }} />
}
