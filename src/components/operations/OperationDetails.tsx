import type { PropsWithChildren } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../../config/theme'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Screen } from '../Screen'

export function OperationDetails({ title, backLabel = 'Volver a la cola', footerBack = false, onClose, children }: PropsWithChildren<{
  title: string; backLabel?: string; footerBack?: boolean; onClose(): void
}>) {
  return <Modal visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider><Screen header="none" bottomOwnedByNavigator={false}>
      <View style={s.content} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        {!footerBack && <ActionButton secondary label={backLabel} onPress={onClose} />}
        <AppText variant="title" accessibilityRole="header">{title}</AppText>{children}
      </View>
    </Screen></SafeAreaProvider>
  </Modal>
}
const s = StyleSheet.create({ content: { gap: theme.spacing.lg } })
