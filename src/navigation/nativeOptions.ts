import { ConnectionIndicator } from '../components/ConnectionIndicator'
import { stackScreenOptions } from './options'

export const nativeStackScreenOptions = {
  ...stackScreenOptions,
  headerRight: ConnectionIndicator,
}
