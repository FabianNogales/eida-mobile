import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { FlatList, Keyboard, StyleSheet, type FlatListProps } from 'react-native'
import { ScreenFrame, type ScreenFrameProps } from './ScreenFrame'
import { theme } from '../config/theme'
import { KeyboardFocusContext, type TextInputHandle } from './keyboardFocus'

// A single virtualized list. Header/footer inputs share the same focus handling
// as Screen, without nesting the list inside a ScrollView.
export function ListScreen<Item>({ home, header, bottomOwnedByNavigator, avoidKeyboard,
  contentContainerStyle, onLayout, ...props }: FlatListProps<Item> & Omit<ScreenFrameProps, 'children'>) {
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
  return <ScreenFrame home={home} header={header} bottomOwnedByNavigator={bottomOwnedByNavigator} avoidKeyboard={avoidKeyboard}>
    {(inset) => <KeyboardFocusContext.Provider value={focus}><FlatList {...props} ref={list}
      onLayout={(event) => { onLayout?.(event); reveal() }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content,
        { paddingBottom: theme.spacing.pageBottom + inset }, contentContainerStyle]} /></KeyboardFocusContext.Provider>}
  </ScreenFrame>
}
const styles = StyleSheet.create({ content: { flexGrow: 1, width: '100%', maxWidth: theme.layout.contentMaxWidth,
  alignSelf: 'center', padding: theme.spacing.xl, gap: theme.spacing.md } })
