// Compile-only cases included by tsconfig.tests.json. Not a *.test.ts file:
// npm test never executes this module or imports React Native through it.
import type { Dispatch, SetStateAction } from 'react'
import type { FlatListProps } from 'react-native'
import type { ChoiceChips } from '../../src/components/operations/ChoiceChips'
import { incidentTypes, infractionTypes, type IncidentType, type InfractionType, type IncidentState } from '../../src/features/incidents/contracts'
import type { OutboxState } from '../../src/features/offline/sync/contracts'
import { entryStates, incidentStates } from '../../src/ui/operations'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

// Deliberately never called: typecheck checks the real generic component and
// React setters without replacing their types or mounting native components.
export function choiceChipsTypeCases(
  render: typeof ChoiceChips,
  setInfraction: Dispatch<SetStateAction<InfractionType>>,
  setIncident: Dispatch<SetStateAction<IncidentType>>,
  setIncidentFilter: Dispatch<SetStateAction<IncidentState | 'ALL'>>,
  setEntryFilter: Dispatch<SetStateAction<OutboxState | 'ALL'>>,
) {
  render({ options: infractionTypes, value: 'COPYING', onChange: setInfraction })
  render({ options: incidentTypes, value: 'IDENTIFICATION', onChange: setIncident, disabled: true })
  render({ options: infractionTypes, value: 'CHEATING', onChange(value) {
    const exact: Equal<typeof value, InfractionType> = true
    void exact
  } })
  render({ options: incidentTypes, value: 'ENVIRONMENT', onChange(value) {
    const exact: Equal<typeof value, IncidentType> = true
    void exact
  } })
  // Inline options also retain their literal union without caller assertions.
  render({ options: [{ value: 'COPYING', label: 'Copia' }, { value: 'CHEATING', label: 'Trampa' }],
    value: 'COPYING', onChange(value) {
      const exact: Equal<typeof value, 'COPYING' | 'CHEATING'> = true
      void exact
    } })
  const incidentOptions: { value: IncidentState | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Todos' }, ...incidentStates.map((value) => ({ value, label: value })),
  ]
  const entryOptions: { value: OutboxState | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Todos' }, ...entryStates.map((value) => ({ value, label: value })),
  ]
  render({ options: incidentOptions, value: 'ALL', onChange: setIncidentFilter })
  render({ options: entryOptions, value: 'ALL', onChange: setEntryFilter })
  render({ options: [{ value: 'expulsions', label: 'Expulsiones' }, { value: 'entries', label: 'Ingresos' }],
    value: 'entries', onChange: (_value: 'expulsions' | 'entries') => {} })
  render({ options: incidentOptions, value: 'REGISTERED', onChange(value) {
    const exact: Equal<typeof value, IncidentState | 'ALL'> = true
    void exact
  } })
  render({ options: entryOptions, value: 'CONFIRMED', onChange(value) {
    const exact: Equal<typeof value, OutboxState | 'ALL'> = true
    void exact
  } })

  // Negative expectations must keep producing errors; they cannot mask a
  // compiler regression because TypeScript reports unused @ts-expect-error.
  // @ts-expect-error A value outside the options must not widen their union.
  render({ options: infractionTypes, value: 'UNKNOWN', onChange: setInfraction })
  // @ts-expect-error Even a broad callback cannot make an unknown value valid.
  render({ options: incidentTypes, value: 'UNKNOWN', onChange: (_value: string) => {} })
  // @ts-expect-error An infraction setter cannot receive incident values.
  render({ options: incidentTypes, value: 'IDENTIFICATION', onChange: setInfraction })
  // @ts-expect-error A callback must handle every option, not only COPYING.
  render({ options: infractionTypes, value: 'COPYING', onChange: (_value: 'COPYING') => {} })
}

export function flatListSlotTypeCases() {
  const empty: FlatListProps<unknown>['ListEmptyComponent'] = undefined
  const footer: FlatListProps<unknown>['ListFooterComponent'] = undefined
  // @ts-expect-error The installed generated FlatList types exclude null.
  const invalidEmpty: FlatListProps<unknown>['ListEmptyComponent'] = null
  // @ts-expect-error The installed generated FlatList types exclude null.
  const invalidFooter: FlatListProps<unknown>['ListFooterComponent'] = null
  return { empty, footer, invalidEmpty, invalidFooter }
}
