# EIDA Control — fase 2: código y ejecución manual

Actualizado: 7 de noviembre de 2026, America/La_Paz.

**Estado: base preparada a nivel de código. La revisión actual es exclusivamente estática. Las pruebas actuales NO se ejecutaron; no hay APK generado ni verificación demostrada en Android.** El usuario realizará instalaciones, comandos, pruebas y compilación. Las acciones anteriores están registradas en [HISTORIAL_FASE_2.md](HISTORIAL_FASE_2.md).

## A. Estado encontrado

El proyecto ya existía en `C:/Fabian/Docs. Universidad/TIS/proyecto/oidevs-eida-control-mobile`, con Expo Router, pantallas, verificador, 29 vectores y una suite de escritorio de 40 pruebas. También quedaron dependencias, Node local, Android generado y registros de intentos de compilación anteriores. No se inicializó Git.

El build anterior fue detenido por el usuario. La unidad virtual y su junction se retiraron entonces. En esta sesión se retiró del código mantenido la lógica que podía crearlas; no se ejecutaron herramientas del entorno ni se desinstaló nada.

## B. Arquitectura y archivos

```text
oidevs-eida-control-mobile/
  AGENTS.md                         # Regla persistente: solo código
  .env.example                     # Configuración pública futura
  .gitignore
  .node-version
  app.config.ts                    # Identidad y plugins Expo
  eas.json                         # Perfiles preparados, no ejecutados
  expo-env.d.ts
  metro.config.js
  package.json
  package-lock.json                # Conservado sin regenerar
  tsconfig.json
  tsconfig.tests.json
  README.md
  src/
    app/
      _layout.tsx                  # Stack y tema
      index.tsx
      qr-diagnostics.tsx
    config/
      api.ts                       # Validación HTTPS; no cliente HTTP aún
      theme.ts
    components/
      Screen.tsx
      ActionButton.tsx
      DiagnosticCaseCard.tsx
    screens/
      HomeScreen.tsx
      QrDiagnosticsScreen.tsx
    features/
      qr/
        contracts.ts               # Tipos, contexto y proveedor
        codec.ts                   # Utilidades base64url/JSON
        verifyQrV3.ts              # Verificador independiente
        nativeCrypto.ts            # Adaptador QuickCrypto
        fixtures/
          php-vectors.json
          supplemental-vectors.json
      diagnostics/
        runVectors.ts
        useQrDiagnostics.ts
  tests/
    qr-v3.test.ts
  scripts/                         # Solo ejecución manual del usuario
    check-android.mjs
    build-android.mjs
    collect-android-report.mjs
    generate-supplemental-vectors.php
  docs/
    EIDA_CONTROL_FASE_2_EXPO_QR.md
    HISTORIAL_FASE_2.md
```

Directorios locales previos, ignorados y conservados: `node_modules/`, `.tools/`, `.artifacts/`, `android/`; `.expo/` también está ignorado. El antiguo `.artifacts/probe-autolink.mjs` quedó deshabilitado mediante un error explícito, sin comandos ni operaciones sobre unidades. Los registros y herramientas anteriores se conservaron.

Identidad: **EIDA Control**, paquete `bo.eida.control.dev`, orientación vertical, esquema `eidacontrol-dev`. Tema EIDA: navy `#172554`, principal `#0049a8`, acento `#8b1e3f`. Hay dos pantallas funcionales para esta prueba técnica, sin implementar aún las pantallas de asistencia, login, listas o sincronización.

## C. Dependencias declaradas

Se conservan package.json y su lockfile de la sesión anterior. No se añadieron dependencias en esta revisión.

| Dependencia | Declaración |
| --- | --- |
| expo | ~58.0.23 |
| react / react-dom | 19.3.0 |
| react-native | 0.88.1 |
| expo-router | ~58.0.30 |
| expo-dev-client | ~58.0.18 |
| expo-constants | ~58.0.15 |
| expo-linking | ~58.0.16 |
| expo-splash-screen | ~58.0.13 |
| expo-status-bar | ~58.0.4 |
| expo-system-ui | ~58.0.7 |
| react-native-safe-area-context | ~5.11.1 |
| react-native-screens | ~4.30.1 |
| react-native-quick-crypto | 1.1.9 |
| react-native-nitro-modules | 0.37.2 |
| react-native-quick-base64 | 3.0.1 |
| typescript (desarrollo) | ~6.0.3 |
| @types/react (desarrollo) | ~19.3.0 |
| @types/node (solo pruebas) | ^22.19.0 |
| tsx (solo pruebas) | ^4.20.6 |

Node declarado: `^22.13.0 || ^24.3.0 || >=26.0.0`; `.node-version` propone 22.23.1. El Node global detectado anteriormente era 20.19.0. React DOM se fijó en la misma versión que React por los peers de Router. No se desarrolla una versión web.

### API de QuickCrypto revisada estáticamente

Se leyeron README y declaraciones de tipos de **la versión instalada 1.1.9**, especialmente `lib/typescript/keys/signVerify.d.ts` e `index.d.ts`. La firma utilizada es `verify(algorithm, data, key, signature): boolean`, con `sha256`, PEM público y `RSA_PKCS1_PADDING` (valor 1). Buffer está reexportado por el paquete. No requiere instalar un alias global para esta llamada directa.

QuickCrypto 1.x usa Nitro/JSI y la nueva arquitectura. Se conservan Nitro Modules y Quick Base64. **Requiere una build nativa propia; Expo Go no basta.** Esto confirma que el adaptador corresponde a la API declarada; la compilación, carga del módulo y ejecución RSA con esta combinación concreta siguen pendientes de prueba en un celular Android.

## D. Contrato y verificación QR v3

Se revisaron, solo en lectura, el documento de fase 1 y las clases Laravel `QrV3Service` y `QrV3KeyRing`.

Cabecera exacta: `alg: RS256`, `kid` confiable y `typ: eida-entry-qr+jwt`. Claims exactos: `v:3`, `jti`, `sub`, `exam_id`, `iss`, `aud`, `iat`, `nbf`, `exp`.

`verifyQrV3(token, context, trust, provider)`:

1. Exige examen esperado canónico y permite comprobar también estudiante esperado.
2. Limita a 4096 caracteres y tres segmentos JWS.
3. Valida JSON y cabecera; rechaza algoritmos distintos, `none` y cabeceras extras.
4. Selecciona únicamente una clave pública del Map confiable por kid. Nunca descarga claves del QR.
5. Decodifica firma base64url canónica y verifica los bytes originales `header.payload`.
6. Exige un booleano del proveedor; una respuesta incompatible devuelve `CRYPTO_UNAVAILABLE`.
7. Solo tras autenticar, decodifica y valida los claims, identificadores, emisor/audiencia y examen.
8. Comprueba `iat <= nbf < exp`, duración máxima 172800 segundos y `iat/nbf <= now < exp`, sin tolerancia añadida.
9. Devuelve `{ok:true, claims, kid}` o `{ok:false, code}`; no devuelve claims sin firma válida.

RS256 es RSA PKCS#1 v1.5 con SHA-256. Las claves públicas de prueba son RSA de al menos 2048 bits. No hay claves privadas del backend ni APP_KEY en la app. sub/exam_id son strings decimales canónicos hasta `9223372036854775807`; tiempos son enteros Unix entre 0 y 253402300799. El perfil JSON reproduce el emisor PHP compacto, con escapes Unicode y sin claves duplicadas. El orden de rechazo de cabecera/kid/firma coincide con Laravel.

El reloj por defecto usa `Math.floor(Date.now()/1000)`. Solo el diagnóstico inyecta los instantes de prueba de 2030; no se desactiva la expiración del verificador. Una firma correcta no confirma habilitación, pertenencia a lista, ausencia de revocación ni asistencia.

## E. Vectores, pruebas escritas y límites de evidencia

`php-vectors.json` conserva los 10 casos originales de `backend/tests/Fixtures/qr-v3/rs256-vectors.json`. SHA-256 original/copia:

`4F03499E524EB3B0A099C5E7D7BB4AA788E74EAF3BC7E1C5ABBDC0A5A582B2C4`

Los 19 vectores adicionales se generaron previamente con PHP y el prototipo Laravel: una clave efímera en memoria, solo pública y tokens sintéticos persistidos. No se regeneraron ahora. Incluyen claims firmados inválidos, versión, emisor, audiencia, tiempos, campos ausentes/adicionales, IDs, JSON duplicado/no compacto, alg:none, typ, jku y formatos incorrectos. Total Android previsto: **29 casos; 2 válidos y 27 rechazos esperados**.

La suite actual contiene **44 pruebas de escritorio escritas, NO ejecutadas en esta sesión**: los 29 vectores y 15 comprobaciones adicionales. Cubren conservación del fixture, códigos esperados, reloj/expiración, ausencia de claims sin firma, proveedor no disponible o de API incompatible, orden de rechazo, base64url binario, IDs de 64 bits/espacios, contexto, estudiante opcional y configuración HTTPS.

| Evidencia | Estado |
| --- | --- |
| Revisión actual de código, tipos declarados y contrato Laravel | Estática, realizada |
| Suite anterior, antes de estos cambios | Histórico: 40 pruebas aprobadas en Node/OpenSSL |
| TypeScript, npm ls y expo install --check anteriores | Histórico: sin errores/conflictos reportados |
| Suite actual de 44 pruebas y typecheck actual | **NO ejecutados; usuario debe ejecutarlos** |
| Compilación completa y carga de QuickCrypto en celular | Pendientes |
| Verificación RS256 ejecutada en Android | **No demostrada** |
| APK/AAB | **No generado** |

Los resultados históricos no validan los últimos cambios ni demuestran compatibilidad Android. No se agregaron informes Android simulados. El adaptador Node existe únicamente en tests; la app usa exclusivamente el adaptador nativo.

## F. Diagnóstico y scripts manuales

La pantalla **Verificación QR v3** permite ejecutar los vectores, ver resultado esperado/observado y compartir un informe. Comprueba Android y rechaza Expo Go antes de cargar el proveedor. El resumen no marca éxito para una lista vacía. Si falla la carga nativa, informa indisponibilidad.

El informe registra fecha real de ejecución, plataforma, API Android, motor, proveedor, huella del fixture y resultados. No contiene tokens completos, PEM, credenciales ni datos personales. Sus entradas `EIDA_QR_DIAGNOSTIC_REPORT` se fragmentan para evitar truncamiento en logcat.

- `check-android.mjs`: inventario por lectura de archivos. Ya no ejecuta ADB ni otra herramienta.
- `build-android.mjs`: solo si el usuario lo invoca. Usa la ruta real y JAVA_HOME/ANDROID_HOME elegidos por el usuario. No crea unidades/enlaces, no selecciona otro Node/JDK, no instala herramientas ni cambia variables. Desactiva la descarga automática de componentes SDK por AGP (`android.builder.sdkDownload=false`). El wrapper/dependencias Maven pueden descargarse al ejecutar Gradle manualmente.
- `collect-android-report.mjs`: solo invocado manualmente, con serial explícito. Lee logs, exige que el informe más reciente esté completo y comprueba API, hash y resultados. No verifica firmas en Node ni reemplaza la ejecución dentro del teléfono.
- `generate-supplemental-vectors.php`: conservado como utilidad opcional. No hace falta ejecutarlo; reemplazaría las fixtures adicionales. No fue ejecutado en esta sesión.

Estos scripts modificados tampoco se ejecutaron para comprobarlos. No existen hooks preinstall/postinstall propios que invoquen estos ayudantes.

## G. Procedimiento manual: PowerShell en Windows

**Todos los comandos siguientes son instrucciones para el usuario. El asistente NO los ejecutó en esta sesión.** Ejecutarlos por etapas; una etapa fallida debe resolverse antes de continuar. No usar unidades virtuales ni enlaces para resolver rutas.

### 1. Abrir el proyecto y revisar Node

```powershell
Set-Location -LiteralPath 'C:\Fabian\Docs. Universidad\TIS\proyecto\oidevs-eida-control-mobile'
node --version
npm --version
Get-Command node, npm | Select-Object Name, Source
```

Usar Node compatible con engines, por ejemplo 22.23.1. Si eliges aprovechar el Node local ya descargado anteriormente, puedes seleccionarlo solo para este terminal y volver a revisar las versiones:

```powershell
$env:Path = (Resolve-Path -LiteralPath '.tools/node/node_modules/node/bin').Path + ';' + $env:Path
node --version
npm --version
```

Este comando no instala Node ni cambia variables persistentes. Si esa carpeta no existe, prepara personalmente un Node compatible; no hay descargador automático en los scripts.

### 2. Dependencias y pruebas de escritorio

Si necesitas reproducir la instalación desde el lockfile existente:

```powershell
npm ci
npm run typecheck
npm test
```

La instalación descarga dependencias y puede ejecutar scripts de terceros; la inicia el usuario. Las pruebas son de escritorio. El objetivo esperado de la suite actual es 44 aprobadas, todavía sin resultado nuevo.

### 3. SDK y Java

Si corresponden a tus instalaciones, selecciona SDK y JDK solo en este terminal:

```powershell
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
java -version
Test-Path -LiteralPath "$env:ANDROID_HOME\platform-tools\adb.exe"
Get-ChildItem -LiteralPath "$env:ANDROID_HOME\platforms"
Get-ChildItem -LiteralPath "$env:ANDROID_HOME\build-tools"
Get-ChildItem -LiteralPath "$env:ANDROID_HOME\ndk"
Get-ChildItem -LiteralPath "$env:ANDROID_HOME\cmake" -ErrorAction SilentlyContinue
npm run check:android
```

Datos del código y ejecución anterior: Gradle wrapper 9.4.1, compileSdk 37, targetSdk 36, minSdk 24, build-tools 37.0.0 y NDK 27.1.12297006. Android Studio aportaba JBR 25.0.4; no fue instalado por el asistente. CMake no estaba instalado al detenerse el trabajo anterior. Su versión requerida debe confirmarse en el error/configuración del build manual; ReactAndroid declara 3.30.5 en su fuente instalada. No se hizo una nueva comprobación del sistema.

Si falta un componente, instálalo personalmente desde Android Studio > SDK Manager > SDK Tools (Show Package Details), eligiendo la versión que solicite Gradle. Para la CLI Android nueva detectada anteriormente, un ejemplo de instalación manual de CMake, si esa es la versión solicitada, es:

```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\android.exe" --no-metrics sdk install 'cmake/3.30.5'
```

### 4. Preparar un celular físico

Activar opciones de desarrollador y depuración USB; conectar y autorizar este equipo desde el celular. Requiere Android API 24 o superior según la configuración actual.

```powershell
adb devices -l
$serial = 'REEMPLAZAR_POR_EL_SERIAL_REAL_DEL_CELULAR'
adb -s $serial reverse tcp:8081 tcp:8081
```

No se incluye creación de emuladores. Todas las operaciones del dispositivo usan el serial que elijas.

### 5. Generación nativa y development build

`android/` ya existe por la sesión anterior. Si necesitas aplicar/regenerar la configuración Expo, hacerlo manualmente sin --clean:

```powershell
npm run prebuild
```

Para compilar, instalar y abrir la development build en el teléfono, dejando que Expo inicie Metro:

```powershell
npm run android -- --device $serial
```

Para iniciar únicamente Metro cuando ya tengas la development build instalada:

```powershell
npm start
```

Abrir la URL del development client que imprime Expo. Esta build contiene los módulos nativos, pero depende de Metro para cargar JavaScript, incluidos módulos cargados de forma diferida en desarrollo. No es todavía una APK autónoma para distribución offline.

### 6. Ejecutar los vectores dentro del celular

En la app: **Abrir prueba criptográfica > Ejecutar vectores en Android**. Resultado esperado: 29/29, con 2 tokens válidos y 27 rechazos con su código esperado. Esto es una expectativa, no un resultado obtenido.

También puedes abrir la ruta cuando el proyecto ya esté cargado en la development build:

```powershell
adb -s $serial shell am start -a android.intent.action.VIEW -d 'eidacontrol-dev://qr-diagnostics?autorun=1'
node scripts/collect-android-report.mjs $serial
```

El lector guarda `.artifacts/android/qr-v3-report.json` solo si encontró un informe completo; informa si hay resultados no conformes. Revisar executedAt para confirmar que corresponde a la ejecución que acabas de realizar. El botón Compartir informe permite guardar el JSON si logcat no está disponible.

### 7. Generar posteriormente un APK local

Development APK para un celular ARM64, con Metro necesario:

```powershell
npm run build:android -- --variant debug --architectures arm64-v8a
Test-Path -LiteralPath '.artifacts/apk/eida-control-debug-arm64-v8a.apk'
adb -s $serial install -r '.artifacts/apk/eida-control-debug-arm64-v8a.apk'
```

APK autónoma de prueba con JavaScript incorporado, ARM64 y x86_64:

```powershell
npm run build:android -- --variant release --architectures arm64-v8a,x86_64
$apk = '.artifacts/apk/eida-control-release-arm64-v8a_x86_64.apk'
Test-Path -LiteralPath $apk
Get-FileHash -LiteralPath $apk -Algorithm SHA256
adb -s $serial install -r $apk
```

El helper solo copia el APK a `.artifacts/apk/` tras una compilación exitosa y existencia del archivo. Un APK exclusivamente x86_64 no sirve para un celular ARM64.

La variante release local conserva la firma de desarrollo de la plantilla. Es una APK autónoma de prueba, no una entrega institucional con clave de publicación. Para distribución institucional se deberá definir posteriormente el firmado y la configuración correspondientes. eas.json conserva perfiles development e internal preview, pero no se invocó EAS ni se subió código a servicios externos.

Para demostrar independencia de red, instalar la variante con bundle incorporado, cerrar Metro, desconectar la red del teléfono y ejecutar allí los vectores. Guardar el informe y una captura con el resultado real.

## H. Limitaciones técnicas pendientes

- Compilar en la ruta real con espacios, cargar QuickCrypto/Nitro y comprobar firmas en el celular. El helper fue revisado estáticamente y no probado tras su modificación.
- Resolver manualmente componentes SDK/CMake, licencias, memoria o errores de CMake/Ninja. No está autorizado resolverlos con instalaciones o modificaciones del sistema por parte del asistente.
- Reejecutar typecheck y las 44 pruebas actuales. Los 40 éxitos anteriores pertenecen al código anterior.
- Conservar evidencia real del teléfono y comprobar la APK autónoma offline. No hay APK ni informe Android generado hasta ahora.

## I. Integración posterior con el backend

Mantener QR v3 experimental hasta disponer de evidencia Android. Confirmar despliegue de fase 1, migración de dispositivos y configuración móvil en un entorno autorizado antes de conectar login.

Próxima etapa: cliente HTTPS, Bearer Sanctum, SecureStore, vencimiento/reautenticación y revocación de dispositivos. Después: HU36, listas/fotos, SQLite cifrado, cámara, incidencias, cola HU37 y resolución de conflictos. La función apiBaseUrl solo valida configuración; no se añadieron solicitudes HTTP ni conexión a producción. No se crearon decenas de módulos vacíos para esas fases.

## J. Cambios de esta sesión

Inventario exacto y comparación con las sesiones anteriores: [HISTORIAL_FASE_2.md](HISTORIAL_FASE_2.md). Se añadieron cuatro pruebas y se actualizaron dos existentes. No cambian las dependencias, el lockfile, las fixtures, el formato firmado ni los archivos nativos generados.

## K. Alcance y preservación

En esta sesión solo se leyeron y editaron archivos. No se ejecutaron instalaciones, npm/npx/Node, pruebas, typecheck, Expo, Gradle, ADB, EAS ni generadores; no se crearon emuladores, unidades o enlaces, no se modificaron variables del sistema y no se realizaron operaciones Git. No se desinstalaron las herramientas anteriores. Backend/frontend permanecieron de solo lectura y no se leyó su .env.

Las verificaciones históricas de contenidos, HEAD e índices, que confirmaron la preservación de ambos repositorios, se registran como históricas en el informe acumulado; no se repitieron consultas Git en esta sesión.

## Referencias revisadas

La revisión actual usó código y documentación locales de las versiones instaladas. Referencias oficiales consultadas en las sesiones previas:

- [Expo: SDK](https://docs.expo.dev/versions/latest/).
- [Expo: development builds](https://docs.expo.dev/develop/development-builds/introduction/).
- [Expo: APK](https://docs.expo.dev/build-reference/apk/).
- [QuickCrypto](https://github.com/margelo/react-native-quick-crypto).

Las páginas web actuales pueden describir versiones posteriores; para esta revisión mandan las declaraciones 1.1.9 conservadas localmente y package-lock.json.
