import { StyleSheet, View } from 'react-native'
import type { MainTabName } from '../navigation/mainTabs'

// Small decorative native strokes; the parent tab supplies the accessible label.
// No icon font, SVG renderer or bitmap dependency is required.
export function MainTabIcon({ name, color }: { name: MainTabName; color: string }) {
  const line = { borderColor: color }
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.icon}>
    {name === 'index' && <>
      <View style={[s.roof, line]} /><View style={[s.house, line]} /><View style={[s.door, line]} />
    </>}
    {name === 'exams' && <>
      <View style={[s.calendar, line]} /><View style={[s.calendarLine, line]} />
      <View style={[s.ring, { left: 7 }, line]} /><View style={[s.ring, { right: 7 }, line]} />
    </>}
    {name === 'pending' && <>
      <View style={[s.clock, line]} /><View style={[s.hand, line]} /><View style={[s.minute, line]} />
    </>}
    {name === 'profile' && <>
      <View style={[s.head, line]} /><View style={[s.shoulders, line]} />
    </>}
  </View>
}
const s = StyleSheet.create({
  icon: { width: 24, height: 24 },
  roof: { position: 'absolute', width: 13, height: 13, borderLeftWidth: 2, borderTopWidth: 2, left: 5.5, top: 2, transform: [{ rotate: '45deg' }] },
  house: { position: 'absolute', width: 15, height: 12, borderWidth: 2, borderTopWidth: 0, left: 4.5, top: 10 },
  door: { position: 'absolute', width: 5, height: 8, borderWidth: 2, borderBottomWidth: 0, left: 9.5, top: 14 },
  calendar: { position: 'absolute', borderWidth: 2, borderRadius: 3, left: 2, right: 2, top: 5, bottom: 2 },
  calendarLine: { position: 'absolute', borderTopWidth: 2, top: 10, left: 3, right: 3 },
  ring: { position: 'absolute', borderLeftWidth: 2, height: 6, top: 2 },
  clock: { position: 'absolute', borderWidth: 2, borderRadius: 11, width: 21, height: 21, top: 1, left: 1 },
  hand: { position: 'absolute', borderLeftWidth: 2, height: 7, left: 11, top: 5 },
  minute: { position: 'absolute', borderTopWidth: 2, width: 6, left: 11, top: 11 },
  head: { position: 'absolute', borderWidth: 2, borderRadius: 5, width: 10, height: 10, top: 1, left: 7 },
  shoulders: { position: 'absolute', borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: 11, borderTopRightRadius: 11, width: 20, height: 10, left: 2, bottom: 1 },
})
