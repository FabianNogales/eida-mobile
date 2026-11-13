import { useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage } from '../services/http/errors'

export function useRemoteQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  type Result = { data: T | null; error: string | null; loading: boolean }
  const loading: Result = { data: null, error: null, loading: true }
  const [state, setState] = useState<{ load: typeof load; revision: number; result: Result } | null>(null)
  const active = useRef<{ load: typeof load; revision: number; reload(): Promise<void> } | null>(null)
  useEffect(() => {
    let current = true
    let controller: AbortController | undefined, pending: Promise<void> | undefined
    const publish = (result: Result) => { if (current) setState({ load, revision, result }) }
    const query = { load, revision, reload() {
      if (pending) return pending
      controller = new AbortController()
      const { signal } = controller
      // Hide old authorizations while rechecking and after failure.
      publish({ data: null, error: null, loading: true })
      pending = Promise.resolve().then(async () => {
        if (signal.aborted) return
        const data = await load(signal)
        if (!signal.aborted) publish({ data, error: null, loading: false })
      }).catch((error: unknown) => {
        publish({ data: null, error: error instanceof ApiError && error.kind === 'cancelled' ? null : errorMessage(error), loading: false })
      }).finally(() => { pending = undefined })
      return pending
    } }
    active.current = query
    void query.reload()
    return () => { current = false; active.current = null; controller?.abort() }
  }, [load, revision])
  const result = state?.load === load && state.revision === revision ? state.result : loading
  return { ...result,
    reload: () => active.current?.load === load && active.current.revision === revision ? active.current.reload() : Promise.resolve(),
    refresh: () => setRevision((value) => value + 1),
  }
}
