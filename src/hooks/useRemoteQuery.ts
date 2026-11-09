import { useEffect, useState } from 'react'
import { ApiError, errorMessage } from '../services/http/errors'

export function useRemoteQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    // No offline cache in phase 3. Do not present old authorizations after failure.
    setState({ data: null, error: null, loading: true })
    void load(controller.signal).then((data) => {
      if (current) setState({ data, error: null, loading: false })
    }).catch((error: unknown) => {
      if (current && !(error instanceof ApiError && error.kind === 'cancelled')) setState({ data: null, error: errorMessage(error), loading: false })
    })
    return () => { current = false; controller.abort() }
  }, [load, revision])
  return { ...state, refresh: () => setRevision((value) => value + 1) }
}
