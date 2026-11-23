export type ConnectionState = 'checking' | 'online' | 'offline' | 'unvalidated' | 'unknown'

export function connectionState(value: unknown): ConnectionState {
  if (value === true) return 'online'
  // The old native boolean only reports VALIDATED, not physical connectivity.
  if (value === false) return 'unvalidated'
  if (value && typeof value === 'object') {
    const state = value as Record<string, unknown>
    if (state.isConnected === false) return 'offline'
    if (state.isConnected === true && state.isInternetReachable === true) return 'online'
    if (state.isConnected === true) return 'unvalidated'
  }
  return 'unknown'
}

export const connectionLabels: Record<ConnectionState, string> = {
  checking: 'Comprobando red',
  online: 'Internet disponible',
  offline: 'Sin conexión',
  unvalidated: 'Internet sin verificar',
  unknown: 'Estado de red no disponible',
}

export function observeConnectivity({ read, onChange, onForeground }: {
  read(): Promise<unknown>
  onChange(listener: (value: unknown) => void): () => void
  onForeground(listener: () => void): () => void
}, publish: (state: ConnectionState) => void, timeoutMs = 5000) {
  let revision = 0, active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => { if (timer) clearTimeout(timer); timer = undefined }
  const refresh = () => {
    const current = ++revision
    clear()
    timer = setTimeout(() => {
      if (active && current === revision) { revision++; publish('unknown') }
    }, timeoutMs)
    let pending: Promise<unknown>
    try { pending = read() } catch { pending = Promise.resolve(null) }
    void pending.catch(() => null).then((value) => {
      if (active && current === revision) { clear(); publish(connectionState(value)) }
    })
  }
  let unsubscribe = () => {}, stopForeground = () => {}
  const stop = () => {
    if (!active) return
    active = false; clear()
    try { stopForeground() } finally { unsubscribe() }
  }
  try {
    unsubscribe = onChange((value) => {
      if (!active) return
      const next = connectionState(value)
      if (next === 'unknown') { publish('checking'); refresh() }
      else { revision++; clear(); publish(next) }
    })
    stopForeground = onForeground(refresh)
    if (revision === 0) refresh()
  } catch {
    try { stop() } finally { publish('unknown') }
  }
  return stop
}
