import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { LoadingState } from '../FeedbackStates'
import { Notice } from '../Notice'

export function OnlineAccessState({ loading, error, message, retry }: { loading: boolean; error: string | null; message: string; retry(): void }) {
  return <Card><AppText variant="subtitle" accessibilityRole="header">Autorización de la operación</AppText>
    {loading ? <LoadingState label="Validando permisos con el servidor" /> : <Notice tone={error ? 'error' : 'warning'} message={error ?? message} />}
    <AppText>Esta operación requiere conexión y autorización actual. La interfaz no concede permisos docentes.</AppText>
    <ActionButton secondary label="Volver a consultar autorización" busy={loading} onPress={retry} />
  </Card>
}
