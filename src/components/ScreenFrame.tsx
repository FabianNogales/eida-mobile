import { useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { keyboardOverlap, screenEdges } from '../ui/presentation'
import { TabInsetsContext } from '../navigation/TabInsetsContext'

export interface ScreenFrameProps {
  home?: boolean
  header?: 'native' | 'none'
  bottomOwnedByNavigator?: boolean
  avoidKeyboard?: boolean
  children: (keyboardInset: number) => ReactNode
}
export function ScreenFrame({ home = false, header = home ? 'none' : 'native', bottomOwnedByNavigator,
  avoidKeyboard = true, children }: ScreenFrameProps) {
  const insideTabs = useContext(TabInsetsContext)
  const frame = useRef<ComponentRef<typeof View> | null>(null), active = useRef(true)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() => {
    const metrics = Keyboard.metrics()
    return metrics && metrics.height > 0 ? metrics.screenY : null
  })
  const { width, height, fontScale } = useWindowDimensions()
  const measure = useCallback(() => {
    frame.current?.measureInWindow((_x, top, _width, frameHeight) => {
      if (active.current) setViewport((old) => old.top === top && old.height === frameHeight ? old : { top, height: frameHeight })
    })
  }, [])
  useEffect(() => {
    active.current = true
    const show = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) => {
      setKeyboardTop(endCoordinates.height > 0 ? endCoordinates.screenY : null); measure()
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => { setKeyboardTop(null); measure() })
    return () => { active.current = false; show.remove(); hide.remove() }
  }, [measure])
  useEffect(measure, [measure, width, height, fontScale])
  const ime = avoidKeyboard ? keyboardTop : null
  const overlap = keyboardOverlap(viewport.top, viewport.height, ime)
  return <View ref={frame} collapsable={false} onLayout={measure} style={styles.frame}>
    <SafeAreaView style={styles.frame} edges={screenEdges(header, bottomOwnedByNavigator ?? insideTabs, ime !== null)}>
      {children(overlap)}
    </SafeAreaView>
  </View>
}
const styles = StyleSheet.create({ frame: { flex: 1, backgroundColor: theme.colors.background } })
