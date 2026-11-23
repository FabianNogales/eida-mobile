import type { OfflineApi } from './api'
import type { DistributionContext, PackageRecord } from './contracts'
import type { OfflineRepository } from './repository'
import { ApiError, protocolError } from '../../services/http/errors'

type Copies = Pick<OfflineRepository, 'list' | 'setState'>
type ContextApi = Pick<OfflineApi, 'context'>

export function distributionReady(context: DistributionContext) {
  return !context.stale && !context.unavailable_reason && context.distribution_id !== null &&
    context.version !== null && context.own_list_id !== null
}

export function copyMatchesDistribution(copy: PackageRecord, context: DistributionContext) {
  return distributionReady(context) && copy.examId === String(context.exam.id) &&
    copy.manifest.exam_id === copy.examId && copy.manifest.list_id === context.own_list_id &&
    copy.manifest.distribution_id === context.distribution_id && copy.manifest.version === context.version
}

export function resumableCopyId(copy: PackageRecord | null, context: DistributionContext) {
  return copy && copyMatchesDistribution(copy, context) && copy.state !== 'DESACTUALIZADO' && copy.state !== 'VENCIDO'
    ? copy.id : undefined
}

export async function invalidateExamCopies(repo: Copies, examId: string) {
  for (const copy of await repo.list()) {
    if (copy.examId === examId && copy.state !== 'DESACTUALIZADO') await repo.setState(copy.id, 'DESACTUALIZADO')
  }
}

export async function reconcileDistribution(repo: Copies, context: DistributionContext, signal?: AbortSignal) {
  for (const copy of await repo.list()) {
    if (signal?.aborted) throw new ApiError('cancelled', 'Consulta cancelada.')
    if (copy.examId === String(context.exam.id) && !copyMatchesDistribution(copy, context) && copy.state !== 'DESACTUALIZADO') {
      // Keep original events and reports for synchronization; only block further use of this copy.
      await repo.setState(copy.id, 'DESACTUALIZADO')
    }
  }
}

export async function currentDistribution(api: ContextApi, repo: Copies | null, examId: string, signal?: AbortSignal) {
  try {
    const context = await api.context(examId, signal)
    if (signal?.aborted) throw new ApiError('cancelled', 'Consulta cancelada.')
    if (String(context.exam.id) !== examId) throw protocolError()
    if (repo) await reconcileDistribution(repo, context, signal)
    return context
  } catch (error) {
    if (repo && !signal?.aborted && error instanceof ApiError &&
        (error.status === 404 || (error.status === 403 && error.code !== 'MOBILE_ABILITY_REQUIRED') ||
          error.code === 'DISTRIBUTION_STALE' || error.code === 'DISTRIBUTION_FROZEN')) {
      await invalidateExamCopies(repo, examId)
    }
    throw error
  }
}

export function copyPreparationReason(context: DistributionContext) {
  if (context.unavailable_reason) return 'Este examen no permite preparar listas en su estado actual. Consulta con el docente responsable.'
  if (context.stale) return context.can_prepare
    ? 'Cambió la distribución de estudiantes. Actualiza la copia con internet antes de controlar ingresos.'
    : 'Cambió la distribución de estudiantes. El docente responsable debe actualizarla. Después pulsa Actualizar copia.'
  if (!context.own_list_id) return context.can_prepare
    ? 'Aún no tienes una lista personal. Revisa la distribución del examen; no puedes descargar la lista de otra persona.'
    : 'El docente todavía debe asignarte una lista. Después pulsa Actualizar copia.'
  return 'Todavía no hay una lista vigente para descargar. Vuelve a consultar el examen.'
}

/** Refresh an assignment, requesting server-side preparation only for its authorized owner. */
export async function prepareCopyContext(api: Pick<OfflineApi, 'context' | 'prepare'>, repo: Copies, examId: string,
  check: () => void = () => {}) {
  check()
  let context = await currentDistribution(api, repo, examId)
  check()
  if (!distributionReady(context) && context.can_prepare && !context.unavailable_reason) {
    await api.prepare(examId)
    check()
    context = await currentDistribution(api, repo, examId)
    check()
  }
  if (!distributionReady(context)) throw new Error(copyPreparationReason(context))
  return context
}
