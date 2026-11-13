import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type PropsWithChildren, type ReactNode } from 'react'
import { Keyboard, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '../config/theme'
import { ScreenFrame, type ScreenFrameProps } from './ScreenFrame'
import { KeyboardFocusContext, type TextInputHandle } from './keyboardFocus'
import { screenRefreshProps, type ScreenRefresh } from './screenRefresh'

export interface ScreenProps extends Omit<ScreenFrameProps, 'children'> {
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
  footer?: ReactNode
  refresh?: ScreenRefresh
}
export function Screen({ children, scroll = true, contentStyle, footer, refresh, ...frame }: PropsWithChildren<ScreenProps>) {
  const [footerHeight, setFooterHeight] = useState(0)
  return <ScreenFrame {...frame}>{(inset) => footer ?
    <View style={[styles.static, { paddingBottom: inset }]}>
      <ScrollableContent inset={0} revealOffset={footerHeight} contentStyle={contentStyle} refresh={refresh}>{children}</ScrollableContent>
      <View onLayout={({ nativeEvent }) => setFooterHeight((old) => old === nativeEvent.layout.height ? old : nativeEvent.layout.height)} style={styles.footer}>
        <View style={[styles.footerContent, contentStyle]}>{footer}</View>
      </View>
    </View> : scroll ?
    <ScrollableContent inset={inset} contentStyle={contentStyle} refresh={refresh}>{children}</ScrollableContent> :
    <View style={[styles.content, styles.static, { paddingBottom: theme.spacing.xl + inset }, contentStyle]}>{children}</View>}
  </ScreenFrame>
}
function ScrollableContent({ children, inset, revealOffset = 0, contentStyle, refresh }: PropsWithChildren<{
  inset: number; revealOffset?: number; contentStyle?: StyleProp<ViewStyle>; refresh?: ScreenRefresh
}>) {
  const scroll = useRef<ComponentRef<typeof ScrollView> | null>(null), focused = useRef<TextInputHandle | null>(null)
  const reveal = useCallback(() => {
    const input = focused.current
    if (input && Keyboard.isVisible()) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(input, theme.spacing.lg + revealOffset, true)
  }, [revealOffset])
  const focus = useMemo(() => ({
    focus(input: TextInputHandle | null) { focused.current = input; requestAnimationFrame(reveal) },
    blur(input: TextInputHandle | null) { if (focused.current === input) focused.current = null },
  }), [reveal])
  useEffect(() => {
    const id = requestAnimationFrame(reveal)
    return () => cancelAnimationFrame(id)
  }, [inset, reveal])
  // Remains mounted while the keyboard resizes the viewport: local form state is preserved.
  return <KeyboardFocusContext.Provider value={focus}>
    <ScrollView {...screenRefreshProps(refresh)} ref={scroll} style={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      onLayout={reveal} contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.pageBottom + inset }, contentStyle]}>
      {children}
    </ScrollView>
  </KeyboardFocusContext.Provider>
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: theme.spacing.xl, gap: theme.spacing.xl,
    width: '100%', maxWidth: theme.layout.contentMaxWidth, alignSelf: 'center' },
  static: { flex: 1 },
  footer: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.background },
  footerContent: { width: '100%', maxWidth: theme.layout.contentMaxWidth, alignSelf: 'center' },
})

