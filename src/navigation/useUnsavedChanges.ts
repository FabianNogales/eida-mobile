import { useEffect, useMemo, useRef, useState } from 'react'
import { usePreventRemove } from 'expo-router'
import { createExitConfirmation } from './back'

// Opt-in for later blocks. canProtectRoute MUST become false on logout/revocation/lock.
// onDiscard clears only unsaved in-memory form state; never a captured/outbox event.
export function useUnsavedChanges({ hasUnsavedChanges, canProtectRoute, onDiscard }: {
  hasUnsavedChanges: boolean; canProtectRoute: boolean; onDiscard(): void
}) {
  const decision = useMemo(createExitConfirmation, [])
  const current = useRef({ hasUnsavedChanges, canProtectRoute })
  current.current = { hasUnsavedChanges, canProtectRoute }
  const [visible, setVisible] = useState(false), [allowExit, setAllowExit] = useState(false)
  usePreventRemove(hasUnsavedChanges && canProtectRoute && !allowExit, ({ repeat }) => {
    if (decision.request(repeat)) setVisible(true)
  })
  useEffect(() => {
    if (!hasUnsavedChanges || !canProtectRoute) { decision.clear(); setVisible(false); setAllowExit(false) }
  }, [hasUnsavedChanges, canProtectRoute, decision])
  useEffect(() => () => decision.clear(), [decision])
  return {
    visible: visible && hasUnsavedChanges && canProtectRoute,
    cancel() { decision.cancel(); setVisible(false) },
    confirm() {
      if (!current.current.hasUnsavedChanges || !current.current.canProtectRoute) { decision.clear(); setVisible(false); return }
      onDiscard(); setAllowExit(true); setVisible(false); decision.confirm()
    },
  }
}
