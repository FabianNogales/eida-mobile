import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import { observeConnectivity, type ConnectionState } from './state'

type NetworkPort = {
  connectionIsValidated(): Promise<boolean>
  addListener(event: 'onConnectivityChanged', listener: (event: { connected: boolean | null }) => void): { remove(): void }
}

const Context = createContext<ConnectionState>('unknown')

export function NetworkProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ConnectionState>('unknown')
  useEffect(() => {
    const native = requireOptionalNativeModule<NetworkPort>('EidaOfflineClock')
    if (!native || typeof native.connectionIsValidated !== 'function') return
    return observeConnectivity({
      read: () => native.connectionIsValidated(),
      onChange(listener) {
        const sub = native.addListener('onConnectivityChanged', ({ connected }) => listener(connected))
        return () => sub.remove()
      },
      onForeground(listener) {
        const sub = AppState.addEventListener('change', (value) => { if (value === 'active') listener() })
        return () => sub.remove()
      },
    }, setState)
  }, [])
  return <Context.Provider value={state}>{children}</Context.Provider>
}

export function useNetwork() { return useContext(Context) }
