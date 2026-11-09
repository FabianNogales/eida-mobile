import { Text, type TextProps } from 'react-native'
import { theme } from '../config/theme'

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: keyof typeof theme.typography }) {
  return <Text {...props} style={[theme.typography[variant], { color: theme.colors.text, flexShrink: 1 }, style]} />
}
