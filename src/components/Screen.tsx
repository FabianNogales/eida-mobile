import { useCallback, useEffect, useMemo, useRef, type ComponentRef, type PropsWithChildren } from 'react'
import { Keyboard, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '../config/theme'
import { ScreenFrame, type ScreenFrameProps } from './ScreenFrame'
import { KeyboardFocusContext, type TextInputHandle } from './keyboardFocus'

export interface ScreenProps extends Omit<ScreenFrameProps, 'children'> {
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
}
export function Screen({ children, scroll = true, contentStyle, ...frame }: PropsWithChildren<ScreenProps>) {
  return <ScreenFrame {...frame}>{(inset) => scroll ?
    <ScrollableContent inset={inset} contentStyle={contentStyle}>{children}</ScrollableContent> :
    <View style={[styles.content, styles.static, { paddingBottom: theme.spacing.xl + inset }, contentStyle]}>{children}</View>}
  </ScreenFrame>
}
function ScrollableContent({ children, inset, contentStyle }: PropsWithChildren<{ inset: number; contentStyle?: StyleProp<ViewStyle> }>) {
  const scroll = useRef<ComponentRef<typeof ScrollView> | null>(null), focused = useRef<TextInputHandle | null>(null)
  const reveal = useCallback(() => {
    const input = focused.current
    if (input && Keyboard.isVisible()) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(input, theme.spacing.lg, true)
  }, [])
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
    <ScrollView ref={scroll} style={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
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
})

