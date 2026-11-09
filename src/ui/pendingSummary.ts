import type { SyncItem } from '../features/offline/sync/contracts'
import type { IncidentItem } from '../features/incidents/contracts'

type DeliveryState = SyncItem['state'] | IncidentItem['state']
export interface QueueSummary { pending: number; sending: number; conflicts: number; rejected: number }
function summarize(items: readonly { state: DeliveryState }[]): QueueSummary {
  return items.reduce((counts, item) => {
    if (item.state === 'PENDING') counts.pending++
    else if (item.state === 'SENDING') counts.sending++
    else if (item.state === 'CONFLICT') counts.conflicts++
    else if (item.state === 'REJECTED') counts.rejected++
    return counts
  }, { pending: 0, sending: 0, conflicts: 0, rejected: 0 })
}

// Presentation only: never changes an event, receipt or transport. A locked vault
// has unknown counts, rather than a reassuring (and incorrect) zero.
export function pendingSummary(unlocked: boolean,
  entries: readonly Pick<SyncItem, 'state'>[], incidents: readonly Pick<IncidentItem, 'state'>[]) {
  if (!unlocked) return null
  const entry = summarize(entries), incident = summarize(incidents)
  return { entry, incident,
    pending: entry.pending + entry.sending + incident.pending + incident.sending,
    attention: entry.conflicts + entry.rejected + incident.conflicts + incident.rejected }
}
