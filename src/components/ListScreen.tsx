import { FlatList, StyleSheet, type FlatListProps } from 'react-native'
import { ScreenFrame, type ScreenFrameProps } from './ScreenFrame'
import { theme } from '../config/theme'

// A single virtualized list, never nested inside Screen's ScrollView. Adoption is block C/D.
export function ListScreen<Item>({ home, header, bottomOwnedByNavigator, avoidKeyboard,
  contentContainerStyle, ...props }: FlatListProps<Item> & Omit<ScreenFrameProps, 'children'>) {
  return <ScreenFrame home={home} header={header} bottomOwnedByNavigator={bottomOwnedByNavigator} avoidKeyboard={avoidKeyboard}>
    {(inset) => <FlatList {...props} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content,
        { paddingBottom: theme.spacing.pageBottom + inset }, contentContainerStyle]} />}
  </ScreenFrame>
}
const styles = StyleSheet.create({ content: { flexGrow: 1, width: '100%', maxWidth: theme.layout.contentMaxWidth,
  alignSelf: 'center', padding: theme.spacing.xl, gap: theme.spacing.md } })
