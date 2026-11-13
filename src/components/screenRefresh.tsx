import { RefreshControl } from 'react-native'
import { theme } from '../config/theme'

export interface ScreenRefresh {
  enabled: boolean
  refreshing: boolean
  onRefresh(): void
}

export function screenRefreshProps(refresh?: ScreenRefresh) {
  if (!refresh) return {}
  const { enabled, refreshing, onRefresh } = refresh
  return {
    refreshControl: <RefreshControl enabled={enabled || refreshing} refreshing={refreshing}
      onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />,
    importantForAccessibility: 'yes' as const,
    accessibilityActions: enabled ? [{ name: 'refresh', label: 'Actualizar contenido' }] : [],
    onAccessibilityAction: onRefreshAction,
  }

  function onRefreshAction(event: { nativeEvent: { actionName: string } }) {
    if (enabled && event.nativeEvent.actionName === 'refresh') onRefresh()
  }
}
