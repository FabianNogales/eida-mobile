# EIDA Control — fase 3: autenticación, sesión y consultas

Fecha: 8 de noviembre de 2026, America/La_Paz. Proyecto: `C:/proyecto/eida-mobile`.

**Estado: implementación de código y revisión estática. No se ejecutaron instalaciones, pruebas, typecheck, Expo, compilaciones, ADB ni comandos Git.** El usuario confirmó al solicitar esta fase que QR v3 de fase 2 funciona en su celular real; no se atribuye esa prueba al asistente.

**Advertencia de integración:** los contratos se verificaron en el backend local `C:/proyecto/oidevs-examenes-backend`. La ruta antigua indicada en el prompt ya no estaba disponible. No se consultó producción, no se aplicaron migraciones y no se confirmó que estas rutas estén desplegadas. Un servidor que aún no tenga fase 1/migración mobile_devices no podrá completar este flujo.

## A. Alcance implementado

- Login institucional con el endpoint móvil Sanctum, sin flujo SPA/CSRF ni cookies.
- Cliente HTTP centralizado con timeout de 15 segundos, cancelación y errores seguros.
- SecureStore para token/identidad mínima; UUID de instalación aleatorio estable, sin IMEI/serial.
- Restauración vía `/me`, vencimiento, revocación, validación pendiente y recuperación.
- Navegación protegida, inicio, exámenes paginados, colaboraciones, perfil y dispositivos propios.
- Logout remoto, cierre local y revocación pendiente diferenciados.
- Diagnóstico QR v3 público de desarrollo y verificador/vectores/pruebas originales conservados.

No se implementan listas offline, SQLite, fotos, cámara, asistencia, incidencias ni sincronización. No hay datos ficticios dentro de las pantallas: los mocks nuevos están exclusivamente en tests.

## B. Auditoría de contratos reales

Rutas relativas a `/api/v1`; detrás de un proxy pueden llevar antes `/backend` u otro prefijo.

| Método y ruta | Petición / respuesta real | Autorización |
| --- | --- | --- |
| POST auth/mobile/login | identifier, password, installation_id, device_name, app_version opcional. HTTP 200: `{data:{access_token,token_type,expires_at,abilities,device,user,server_time}}`. | Sin Bearer ni cookie; límite de intentos propio. |
| GET me | `{success:true,data:{id,display_name,email,status,must_change_password,roles}}`. | Sanctum; token móvil con mobile:session. |
| POST auth/logout | HTTP 200 `{message:"Session revoked successfully"}`. Revoca la instalación del token móvil. | Bearer actual; mobile:session. |
| GET auth/devices | `{data:[{id,installation_id,device_name,platform,app_version,status,last_login_at,revoked_at}]}`. Incluye propios activos y revocados. | mobile:devices. |
| DELETE auth/devices/{id} | HTTP 204; ajeno/inexistente: 404. | mobile:devices y propiedad comprobada en Laravel. |
| GET teacher/exams | Colección Laravel `{data:[...],links,meta}`. Filtros: view, search, page, per_page. | control:read, cuenta activa, contraseña cambiada y teacher.role. Solo exámenes propios. |
| GET me/collaborations | `{data:[{exam_id,exam_name,subject_name,exam_date,start_time,duration_minutes,room}]}`. Sin paginación. | control:read; servidor filtra colaboraciones ACTIVE, examen disponible y candidatura vigente. |

Login: identifier hasta 100 caracteres; password entre 8 y 20, sin recortarla; installation_id UUID; device_name hasta 100 y app_version hasta 40. Se envía el nombre genérico EIDA Control Android y la versión Expo de la app. Laravel decide dominio institucional/código SIS/docente, roles, abilities y TTL; el cliente no sustituye esa política.

CurrentUserResource devuelve id numérico, display_name, email, status, must_change_password y roles globales normalizados. No se inventa un rol COLABORADOR. La misma cuenta puede consultar sus exámenes docentes y también colaboraciones de otros exámenes.

### Exámenes

ListTeacherExamsRequest permite `view=upcoming|past|cancelled|all`, search hasta 255, page positivo y **per_page=10**. La app implementa las cuatro vistas y paginación de 10; no utiliza las URLs links de Laravel para enviar tokens, construye la página siguiente sobre el backend configurado.

Campos usados: id, name, subject_name, subject_code, exam_date, start_time, duration_minutes, room `{id,code,name}` o null, status. Otros campos reales del recurso, como permisos de edición/cancelación, no habilitan mutaciones en esta fase.

`upcoming` del servidor incluye programados y en desarrollo cuyo fin aún no pasó. Por eso se presenta como **Próximos y en desarrollo**, resaltando IN_PROGRESS dentro de la página actual. Pasados y cancelados los filtra Laravel. No existe un filtro exclusivo in_progress en ese endpoint; no se inventó uno. El reloj del celular no modifica el estado oficial.

### Colaboraciones

La API actual no devuelve docente responsable, estado del examen ni campo de estado de colaboración. La pantalla no los inventa. “Colaboración autorizada al consultar” expresa la semántica del listado filtrado por el servidor. Una revocación deja de aparecer al actualizar; no hay historial ni motivo de desaparición en este contrato.

Fechas de examen: YYYY-MM-DD y horas HH:mm:ss de America/La_Paz. Se muestran como fecha de calendario/hora local del dominio, sin convertir la fecha a medianoche UTC. Fechas de sesión/dispositivos son ISO con zona; se aceptan microsegundos Carbon y se presentan en America/La_Paz.

### Códigos verificados

- 422: validación/credenciales. Cuenta inactiva en login puede llegar como errors.identifier con “La cuenta se encuentra inactiva.”, sin código específico.
- 403 PASSWORD_CHANGE_REQUIRED: completar el cambio inicial en EIDA Web.
- 403 MOBILE_OPERATOR_REQUIRED: falta examen propio o colaboración vigente.
- 403 MOBILE_ABILITY_REQUIRED o 403 sin código: operación no autorizada; un error de lista no elimina por sí solo una sesión válida.
- 401: credencial inválida/vencida; puede incluir ACCOUNT_INACTIVE, MOBILE_DEVICE_REVOKED, MOBILE_TOKEN_INVALID o SESSION_REPLACED. Se invalida la sesión local.
- 429: demasiados intentos; no hay reintento automático.
- 503 MOBILE_CONFIGURATION_INVALID y otros 5xx: indisponibilidad/configuración del servidor. No se confunden con contraseña incorrecta ni se descarta el token por un fallo temporal.

Fuentes leídas: routes/api.php, routes/api/v1.php, MobileLoginRequest, MobileAuthService, LoginUserResolver, CurrentUserController/Resource, AuthenticationService, MobileDeviceController/Service, EnforceMobileTokenAccess, VerifyTeacherRole, EnsurePasswordHasBeenChanged, EnsureCurrentSession, ListTeacherExamsRequest, ExamManagementController/Resource/Service/Policy y ExamCollaboratorController/Service/Model.

## C. Arquitectura

```text
src/
  config/api.ts                       # Validación y raíz API con proxy
  services/http/
    client.ts                         # Transporte, cabeceras, cancelación y timeout
    nativeTransport.ts                # fetch de Expo SDK 58
    errors.ts                         # Normalización sin logs sensibles
    schema.ts                         # Validación runtime de JSON REST
  features/auth/
    contracts.ts                      # Tipos, sesión mínima y estados
    api.ts                            # Login, me, logout y parsers
    storage.ts                        # Persistencia segura inyectable
    nativeStorage.ts                  # SecureStore + UUID QuickCrypto
    session.ts                        # Ciclo de vida, concurrencia e invalidación
    guards.ts
    AuthProvider.tsx
  features/exams/api.ts                # Exámenes, colaboraciones y dispositivos
  hooks/useRemoteQuery.ts              # Carga cancelable, sin caché offline
  utils/dates.ts
  components/{FormField,Notice}.tsx
  components/contentStyles.ts
  screens/
    EntryScreen.tsx
    LoginScreen.tsx
    SessionScreen.tsx
    HomeScreen.tsx
    ExamsScreen.tsx
    CollaborationsScreen.tsx
    ProfileScreen.tsx
    DevicesScreen.tsx
    QrDiagnosticsScreen.tsx            # Conservado
```

Las pantallas no hacen fetch ni manipulan tokens. El controlador solo publica identidad validada y metadatos no secretos. Las respuestas REST se validan antes de convertirse en tipos de dominio.

## D. URL y transporte

Variable única: **EXPO_PUBLIC_EIDA_API_BASE_URL**. No incluir tokens/contraseñas en variables EXPO_PUBLIC_. `.env.example` usa un dominio `.invalid`, deliberadamente no operativo; la app lo rechaza con un mensaje de configuración.

Se aceptan una raíz HTTPS, una raíz con proxy como `/backend`, o una raíz completa `/backend/api/v1`. Se añade `/api/v1` solo cuando falta. Se rechazan credenciales en URL, query, fragmento, duplicaciones de `/api/v1`, rutas externas o con traversal. No se desactiva TLS.

El transporte utiliza **fetch de expo/fetch**, ya incluido en Expo, no Axios ni el fetch legacy de React Native. Se revisó su implementación Android instalada: `credentials:omit` usa CookieJar.NO_COOKIES y `redirect:manual` desactiva followRedirects/followSslRedirects de OkHttp. El cliente rechaza 3xx y cambios de URL. Así no se sigue una redirección con contraseña o Bearer hacia otro destino. El proxy debe servir la API en su URL final, sin redirigirla.

No hay reintentos automáticos de POST/DELETE. No se escriben tokens, contraseñas ni respuestas privadas en logs. Los errores HTTP se traducen a mensajes conocidos; no se muestra HTML ni stack traces del servidor.

## E. Token, instalación y sesión

Dependencia nueva: **expo-secure-store ~58.0.2**, versión indicada por bundledNativeModules del Expo SDK 58 instalado. Está declarada y su plugin está configurado. **No está instalada por el asistente y el lockfile no fue editado**: deben sincronizarse mediante instalación manual antes de usar npm ci.

No hace falta otra biblioteca UUID: QuickCrypto 1.1.9 ya declara randomUUID, usado para generar un UUID v4 criptográfico. No se modifica el adaptador QR existente ni se instala crypto global.

SecureStore mantiene:

- `eida.installation.v1`: UUID local, estable mientras se conserve el almacenamiento.
- `eida.session.v1`: token, base API normalizada, expiresAt, desfase respecto de server_time, userId, deviceId, installationId y logoutPending.

No se guardan contraseña, roles, email o perfil completo. No se usan AsyncStorage, SQLite ni archivos planos como fallback. `installationId` no es el id del dispositivo del servidor ni el id del usuario y no demuestra identidad física. Si Android pierde el almacenamiento/reinstala la app, deberá autenticarse y registrar una instalación nueva.

Estados: initializing, unauthenticated, authenticating, authenticated, expired, offline y recoverable-error. Al arrancar y volver a primer plano se lee la credencial y se valida `/me`. Se comprueba su vencimiento conocido y coincidencia de userId. La sesión se vincula a la base API: cambiar dominio/prefijo no envía el token anterior a la nueva URL.

El vencimiento local usa expires_at con el desfase observado de server_time; hay comprobación al solicitar datos y temporizador mientras está abierta. Laravel sigue siendo la autoridad frente a cambios de reloj o revocaciones. No existe refresh token en el contrato; al vencer, se requiere login.

Un 401 o cambio obligatorio de contraseña bloquea inmediatamente rutas privadas y elimina la credencial segura. Un error de red conserva el token, pero deja la identidad sin validar y no permite consultas privadas hasta recuperar `/me`. Una generación interna de sesión y cancelaciones descartan respuestas tardías del usuario anterior.

### Logout y fallos locales

Antes del POST de logout se persiste logoutPending y se retira la identidad de la UI. Tras el 200 esperado se elimina el token. Un 401 confirma credencial no válida, no necesariamente eliminación remota del registro; se comunica con ese significado.

Si falla la conexión o el servidor, la credencial queda cifrada **solo para una revocación pendiente**, sin poder restaurar acceso. No se reintenta POST al arrancar: el usuario elige reintentar revocación o “Olvidar credencial local”. Esta última opción advierte que el servidor podría conservarla y que puede revocarse en EIDA Web.

Un fallo de SecureStore bloquea acceso. Si no se pudo persistir el cierre, se informa que debe reintentarse antes de reiniciar. Si el servidor emitió un token y falló su guardado, no se habilita la sesión; un nuevo login de la misma cuenta/instalación rota sus tokens según Laravel. No se promete una revocación remota que no se confirmó.

Cerrar sesión solo elimina la clave de sesión de esta fase. Conserva installationId y no borra futuros paquetes/colas offline.

## F. Navegación

```text
/                         Resolución del estado de sesión
/login                    Pública
/session                  Validación pendiente/error recuperable
/qr-diagnostics           Pública, diagnóstico de desarrollo conservado
/(private)/               Inicio
/(private)/exams          Mis exámenes
/(private)/collaborations Mis colaboraciones
/(private)/profile        Mi cuenta
/(private)/devices        Mis dispositivos
```

Stack.Protected existe en la versión instalada de Router. Se combina con una guarda adicional del layout privado; al perder la sesión se retira su historial. Las consultas privadas exigen también un estado validado en SessionController y la autorización final de Laravel. No hay rutas con IDs de examen que permitan abrir detalles ajenos en esta fase.

La conexión se presenta como última validación con el servidor, no como monitor continuo de Internet. No se añadió NetInfo. Los listados tienen actualización manual, estados de carga, error y vacío; al fallar/abandonar una consulta no se inyectan datos ficticios ni una caché de autorizaciones.

## G. Pruebas escritas, NO ejecutadas

49 nuevas pruebas previstas por sus declaraciones/bucles, más las 44 anteriores QR: **93 en total esperadas**, sin resultado de ejecución ni typecheck de esta fase.

- tests/http.test.ts: 14 casos; configuración, proxy, ruta, Bearer/cookies, redirecciones, 401/403/422/429/500, red, timeout, cancelación y fechas.
- tests/session.test.ts: 28 casos; login, campos/credenciales, cuenta inactiva, contraseña inicial, permisos, UUID, persistencia, restauración, expiración, revocación, red, 5xx, concurrencia, logout pendiente y cambio de usuario/backend.
- tests/exams.test.ts: 7 casos; exámenes, paginación, vacío, colaboración vigente/revocada, funciones simultáneas, 403 y dispositivos.
- tests/support/authFixtures.ts: mocks sintéticos únicamente para pruebas.
- tests/qr-v3.test.ts y fixtures QR: conservados byte por byte. npm test los incluye como regresión.

Los tests nuevos ejercitan el controlador y los servicios reales con un transporte/almacenamiento inyectados. No demuestran cifrado nativo SecureStore, UI de Router o conectividad del APK: eso requiere las comprobaciones manuales siguientes.

## H. Ejecución manual por el usuario

**Solo instrucciones: ningún comando de este documento fue ejecutado por el asistente.**

### Dependencia y configuración — PowerShell

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
node --version
# Si eliges usar el Node local compatible ya existente, solo en este terminal:
$env:Path = (Resolve-Path -LiteralPath '.tools/node/node_modules/node/bin').Path + ';' + $env:Path
node --version

# Instala la dependencia declarada y actualiza el lockfile mediante npm:
npm install 'expo-secure-store@~58.0.2'

# Crea .env solo si no existe; después edita personalmente su URL:
if (-not (Test-Path -LiteralPath '.env')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
npm run typecheck
npm test
```

No ejecutar npm ci antes de incorporar SecureStore al lockfile: package.json y lockfile quedaron intencionalmente sin sincronizar por la prohibición de instalar/editarlos manualmente. Después de la instalación, revisa tú los cambios de manifest/lockfile. La URL de ejemplo no permitirá login hasta que la reemplaces por tu backend HTTPS autorizado.

Git Bash equivalente para las comprobaciones e instalación:

```bash
cd /c/proyecto/eida-mobile
node --version
npm install 'expo-secure-store@~58.0.2'
npm run typecheck
npm test
```

### Nueva development build

El APK de fase 2 puede no contener SecureStore. Instalar el paquete JS no incorpora por sí solo su módulo nativo: compila una nueva development build. **No se modificó android/**; conserva primero los ajustes nativos manuales de fase 2. Si decides aplicar/regenerar plugins con prebuild, hazlo tú y revisa el resultado, sin --clean automático.

```powershell
# Solo si decides regenerar/aplicar configuración nativa:
npm run prebuild

# Con SDK/JDK preparados por ti y celular autorizado:
adb devices -l
$serial = 'REEMPLAZAR_POR_EL_SERIAL_REAL_DEL_CELULAR'
adb -s $serial reverse tcp:8081 tcp:8081
npm run android -- --device $serial
```

Si la build ya está instalada y solo necesitas Metro, reinícialo tras cambiar .env:

```powershell
npm start -- --clear
```

Expo Go no sustituye esta build. No hay instrucciones de despliegue backend ni comandos de base de datos ejecutados; el despliegue/migración deben revisarse por el equipo en el entorno autorizado.

### Lista de comprobación de login real

1. Confirmar que HTTPS/proxy/Authorization funcionan y que existe el endpoint móvil desplegado.
2. Sin URL o con el ejemplo, comprobar mensaje de configuración y acceso al diagnóstico QR.
3. Probar campos vacíos, credenciales incorrectas, cuenta inactiva, contraseña inicial y usuario sin examen/colaboración. Verificar mensajes, sin registrar credenciales en logs.
4. Iniciar sesión con una cuenta real autorizada; comprobar `/me`, nombre y funciones.
5. Consultar exámenes en las cuatro vistas, navegar páginas y comprobar fecha/hora/estado con EIDA Web. Consultar colaboraciones y lista vacía real.
6. Reiniciar la app: restaurar mediante SecureStore y `/me`. Cortar red y reabrir: validación pendiente sin perder token ni habilitar pantallas privadas. Reconectar y reintentar.
7. Revocar la instalación desde EIDA Web u otra sesión; al consultar/volver a primer plano debe bloquearse por 401. Verificar también vencimiento con TTL configurado por el responsable del backend, sin alterar su base desde el asistente.
8. Probar una cuenta docente con colaboraciones de otros exámenes y una cuenta que solo tenga colaboraciones: teacher/exams puede responder 403 sin invalidar la otra función.
9. Repetir los 29 vectores del diagnóstico QR existente para comprobar que su integración continúa funcionando.

### Lista de comprobación de cierre

1. Con conexión, pulsar Cerrar sesión. Esperar confirmación del servidor; atrás/deep links no deben devolver pantallas privadas. Reiniciar y comprobar login.
2. Sin conexión, pulsar Cerrar sesión: se comunica cierre local y revocación pendiente, sin afirmar revocación remota.
3. Reiniciar todavía sin red: no debe restaurarse acceso ni reintentarse automáticamente el POST. Reconectar y elegir Reintentar revocación remota.
4. Probar Olvidar credencial local solo entendiendo que no confirma revocación remota. Comprobar que installationId se conserva y la siguiente cuenta no ve datos de la anterior.
5. En dispositivos, revocar uno ajeno a esta instalación y luego esta instalación propia. La API decide propiedad; al revocar la actual se bloquea su sesión.

## I. Archivos creados y modificados

**Creados:**

```text
src/services/http/{client,errors,schema,nativeTransport}.ts
src/features/auth/{api,contracts,guards,storage,nativeStorage,session}.ts
src/features/auth/AuthProvider.tsx
src/features/exams/api.ts
src/hooks/useRemoteQuery.ts
src/utils/dates.ts
src/components/FormField.tsx
src/components/Notice.tsx
src/components/contentStyles.ts
src/screens/{Entry,Login,Session,Exams,Collaborations,Profile,Devices}Screen.tsx
src/app/login.tsx
src/app/session.tsx
src/app/(private)/{index,exams,collaborations,profile,devices,_layout}.tsx
tests/http.test.ts
tests/session.test.ts
tests/exams.test.ts
tests/support/authFixtures.ts
docs/EIDA_CONTROL_FASE_3_AUTH_EXAMS.md
```

**Modificados:** package.json, app.config.ts, .env.example, README.md, AGENTS.md, docs/EIDA_CONTROL_FASE_2_EXPO_QR.md (nota del resultado informado por el usuario), src/config/api.ts, src/app/index.tsx, src/app/_layout.tsx, src/screens/HomeScreen.tsx, src/components/ActionButton.tsx y src/components/Screen.tsx. Los componentes compartidos conservan los usos anteriores del diagnóstico QR.

**Conservados:** lockfile, todos los archivos QR/vectores/pruebas de fase 2, pantalla de diagnóstico y su runner, scripts anteriores, carpeta android y repositorios backend/frontend. No se hicieron operaciones Git ni cambios de staging/HEAD/ramas.

Se compararon por lectura las huellas SHA-256 anteriores/posteriores. Coincidieron las de los seis archivos del módulo QR, tests/qr-v3.test.ts, package-lock.json, android/gradle.properties, android/app/build.gradle y los archivos Git index/HEAD. Referencias:

| Archivo | SHA-256 conservado |
| --- | --- |
| package-lock.json | E8DBBC8867411F86B44F4271E8922CFFEBCA4A8457B5DA4C550209663B8AB963 |
| src/features/qr/verifyQrV3.ts | DF644F11B33CE84E5FAAB7BD1F95661AA743395DB14325D14DDBEFE36B1A3C3F |
| src/features/qr/fixtures/php-vectors.json | 4F03499E524EB3B0A099C5E7D7BB4AA788E74EAF3BC7E1C5ABBDC0A5A582B2C4 |
| tests/qr-v3.test.ts | 14A00BFF0953C1A88CAD5B8C7A4D0B3481CA4D390F263DABE5B2B1726241D8B0 |

La lectura de huellas y la revisión de referencias/imports son comprobaciones estáticas, no ejecución de tests ni de TypeScript.

## J. Limitaciones y siguientes pasos

- Instalación manual de SecureStore y actualización del lockfile, typecheck, tests, nueva build y login real todavía pendientes de ejecución del usuario.
- No se comprobó producción ni migración; 404, HTML o 5xx pueden indicar servidor sin el contrato móvil o proxy incorrecto.
- SecureStore no reemplaza la autorización remota. El diagnóstico QR sigue siendo técnico y no confirma ingreso.
- No hay refresh token ni historial de colaboraciones revocadas en el contrato. No se inventaron endpoints para suplirlos.
- Las pantallas no almacenan listas offline ni mantienen permisos por roles en caché. IDs numéricos REST fuera del rango seguro de JavaScript se rechazan, en lugar de perder precisión.
- Revisar en un dispositivo la persistencia Keystore, los eventos de retorno a primer plano, redirecciones rechazadas y el comportamiento de navegación/teclado. La revisión estática no sustituye esa evidencia.
- Próximas fases: cliente de paquetes HU36, almacenamiento cifrado y política de retención, cámara/QR operativo, incidencias y cola HU37. No se adelantó su implementación.
