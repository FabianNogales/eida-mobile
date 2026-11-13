import { forwardRef, useContext, useId, useRef, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { theme } from '../config/theme'
import { KeyboardFocusContext, type TextInputHandle } from './keyboardFocus'

export interface FormFieldProps extends TextInputProps { label: string; error?: string | null; hint?: string; trailing?: ReactNode; visibleLabel?: boolean }
export const FormField = forwardRef<TextInputHandle, FormFieldProps>(function FormField({ label, error, hint, style,
  onFocus, onBlur, multiline, accessibilityLabel, accessibilityHint, trailing, visibleLabel = true, ...props }, forwarded) {
  const input = useRef<TextInputHandle | null>(null), focus = useContext(KeyboardFocusContext), labelId = useId()
  const nativeInput = <TextInput {...props} ref={(instance) => { input.current = instance; if (typeof forwarded === 'function') forwarded(instance); else if (forwarded) forwarded.current = instance }}
      accessibilityLabel={accessibilityLabel ?? label} accessibilityLabelledBy={visibleLabel ? labelId : undefined}
      accessibilityHint={[accessibilityHint ?? hint, error ? `Error: ${error}` : null].filter(Boolean).join('. ') || undefined}
      placeholderTextColor={theme.colors.muted} selectionColor={theme.colors.primary}
      multiline={multiline} style={[styles.input, trailing ? styles.withTrailing : undefined, multiline && styles.multiline, error && styles.invalid, style]}
      onFocus={(event) => { focus.focus(input.current); onFocus?.(event) }}
      onBlur={(event) => { focus.blur(input.current); onBlur?.(event) }} />
  return <View style={styles.field}>
    {visibleLabel && <Text nativeID={labelId} style={styles.label}>{label}</Text>}
    {trailing ? <View style={styles.inputRow}>{nativeInput}<View style={styles.trailing}>{trailing}</View></View> : nativeInput}
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> :
      hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>
})
const styles = StyleSheet.create({
  field: { gap: theme.spacing.sm }, label: { ...theme.typography.label, color: theme.colors.navy },
  inputRow: { alignSelf: 'stretch' }, withTrailing: { paddingRight: 64 },
  trailing: { position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' },
  input: { minHeight: theme.layout.controlMinHeight, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.surface, color: theme.colors.text, ...theme.typography.input },
  multiline: { minHeight: 120, textAlignVertical: 'top' }, invalid: { borderColor: theme.colors.error, borderWidth: 2 },
  hint: { ...theme.typography.body, color: theme.colors.muted }, error: { ...theme.typography.body, color: theme.colors.error },
})
