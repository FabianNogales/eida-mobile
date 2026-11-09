// One decision per visible dialog, including hardware Back and rapid repeated taps.
export function createDialogDecision() {
  let decided = false
  return {
    reset() { decided = false },
    choose(action: 'cancel' | 'confirm', callbacks: { cancel(): void; confirm(): void }): boolean {
      if (decided) return false
      decided = true; callbacks[action](); return true
    },
  }
}
