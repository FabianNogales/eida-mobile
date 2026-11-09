# EIDA Control · Fase 6 · Cámara QR nativa

## Estado y alcance

Integración escrita, pendiente de instalar `expo-camera`, ejecutar typecheck/pruebas y construir/validar una nueva APK en Android físico. No se validó físicamente la cámara ni se ejecutó ningún comando de instalación, pruebas, Expo, Prebuild, compilación, Git o modificación de Windows en esta fase.

Proyecto: `C:/proyecto/eida-mobile`. Backend verificado en `C:/proyecto/oidevs-examenes-backend`, consultado solo como fuente de contratos. No se modificaron backend, frontend, `.env`, lockfile, `android/`, herramientas ni datos. El QR v3 ya probado por el usuario en fases anteriores se conserva; ese resultado anterior no valida la cámara nueva.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `src/features/scanner/scanSession.ts` | Sesión del escáner con adaptadores, exclusión inmediata de callbacks, verificación y confirmación mediante HU36. |
| `src/features/scanner/NativeQrCamera.tsx` | Permiso y preview nativo de `expo-camera`, solo QR. |
| `src/screens/OfflineScannerScreen.tsx` | Pantalla de permiso, lectura, revisión de identidad/fotografías, confirmación, duplicados y resultados. |
| `src/app/offline/scan.tsx` | Ruta del escáner. |
| `src/app/offline/_layout.tsx` | Título/ruta en el Stack existente. |
| `src/screens/OfflineListScreen.tsx` | Botón «Escanear QR», conservando la consulta manual y el campo de QR anterior. |
| `package.json` | Declaración de `expo-camera: ~58.0.14`; no instalación ni actualización de lockfile. |
| `app.config.ts` | Plugin de cámara, permiso CAMERA, bloqueo de RECORD_AUDIO y escáner habilitado. |
| `tests/scanner.test.ts` | Pruebas de escritorio escritas, sin ejecutarlas. |
| Este documento y referencias en los dos documentos de fase 2 | Estado y procedimiento manual; preservación del historial. |

No se alteraron el verificador/vectores QR v3, autenticación, esquemas SQLite/SQLCipher, registro HU36 ni sincronización HU37.

## Dependencia y API nativa revisadas

El SDK instalado declara `expo: ~58.0.23` y su `node_modules/expo/bundledNativeModules.json` recomienda `expo-camera: ~58.0.14`. Al inspeccionar, no existía `node_modules/expo-camera`. Se contrastaron API y plugin con el código oficial de SDK 58:

- [Documentación de Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/).
- [Exportaciones y useCameraPermissions de SDK 58](https://github.com/expo/expo/blob/sdk-58/packages/expo-camera/src/index.ts).
- [CameraView de SDK 58](https://github.com/expo/expo/blob/sdk-58/packages/expo-camera/src/CameraView.tsx).
- [Plugin y permisos de SDK 58](https://github.com/expo/expo/blob/sdk-58/packages/expo-camera/plugin/src/withCamera.ts).
- [Manifest Android de la biblioteca](https://github.com/expo/expo/blob/sdk-58/packages/expo-camera/android/src/main/AndroidManifest.xml).

Se usan `CameraView`, `useCameraPermissions`, `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`, `onBarcodeScanned`, `onCameraReady` y `onMountError`. Preview trasero en modo picture y mute; no se llaman métodos de fotografías, grabación, galería, lectura desde URL ni el escáner moderno externo. En Android se desmonta el preview al detectar/salir; no se depende de `active`, documentado para iOS. `isAvailableAsync` es web-only en esta API, por eso la disponibilidad Android se informa con errores de montaje y un timeout de arranque de 15 segundos.

La importación nativa es diferida y muestra una explicación si una APK anterior carece del módulo. La dependencia JavaScript sí debe instalarse antes de typecheck o bundling; una importación diferida no permite omitir un paquete inexistente.

## Flujo y seguridad

1. Desbloquear con biometría un paquete previamente descargado/publicado y abrir su lista. Pulsar «Escanear QR».
2. La pantalla comprueba `repo.usable` antes de habilitar el adaptador. Solicitar solo permiso Cámara mediante el botón cuando sea necesario. Permiso denegado permite volver a consulta manual; si Android impide otra solicitud, se ofrece abrir ajustes.
3. Pulsar «Iniciar escaneo». Se monta una única cámara al tener foco, aplicación activa, permiso concedido y paquete utilizable. Se ignoran callbacks antes de `onCameraReady` y códigos que no sean QR.
4. El primer callback cierra sincrónicamente la puerta a otros callbacks y retira el preview. El texto original, limitado a 4096 caracteres, se conserva en memoria de la sesión. No se recorta, registra en logs, convierte a URL ni envía a servicios externos.
5. Se llama a `identifyQr`, que reutiliza **el mismo** `verifyQrV3` y proveedor criptográfico del almacén. Firma RS256, kid confiable del snapshot, versión, issuer/audience, examen y vigencia son comprobados antes de resolver el sujeto firmado dentro de la lista. También se aplican habilitación/ingreso y revocaciones conocidas. Un QR sin autenticar nunca suministra nombres o fotografías a la interfaz.
6. Las fotografías PRESENT se leen como BLOB desde SQLCipher; se comprueban tamaño y SHA-256 antes de representarlas como data URI en RAM. ABSENT continúa mostrando la ausencia legítima informada por el servidor. La cámara no produce archivos de imagen ni grabaciones.
7. Se consulta el evento existente del mismo examen/estudiante. Si existe, se muestra como duplicado local sin reemplazar método, token, UUID ni evidencia. Si no, se muestra identidad y fotografías para revisión; hasta aquí no hay captura de ingreso.
8. Solo «Confirmar ingreso provisional · guardar pendiente» llama a `captureProvisional`. Este servicio revalida con una muestra nueva del reloj nativo, vuelve a verificar el QR y conserva la idempotencia/UUID y protección UNIQUE existentes. Un doble toque no genera dos eventos. Una captura concurrente previa también conserva su evidencia original.
9. Se muestra **PENDIENTE DE SINCRONIZACIÓN**. El refresco existente reconcilia con la outbox HU37, conserva token original y requisito de soporte v3 y no inicia envíos automáticamente. Solo un recibo ACCEPTED persistido por HU37 muestra ingreso oficial confirmado; DUPLICATE/CONFLICT/REJECTED conservan su significado.
10. «Cancelar lectura» descarta el resultado todavía no confirmado; «Volver a escanear» exige armar una sesión de preview nueva. Las detecciones tardías de previews anteriores no pueden ocupar la nueva sesión. Salir, cambiar de cuenta, bloquear o pasar a segundo plano retira el preview y descarta los datos visibles del escáner. Los eventos ya confirmados localmente se conservan cifrados. Una escritura que ya se confirmó y alcanzó la persistencia no se deshace por abandonar la pantalla.

Se revisa el acceso visible periódicamente y al límite de vigencia con el reloj de servidor anclado a tiempo monotónico/boot, sin confiar en Date.now del teléfono. Expiración, cambio de boot o generación del almacén retiran la identidad y bloquean la operación. Los límites y revocaciones que ocurrieron después de descargar el snapshot pueden desconocerse offline.

Se conserva el bloqueo de seguridad de OfflineProvider al abandonar el estado activo. Si el diálogo de permiso o los ajustes provocan ese cambio, hay que volver a desbloquear el almacén y abrir la lista; no se introdujo una excepción al bloqueo por la cámara.

## Contrato EIDA y límite de QR v2

Se revisaron `features/offline/api.ts`, contratos/parser, `routes/api/v1.php`, `MobileOfflinePackageService`, `StudentQrService`, configuración pública y HU37 en la ubicación real del backend. El escáner no introduce endpoints ni peticiones nuevas.

- Preparación/contexto: `POST /api/v1/exams/{id}/offline/prepare`, `GET .../mobile-context`, `GET .../assignments`.
- Descarga: `GET .../package?schema_version=2`, `GET .../packages/{package_id}`, fotografías de la ruta exacta validada del manifiesto.
- Respuesta de paquete: sobre existente `data.mobile`, con `schema_version: 1`, `manifest_json` y `manifest_sha256`. El manifiesto interno mantiene su versión 1 y sus tipos existentes.
- Sincronización: `GET .../sync-capabilities` y `POST .../sync` con el protocolo 2 de HU37. Se conserva la marca local histórica `QR_V3_REQUIRES_BACKEND_EXTENSION` y la negociación real de capacidades. El teléfono no sustituye la validación Laravel.

El código actual de `StudentQrService` emite **v2 HS256**. El verificador offline no dispone de un secreto HS256 ni debe recibirlo. Leer ese código con cámara da un rechazo explícito, nunca éxito simulado. No se consultó producción ni se leyó ningún `.env`; se informa lo observado en el código/configuración por defecto.

Para QR v3 real se necesita un emisor v3 autorizado, claves públicas confiables en un snapshot nuevo y soporte del backend para verificar/sincronizar esa evidencia. Las condiciones actuales de publicación del material público incluyen `mobile_offline.qr_v3_issued`, `qr_v3.enabled`, kid, issuer/audience y clave pública RSA válida; cambiar flags por sí solo no implementa un emisor. HU37 anuncia v3 solo cuando está disponible su verificación. Las migraciones/despliegue de fase 5 siguen siendo un paso manual previo a sincronizar. No se activó emisión, se inventaron credenciales ni se incluyeron claves privadas en la APK.

## Permisos y preparación Android manual

`app.config.ts` declara CAMERA, bloquea RECORD_AUDIO y configura `recordAudioAndroid: false`, `microphonePermission: false`, `barcodeScannerEnabled: true`. No se usa `useMicrophonePermissions`. Conceder cámara se hace únicamente por acción del usuario.

**La configuración fuente no modifica el Android existente hasta aplicarla.** Antes de hacerlo, respalda manualmente tus modificaciones de `android/` fuera de esa carpeta. Revisa `gradle.properties`, `app/build.gradle`, manifests, `local.properties` y el autolinking de QuickCrypto, SecureStore, SQLite y EidaOfflineClock. No ejecutes Prebuild con `--clean`: puede perder modificaciones nativas. La configuración CMake existente se conserva y se fuerza explícitamente al compilar.

Comandos para que **el usuario** los revise y ejecute, en orden, desde PowerShell:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npx expo install expo-camera
npm run typecheck
npm test
```

La instalación debe resolver la versión compatible (~58.0.14) y actualizar el lockfile. Hasta entonces `package.json` y el lockfile tienen esta diferencia intencional; no usar `npm ci` esperando que la dependencia nueva ya esté bloqueada. No hace falta instalar otra biblioteca de escaneo ni ampliar las dependencias de pruebas.

Tras el respaldo/revisión nativos, para aplicar el plugin y permisos declarados:

```powershell
npx expo prebuild --platform android --no-install
```

Ese comando **sí modifica archivos nativos** y puede ajustar archivos del proyecto; aquí solo se documenta, no se ejecutó. Revisa sus cambios antes de compilar, incluyendo `allowBackup=false`, el bloqueo de micrófono, SQLCipher y tus personalizaciones. [Expo explica el comportamiento de Prebuild y sus riesgos](https://docs.expo.dev/workflow/continuous-native-generation/).

Alternativa sin Prebuild: Android ya tiene autolinking Expo y la biblioteca de cámara aporta CAMERA por fusión de manifest; el escáner está habilitado por defecto. Sin embargo Gradle no aplica por sí solo los plugins de `app.config.ts`. Para mantener Android manualmente, el usuario debe revisar/aplicar los permisos equivalentes, incluyendo la eliminación de RECORD_AUDIO si alguna dependencia lo aporta. Ejemplo de entradas dentro de `<manifest>` con el namespace `tools` existente (no insertadas por el asistente):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove" />
```

Después de preparar Android por una de esas vías, compilar una APK debug:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile\android'
.\gradlew.bat :app:assembleDebug `
  '-Pexpo.sqlite.useSQLCipher=true' `
  '-Pandroid.cmakeVersion=3.31.6' `
  '-Pandroid.builder.sdkDownload=false' `
  --no-daemon --max-workers=2 --console=plain
```

Salida habitual: `android/app/build/outputs/apk/debug/app-debug.apk`. Se necesita una APK nueva con expo-camera, QuickCrypto/Nitro, SecureStore, SQLCipher y el reloj local enlazados. Actualizar solo JS no incorpora módulos nativos. Gradle puede descargar sus dependencias de cámara/Maven; el flag de SDK impide su instalación automática por Gradle. No se cambia CMake 3.31.6 ni ninguna herramienta del equipo con código de esta fase.

Para servir JavaScript a la development build, en otra terminal del usuario:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run start
```

## Pruebas escritas y validación pendiente

`tests/scanner.test.ts` inyecta un adaptador de detección/permisos y el reloj sintético; reutiliza el verificador real con OpenSSL de escritorio, los vectores públicos existentes y las consultas SQLite reales de HU36/HU37. El doble de `cipher_version` del soporte anterior solo permite comprobar lógica SQL en escritorio: no prueba cifrado Android. El adaptador de base64 tampoco sustituye una prueba física de fotografías.

Casos escritos: QR válido sin captura automática; firma/payload manipulados; alg/kid inesperados; otro examen; estudiante fuera de lista; expiración QR con paquete aún vigente; v2; texto malformado/URL/tamaño; ausencia de claves; habilitación/revocación conocidas; permiso ausente/retirado; preview sin preparar; código no QR; cámara no disponible; doble detección; doble confirmación; callbacks antiguos y escaneos consecutivos; cancelación; duplicado y carrera con captura manual; UUID estable; inmutabilidad SQL; conservación de pendientes con expiración, boot distinto o bloqueo; paquete incompleto/desactualizado; confirmación después de expirar; integración con outbox sin ACK inventado; respuesta criptográfica tardía al salir; fotografías válidas, ausencia legítima y BLOB corrupto.

Se conservó `tests/qr-v3.test.ts` y los vectores originales sin cambios. `npm test` descubrirá también el archivo nuevo mediante el runner multiplataforma existente. **No se afirma que estas pruebas o typecheck hayan aprobado: no se ejecutaron.**

Validación manual posterior en Android físico:

1. Permitir, denegar y denegar permanentemente cámara; abrir ajustes; comprobar que no se solicita micrófono y que la consulta manual sigue disponible.
2. Comprobar preview real, enfoque/iluminación, permisos, cámara ocupada y reintento; abrir/cerrar la pantalla repetidamente y verificar una sola cámara activa.
3. Usar exclusivamente un entorno/paquete de prueba con QR v3 sintético autorizado, sin estudiantes reales. Verificar identidad/fotos solo después de validar firma. Repetir con v2, QR alterado, otro examen y expirado.
4. Enfocar repetidamente: ningún evento hasta confirmar. Confirmar, repetir y comprobar UUID único; cancelar una revisión nueva y comprobar que no se crea evento.
5. Activar modo avión después de descargar/desbloquear; identificar y confirmar offline. Salir/bloquear/volver a abrir: pendientes conservados. Reiniciar exige recuperar/revalidar el anclaje, como en HU36.
6. Al recuperar red, HU37 debe conservar QR v3 pendiente si el backend no anuncia soporte. Solo un ACK válido permite anunciar ingreso oficial; no habilitar emisión de QR v3 para estudiantes reales para probar cámara.

## APK independiente futura

Esta etapa no produce una APK autónoma. El debug actual omite el bundle JS por defecto y requiere Metro. La etapa final debe generar una variante con JS/assets incluidos, enlazar todos los módulos nativos, comprobar `PRAGMA cipher_version` real antes de abrir datos, mantener protección biométrica de la clave/fotografías y probar arranque en frío sin computadora ni red. También faltan validación física de cámara y regresiones completas de autenticación, HU35–HU37 y QR v3. Una distribución real necesita firma adecuada; la configuración release actual usa la clave debug y no debe confundirse con una publicación productiva.
