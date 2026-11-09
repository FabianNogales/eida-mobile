import { useRouter, type Href } from 'expo-router'
import { ActionButton } from './ActionButton'
import { goBack } from '../navigation/back'

export function BackButton({ fallback, label = 'Volver' }: { fallback?: Href; label?: string }) {
  const router = useRouter()
  return <ActionButton secondary label={label} disabled={!router.canGoBack() && !fallback}
    accessibilityHint="Regresa al contexto anterior sin crear otra copia de la pantalla."
    onPress={() => { goBack(router, fallback) }} />
}
