# EIDA Control — Fase 9: auditoría previa a la APK

Fecha: 9 de noviembre de 2026. Inspección estática local; sin ejecución del producto ni conexión a producción.

## 1. Dictamen y alcance

**REQUIERE AJUSTES DE CONFIGURACIÓN PARA COMPILAR Y TIENE FUNCIONES BLOQUEADAS POR EL BACKEND. No está validado para un piloto con datos reales.**

Las dependencias principales están presentes y coinciden con el lockfile. La arquitectura dispone de protecciones offline y pruebas escritas. Sin embargo:

1. Android no declara `expo.sqlite.useSQLCipher=true`, aunque Expo sí solicita SQLCipher. El código bloquea la persistencia si no encuentra el cifrado.
2. CMake 3.31.6 está instalado, pero no está seleccionado por la configuración nativa actual.
3. El catálogo utilizado por Android solicita `compileSdk=37`. No existe `platforms/android-37` en el SDK configurado.
4. Incidencias y disciplina están cerradas para los tokens móviles por la política central de abilities. Existe una propuesta, todavía sin integrar.
5. El emisor de QR de estudiantes inspeccionado genera v2/HS256. El verificador v3 y sus opciones de configuración no cambian ese emisor.
6. La variante release actual incorpora JavaScript, pero usa el keystore estándar de desarrollo para firmar. Para un piloto con personas reales debe emplearse una identidad de firma privada controlada.
7. No hay evidencia de validación de esta versión completa en una APK independiente, con SQLCipher, cámara, biometría y reloj.

Se puede preparar una APK de laboratorio con datos sintéticos después de resolver los requisitos locales, sin esperar a habilitar QR v3 real. La validación integral de incidencias, disciplina y QR de estudiantes requiere además coordinación y cambios del backend.

### Repositorios comprobados

| Componente | Ruta | Resultado |
| --- | --- | --- |
| Móvil | `C:\proyecto\eida-mobile` | Proyecto actual inspeccionado. |
| Backend actual | `C:\proyecto\oidevs-examenes-backend` | Contiene login móvil, extensiones offline, propuesta de abilities y las tres migraciones solicitadas. |
| Backend antiguo autorizado | `C:\Fabian\Docs. Universidad\TIS\proyecto\oidevs-examenes-backend` | La ruta no existe. |
| Frontend web | No fue necesario consultarlo en esta fase | No se modificó. La paleta móvil conserva los cuatro valores aprobados por el usuario. |

No se recorrieron carpetas padre `proyecto` ni directorios `-compare`. No se leyeron `.env`, claves privadas ni keystores. La lectura de la configuración nativa y de pruebas no demuestra qué configuración está desplegada ni qué migraciones están aplicadas.

### Significado de las evidencias

- **IMPLEMENTADO:** existe código inspeccionado que realiza el comportamiento; no equivale a ejecución satisfactoria.
- **PROBADO AUTOMÁTICAMENTE:** requiere un resultado de ejecución identificable. En esta auditoría no se ejecutó ninguna prueba.
- **REQUIERE ANDROID:** solo puede cerrarse con el binario nuevo y pruebas en el dispositivo.
- **BLOQUEADO POR BACKEND:** el código servidor actual impide el flujo, o falta verificar una capacidad desplegada indispensable.

Antecedentes aportados por el usuario: hubo pruebas satisfactorias de fases anteriores, incluida la validación automatizada del Bloque A; `AGENTS.md` también registra una prueba histórica del verificador QR v3 en Android real. Estos antecedentes no certifican el estado actual de los bloques B–D, el cierre visual, SQLCipher, el escáner ni una APK release nueva.

## 2. Bloqueos y prioridades

| ID | Severidad | Hallazgo comprobado o pendiente | Consecuencia y condición para cerrarlo |
| --- | --- | --- | --- |
| N1 | **BLOQUEANTE** | Falta `expo.sqlite.useSQLCipher=true` en `android/gradle.properties`. | Una compilación sin override selecciona SQLite sin SQLCipher. El guard del móvil bloquea guardar datos; no se comprobó una fuga a una base sin cifrar. Compilar con la propiedad explícita y comprobar `PRAGMA cipher_version` en Android. |
| N2 | **BLOQUEANTE** | `compileSdk=37` y plataforma 37 ausente en el SDK configurado. | No se puede completar la compilación con ese SDK tal como está. El usuario debe verificar disponibilidad e instalar exclusivamente esa plataforma, o revisar coordinadamente el catálogo; no bajar el SDK por ensayo. |
| N3 | **IMPORTANTE** | CMake 3.31.6 presente, sin selección en Gradle ni `cmake.dir` local. | Preservarlo con `-Pandroid.cmakeVersion=3.31.6`, propiedad realmente consumida por el plugin Expo instalado. |
| N4 | **IMPORTANTE** | Artefactos generados de autolinking anteriores al conjunto nativo requerido. | La lista Expo existente no contiene entradas nominales de cámara, SQLite ni reloj local. No demuestra el contenido del próximo APK. Comprobar nueva resolución, proveedor generado y módulos en ejecución. |
| B1 | **BLOQUEANTE** | Rutas de incidencias y disciplina ausentes en el mapa central móvil. | `403 MOBILE_ABILITY_REQUIRED`. Equipo 1 debe aprobar e integrar el mapa mínimo y la emisión correspondiente de abilities. |
| B2 | **BLOQUEANTE** | Emisor real del código local continúa en v2. | No se puede validar el escaneo offline v3 con QR de estudiantes emitidos por ese servicio. No activar flags como sustituto de integrar el emisor. |
| B3 | **BLOQUEANTE condicional** | Estado de migraciones/despliegue desconocido. | Login, paquetes o evidencia fallarán si falta su esquema/contrato. Comprobar en un entorno de integración autorizado, sin asumir que faltan en producción. |
| S1 | **CRÍTICO para un piloto con datos reales** | Release usa `signingConfigs.debug`. | La clave de desarrollo no identifica de forma privada al responsable de la APK. Usar firma privada de laboratorio y mantenerla estable antes de introducir datos reales. |
| S2 | **IMPORTANTE** | `allowBackup=false` presente; exclusiones específicas de SecureStore no están en el manifiesto fuente actual. | El plugin declarado todavía no acredita reglas de extracción aplicadas al Android existente. Revisar backups/restauración y transferencia entre dispositivos; conservar exclusiones explícitas antes de distribución con datos reales. |
| V1 | **BLOQUEANTE para declarar validación nativa** | No se generó ni probó el binario auditado. | Ejecutar el plan Android y conservar evidencias con hash, firma y configuración de la APK. |
| T1 | **IMPORTANTE** | Pruebas positivas de incidencias móviles activan el mapa propuesto solo en su contenedor de pruebas. | Un resultado verde de esas pruebas no significa que la política central ya permita el flujo real. |
| T2 | **IMPORTANTE** | La concurrencia PostgreSQL existente cubre HU35–37 y HU27; no se identificó una suite PostgreSQL específica del nuevo transporte `mobile_incident_sync_events`. | Añadir posteriormente casos reales de carrera/replay/cambio de actor de ese transporte, sin sustituirlos por la suite HU27. |
| R1 | **IMPORTANTE** | `/android/` ignorado y cero entradas Android en el índice local. | Las decisiones nativas manuales no se transportan mediante ese índice. Resolver una política de conservación/reproducción antes de regenerar o clonar. |
| U1 | **IMPORTANTE** | Safe Area/IME/Atrás implementados; falta validación en dispositivo. | Probar gestos y tres botones, fuentes grandes, teclado, diálogos y lector de pantalla. |
| O1 | **OPCIONAL** | Poppins pendiente de archivos locales aprobados. | No impide funcionamiento; no descargar fuentes ni añadir dependencias por esta auditoría. |

## 3. Dependencias

Evidencia: `package.json`, `package-lock.json` y `node_modules/<paquete>/package.json`, leídos como datos. Las declaraciones de las 23 dependencias directas coinciden con la raíz del lockfile; sus versiones instaladas coinciden con las resueltas que se indican.

| Paquete | Declaración | Lockfile | Instalado |
| --- | --- | --- | --- |
| expo | ~58.0.23 | 58.0.23 | 58.0.23 |
| expo-camera | ~58.0.14 | 58.0.14 | 58.0.14 |
| expo-constants | ~58.0.15 | 58.0.15 | 58.0.15 |
| expo-dev-client | ~58.0.18 | 58.0.18 | 58.0.18 |
| expo-linking | ~58.0.16 | 58.0.16 | 58.0.16 |
| expo-router | ~58.0.30 | 58.0.30 | 58.0.30 |
| expo-secure-store | ~58.0.2 | 58.0.2 | 58.0.2 |
| expo-splash-screen | ~58.0.13 | 58.0.13 | 58.0.13 |
| expo-sqlite | ~58.0.15 | 58.0.15 | 58.0.15 |
| expo-status-bar | ~58.0.4 | 58.0.4 | 58.0.4 |
| expo-system-ui | ~58.0.7 | 58.0.7 | 58.0.7 |
| react | 19.3.0 | 19.3.0 | 19.3.0 |
| react-dom | 19.3.0 | 19.3.0 | 19.3.0 |
| react-native | 0.88.1 | 0.88.1 | 0.88.1 |
| react-native-nitro-modules | 0.37.2 | 0.37.2 | 0.37.2 |
| react-native-quick-base64 | 3.0.1 | 3.0.1 | 3.0.1 |
| react-native-quick-crypto | 1.1.9 | 1.1.9 | 1.1.9 |
| react-native-safe-area-context | ~5.11.1 | 5.11.1 | 5.11.1 |
| react-native-screens | ~4.30.1 | 4.30.1 | 4.30.1 |
| @types/node | ^22.19.0 | 22.20.5 | 22.20.5 |
| @types/react | ~19.3.0 | 19.3.0 | 19.3.0 |
| tsx | ^4.20.6 | 4.23.15 | 4.23.15 |
| typescript | ~6.0.3 | 6.0.3 | 6.0.3 |

Además, React, React Native, Camera, Router, SQLite, SecureStore, Screens y Safe Area coinciden con los rangos del `bundledNativeModules.json` de Expo instalado. La coincidencia es estática; no prueba compatibilidad binaria de todas las dependencias transitivas.

**No se identificó una dependencia npm directa faltante. No hace falta un comando de instalación para reparar estos hallazgos.** En particular, Camera ya está instalado; no corresponde volver a instalarlo por antecedentes antiguos.

Biometría: `expo-secure-store/android/build.gradle` incorpora `androidx.biometric:biometric:1.1.0`. El móvil usa `canUseBiometricAuthentication()` y `requireAuthentication:true`. No se necesita añadir `expo-local-authentication` para ese diseño.

Reloj: módulo local privado `modules/eida-offline-clock`, versión 1.0.0, con fuentes Kotlin y `expo-module.config.json`. No es una dependencia remota pendiente de instalar.

Node admitido por el proyecto: `^22.13.0 || ^24.3.0 || >=26.0.0`. Para reproducir la validación previa, utilizar Node 22 compatible. No se ejecutó Node ni Java para comprobar la versión activa.

## 4. Android: configuración efectiva y límites

### 4.1 SQLCipher

Evidencia fuente:

- `app.config.ts` declara el plugin `['expo-sqlite', { useSQLCipher: true }]`.
- `android/gradle.properties` no contiene `expo.sqlite.useSQLCipher`.
- `node_modules/expo-sqlite/android/build.gradle:17` activa `USE_SQLCIPHER` solo cuando `findProperty('expo.sqlite.useSQLCipher') == 'true'`; entonces selecciona `vendor/sqlcipher` y los flags nativos correspondientes.
- `node_modules/expo-sqlite/android/shouldUsePublication.groovy` permite el artefacto precompilado únicamente si no existen propiedades de personalización SQLite. Pasar `-Pexpo.sqlite.useSQLCipher=true` también fuerza la ruta de compilación desde fuentes en la selección de publicaciones de Expo.
- El plugin SQLite escribe la propiedad durante Prebuild. Gradle sobre un `android/` existente no ejecuta ese plugin de configuración por el mero hecho de aparecer en `app.config.ts`.

Por tanto, sin un override externo no inspeccionado, el Android fuente actual no selecciona SQLCipher. No se leyeron propiedades Gradle globales personales y no se supone su valor.

En `src/features/offline/repository.ts:20`, `initializeCipher` consulta primero `PRAGMA cipher_version`. Si no obtiene una versión válida, lanza `ProtectedStorageError` antes de `PRAGMA key`, DDL o datos personales. Después valida una clave de 64 caracteres hexadecimales, aplica la clave, `temp_store=MEMORY`, claves foráneas y `secure_delete`. Rechaza una versión de esquema superior a 3.

**Diagnóstico:** protección de cierre seguro IMPLEMENTADA; SQLCipher nativo todavía REQUIERE ANDROID. Puede abrirse/crearse el archivo contenedor antes del guard; ello no significa que se hayan guardado estudiantes o fotos sin cifrar. No se debe retirar el guard para hacer funcionar la APK.

Solución mínima de laboratorio, sin Prebuild: compilar con la propiedad explícita del apartado 9. Solución duradera futura: conservarla también en la configuración nativa reproducible. Esta auditoría no la modifica.

### 4.2 Herramientas y CMake

`android/settings.gradle` usa `expoAutolinking.useExpoVersionCatalog()`. Sin overrides locales en los archivos examinados, el catálogo de `react-native/gradle/libs.versions.toml` determina:

| Requisito nativo | Valor del proyecto | Evidencia local del SDK |
| --- | --- | --- |
| Gradle wrapper | 9.4.1 | Declarado en `android/gradle/wrapper/gradle-wrapper.properties`; no ejecutado. |
| AGP | 9.2.1 | Catálogo instalado; no se resolvió Gradle en esta auditoría. |
| compileSdk | 37 | `C:\Users\HP\AppData\Local\Android\Sdk\platforms\android-37` y su `android.jar` no existen. |
| targetSdk / minSdk | 36 / 24 | No reducirlos para ocultar fallos. |
| Build Tools | 37.0.0 | `build-tools\37.0.0\source.properties` presente; `apksigner.bat` presente. |
| NDK | 27.1.12297006 | `ndk\27.1.12297006\source.properties` presente. |
| CMake solicitado por el usuario | 3.31.6 | `cmake\3.31.6\source.properties` y `bin\cmake.exe` presentes. |

`android/local.properties` señala ese SDK y no contiene `cmake.dir`. La presencia de los archivos de herramientas no acredita una instalación íntegra ni una ejecución correcta.

**Selección correcta comprobada de CMake:** `ExpoRootProjectPlugin.kt`, dentro del plugin instalado de `expo-modules-autolinking`, lee `android.cmakeVersion` y aplica esa versión a los subproyectos Android de aplicación y librería. El proyecto raíz aplica `expo-root-project`. Por ello `-Pandroid.cmakeVersion=3.31.6` es un override respaldado por el código actual; no es una propiedad inventada. No basta asumir que `CMAKE_VERSION` selecciona todos los módulos.

AGP 9.2 documenta Gradle 9.4.1 y JDK mínimo 17. Verificar el Java usado realmente por Gradle; no cambiarlo ni instalarlo automáticamente. El wrapper coincide con ese requisito. [Compatibilidad oficial de AGP 9.2](https://developer.android.com/build/releases/agp-9-2-0-release-notes).

No hace falta reinstalar NDK o CMake por el hallazgo actual. Android admite seleccionar versiones específicas en la configuración de compilación. [NDK y CMake](https://developer.android.com/studio/projects/install-ndk).

### 4.3 Autolinking y nueva arquitectura

La configuración fuente incluye:

- `autolinkLibrariesWithApp()` en `android/app/build.gradle`.
- `expoAutolinking.useExpoModules()` y resolución React Native en `android/settings.gradle`.
- `expo.autolinking.nativeModulesDir="./modules"` en `package.json`.
- `newArchEnabled=true`, Hermes habilitado y envoltorios Expo en `MainApplication.kt`/`MainActivity.kt`.
- Nitro y QuickCrypto instalados; integración CMake/codegen declarada.
- Reloj `bo.eida.control.clock.EidaOfflineClockModule` registrado en su configuración de módulo local; nombre exportado `EidaOfflineClock`. Usa `SystemClock.elapsedRealtime()` y `Settings.Global.BOOT_COUNT`.

Hay salidas antiguas: `android/build/generated/autolinking/autolinking.json`, `PackageList.java`, `Android-autolinking.cmake` y `node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt`.

El JSON React Native menciona Gesture Handler, Reanimated, Worklets y Masked View, además de las dependencias directas. **Sus directorios existen:** que no aparezcan como dependencias directas no significa que falten; pueden ser transitivos. No corresponde borrarlos ni instalarlos de nuevo con esa evidencia.

La lista Expo existente incluye SecureStore pero no las entradas nominales requeridas de Camera, SQLite o `EidaOfflineClock`. No debe tomarse como una lista final del próximo binario. La resolución Expo se ejecuta desde la configuración de Gradle; el próximo build debe actualizar sus salidas. No editar esos archivos generados ni usarlos como prueba de éxito.

Criterio para cerrar el punto: resolución/proveedor nuevo con los módulos correspondientes, compilación del camino SQLCipher desde fuentes y apertura efectiva en la APK de Camera, SecureStore, QuickCrypto/Nitro, SQLite cifrado y reloj. Si siguen faltando, detener la validación y revisar la resolución de módulos; no invocar Prebuild o limpieza indiscriminada como primer remedio.

### 4.4 Permisos, backups y sistema Android

| Área | Comprobado | Pendiente |
| --- | --- | --- |
| Cámara | Plugin solicita CAMERA; el manifiesto de `expo-camera` también la declara. `NativeQrCamera` pide permiso y usa `CameraView` con escaneo exclusivamente QR. | El manifiesto debug generado anterior no acredita cámara incorporada. Inspeccionar el manifiesto release nuevo y probar conceder/denegar/revocar permisos. |
| Micrófono | `recordAudioAndroid:false`, `microphonePermission:false`, permiso RECORD_AUDIO bloqueado en Expo. No aparece en los manifiestos fuente de app/camera examinados; no se usa grabación de audio. | Confirmar ausencia en el manifiesto final, donde también influyen las demás librerías. |
| Biometría | El informe anterior `android/app/build/outputs/logs/manifest-merger-debug-report.txt` atribuye USE_BIOMETRIC y USE_FINGERPRINT a AndroidX Biometric 1.1.0. No es necesario declararlos manualmente para corregir una supuesta ausencia no demostrada. | Probar el prompt biométrico real, cancelación y cambio de huellas. |
| Backups | `allowBackup=false` tanto en Expo como en el manifiesto fuente Android. | No hay referencias fuente `fullBackupContent`/`dataExtractionRules`. El plugin SecureStore sí contiene reglas de exclusión, pero declararlo no las aplica al nativo ya creado. Revisar exclusión de SecureStore/base cifrada en backup y transferencia; no prometer restauración funcional de las claves. |
| Red | Validador móvil exige HTTPS y normaliza `/api/v1`. | No se leyó el valor de `.env` ni se probó el servidor. Release no hereda el `usesCleartextTraffic=true` de debug. |
| Pantalla | `edgeToEdgeEnabled=true`, SafeAreaProvider, SafeAreaView, StatusBar y navegación real. | Contraste de barras, insets, teclado y gestos en Android físico. |
| Atrás | Stacks, manejo de formularios y comportamiento nativo; `enableOnBackInvokedCallback=false` en el manifiesto. | Opt-out de callback predictivo: probar compatibilidad con gesto Atrás y tres botones; no afirmar soporte visual predictivo completo. |
| Teclado | `windowSoftInputMode=adjustResize`; ScreenFrame calcula solapamiento IME; Screen conserva el formulario montado y revela el campo enfocado. | IME real, fuentes grandes, rotaciones permitidas por el sistema, diálogos y selección de estudiantes. |

`SYSTEM_ALERT_WINDOW` y permisos de almacenamiento legado hasta API 32 siguen en el manifiesto fuente. Revisar si deben eliminarse en una futura configuración destinada a distribución; no se necesitan para explicar la protección de fotos en BLOB cifrado. No se modificaron.

## 5. Seguridad y comportamiento offline

### 5.1 Claves, fotografías y cuentas

Evidencia principal: `nativeVault.ts`, `repository.ts`, `download.ts`, `manifest.ts`, `OfflineProvider.tsx` y almacenamiento de sesión.

- Clave aleatoria de 32 bytes generada con QuickCrypto; almacenada mediante SecureStore con `requireAuthentication:true`. No se deriva de contraseña ni SIS/CI.
- El valor `WHEN_UNLOCKED_THIS_DEVICE_ONLY` se declara en las opciones, pero no debe interpretarse como prueba de una semántica iOS aplicada a Android. La protección Android depende de SecureStore/Keystore y la autenticación exigida.
- Base y clave separadas por hash de servidor, usuario, instalación y dispositivo. Se compara el binding con la credencial/grant antes de habilitar el runtime.
- Un marcador impide recrear silenciosamente la clave de una base existente si la clave protegida desaparece.
- Logout, revocación y cambio de cuenta cierran el runtime y retiran el grant activo; conservan base, claves y pendientes. La expiración local del token no borra automáticamente el grant offline acotado.
- El token de sesión usa SecureStore sin requisito biométrico; la clave del almacén offline sí lo exige. Son decisiones distintas.
- Pasar a segundo plano bloquea el almacén y limpia los datos expuestos por el provider. Falta probar que los diálogos biométricos y los callbacks de AppState no provoquen una cancelación repetida en dispositivos concretos.
- Fotografías `PRESENT`: ruta exacta, tamaño máximo de 5 MiB por descriptor, MIME permitido y SHA-256. Fotografías `ABSENT` legítimas no impiden publicar el paquete.
- Fotos persistidas como BLOB dentro de SQLCipher; presentación desde memoria. No se identificó un flujo de exportación a una carpeta pública para ese mecanismo.
- Se publica el paquete después de comprobar fotos y reautorizar contra el servidor. Una descarga interrumpida conserva el snapshot anterior y permite reusar el staging.
- Búsqueda real SQLite parametrizada, normalización de acentos/mayúsculas y `LIKE ? ESCAPE '!'`. Escapa `!`, `%` y `_`.

**Límites que deben quedar documentados antes del piloto:**

- Cambiar biometría, perder Keystore o desinstalar puede dejar pendientes cifrados inaccesibles. No hay que “repararlo” borrando la base o generando otra clave. Definir recuperación/retención institucional.
- Una revocación ocurrida en el servidor no puede conocerse de inmediato sin red. El acceso se limita por el paquete y al reconectar se reevalúa; no equivale a revocación instantánea offline.
- El cifrado del almacenamiento no impide por sí solo capturas de pantalla o visualización en aplicaciones recientes. Revisar la política institucional de pantalla; no se certificó una protección de capturas.
- Las opciones de backup no constituyen un procedimiento de recuperación de evidencia. Mantener una política separada.
- Ninguna prueba desktop demuestra la resistencia de Keystore, el cifrado real de archivos/WAL o el borrado de datos de memoria.

### 5.2 Reloj y persistencia

`clock.ts` calcula la hora anclada al servidor usando tiempo monotónico y boot count. Rechaza retroceso monotónico y cambio de boot. El módulo no requiere un permiso Android adicional en su manifiesto fuente.

Distinguir tres escenarios:

1. Cerrar y abrir el proceso durante el mismo arranque: el diseño permite recuperar el almacén mediante biometría y el grant vigente.
2. Reiniciar el teléfono: cambian los datos de arranque; el paquete necesita revalidación online antes de continuar el control. No es un fallo de persistencia ni implica borrar los pendientes.
3. Revalidar tras un reinicio: verificar que retoma el mismo paquete/snapshot y conserva los eventos originales.

La evidencia temporal del teléfono es declarada y no atestada por hardware. El backend publica `time_evidence=DEVICE_DECLARED_NOT_ATTESTED` y decide la aceptación oficial. No debe venderse como prueba criptográfica de la hora de captura.

### 5.3 Matriz funcional

| Función | Estado de código | Evidencia y límite |
| --- | --- | --- |
| Login y dispositivos | IMPLEMENTADO; REQUIERE ANDROID + backend compatible | Sesión Bearer, caducidad y dispositivo ligado. Backend verifica operador real, no un selector visual de rol. Esquema móvil no confirmado en despliegue. |
| HU35 listas exclusivas | IMPLEMENTADO | Preparación transaccional; miembros únicos por examen; lista por responsable; permisos por examen. Solo responsable prepara. V1 congela distribución: cambios no permiten reasignación automática. |
| HU36 descarga/fotos | IMPLEMENTADO; REQUIERE ANDROID | Snapshot/hash/binding/fotos/reatorización presentes. Bloqueado localmente si el binario no incluye SQLCipher o reloj. |
| Biometría y aislamiento | IMPLEMENTADO; REQUIERE ANDROID | SecureStore biométrico, scopes por cuenta/servidor/dispositivo. Probar cancelación, invalidación y cambio de usuario. |
| Reinicio de proceso | IMPLEMENTADO; REQUIERE ANDROID | Recuperación de staging y envíos interrumpidos. No demostrada en esta APK. |
| Reinicio de teléfono | IMPLEMENTADO con revalidación; REQUIERE ANDROID | Rechazo del ancla de otro boot; pendientes preservados. No promete continuar escaneando offline después de reiniciar. |
| HU37 | IMPLEMENTADO; backend/migración por confirmar; REQUIERE ANDROID | UUID estable, outbox, leases, recibos parciales, reconciliación y conflictos. No genera otro evento por timeout. |
| Evidencia tardía | IMPLEMENTADO; backend/migración por confirmar | Protocolo 2 conserva original cifrado, `review_required` y recibo; no convierte todo evento tardío en ingreso oficial. |
| Cámara QR | IMPLEMENTADO; REQUIERE ANDROID | Preview y permisos nativos; gate contra lecturas simultáneas; confirmar explícitamente antes de registrar. La verificación no es una autorización oficial del servidor. |
| Verificador QR v3 | IMPLEMENTADO; prueba Android histórica comunicada | RSA/RS256 mediante QuickCrypto y vectores públicos. Revalidar en la APK nueva, sin modificar el verificador. |
| QR de estudiantes reales offline | BLOQUEADO POR BACKEND actual | Emisor v2; paquete debe anunciar material v3 auténtico. No aceptar HS256 offline ni distribuir APP_KEY. |
| Incidencias locales | IMPLEMENTADO; REQUIERE ANDROID | Original/UUID persistentes y estados de envío, sin decisión disciplinaria automática. |
| Envío/consulta de incidencias | BLOQUEADO POR BACKEND | Mapa central no permite las rutas. La migración por sí sola no lo resuelve. |
| Infracciones, expulsión y anulación | BLOQUEADO POR BACKEND para token móvil | Gestión online del docente responsable; jamás conceder por un rol global o una copia offline. |
| Estados de autorización | IMPLEMENTADO; REQUIERE ANDROID e integración | Sesión online, grant offline, caducidad, revocación, vinculación de cuenta y estado del paquete se evalúan por separado. |
| Duplicados/conflictos | IMPLEMENTADO; pruebas escritas | Backend vuelve a comprobar membresía, elegibilidad, estado y unicidad; móvil conserva recibos y evidencia. Falta resultado nuevo de concurrencia y prueba nativa. |

No se marca ninguna fila como PROBADO AUTOMÁTICAMENTE en el árbol actual sin adjuntar un resultado de ejecución de esa versión. Los archivos de prueba existentes se enumeran abajo.

## 6. Backend: contratos necesarios

Raíz de API: `routes/api.php` agrega `v1` y carga `routes/api/v1.php`; las rutas públicas resultan `/api/v1/...`. El validador móvil agrega `/api/v1` cuando corresponde; no se inspeccionó ningún secreto de conexión.

### 6.1 Endpoints que deben estar disponibles

| Área | Método y ruta relativa a `/api/v1` | Requisitos |
| --- | --- | --- |
| Login | `POST auth/mobile/login` | Dispositivo/instalación, credenciales, política MobileOperatorAccess y esquema móvil. No usar el login web como reemplazo. |
| Sesión | `GET me`, `POST auth/logout` | Token móvil vigente. |
| Dispositivos | `GET auth/devices`, `DELETE auth/devices/{id}` | Solo dispositivos autorizados de la cuenta. |
| Exámenes | `GET teacher/exams`, `GET teacher/exams/{exam}`, `GET me/collaborations` | La relación contextual decide lo que se puede ver. |
| Contexto HU35 | `GET exams/{exam_id}/offline/mobile-context` y `.../assignments` | Responsable/colaboración vigente; contexto sin descargar otras listas. |
| Preparación | `POST exams/{exam_id}/offline/prepare` | Docente responsable y distribución válida/congelada. |
| Paquete | `GET exams/{exam_id}/offline/package` | Token/dispositivo ligados, lista propia y snapshot móvil. |
| Reanudación | `GET exams/{exam_id}/offline/packages/{package_id}` | Reautoriza cuenta, dispositivo, lista, versión y estado. |
| Fotografías | `GET exams/{exam_id}/offline/packages/{package_id}/photos/{student_id}/{kind}` | `kind=profile|historical`; pertenencia a la lista; respuesta binaria privada sin caché. |
| Capacidades HU37 | `GET exams/{exam_id}/offline/sync-capabilities` | Debe admitir protocolo 2 y evidencia tardía; publica versiones QR verificables. |
| Envío HU37 | `POST exams/{exam_id}/offline/sync` | Contrato de protocolo 2, UUID y evidencia; recibos por evento. |
| Contexto disciplinario | `GET exams/{exam_id}/discipline-context` | Ruta presente; pendiente habilitar mapa móvil. |
| Incidencias móviles | `POST exams/{exam_id}/offline/incidents` | Ruta presente; migración propia y ability pendiente. |
| Consulta incidencias | `GET exams/{exam_id}/incidents` y `.../{incident_id}` | Rutas presentes; ability pendiente y acceso contextual HU27. |

El contrato HU37 de `OfflineSyncService::capabilities` devuelve `protocol_versions=[1,2]`, máximo 100 eventos, `late_evidence=true` y `late_policy=REVIEW_ONLY` cuando el esquema de evidencia existe. Sin sus columnas devuelve `SYNC_MIGRATION_REQUIRED`/503. QR v3 se anuncia para sincronización únicamente si el verificador del servidor está configurado.

La descarga de fotos y la reanudación reautorizan cada solicitud; no basta que el móvil conserve un ID de paquete. El downloader móvil aplica pausas para respetar el throttle existente de 60/min; comprobar listas grandes y reintentos en integración.

### 6.2 Migraciones: necesarias, no “pendientes” demostradas

No se consultó ninguna base; el estado aplicado/pendiente es DESCONOCIDO para todas.

| Migración | Dependencias y efecto | Riesgo / precaución |
| --- | --- | --- |
| `2026_11_01_000001_create_exam_offline_tables.php` | Exámenes, usuarios y estudiantes previos. Crea distribuciones/listas/miembros/paquetes/eventos; snapshots y resultados jsonb. Base HU35–37. | Unicidad examen-estudiante/lista-responsable, FKs restrictivas. Su rollback elimina evidencia y snapshots; no usar como limpieza. |
| `2026_11_06_000001_create_mobile_devices.php` | `users` y `personal_access_tokens` de Sanctum existentes. Crea dispositivos y FK nullable en tokens; única cuenta+instalación. | Necesaria para login/token móvil. Revisar integridad de tokens previos y planificación de DDL. No presupone ampliar abilities. |
| `2026_11_08_000001_add_offline_sync_evidence.php` | `exam_offline_sync_events` de la migración base. Agrega original cifrado, versión de evidencia y `review_required` indexado. | Preservar APP_KEY y política de rotación del backend para poder descifrar evidencia. El down se niega si existe evidencia cifrada. |
| `2026_11_09_000001_create_mobile_incident_sync_events.php` | `exams`, `users`, `exam_offline_packages`. UUID PK, hash de solicitud, original cifrado, recibo jsonb y fecha. | No crea los modelos/tablas oficiales HU27/HU30/HU31. El down se niega si hay eventos; requiere decisión de retención. |

Las rutas también necesitan el esquema previo de colaboraciones, matrículas, elegibilidad, ingresos, auditoría, incidencias, infracciones y expulsiones. Revisar el historial completo y el estado de esos módulos con Equipo 1; no aplicar aisladamente solo la última migración.

Las migraciones de elegibilidad posteriores al esquema base y `2026_11_01_000001_add_observations_to_infractions_table.php` forman parte del backend actual; su necesidad de despliegue depende de la versión de origen. No se puede deducir una lista exacta de migraciones pendientes sin consultar el entorno correspondiente.

**Orden de despliegue propuesto:** comprobar esquema previo → base offline → dispositivos → evidencia HU37 → evidencia de incidencias; respetar además el orden completo del repositorio y sus dependencias. Preparar respaldo, retención y ventana de DDL con el equipo. No se propone rollback automático, `migrate:fresh` o ejecución ciega en producción.

### 6.3 Causa exacta del 403 y propuesta mínima para Equipo 1

`bootstrap/app.php` antepone `EnforceMobileTokenAccess` a la API. El middleware:

1. Identifica tokens móviles por dispositivo o prefijo `eida-control:`.
2. Comprueba token Sanctum real, expiración explícita, cuenta activa y dispositivo propio no revocado.
3. Busca `método + plantilla de ruta` en `MobileTokenPermissions::requiredAbility`.
4. Si no existe mapa **o** el token carece de la ability, responde `403 MOBILE_ABILITY_REQUIRED`.

Las seis abilities emitidas actualmente por `MobileAuthService` son:

`mobile:session`, `mobile:devices`, `control:read`, `offline:prepare`, `offline:download` y `offline:sync`.

Cubren sesión/dispositivos/exámenes/paquetes/HU37. **No cubren incidencias ni disciplina.** Conceder `*` no arregla una ruta sin mapa, porque la política cierra explícitamente las rutas no listadas.

`app/Services/Auth/MobileDisciplinePermissions.php` ya contiene una propuesta separada, con el comentario de que NO está conectada a la política central. Propuesta para revisión:

| Ability propuesta | Rutas exactas, con prefijo `api/v1/` | Condición contextual que debe conservarse |
| --- | --- | --- |
| `incidents:read` | GET `exams/{exam_id}/discipline-context`; GET `exams/{exam_id}/incidents`; GET `exams/{exam_id}/incidents/{incident_id}` | Acceso real a incidencias del examen; no convierte lectura en permiso de sanción. |
| `incidents:report` | POST `exams/{exam_id}/offline/incidents` | Actor/dispositivo/paquete propios y permiso de reportar vigente. Un reporte no es una infracción o expulsión. |
| `discipline:manage` | GET `exams/{exam_id}/infractions`, `.../infractions/options`, `.../infractions/students`, `.../infractions/{infraction_id}`; POST `.../infractions`; PATCH `.../infractions/{infraction_id}/status` | Docente responsable real del examen; validaciones HU30 intactas. |
| `discipline:manage` | GET `exams/{exam_id}/expulsions`, `.../expulsions/students`, `.../expulsions/eligible-infractions`; POST `.../expulsions` | Responsable contextual; reglas HU31 intactas. |
| `discipline:manage` | GET `exams/{exam_id}/entry-control/entries`; POST `.../entry-control/entries/{entry_id}/annulment` | Permiso de anulación evaluado en el servidor y motivo obligatorio. |

Esta lista permite revisar cada operación; no implica que la app necesite inmediatamente cada opción de consulta incluida en la clase propuesta. Para un despliegue mínimo se puede empezar por contexto/lectura/reporte y habilitar gestión solo con la validación correspondiente.

Acciones pendientes del equipo: revisar plantillas reales, conectar mapa exacto, ampliar la emisión de tokens de forma explícita y mantener todos los controles contextuales. El cliente debe volver a iniciar sesión para obtener un token con las abilities nuevas; las migraciones o el cambio de mapa no amplían por sí solos los tokens ya emitidos.

`MobileIncidentController::context` utiliza `InfractionAccess` para calcular gestión, y ese servicio exige cuenta activa, rol DOCENTE y relación real con el docente de la oferta del examen. Un colaborador contextual puede reportar incidencias; no debe poder infraccionar, expulsar o anular por recibir una ability de transporte.

**No se modificó ninguna política, ability, ruta ni controlador.**

### 6.4 QR: tres condiciones distintas

1. **Emisión:** `app/Services/Students/StudentQrService.php::generateStandardJwt` construye `alg=HS256` y `v=2`. Es el flujo local inspeccionado para estudiantes.
2. **Material público del paquete:** `MobileOfflinePackageService::publicQrMaterial` exige `mobile_offline.qr_v3_issued` y `qr_v3.enabled`, un PEM público RSA válido, kid, issuer y audience. De lo contrario anuncia `PRODUCTION_QR_V3_NOT_CONFIRMED`. `revoked_jtis=null` significa desconocido, no ausencia de revocaciones.
3. **Verificación al sincronizar:** `OfflineQrEvidence` usa `offline_sync.qr_v3_verify_enabled` y un verificador configurado. No activa emisión.

Los flags provienen de `MOBILE_OFFLINE_QR_V3_ISSUED`, `EIDA_QR_V3_ENABLED` y `EIDA_OFFLINE_SYNC_QR_V3_VERIFY`. Se leyeron sus nombres y defaults en archivos de configuración, no sus valores secretos/desplegados.

Activarlos sin que el emisor genere realmente v3 produciría una declaración falsa de disponibilidad. Equipo 1 debe definir emisión, compatibilidad online, gestión de kid/rotación/revocación y despliegue coordinado. No distribuir APP_KEY ni una clave privada al móvil; solo material público de verificación.

Se pueden probar HU35, descarga cifrada, consulta manual, ingresos provisionales manuales, recuperación, HU37 e incidencias sintéticas sin activar QR v3 de estudiantes reales. Los vectores de prueba validan el verificador, no una autorización de ingreso de una persona real.

### 6.5 Cómo comprobar el backend desplegado sin inventar su estado

El operador del entorno de integración debe aportar:

- Identificador verificable de la versión desplegada y hashes de las clases/rutas/configuración relevantes, comparados con la copia auditada.
- Estado de migraciones, esquema y restricciones; no solamente presencia de archivos PHP.
- Rutas cargadas y middleware reales, incluyendo posibles cachés de configuración/rutas.
- Respuestas reales con cuentas sintéticas para login, mobile-context, paquete, foto y sync-capabilities.
- Abilities del token obtenidas por login nuevo; pruebas negativas de rutas no mapeadas y de otro examen/dispositivo.
- Capacidad QR anunciada y muestra sintética de la versión que emite el servicio, sin divulgar secretos.
- Evidencia de 401/403/503 diferenciada de 404 o fallo de red.

No existe en lo inspeccionado una prueba automática de que la producción ejecuta esta versión. Un 200 en health tampoco lo acredita. La auditoría no hizo solicitudes a producción.

## 7. Git y reproducibilidad nativa

Se inspeccionó `.gitignore` y se leyó el archivo binario del índice local, sin invocar Git ni cambiarlo.

Resultado: índice DIRC versión 2, 199 entradas, **0 entradas bajo `android/`**, 5 bajo `modules/eida-offline-clock/` y 0 entradas no fusionadas. Esto describe el índice local; no demuestra HEAD, historial, remoto ni estado de GitHub. No se inspeccionó el repositorio web pese a la pestaña MERGE_MSG.

Reglas existentes relevantes:

- Excluyen `node_modules/`, `.expo/`, `.tools/`, `.artifacts/`, `/android/`, `/ios/`.
- Excluyen builds y `.gradle` del reloj local, pero sus fuentes/configuración sí figuran en el índice.
- Excluyen bases SQLite/DB y sus auxiliares, `.env`/`.env.*` salvo `.env.example`, keystores, JKS, PEM, KEY, logs y tsbuildinfo.
- No hay reglas generales `*.apk`/`*.aab`: actualmente un artefacto en Android o .artifacts queda cubierto por su carpeta; uno copiado a otro sitio del proyecto podría no quedar cubierto.

**Decisión pendiente:** mantener nativo versionado o hacerlo reproducible con plugins/configuración propios. No quitar `/android/` de ignore de forma global sin revisar antes builds, SDK local, firmas y cachés. El índice actual no conserva Gradle, MainActivity/MainApplication, manifiestos ni las futuras propiedades SQLCipher/CMake.

Archivos nativos a conservar o poder regenerar: wrapper/configuración Gradle, manifest/recursos y actividades fuente, configuración de autolinking/nueva arquitectura, selección SQLCipher/CMake y módulo local del reloj. `android/local.properties`, keystore privado, `build/`, `.gradle/`, `.cxx/` y salidas generadas deben permanecer fuera de una eventual inclusión de fuentes nativas.

Recomendaciones de reglas para revisión futura, sin aplicarlas: `*.apk`, `*.aab`, y, si se adopta Android versionado, exclusiones explícitas de `android/local.properties`, `android/.gradle/`, `android/.cxx/`, `android/**/.cxx/` y `android/**/build/`.

Los vectores QR JSON con claves públicas y datos sintéticos son material de prueba versionable. Una clave pública no es una clave privada; revisar contenido/origen y no ignorar todos los vectores por contener “key”. Jamás incluir credenciales reales, APP_KEY, claves privadas, tokens, paquetes reales, fotos o evidencia personal.

## 8. Inventario de pruebas y aislamiento

### 8.1 Móvil

Se identificaron 16 archivos `tests/*.test.ts`:

| Área | Archivos |
| --- | --- |
| QR / transporte / sesión | `qr-v3.test.ts`, `http.test.ts`, `session.test.ts` |
| Exámenes / manifiesto / SQLite | `exams.test.ts`, `manifest.test.ts`, `offline.test.ts` |
| HU37 / cámara / incidencias | `sync.test.ts`, `scanner.test.ts`, `incidents.test.ts` |
| Sistema visual y navegación | `design-system.test.ts`, `navigation.test.ts`, `main-tabs.test.ts`, `general-screens.test.ts`, `control-screens.test.ts`, `operations.test.ts`, `visual-closure.test.ts` |

`scripts/run-tests.mjs` descubre archivos concretos recursivamente, no depende de comodines del shell, no sigue enlaces y falla si no encuentra pruebas. Usa el tsx local sin instalarlo.

`tests/support/offlineFixtures.ts` ejecuta SQL real de Node `node:sqlite` en `:memory:`; no sustituye la búsqueda real. Simula exclusivamente la disponibilidad de `PRAGMA cipher_version` para pruebas lógicas. Esas pruebas no acreditan cifrado Android, biometría ni autolinking.

Las pruebas visuales/navegación revisan reglas, helpers y assets, sin sustituir una ejecución de React Native ni una prueba de TalkBack o teclado.

### 8.2 Backend

| Suite existente | Cobertura estática identificada | Base / precaución |
| --- | --- | --- |
| `tests/Feature/Mobile/MobileAuthenticationTest.php` y `Legacy*CompatibilityTest.php` / `LegacyPasswordContinuityTest.php` | Login/dispositivos/abilities y regresión web de sesión, contraseña y logout. | `phpunit.mobile.xml` usa guard previo al bootstrap, SQLite :memory:, sin DB_URL y sin configuración cacheada. |
| `tests/Unit/QrV3/QrV3Test.php` | Firma/verificación, formato y casos negativos QR. | Claves/vectores sintéticos de pruebas; no leer ni usar claves productivas. |
| `tests/Feature/Offline/OfflineBackendTest.php`, `MobileOfflinePackageTest.php`, `OfflineSyncEvidenceTest.php`, `OnlineQrCompatibilityTest.php` | Listas, paquetes, fotos, evidencia/protocolo y compatibilidad QR online. | `phpunit.offline.xml` fuerza SQLite :memory:; comprobar que no hay configuración cacheada. |
| `OfflinePostgresConcurrencyTest.php` | Carreras, replay y entrada online/offline concurrente. | PostgreSQL nuevo y vacío `hu35_37_test_<12 hex>`; opt-in `EIDA_OFFLINE_PG_CONCURRENCY=1`, APP_ENV testing, sin config cacheada ni URL de conexión alternativa. Ejecuta migraciones dentro de la prueba. |
| `OfflineSyncEvidencePostgresTest.php` | Doble envío de evidencia viva/tardía, recibo inmutable y reutilización UUID con contenido distinto. | Mismo guard anterior; usar otra base recién creada. No reutilizar la ya poblada por la otra clase. |
| `tests/Feature/Incidents/MobileIncidentSyncTest.php` | Reportes móviles, hash/UUID, originales cifrados, colaborador, tardíos, revocación, validación y rollback de auditoría. | Trait de base aislada. Los casos positivos inyectan el mapa propuesto en el contenedor de pruebas; el negativo comprueba el bloqueo real actual. |
| `IncidentReportTest.php`, `IncidentRegistrationTest.php`, `IncidentReadTest.php`, `IncidentInputTest.php`, `IncidentFrontendContractTest.php`, `IncidentFlowTest.php`, `IncidentAutomaticQrTest.php`, `ExamIncidentReportContractTest.php` | HU27 y contratos de lectura/reporte/registro. | Algunos usan RefreshDatabase: ejecución solo con DB de pruebas verificada. No recomendar lanzar toda la suite con la configuración personal actual. |
| `tests/Feature/Incidents/IncidentConcurrencyTest.php` | Carreras HU27, entre ellas lecturas de un evento QR. | **Destructiva para su base:** llama `migrate:fresh`. Exige PG y nombre `hu27_test_<12 hex>` con `HU27_PG_CONCURRENCY=1`. No sustituye concurrencia del nuevo transporte móvil. |

`phpunit.xml` general no ofrece la misma protección temprana y valores forzados del archivo mobile; variables externas o configuración cacheada pueden cambiar el destino. No usar `php artisan test` general como primer paso de esta auditoría.

Para ejecutar `MobileIncidentSyncTest` sin alterar suites, puede seleccionarse explícitamente con `phpunit.mobile.xml`; el bootstrap y el trait exigen SQLite :memory:. El nombre de la suite en ese XML no impide seleccionar otro archivo aislado por CLI.

La suite PG offline rechaza configuración insegura antes de consultar tablas; la suite antigua HU27 abre la conexión para comprobar el driver/nombre y luego usa `migrate:fresh`. Sus guards no equivalen a autorización para usar una base existente.

**Pendientes de validación:** resultados de estas suites en la versión actual, ejecución PG separada, casos concurrentes del transporte móvil nuevo y plan Android del apartado 10. No se adjuntan resultados inventados ni número de tests “aprobados”.

## 9. Procedimiento manual para una APK independiente

Todos los bloques siguientes son instrucciones para el usuario. **No fueron ejecutados.** Revisar cada etapa y detenerse ante el primer error. No ejecutar todo como un script único.

### 9.1 Variante y configuración elegidas

Recomendación: **`release` de laboratorio**, inicialmente sin R8 para reducir variables durante validación nativa; conserva Hermes y nueva arquitectura.

En el proyecto actual, `react.bundleCommand="export:embed"` usa Expo para generar el bundle durante Gradle. `debuggableVariants` no se redefine: debug omite el bundle; release lo incorpora. La presencia de expo-dev-client no vuelve independiente un debug. [Comportamiento de variantes y bundling en React Native](https://reactnative.dev/docs/react-native-gradle-plugin).

`assembleRelease` ejecuta bundling durante la compilación; no requiere mantener Metro levantado para ejecutar la APK terminada. `npm run export:android` por sí solo genera una exportación JS, no una APK ni incorpora módulos nativos a una APK ya instalada.

El script `scripts/build-android.mjs` admite release y copia el APK a `.artifacts/apk/`, pero no pasa las dos propiedades SQLCipher/CMake necesarias. Su default es debug. **No recomendar su invocación actual como procedimiento suficiente.** Usar Gradle directamente con flags explícitos.

No hace falta Prebuild para pasar estas propiedades o autolinkear los módulos ya configurados. Prebuild puede reescribir manifiestos/recursos/Gradle y perder ajustes manuales de CMake o firma, especialmente con `--clean`. Resolver primero la política de conservación nativa.

### 9.2 Verificación local manual

Desde PowerShell:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
node --version
npm run check:android
npm run typecheck
npm test
```

Usar Node compatible según el apartado 3. `check:android` solo inventaría herramientas; no acredita la versión efectiva de SQLCipher ni sustituye la compilación. El usuario debe conservar la salida y asociarla al árbol actual.

No se necesita `npm install`, `expo install` ni regenerar el lockfile para los problemas encontrados.

### 9.3 Plataforma faltante: intervención separada del usuario

El SDK configurado es:

```powershell
$eidaSdk = 'C:\Users\HP\AppData\Local\Android\Sdk'
& "$eidaSdk\cmdline-tools\latest\bin\sdkmanager.bat" "--sdk_root=$eidaSdk" --list
```

Solo si el catálogo ofrece `platforms;android-37` y el usuario decide instalarla:

```powershell
& "$eidaSdk\cmdline-tools\latest\bin\sdkmanager.bat" "--sdk_root=$eidaSdk" 'platforms;android-37'
```

Esta es una descarga manual propuesta, no realizada. Si no está disponible o exige una versión preliminar no acordada, detenerse y revisar el catálogo del proyecto con el equipo. No instalar todo el SDK, cambiar NDK/CMake ni aceptar automáticamente licencias.

La herramienta `sdkmanager.bat` ya existe en esa ruta. Se utiliza su sintaxis disponible para paquetes específicos; no es necesario cambiar de herramienta para esta intervención. [Referencia oficial de SDK Manager](https://developer.android.com/tools/sdkmanager).

### 9.4 Compilación con SQLCipher y CMake 3.31.6 explícitos

Requisitos previos: pruebas revisadas por el usuario, plataforma 37 disponible, Java compatible y SDK configurados, y API HTTPS de integración verificada por el propio usuario. El valor `EXPO_PUBLIC_EIDA_API_BASE_URL` queda incorporado al bundle durante compilación; no contiene secretos y debe apuntar al entorno correcto. Cambiarlo después en el archivo local no cambia una APK ya generada.

Para un teléfono **arm64-v8a** confirmado por el usuario:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
$eidaSdk = 'C:\Users\HP\AppData\Local\Android\Sdk'
if (-not (Test-Path -LiteralPath "$eidaSdk\platforms\android-37\android.jar")) {
    throw 'Falta Android API 37. No iniciar la compilación.'
}
if (-not (Test-Path -LiteralPath "$eidaSdk\cmake\3.31.6\bin\cmake.exe")) {
    throw 'Falta CMake 3.31.6. No seleccionar otra versión automáticamente.'
}
if (-not (Test-Path -LiteralPath "$eidaSdk\ndk\27.1.12297006\source.properties")) {
    throw 'Falta el NDK configurado. Revisar antes de compilar.'
}
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath "$env:JAVA_HOME\bin\java.exe")) {
    throw 'JAVA_HOME debe señalar un JDK compatible ya preparado.'
}
& "$env:JAVA_HOME\bin\java.exe" -version
$eidaGradleArgs = @(
    ':app:assembleRelease'
    '-Pexpo.sqlite.useSQLCipher=true'
    '-Pandroid.cmakeVersion=3.31.6'
    '-PreactNativeArchitectures=arm64-v8a'
    '-Pandroid.enableMinifyInReleaseBuilds=false'
    '-Pandroid.builder.sdkDownload=false'
    '-Dorg.gradle.parallel=false'
    '--max-workers=2'
    '--no-daemon'
    '--console=plain'
)
Push-Location -LiteralPath '.\android'
try {
    & .\gradlew.bat @eidaGradleArgs
    if ($LASTEXITCODE -ne 0) { throw 'La compilación falló. No usar artefactos anteriores como resultado.' }
} finally {
    Pop-Location
}
```

Los únicos overrides de compilación cambian esta invocación; no persisten las propiedades nativas. Documentar ambos flags para futuros builds, o incorporarlos en una posterior corrección de configuración autorizada.

No usar ese ABI para un teléfono que no lo soporte. Para emulador x86_64, hacer un build separado con `-PreactNativeArchitectures=x86_64`. No se creó ni ejecutó un emulador.

`android.builder.sdkDownload=false` evita el mecanismo de descarga automática del SDK usado por AGP; no promete una compilación sin red: Gradle/npm-resolved artifacts, Maven y otras tareas todavía pueden descargar dependencias de compilación. No se ejecuta limpieza de cachés.

Revisar en la salida la selección de CMake 3.31.6, proyecto SQLite desde fuentes y SQLCipher. Si falla OpenSSL/Maven, codegen o autolinking, conservar el error y revisar su causa; no deshabilitar SQLCipher, reloj o nueva arquitectura para conseguir una APK aparente.

Artefacto esperado al finalizar correctamente:

`C:\proyecto\eida-mobile\android\app\build\outputs\apk\release\app-release.apk`

Este comando directo no crea la copia que hace el script `build-android.mjs`. R8 queda desactivado solo en esta compilación de laboratorio; repetir luego la validación con la configuración de optimización prevista antes de entregar.

### 9.5 Firma privada de laboratorio

El release actual sale firmado con `android/app/debug.keystore`, alias/contraseña estándar de desarrollo. Eso permite pruebas sintéticas locales, pero no es la identidad privada recomendada para un piloto.

Dos opciones futuras: configurar una firma privada en Gradle, o firmar una salida separada con `apksigner` sin editar Android. Para esta segunda opción, el usuario puede preparar **una vez** una clave de laboratorio y conservarla. Los siguientes comandos no fueron ejecutados:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
New-Item -ItemType Directory -Path '.\.artifacts\signing' -Force | Out-Null
New-Item -ItemType Directory -Path '.\.artifacts\apk' -Force | Out-Null
$eidaLabKey = Join-Path (Get-Location) '.artifacts\signing\eida-control-lab.jks'
if (-not (Test-Path -LiteralPath $eidaLabKey)) {
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -storetype JKS -keystore $eidaLabKey -alias eida-control-lab -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=EIDA Control Laboratorio'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la clave privada de laboratorio.' }
}
$eidaApk = Join-Path (Get-Location) 'android\app\build\outputs\apk\release\app-release.apk'
$eidaSignedApk = Join-Path (Get-Location) '.artifacts\apk\eida-control-phase9-arm64-private.apk'
if (-not (Test-Path -LiteralPath $eidaApk)) { throw 'No existe el APK recién compilado.' }
if (Test-Path -LiteralPath $eidaSignedApk) { throw 'Ya existe la salida privada. Elige otro nombre para conservarla.' }
$eidaSdk = 'C:\Users\HP\AppData\Local\Android\Sdk'
& "$eidaSdk\build-tools\37.0.0\apksigner.bat" sign --ks $eidaLabKey --ks-key-alias eida-control-lab --out $eidaSignedApk $eidaApk
if ($LASTEXITCODE -ne 0) { throw 'La firma privada falló.' }
& "$eidaSdk\build-tools\37.0.0\apksigner.bat" verify --verbose --print-certs $eidaSignedApk
if ($LASTEXITCODE -ne 0) { throw 'La verificación de firma falló.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $eidaSignedApk
```

Las contraseñas se introducen en el prompt de las herramientas; no escribirlas en comandos, documentación o archivos de código. Respaldar el keystore de forma privada fuera del repositorio y mantener su alias/contraseña para las actualizaciones.

`apksigner` permite una salida separada; el flujo normal sustituye la firma anterior salvo que se pida conservar otros firmantes. Comprobar que la salida muestra el certificado privado esperado y no el debug. No usar `--append-signature` para este propósito. No alterar el APK después de firmarlo. [Documentación de firma](https://developer.android.com/tools/apksigner), [implementación oficial de ApkSignerTool](https://android.googlesource.com/platform/tools/apksig/+/refs/heads/main/src/apksigner/java/com/android/apksigner/ApkSignerTool.java).

Si ya hay una app con `bo.eida.control.dev` firmada con otra clave, Android puede rechazar la actualización. No desinstalarla ni borrar datos para resolverlo mientras haya pendientes. Empezar el laboratorio con la firma elegida antes de introducir datos o usar un dispositivo de pruebas separado.

No se requiere firma definitiva de Play Store. Sí una identidad estable y controlada para evitar perder la continuidad de las actualizaciones.

### 9.6 Inspección de la APK y prueba sin Metro

Después de generar el artefacto que realmente se instalará:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
$eidaSdk = 'C:\Users\HP\AppData\Local\Android\Sdk'
$eidaApkToInspect = Join-Path (Get-Location) '.artifacts\apk\eida-control-phase9-arm64-private.apk'
& "$eidaSdk\cmdline-tools\latest\bin\apkanalyzer.bat" manifest print $eidaApkToInspect
& "$eidaSdk\cmdline-tools\latest\bin\apkanalyzer.bat" files list $eidaApkToInspect
```

Revisar: `debuggable` falso, CAMERA y biometría presentes, RECORD_AUDIO ausente, `allowBackup=false`, reglas de extracción, configuración de red y ABI correcto. Buscar `assets/index.android.bundle`, assets locales y librerías nativas. Con Hermes, el archivo del bundle puede contener bytecode; su existencia no exige texto JavaScript legible. Confirmar módulos en DEX/proveedores cuando haga falta; el nombre de un .so aislado no prueba todas sus capacidades. [APK Analyzer oficial](https://developer.android.com/tools/apkanalyzer).

Instalación manual por el usuario, transfiriendo el archivo y abriéndolo en Android, sin necesitar ADB para el procedimiento. Cerrar manualmente Metro y desconectar el cable del ordenador; abrir la app desde su icono. No iniciar `expo start` para demostrar independencia.

Con red: login sintético, biometría y paquete de prueba. Luego modo avión, cerrar por completo la app desde Android y abrir desde el icono: debe renderizar y recuperar el paquete según el grant vigente, sin URL de desarrollo ni pantalla que espere Metro. La pantalla de login puede exigir red; eso no significa dependencia de Metro.

Hacer por separado la prueba de reinicio físico: debe conservar datos y pendientes, pero exigir revalidar el ancla del reloj para continuar el control. No confundir ambos escenarios.

## 10. Plan de pruebas Android e integración

Usar cuentas, exámenes, estudiantes y fotos sintéticos de un entorno autorizado. Registrar modelo, Android/API, ABI, biometría, hash APK, certificado, hora del servidor, versión backend y resultados. No registrar tokens, claves ni fotos personales en informes.

| Caso | Acción manual | Resultado esperado |
| --- | --- | --- |
| APK autónoma | Iniciar sin cable ni Metro; repetir en modo avión tras preparación. | UI local disponible; sin launcher que obligue a abrir servidor de desarrollo. |
| SQLCipher | Desbloquear y preparar lista en el binario nuevo. | Guard obtiene versión real de cipher, crea esquema y opera. Una build sin cifrado debe bloquear persistencia, nunca caer a SQLite plano. |
| Cifrado de archivos | Inspección controlada de una base exclusivamente sintética, si el dispositivo permite extraerla sin rootear/modificar el entorno. | No abrirla como SQLite sin clave; verificar apertura con la clave solo en procedimiento seguro. Si no puede inspeccionarse, registrar prueba pendiente, no desactivar seguridad. |
| Biometría | Conceder, cancelar, denegar y volver a intentar; poner app en segundo plano durante el prompt. | Sin acceso tras cancelación; sin bucle de bloqueo por AppState; datos no aparecen antes de desbloquear. |
| Cambio de huellas | En dispositivo sintético sin pendientes reales, cambiar inscripción biométrica. | Fallo controlado si invalida clave; no sustituir clave ni borrar base automáticamente. |
| Cuenta/servidor | Logout, login con otra cuenta, intento de abrir paquete ajeno. | Aislamiento completo; pendientes originales preservados. Un usuario no hereda la lista de otro. |
| HU35 | Preparar con responsable, consultar con colaborador; intentar otra lista; cambiar entrada relevante. | Distribución exclusiva y congelada, acceso contextual; stale/conflicto explícito, sin redistribución silenciosa. |
| Fotos | PRESENT válida, ABSENT legítima, bytes/hash/tamaño incorrectos y corte de red. | Solo publica paquete íntegro; ausencia legítima permitida; staging reanudable y snapshot anterior preservado. |
| Consulta | Buscar acentos, apellido, SIS, CI y literales `%`/`_`/`!`. | Coincidencias correctas; comodines no amplían accidentalmente resultados. |
| Registro manual | Confirmar ingreso provisional, repetir, cancelar confirmación. | Evento único en confirmación; cancelar no registra. No presentar provisional como asistencia oficial. |
| Persistencia | Cerrar/forzar detención y reabrir durante el mismo boot. | Misma base y eventos; envíos interrumpidos recuperables; nueva biometría según diseño. |
| Reloj | Alterar hora de pared; después reiniciar teléfono. | Mantiene referencia monotónica dentro del boot; tras reinicio exige revalidación, conservando evidencia. |
| HU37 | Cortar red tras recepción servidor, reenviar y devolver respuesta parcial. | Mismo UUID/payload, recibo estable, ningún ingreso duplicado; pendientes no contestados conservados. |
| Conflictos | Otro control registra primero, cambia elegibilidad, termina examen o se revoca colaboración. | Servidor decide duplicate/conflict/review; evidencia no desaparece y no se transforma en aceptación automática. |
| Cuenta/dispositivo revocado | Revocar en integración y reconectar. | 401/403 controlado; no cambiar de usuario ni borrar pendientes para reintentar. |
| QR sintético | Ejecutar diagnóstico con vectores y probar cámara con QR sintético autorizado. | Verificación RS256 y rechazo de formato/firma/issuer/audience/kid/tiempos incorrectos; el vector no concede ingreso real. |
| QR cámara | Denegar permiso, conceder desde ajustes, escanear repetidamente, ir a fondo y volver. | Sin audio, sin registros por callbacks repetidos; preview detenido fuera del flujo; sin datos no verificados como identidad. |
| QR v2 | Mostrar un QR v2 del emisor actual en laboratorio. | Rechazo/incompatibilidad offline explícita, sin fallback HS256 con secreto móvil. |
| Incidencias | Crear reporte offline, cerrar, reabrir, enviar dos veces y alterar UUID/payload en prueba de API. | Evidencia original, recibo idempotente y conflicto de contenido distinto; requiere mapa/migración backend antes del caso positivo. |
| Disciplina | Colaborador intenta sancionar; responsable hace acción online con motivo. | Colaborador denegado aunque tenga ability; responsable sujeto a reglas y revisiones. Borrador offline no sanciona. |
| Navegación/IME | Gesto Atrás, tres botones, teclado abierto, diálogos, formularios con cambios y entradas desde pestañas. | Sin salir accidentalmente ni duplicar rutas; confirma pérdida de cambios; campos y CTA visibles. |
| Accesibilidad | TalkBack, fuente grande, tamaño de pantalla, contraste, foco, errores y botones. | Etiquetas comprensibles, orden de foco y controles de al menos 48 dp; sin textos críticos truncados. |
| Backups/actualización | Actualización con misma firma y revisión de extracción en dispositivo sintético. | Datos/pendientes conservados al actualizar; ninguna promesa de restaurar Keystore desde backup. |

Si el diagnóstico actual no muestra `cipher_version` explícitamente, preparar exitosamente el almacén demuestra que pasó el guard, pero no sustituye un registro controlado de la versión real. No se añadió una pantalla ni logging de claves para esta auditoría.

## 11. Comandos backend para revisión manual

Ejecutarlos únicamente en una copia/entorno de integración cuya conexión haya sido verificada por el operador. Artisan puede arrancar proveedores; no ejecutar estos comandos de forma ciega en producción.

### Identificación y contratos, sin migrar

```powershell
Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
Get-FileHash -Algorithm SHA256 -LiteralPath '.\app\Services\Auth\MobileTokenPermissions.php'
Get-FileHash -Algorithm SHA256 -LiteralPath '.\app\Services\Offline\OfflineSyncService.php'
Get-FileHash -Algorithm SHA256 -LiteralPath '.\app\Services\Students\StudentQrService.php'
php artisan route:list --path=api/v1/auth/mobile
php artisan route:list --path=api/v1/exams
php artisan migrate:status
```

El operador del despliegue puede comparar esos hashes y consultar su estado local. Este documento no da por ejecutados los comandos ni pide credenciales. No se proporciona una orden de migración productiva; revisar el plan completo con Equipo 1 antes.

### Suites SQLite aisladas

Precondiciones: vendor existente, extensiones PHP necesarias disponibles, sin configuración cacheada y destino de pruebas confirmado. Si existe `bootstrap/cache/config.php`, detenerse y acordar una configuración de pruebas separada; no ejecutar limpieza automáticamente.

```powershell
Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
if (Test-Path -LiteralPath '.\bootstrap\cache\config.php') {
    throw 'Hay configuración cacheada. No ejecutar pruebas hasta separar la configuración de testing.'
}
php .\vendor\bin\phpunit -c phpunit.mobile.xml
php .\vendor\bin\phpunit -c phpunit.offline.xml
php .\vendor\bin\phpunit -c phpunit.mobile.xml tests/Feature/Incidents/MobileIncidentSyncTest.php
```

El primer XML incluye QR v3 y regresión móvil/web; el segundo no ejecuta de verdad los casos PG con el opt-in en cero. Conservar los casos skipped como skipped, no como concurrencia aprobada.

### Suites PostgreSQL: procedimiento pendiente separado

No basta añadir un nombre distinto a la base productiva ni cambiar solo `APP_ENV`. Requieren servidor/usuario/base desechables, sin privilegios sobre datos reales, configuración testing no cacheada, credenciales de prueba y DB_URL sin override.

- HU35–37: base nueva vacía con nombre que cumpla `^hu35_37_test_[a-f0-9]{12}$`, opt-in `EIDA_OFFLINE_PG_CONCURRENCY=1`. Cada clase necesita su propia base vacía.
- HU27: base totalmente desechable que cumpla `^hu27_test_[a-f0-9]{12}$`, opt-in `HU27_PG_CONCURRENCY=1`. La suite hace `migrate:fresh`.
- Los XML mobile/offline fuerzan SQLite y el opt-in offline a cero: **no usar esos XML esperando ejecutar PostgreSQL**, ni el bootstrap mobile que impide conexiones PG.
- Preparar después una configuración PHPUnit PG aislada con el equipo y ejecutar cada archivo de concurrencia explícitamente. Esta auditoría no crea esa configuración, no inventa credenciales ni entrega una orden destructiva conectada a la configuración personal actual.

## 12. Orden recomendado y criterios de cierre

1. Conservar esta auditoría y revisar con Equipo 1 el backend destino, las migraciones y la ampliación mínima de abilities. Separar el piloto manual offline de la emisión QR v3 real.
2. Elegir firma estable de laboratorio y dispositivo sintético antes de crear datos/pending events. Decidir cómo se conservarán fuentes/configuración nativas actualmente ignoradas.
3. Resolver API 37 y usar explícitamente SQLCipher + CMake 3.31.6; no reinstalar el conjunto de herramientas ni usar Prebuild por defecto.
4. Ejecutar manualmente typecheck y pruebas móviles de la versión actual. Ejecutar backend SQLite aislado y planificar PostgreSQL con bases desechables.
5. Generar release con bundle incorporado; revisar salidas actualizadas de autolinking y módulos. Firmar y registrar hash/certificado del artefacto exacto.
6. Inspeccionar manifiesto/bundle y realizar pruebas nativas con datos sintéticos: SQLCipher, biometría, fotos, cierre de proceso, reloj, cuentas, permisos e interfaz.
7. Aplicar mediante el equipo los cambios backend aprobados y verificar despliegue real. Reemitir tokens; probar incidencias/disciplinaria con positivos y negativos HTTP sin mocks de la política.
8. Validar HU37 y evidencia tardía/concurrencia. Resolver pruebas faltantes del transporte de incidencias antes de considerarlo robusto ante carreras.
9. Integrar y validar emisión QR v3 solo en el alcance aprobado, preservando compatibilidad y secretos servidor. Después probar el escáner con QR reales autorizados.
10. Autorizar un piloto con datos reales únicamente con evidencia del binario, backend y controles pendientes cerrados. Optimización R8 y distribución final requieren su propia repetición de validación.

**Criterio de salida:** APK identificada por SHA-256/certificado que inicia sin Metro, módulos nativos operativos, cifrado comprobado, aislamiento por cuenta, recuperación sin pérdida, reloj con comportamiento documentado, backend compatible y permisos contextuales verificados. Ninguno de estos puntos se da por validado por la mera lectura de código.

## 13. Registro de intervención

Único archivo creado/modificado por esta auditoría:

`docs/EIDA_CONTROL_FASE_9_AUDITORIA_PRE_APK.md`.

Se hicieron lecturas de archivos/configuración/índice como datos, comprobaciones de existencia en rutas concretas y consulta de documentación pública oficial. Algunas lecturas a rutas no existentes se corrigieron dentro de las raíces autorizadas; no se usaron para inferir contenido faltante.

No se modificaron código, lockfile, .gitignore, android/, módulos nativos, backend ni frontend. No se ejecutaron instalaciones, npm/npx, Node del proyecto, typecheck, pruebas, Expo, Metro, Prebuild, Gradle, ADB, compilaciones, migraciones, seeders, despliegues ni comandos Git. No se cambiaron variables del entorno, SDK/Java/Node/NDK/CMake, unidades virtuales, junctions o particiones. No se borró nada y no se consultó producción.

Los comandos incluidos son exclusivamente propuestas para ejecución manual del usuario; su presencia en este documento no significa que hayan sido ejecutados ni que sus resultados estén aprobados.

