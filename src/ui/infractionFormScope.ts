// UI memory boundaries only. This neither grants permissions nor stores a draft.
export interface InfractionFormScope {
  actorId: number | null; deviceId: number | null; examId: string; draftId: string | null; runtime: unknown
}
export function sameInfractionFormScope(a: InfractionFormScope | null, b: InfractionFormScope) {
  return !!a && a.actorId === b.actorId && a.deviceId === b.deviceId && a.examId === b.examId && a.draftId === b.draftId &&
    (!b.draftId || a.runtime === b.runtime)
}
export function infractionFormPolicy(previous: InfractionFormScope | null, next: InfractionFormScope,
  canAccess: boolean, manage: boolean | undefined) {
  const sameRecord = !!previous && previous.actorId === next.actorId && previous.deviceId === next.deviceId &&
    previous.examId === next.examId && previous.draftId === next.draftId
  return { resetScope: !sameInfractionFormScope(previous, next), resetSubmission: !sameRecord,
    clearPrivateFields: !canAccess || manage === false,
    canHydrateDraft: canAccess && manage === true && next.draftId !== null && next.runtime != null }
}
