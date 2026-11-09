import { StyleSheet, View } from 'react-native'
import { theme } from '../../config/theme'
import { userInitials } from '../../ui/generalScreens'
import { AppText } from '../AppText'

export function IdentityBlock({ name, detail }: { name: string; detail?: string }) {
  return <View style={s.row}>
    <View style={s.avatar} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AppText variant="subtitle" style={s.initials}>{userInitials(name)}</AppText>
    </View>
    <View style={s.identity}><AppText variant="title" accessibilityRole="header">{name}</AppText>
      {detail && <AppText style={s.detail}>{detail}</AppText>}</View>
  </View>
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.lg },
  identity: { flexBasis: 180, flexGrow: 1, gap: theme.spacing.xs },
  avatar: { minWidth: 56, minHeight: 56, padding: theme.spacing.md, borderRadius: theme.radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.navy },
  initials: { color: theme.colors.onPrimary }, detail: { color: theme.colors.muted },
})
