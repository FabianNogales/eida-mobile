# Excepción temporal de biometría para laboratorio

Fecha: 9 de noviembre de 2026.

El usuario autorizó expresamente permitir las pruebas sin biometría después de
informar que el lector de huella del Huawei Y9 está averiado. Esta instrucción
posterior cambia el requisito anterior únicamente para el modo de laboratorio.

## Activación y alcance

En `src/config/offlineLab.ts` está activo:

```ts
export const TEMPORARY_DEBUG_WITHOUT_BIOMETRICS = true
```

La excepción solo se aplica cuando además `__DEV__ === true`. Un bundle de
producción, como el generado normalmente para Release, mantiene biometría
obligatoria aunque ese interruptor siga en true. Un Debug con un bundle generado
sin desarrollo también conservará la política estricta: la comprobación depende
del bundle, no solamente del nombre del APK.

No se añadió una opción para omitir un error biométrico en el almacén normal.
La selección del laboratorio se hace antes de abrir el almacén y utiliza un
espacio local independiente.

## Qué cambia

- En laboratorio se omite `canUseBiometricAuthentication` como requisito de acceso
  y se usa `requireAuthentication:false` al guardar/leer su clave en SecureStore.
- La clave continúa siendo aleatoria, de 32 bytes, almacenada mediante el
  SecureStore/Keystore de Android. No se guarda en texto plano, AsyncStorage o .env.
- El PIN del teléfono no se solicita ni se valida dentro de EIDA Control. Se ha
  desactivado la exigencia de biometría para ese almacén; no se implementó un nuevo
  autenticador mediante PIN.
- Antes de abrir/preparar listas se muestra un aviso visible en Paquetes y en la
  distribución del examen.
- Los mensajes de las pantallas bloqueadas ya no exigen verbalmente una huella
  cuando se está usando este laboratorio.
- El diagnóstico sigue comunicando el estado real de la biometría, aclarando que
  no es obligatoria en el almacén de laboratorio. No simula que el sensor funciona.

## Qué se conserva

SQLCipher sigue siendo obligatorio y se mantiene el guard real de
`PRAGMA cipher_version` antes de DDL/datos personales. Si falta SQLCipher, las
listas siguen bloqueadas. Si falla SecureStore, tampoco se abre la base.

Se conservan login, autorización por cuenta/servidor/dispositivo, lista exclusiva,
vigencia del paquete, validación de fotografías, bloqueo al pasar a segundo plano,
revalidación tras reiniciar Android, logout y la conservación de pendientes. No se
cambian los eventos, los contratos HTTP, HU37, QR o reglas de incidencias/disciplinarias.

Esta excepción reduce la protección de acceso local: una vez desbloqueado el
teléfono, el laboratorio no pide otra autenticación para recuperar la clave.
Usar datos ficticios. El backend configurado sigue siendo el mismo y las
sincronizaciones pueden producir registros reales allí; el aislamiento es local,
no un sandbox de servidor.

## Separación de datos

| Modo | Servicio SecureStore | Base local |
| --- | --- | --- |
| Normal | `bo.eida.control.offline.v1` | `eida-<scope>.db` |
| Laboratorio | `bo.eida.control.offline.lab.v1` | `eida-lab-<scope>.db` |

El scope conserva los identificadores de servidor, cuenta, instalación y
dispositivo. No se modifican ni se trasladan las bases o claves existentes. El
grant y los marcadores también usan el servicio del modo seleccionado.

Al entrar al laboratorio será necesario validar la cuenta online y descargar de
nuevo la lista en ese espacio. No se verá automáticamente el contenido del
almacén biométrico anterior. No se ha borrado ese contenido.

## Cómo volver a exigir biometría

1. Antes de cambiar de modo, revisar y sincronizar los pendientes del laboratorio
   con su cuenta original; conservar conflictos/evidencia según las reglas actuales.
2. Cambiar el interruptor a `false` en `src/config/offlineLab.ts`.
3. Cerrar completamente y volver a iniciar la aplicación con el código actualizado,
   o generar la APK correspondiente. No cambiar de modo con una descarga o envío
   en curso mediante Fast Refresh.

La base de laboratorio quedará conservada, pero no será la base seleccionada por
el modo normal. Volver a activar la excepción en desarrollo permite regresar al
mismo espacio. No desinstalar ni borrar datos si hay pendientes.

## Archivos y validación

Modificados: `nativeVault.ts`, `OfflinePackagesScreen.tsx`,
`OfflineDistributionScreen.tsx`, `ProtectionDiagnostics.tsx`, y textos de bloqueo
en `OfflineListScreen.tsx`, `OfflineIncidentsScreen.tsx` y `OfflineScannerScreen.tsx`.
Creado: `src/config/offlineLab.ts`.

Pruebas nuevas: `tests/offline-lab.test.ts` cubre desarrollo/producción,
interruptor apagado, separación de namespaces, fallo de SecureStore,
provisión solo con autorización online y rechazo de SQLite sin SQLCipher.
La prueba estricta existente conserva sus aserciones; solo se aclaró su nombre.

**No se ejecutaron pruebas ni typecheck.** El usuario debe ejecutar:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Después debe actualizar el JavaScript usado por su Debug o generar la APK con el
bundle actualizado, según su procedimiento habitual. Para un APK con bundle
incorporado, el cambio de archivos locales no actualiza el binario instalado.
No hay dependencia nueva ni cambio nativo que requiera Prebuild. SQLCipher debe
seguir incorporado en la APK.

Pendiente físico: abrir el almacén de laboratorio en el Huawei, confirmar el aviso,
comprobar SQLCipher, preparar una lista sintética y repetir cierre de proceso,
logout y cambio de cuenta. No se declara validado en el dispositivo.

No se ejecutaron instalaciones, Expo/Metro, compilaciones, Gradle, ADB, Prebuild,
migraciones ni Git. No se modificaron Android, backend, frontend o entorno Windows.
