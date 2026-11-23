import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import { observeConnectivity, type ConnectionState } from './state'

type NetworkPort = {
  connectionStatus?(): Promise<unknown>
  connectionIsValidated?(): Promise<boolean>
  addListener(event: 'onConnectivityChanged', listener: (event: { connected: boolean | null; isConnected?: boolean; isInternetReachable?: boolean | null }) => void): { remove(): void }
}

const Context = createContext<ConnectionState>('checking')

export function NetworkProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ConnectionState>('checking')
  useEffect(() => {
    try {
      const native = requireOptionalNativeModule<NetworkPort>('EidaOfflineClock')
      if (!native || (typeof native.connectionStatus !== 'function' && typeof native.connectionIsValidated !== 'function')) {
        setState('unknown'); return
      }
      return observeConnectivity({
        read: () => native.connectionStatus ? native.connectionStatus() : native.connectionIsValidated!(),
        onChange(listener) {
          const sub = native.addListener('onConnectivityChanged', (event) => listener(
            typeof event?.isConnected === 'boolean' ? event : event?.connected))
          return () => sub.remove()
        },
        onForeground(listener) {
          const sub = AppState.addEventListener('change', (value) => { if (value === 'active') listener() })
          return () => sub.remove()
        },
      }, setState)
    } catch { setState('unknown') }
  }, [])
  return <Context.Provider value={state}>{children}</Context.Provider>
}

export function useNetwork() { return useContext(Context) }
