import { View, StyleSheet } from 'react-native'
import type { PreparationState } from '../../features/offline/contracts'
import { theme } from '../../config/theme'
import { preparationLabels } from '../../ui/controlScreens'
import { AppText } from '../AppText'
import { ProgressBar } from '../ProgressBar'
import { StatusBadge } from '../StatusBadge'

export function PreparationStatus({ state, active }: { state: PreparationState; active?: boolean }) {
  return <View style={s.group}>
    <StatusBadge {...(state === 'PREPARADO' && active === false ? { label: 'Copia archivada', tone: 'neutral' as const } : preparationLabels[state])} />
    {state === 'DESCARGANDO' && <ProgressBar value={null} label="Preparando datos y verificando fotografías" />}
    {state === 'PREPARADO' && active === false && <AppText variant="caption">Copia conservada, no publicada como activa.</AppText>}
    {state === 'INCOMPLETA' && <AppText>Esta descarga no se puede usar para identificar estudiantes. Puedes reanudarla con la cuenta original y conexión.</AppText>}
  </View>
}
const s = StyleSheet.create({ group: { gap: theme.spacing.sm } })
