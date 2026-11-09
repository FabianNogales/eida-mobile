import type { NativeStackNavigationOptions } from 'expo-router'
import { theme } from '../config/theme'

// Use real native Stack headers/back gestures. Do not paint deprecated Android 35 bars.
export const stackScreenOptions = {
  headerStyle: { backgroundColor: theme.colors.surface },
  headerTintColor: theme.colors.navy,
  headerTitleStyle: { fontSize: 20, fontWeight: '600' },
  contentStyle: { backgroundColor: theme.colors.background },
  statusBarStyle: 'dark', statusBarHidden: false, navigationBarHidden: false,
} satisfies NativeStackNavigationOptions
