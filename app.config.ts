import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'EIDA Control',
  slug: 'eida-control-mobile',
  version: '0.1.0',
  scheme: 'eidacontrol-dev',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: { package: 'bo.eida.control.dev', versionCode: 1, allowBackup: false },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-dev-client', { launchMode: 'most-recent' }],
    ['expo-splash-screen', { backgroundColor: '#172554' }],
  ],
  experiments: { typedRoutes: false },
}
export default config

