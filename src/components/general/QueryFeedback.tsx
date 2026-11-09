import { ActionButton } from '../ActionButton'
import { LoadingState } from '../FeedbackStates'
import { Notice } from '../Notice'

export function QueryFeedback({ loading, error, label, retry }: { loading: boolean; error: string | null; label: string; retry(): void }) {
  if (loading) return <LoadingState label={label} />
  if (!error) return null
  return <><Notice tone="error" message={error} /><ActionButton secondary label="Reintentar consulta" onPress={retry} /></>
}
