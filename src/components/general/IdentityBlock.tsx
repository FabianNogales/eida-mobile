import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { userInitials } from '../../ui/generalScreens'
import { AppText } from '../AppText'
import { StatusBadge } from '../StatusBadge'

export function IdentityBlock({ name, detail, roles = [] }: { name: string; detail?: string; roles?: readonly string[] }) {
  return <View style={s.row}>
    <View style={s.avatar} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AppText variant="subtitle" style={s.initials}>{userInitials(name)}</AppText>
    </View>
    <View style={s.identity}>
      <AppText variant="subtitle" accessibilityRole="header">{name}</AppText>
      {detail && <AppText variant="caption" style={s.detail}>{detail}</AppText>}
      {roles.length > 0 && <View style={s.roles}>
        {roles.map((role) => <StatusBadge key={role} label={role} tone="info" />)}
      </View>}
    </View>
  </View>
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.lg },
  identity: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  avatar: { minWidth: 56, minHeight: 56, padding: theme.spacing.md, borderRadius: theme.radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.navy },
  initials: { color: theme.colors.onPrimary }, detail: { color: theme.colors.muted },
})
