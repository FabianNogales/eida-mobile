import { createContext } from 'react'

// The main tab bar owns the bottom system inset; sibling detail stacks do not.
export const TabInsetsContext = createContext(false)
