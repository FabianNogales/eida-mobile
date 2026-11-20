export function connectionState(value: unknown) {
  if (value === true) return 'online'
  if (value === false) return 'offline'
  return 'unknown'
}

export type ConnectionState = ReturnType<typeof connectionState>

export const connectionLabels: Record<ConnectionState, string> = {
  online: 'En línea',
  offline: 'Sin conexión',
  unknown: 'Comprobando red',
}

export function observeConnectivity({ read, onChange, onForeground }: {
  read(): Promise<unknown>
  onChange(listener: (value: unknown) => void): () => void
  onForeground(listener: () => void): () => void
}, publish: (state: ConnectionState) => void) {
  let revision = 0, active = true
  const refresh = async () => {
    const current = ++revision
    const value = await read().catch(() => null)
    if (active && current === revision) publish(connectionState(value))
  }
  const unsubscribe = onChange((value) => {
    revision++
    if (active) publish(connectionState(value))
  })
  const stopForeground = onForeground(() => { void refresh() })
  void refresh()
  return () => { active = false; stopForeground(); unsubscribe() }
}
