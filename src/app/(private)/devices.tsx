import { Redirect } from 'expo-router'

// Keep old links safe without exposing device administration in the operator UI.
export default function DevicesRedirect() {
  return <Redirect href="/(private)/(tabs)/profile" />
}
