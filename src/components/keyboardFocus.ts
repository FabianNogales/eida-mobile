import { createContext, type ComponentRef } from 'react'
import type { TextInput } from 'react-native'
export type TextInputHandle = ComponentRef<typeof TextInput>

// Holds only the native input handle, never its value or password.
export const KeyboardFocusContext = createContext<{
  focus(input: TextInputHandle | null): void; blur(input: TextInputHandle | null): void
}>({ focus: () => {}, blur: () => {} })
