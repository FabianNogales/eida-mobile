import { Tabs } from 'expo-router/js-tabs'
import { MainHeader } from '../../../components/MainHeader'
import { MainTabBar } from '../../../components/MainTabBar'
import { TabInsetsContext } from '../../../navigation/TabInsetsContext'

export const unstable_settings = { initialRouteName: 'index' }
const homeHeader = () => <MainHeader title="Inicio" compact />
const examsHeader = () => <MainHeader title="Mis exámenes" compact />
const pendingHeader = () => <MainHeader title="Pendientes" compact />
const profileHeader = () => <MainHeader title="Perfil" compact />

export default function MainTabsLayout() {
  return <TabInsetsContext.Provider value={true}>
    <Tabs backBehavior="history" tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{ header: ({ options }) => <MainHeader title={options.title ?? 'EIDA Control'} />,
        lazy: true, popToTopOnBlur: false }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', header: homeHeader }} />
      <Tabs.Screen name="exams" options={{ title: 'Mis exámenes', header: examsHeader }} />
      <Tabs.Screen name="pending" options={{ title: 'Pendientes', header: pendingHeader }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', header: profileHeader }} />
    </Tabs>
  </TabInsetsContext.Provider>
}
