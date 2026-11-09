import { useContext, useEffect, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, View } from 'react-native'
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs'
import { theme } from '../config/theme'
import { useOffline } from '../features/offline/OfflineProvider'
import { mainTabs, selectTab } from '../navigation/mainTabs'
import { pendingSummary } from '../ui/pendingSummary'
import { AppText } from './AppText'
import { MainTabIcon } from './MainTabIcon'

export function MainTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext)
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible())
  const { runtime, syncItems, incidentItems } = useOffline()
  const summary = pendingSummary(runtime !== null, syncItems, incidentItems)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  useEffect(() => { if (keyboardVisible) onHeightChange?.(0) }, [keyboardVisible, onHeightChange])
  if (keyboardVisible) return null
  return <View onLayout={({ nativeEvent }) => onHeightChange?.(nativeEvent.layout.height)}
    style={[s.bar, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View style={s.row}>
      {state.routes.map((route, index) => {
        const tab = mainTabs.find((item) => item.name === route.name)
        if (!tab) return null
        const selected = state.index === index
        const color = selected ? theme.colors.primary : theme.colors.muted
        const count = tab.name === 'pending' && summary ? summary.pending : 0
        const attention = tab.name === 'pending' && summary ? summary.attention : 0
        const label = `${tab.label}${tab.name === 'pending' ? summary
          ? `, ${count} por enviar, ${attention} conflictos o rechazos`
          : ', desbloquea el almacén para consultar las colas' : ''}`
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected }}
          accessibilityLabel={label} testID={`main-tab-${tab.name}`}
          onPress={() => selectTab(route.key, selected,
            (key) => emitter.emit({ type: 'tabPress', target: key, canPreventDefault: true }), navigateToTab)}
          onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          style={({ pressed }) => [s.tab, selected && s.selected, pressed && s.pressed]}>
          <MainTabIcon name={tab.name} color={color} />
          <AppText variant="caption" style={[s.label, { color }]}>{tab.label}</AppText>
          {(count > 0 || attention > 0) && <AppText variant="caption" style={s.badge}>
            {count > 0 ? `${count} pendientes` : 'Revisar'}{count > 0 && attention > 0 ? ' · Revisar' : ''}
          </AppText>}
        </Pressable>
      })}
    </View>
  </View>
}
const s = StyleSheet.create({
  bar: { backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { flexDirection: 'row', padding: theme.spacing.xs, alignItems: 'stretch', maxWidth: theme.layout.contentMaxWidth, width: '100%', alignSelf: 'center' },
  tab: { flex: 1, minWidth: theme.layout.minTouch, minHeight: theme.layout.minTouch, paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs, gap: theme.spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.colors.background },
  pressed: { backgroundColor: theme.colors.border },
  label: { textAlign: 'center' },
  badge: { textAlign: 'center', color: theme.colors.error },
})
