import { StyleSheet, Text, View } from 'react-native'
import { theme } from '../../config/theme'
import { MainTabIcon } from '../MainTabIcon'

export type ExamIconName = 'calendar' | 'clock' | 'person' | 'place' | 'chevron' | 'download' | 'list' | 'qr' | 'alert' | 'shield' | 'eye' | 'eye-off'
  | 'wifi' | 'help' | 'info' | 'logout'
export function ExamIcon({ name, color = theme.colors.primary }: { name: ExamIconName; color?: string }) {
  if (name === 'calendar' || name === 'clock' || name === 'person') {
    return <MainTabIcon name={name === 'calendar' ? 'exams' : name === 'clock' ? 'pending' : 'profile'} color={color} />
  }
  const line = { borderColor: color, position: 'absolute' as const }
  return <View style={s.icon} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {name === 'chevron' && <View style={[s.chevron, line]} />}
    {name === 'place' && <><View style={[s.pin, line]} /><View style={[s.pinDot, line]} /></>}
    {name === 'download' && <><View style={[s.shaft, line]} /><View style={[s.arrow, line]} /><View style={[s.tray, line]} /></>}
    {name === 'list' && <>{[5, 11, 17].map((top) => <View key={top} style={[s.listLine, { top }, line]} />)}</>}
    {name === 'qr' && <><View style={[s.qrBox, { top: 3, left: 3 }, line]} /><View style={[s.qrBox, { top: 3, right: 3 }, line]} /><View style={[s.qrBox, { bottom: 3, left: 3 }, line]} /><View style={[s.qrBox, { bottom: 3, right: 3, borderWidth: 3 }, line]} /></>}
    {name === 'alert' && <><View style={[s.alert, line]} /><View style={[s.shaft, { height: 7, top: 6 }, line]} /><View style={[s.dot, { backgroundColor: color }]} /></>}
    {name === 'shield' && <><View style={[s.shield, line]} /><View style={[s.check, line]} /></>}
    {name === 'wifi' && <>
      <View style={[s.wifiArc, line]} /><View style={[s.wifiArc, s.wifiInner, line]} />
      <View style={[s.wifiDot, { backgroundColor: color }]} />
    </>}
    {(name === 'help' || name === 'info') && <View style={[s.circle, { borderColor: color }]}>
      <Text allowFontScaling={false} style={[s.symbol, { color }]}>{name === 'help' ? '?' : 'i'}</Text>
    </View>}
    {name === 'logout' && <>
      <View style={[s.door, line]} /><View style={[s.exitLine, line]} /><View style={[s.exitArrow, line]} />
    </>}
    {(name === 'eye' || name === 'eye-off') && <><View style={[s.eye, line]} /><View style={[s.pupil, line]} />{name === 'eye-off' && <View style={[s.slash, line]} />}</>}
  </View>
}
const s = StyleSheet.create({
  icon: { width: 24, height: 24, flexShrink: 0 },
  wifiArc: { width: 18, height: 10, top: 6, left: 3, borderTopWidth: 2, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  wifiInner: { width: 10, top: 10, left: 7 },
  wifiDot: { position: 'absolute', width: 3, height: 3, borderRadius: 2, left: 10.5, top: 15 },
  circle: { width: 18, height: 18, margin: 3, borderWidth: 1.5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontSize: 12, fontWeight: '700', includeFontPadding: false },
  door: { width: 9, height: 16, top: 4, left: 4, borderWidth: 1.5, borderRightWidth: 0, borderRadius: 2 },
  exitLine: { width: 10, borderTopWidth: 2, top: 11, left: 9 },
  exitArrow: { width: 6, height: 6, borderRightWidth: 2, borderTopWidth: 2, top: 9, left: 14, transform: [{ rotate: '45deg' }] },
  chevron: { width: 8, height: 8, borderRightWidth: 2, borderTopWidth: 2, transform: [{ rotate: '45deg' }], left: 6, top: 8 },
  pin: { width: 15, height: 18, borderWidth: 2, borderRadius: 10, left: 4.5, top: 2 },
  pinDot: { width: 5, height: 5, borderWidth: 1.5, borderRadius: 3, left: 9.5, top: 7 },
  shaft: { borderLeftWidth: 2, height: 13, left: 11, top: 2 },
  arrow: { borderBottomWidth: 2, borderRightWidth: 2, width: 8, height: 8, left: 8, top: 7, transform: [{ rotate: '45deg' }] },
  tray: { borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, width: 18, height: 5, left: 3, bottom: 2 },
  listLine: { borderLeftWidth: 3, borderBottomWidth: 2, width: 18, height: 2, left: 3 },
  qrBox: { position: 'absolute', width: 7, height: 7, borderWidth: 1.5, borderRadius: 1 },
  alert: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 5, top: 2, left: 2 },
  dot: { position: 'absolute', width: 2, height: 2, top: 16, left: 11 },
  shield: { width: 18, height: 21, borderWidth: 1.5, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, left: 3, top: 1 },
  check: { width: 8, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], left: 8, top: 8 },
  eye: { width: 21, height: 13, borderWidth: 1.5, borderRadius: 12, left: 1.5, top: 5.5 },
  pupil: { width: 6, height: 6, borderWidth: 1.5, borderRadius: 4, left: 9, top: 9 },
  slash: { height: 24, borderLeftWidth: 1.5, left: 12, transform: [{ rotate: '-45deg' }] },
})

