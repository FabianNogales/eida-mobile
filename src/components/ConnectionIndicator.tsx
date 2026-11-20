import { AppText } from './AppText'
import { useNetwork } from '../features/connectivity/NetworkProvider'
import { connectionLabels } from '../features/connectivity/state'
import { theme } from '../config/theme'

export function ConnectionIndicator() {
  const state = useNetwork()
  const label = connectionLabels[state]
  return <AppText variant="caption" accessibilityLabel={label} style={{ color: theme.colors.muted }}>{label}</AppText>
}
