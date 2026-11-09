import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRemoteQuery } from '../../hooks/useRemoteQuery'
import { DisciplineApi } from './api'
import { useOffline } from '../offline/OfflineProvider'
import { sameBinding } from '../offline/contracts'
import { nativeClock } from '../offline/clock'
import { ApiError } from '../../services/http/errors'

export function useDiscipline(examId: string) {
  const { controller } = useAuth(), api = useMemo(() => controller ? new DisciplineApi(controller) : null, [controller])
  const offline = useOffline(), r = offline.runtime
  const load = useCallback(async (signal: AbortSignal) => {
    if (!api) throw new Error('Primero valida la sesión online.')
    const sameActor = () => {
      const b = controller?.offlineBinding()
      return r && b && sameBinding(b, r.repo.binding)
    }
    try {
      const permission = await api.context(examId)
      if (signal.aborted) throw new ApiError('cancelled', 'Consulta cancelada.')
      if (sameActor() && r) {
        r.check()
        const sample = await nativeClock.sample()
        for (const p of await r.repo.list()) if (!signal.aborted && p.examId === examId && p.active && p.state === 'PREPARADO') {
          try {
            await r.incidents.rememberOwner(p.id, permission, sample)
            if (!permission.report) await r.repo.setState(p.id, 'DESACTUALIZADO')
          } catch { /* expired package never receives a usable owner grant */ }
        }
      }
      return permission
    } catch (error) {
      // A denied token scope is a deployment prerequisite, not proof of package revocation.
      if (error instanceof ApiError && error.status === 403 && error.code !== 'MOBILE_ABILITY_REQUIRED' && sameActor() && r) {
        for (const p of await r.repo.list()) if (p.examId === examId && p.active) await r.repo.setState(p.id, 'DESACTUALIZADO')
        await offline.refresh()
      }
      throw error
    }
  }, [api, controller, examId, r, offline.refresh])
  const context = useRemoteQuery(load)
  return { api, context }
}
