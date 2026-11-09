import { useEffect, useMemo } from 'react'
import { Modal, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../config/theme'
import { AppText } from './AppText'
import { ActionButton } from './ActionButton'
import { createDialogDecision } from '../ui/dialogDecision'

export interface ConfirmDialogProps {
  visible: boolean; title: string; message: string; confirmLabel: string
  onConfirm(): void; onCancel(): void; destructive?: boolean
}
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, destructive = false }: ConfirmDialogProps) {
  const decision = useMemo(createDialogDecision, [])
  useEffect(() => { if (visible) decision.reset() }, [visible, decision])
  const cancel = () => { decision.choose('cancel', { cancel: onCancel, confirm: onConfirm }) }
  const confirm = () => { decision.choose('confirm', { cancel: onCancel, confirm: onConfirm }) }
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent
    onRequestClose={cancel}>
    <SafeAreaProvider><View style={styles.scrim}><SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.dialog} accessibilityViewIsModal onAccessibilityEscape={cancel}>
          <AppText variant="subtitle" accessibilityRole="header">{title}</AppText>
          <AppText>{message}</AppText>
          <ActionButton secondary label="Cancelar" onPress={cancel} />
          <ActionButton variant={destructive ? 'danger' : 'primary'} label={confirmLabel} onPress={confirm} />
        </View>
      </ScrollView>
    </SafeAreaView></View></SafeAreaProvider>
  </Modal>
}
const styles = StyleSheet.create({ scrim: { flex: 1, backgroundColor: theme.colors.scrim }, safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.xl },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: theme.layout.dialogMaxWidth,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, padding: theme.spacing.xl, gap: theme.spacing.lg } })
