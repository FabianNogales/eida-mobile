import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'EIDA Control',
  slug: 'eida-control-mobile',
  version: '0.1.0',
  scheme: 'eidacontrol-dev',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: {
    package: 'bo.eida.control.dev', versionCode: 1, allowBackup: false,
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-camera', { recordAudioAndroid: false, microphonePermission: false, barcodeScannerEnabled: true }],
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-dev-client', { launchMode: 'most-recent' }],
    ['expo-splash-screen', { backgroundColor: '#172554' }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    eas: {
      projectId: '83b0510a-9059-4a69-b339-7414a09afa64',
    },
  },
}
export default config

