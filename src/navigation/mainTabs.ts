export const mainTabs = [
  { name: 'index', label: 'Inicio' },
  { name: 'exams', label: 'Exámenes' },
  { name: 'pending', label: 'Pendientes' },
  { name: 'profile', label: 'Perfil' },
] as const
export type MainTabName = typeof mainTabs[number]['name']

// Same cancellable event protocol as Expo Router 58's installed BottomTabBar.
export function selectTab(key: string, focused: boolean,
  emit: (key: string) => { defaultPrevented: boolean }, navigate: (key: string) => void) {
  const event = emit(key)
  if (!focused && !event.defaultPrevented) navigate(key)
}
