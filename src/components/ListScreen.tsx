import { useCallback, useEffect, useMemo, useRef, type ComponentRef, type ReactNode } from 'react'
import { FlatList, Keyboard, StyleSheet, View, type FlatListProps } from 'react-native'
import { ScreenFrame, type ScreenFrameProps } from './ScreenFrame'
import { theme } from '../config/theme'
import { KeyboardFocusContext, type TextInputHandle } from './keyboardFocus'
import { screenRefreshProps, type ScreenRefresh } from './screenRefresh'

// A single virtualized list. Header/footer inputs share the same focus handling
// as Screen, without nesting the list inside a ScrollView.
export function ListScreen<Item>({ home, header, bottomOwnedByNavigator, avoidKeyboard,
  contentContainerStyle, onLayout, refresh, footer, scrollKey, ...props }: FlatListProps<Item> & Omit<ScreenFrameProps, 'children'> & {
  refresh?: ScreenRefresh; footer?: ReactNode; scrollKey?: number
}) {
  const list = useRef<ComponentRef<typeof FlatList<Item>> | null>(null)
  const focused = useRef<TextInputHandle | null>(null)
  const reveal = useCallback(() => {
    if (focused.current && Keyboard.isVisible()) list.current?.getScrollResponder()?.scrollResponderScrollNativeHandleToKeyboard(focused.current, theme.spacing.lg, true)
  }, [])
  const focus = useMemo(() => ({
    focus(input: TextInputHandle | null) { focused.current = input; requestAnimationFrame(reveal) },
    blur(input: TextInputHandle | null) { if (focused.current === input) focused.current = null },
  }), [reveal])
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', reveal)
    return () => subscription.remove()
  }, [reveal])
  useEffect(() => {
    if (scrollKey !== undefined) list.current?.scrollToOffset({ offset: 0, animated: false })
  }, [scrollKey])
  return <ScreenFrame home={home} header={header} bottomOwnedByNavigator={bottomOwnedByNavigator} avoidKeyboard={avoidKeyboard}>
    {(inset) => <KeyboardFocusContext.Provider value={focus}><FlatList {...props} {...screenRefreshProps(refresh)} ref={list}
      onLayout={(event) => { onLayout?.(event); reveal() }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content,
        { paddingBottom: footer ? theme.spacing.md : theme.spacing.pageBottom + inset }, contentContainerStyle]} />
      {footer && <View style={{ paddingBottom: inset }}>{footer}</View>}
    </KeyboardFocusContext.Provider>}
  </ScreenFrame>
}
const styles = StyleSheet.create({ content: { flexGrow: 1, width: '100%', maxWidth: theme.layout.contentMaxWidth,
  alignSelf: 'center', padding: theme.spacing.xl, gap: theme.spacing.md } })
