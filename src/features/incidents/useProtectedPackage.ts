import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useOffline } from '../offline/OfflineProvider'
import { anchoredNow, nativeClock } from '../offline/clock'
import type { PackageRecord } from '../offline/contracts'
import type { VaultRuntime } from '../offline/nativeVault'

export function useProtectedPackage(packageId: string) {
  const { runtime, error: accessError } = useOffline(), [focused, setFocused] = useState(false)
  const [view, setView] = useState<{ runtime: VaultRuntime; p: PackageRecord } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setView(null) } }, []))
  useEffect(() => {
    setView(null); setError(null)
    if (!runtime || !focused || !packageId) return
    let current = true, timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      try {
        const sample = await nativeClock.sample(), p = await runtime.repo.usable(packageId, sample)
        runtime.check()
        if (!current) return
        setView({ runtime, p })
        timer = setTimeout(() => { void check() }, Math.max(1, Math.min(1000, Date.parse(p.manifest.expires_at) - anchoredNow(p.anchor, sample))))
      } catch { if (current) { setView(null); setError('Paquete inaccesible, vencido o sin autorización vigente. Los pendientes se conservan.') } }
    }
    void check()
    return () => { current = false; if (timer) clearTimeout(timer) }
  }, [runtime, packageId, focused])
  if (!focused || !view || view.runtime !== runtime || view.p.id !== packageId) return {
    runtime: null, pkg: null, error: !runtime ? accessError ?? 'La información local todavía no está disponible.' : error,
  }
  return { runtime: view.runtime, pkg: view.p, error }
}
