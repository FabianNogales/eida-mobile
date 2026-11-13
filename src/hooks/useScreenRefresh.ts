import { useRef, useState } from 'react'

export function useScreenRefresh(reload: () => Promise<unknown>, enabled: boolean, canReload = () => true) {
  const pending = useRef(false)
  const [refreshing, setRefreshing] = useState(false)

  function onRefresh() {
    if (!enabled || pending.current || !canReload()) return
    pending.current = true
    setRefreshing(true)
    void reload().finally(() => {
      pending.current = false
      setRefreshing(false)
    })
  }

  return { enabled, refreshing, onRefresh }
}
