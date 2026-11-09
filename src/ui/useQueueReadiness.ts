import { useEffect, useRef } from 'react'
import { queueKnown } from './operations'

// Tracks only whether this runtime completed its first read; never stores queue
// contents. Sending later does not erase the already known counts.
export function useQueueReadiness(runtime: unknown, busy: boolean) {
  const observed = useRef<unknown>(null)
  useEffect(() => { if (runtime == null) observed.current = null; else if (!busy) observed.current = runtime }, [runtime, busy])
  return queueKnown(runtime, observed.current, busy)
}
