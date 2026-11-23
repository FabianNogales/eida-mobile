import { useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'

export function useRefreshOnFocus(reload: () => Promise<unknown>) {
  const current = useRef(reload)
  current.current = reload
  useFocusEffect(useCallback(() => { void current.current() }, []))
}
