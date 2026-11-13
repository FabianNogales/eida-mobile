// TEMPORARY: authorized by the user to test on a device with a broken sensor.
// Set to false and restart the app to restore biometrics in development.
export const TEMPORARY_DEBUG_WITHOUT_BIOMETRICS = true

export function offlineProtectionPolicy(developmentBundle: boolean, allowTemporaryLab: boolean) {
  const laboratory = developmentBundle && allowTemporaryLab
  return {
    laboratory,
    requireAuthentication: !laboratory,
    keychainService: laboratory ? 'bo.eida.control.offline.lab.v1' : 'bo.eida.control.offline.v1',
    databasePrefix: laboratory ? 'eida-lab-' : 'eida-',
  }
}

// Metro supplies this build-time constant. Undefined outside React Native must
// fail closed; this declaration does not set or override the runtime value.
declare const __DEV__: boolean
export const offlineProtection = offlineProtectionPolicy(
  typeof __DEV__ !== 'undefined' && __DEV__ === true, TEMPORARY_DEBUG_WITHOUT_BIOMETRICS,
)

export const offlineLabWarning = 'LABORATORIO: acceso sin biometría. Las listas siguen cifradas y la clave se guarda en SecureStore/Keystore, pero no se solicita autenticación biométrica para abrirlas. Usa datos ficticios: los envíos llegan al backend configurado.'
