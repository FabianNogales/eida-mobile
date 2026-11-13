# EIDA Control — correcciones posteriores a la APK Debug

Actualización posterior autorizada: se habilitó una excepción temporal sin
biometría para bundles de desarrollo, en un almacén local separado. Véase
[Modo de laboratorio sin biometría](./EIDA_CONTROL_MODO_LAB_SIN_BIOMETRIA.md).
El diagnóstico y la política estricta descritos abajo siguen aplicando al modo
normal; no debe interpretarse este informe histórico como que el laboratorio
también exige una huella.

Fecha: 9 de noviembre de 2026. Alcance: repositorio móvil `C:\proyecto\eida-mobile`; código y documentación. No se ejecutaron pruebas, TypeScript ni herramientas Android.

**Estado:** correcciones implementadas y pruebas escritas; validación en Android físico pendiente. No se declara resuelto en el teléfono el error de navegación ni comprobado SQLCipher.

El usuario confirmó que la APK Debug se instaló, que utilizó `-Pexpo.sqlite.useSQLCipher=true` y que el teléfono probado es un **Huawei Y9 con el lector de huella averiado y PIN de bloqueo**. No se dispone de la versión exacta de Android ni de un resultado de `PRAGMA cipher_version` de ese dispositivo.

## 1. Logout: diagnóstico antes de modificar

### Hallazgos confirmados en el código original

- El guard raíz `Stack.Protected` ya utilizaba `canAccessPrivate(session)`.
- Al invalidarse la sesión, el layout privado reemplazaba su Stack por `<Redirect href="/" />` al mismo tiempo que el guard padre retiraba el grupo privado.
- `SessionController.logout()` publicaba `initializing` antes de cerrar recursos, guardar el marcador de revocación y llamar al backend.
- `loginPresentation` interpreta `initializing` como una indicación de navegar a `/session`. SessionScreen, al recibir después `unauthenticated`, vuelve a `/login`.
- La raíz no tenía login como ancla explícita y declaraba index primero. Ese index contiene otra selección/redirección de destino.
- El perfil no llama imperativamente a `router.replace('/login')` después de logout: no se atribuye el problema a una llamada inexistente.
- El callback de consulta del perfil depende del controlador y del ID, no del objeto completo de sesión; no se identificó ahí un efecto infinito.
- `getSnapshot` conserva una referencia estable hasta publicar un estado nuevo; no se encontró un snapshot creado de nuevo en cada lectura.
- El Redirect del Router instalado utiliza un efecto de foco que llama a replace. Los nombres del reducer/reporting en la traza muestran dónde se procesan esos eventos, sin demostrar un defecto interno de Expo.

**Causa confirmada de navegación redundante:** dos propietarios de navegación para la misma invalidación, combinados con presentar logout como una restauración. El flujo podía pasar por retirada de rutas privadas, Redirect del layout, index y transición login → session → login.

**Clasificación del Maximum update depth:** la coordinación anterior es un desencadenante **probable** del bucle observado. No se reprodujo aquí el renderer de Android y no se puede afirmar que sea su única causa. Se corrigió el mecanismo confirmado; la desaparición del error requiere repetir la prueba física. La traza entregada, por sí sola, no permite certificar una causa única más específica.

### Corrección aplicada

1. La raíz declara `unstable_settings.initialRouteName='login'` y pone login primero. El guard raíz continúa protegiendo todo el grupo privado.
2. El layout privado conserva su comprobación, pero devuelve `null` al invalidarse la sesión: no muestra contenido ni emite una segunda acción. El guard raíz es el único responsable de retirar historial privado y elegir el ancla.
3. Logout marca la credencial en memoria como `logoutPending`, incrementa el epoch, aborta peticiones y publica `unauthenticated` **antes de cualquier await**.
4. Después ejecuta el cierre de recursos offline, persiste el marcador y solicita revocación remota. La respuesta HTTP no es necesaria para ocultar la identidad.
5. El bloqueo busy sigue evitando un segundo POST por pulsaciones repetidas. No se añadió navegación imperativa al perfil.
6. El cierre local explícito tampoco utiliza `initializing` para iniciar otra cadena de navegación.
7. Al reanudar la app, AuthProvider no restaura automáticamente una sesión local cerrada o con logout pendiente. Un paso transitorio inactive no inicia una restauración; un retorno real desde background sí revalida una credencial elegible. La secuencia background → inactive → active conserva la marca de background.
8. El epoch y el descarte de respuestas anteriores se preservan. La cuenta nueva no recibe resultados de peticiones emitidas por la anterior.

Expo documenta que al pasar un guard protegido a falso se retiran sus entradas del historial. La prueba real de Atrás sigue siendo necesaria. [Rutas protegidas de Expo](https://docs.expo.dev/router/advanced/protected/).

### Política de conservación y fallos

No se borran bases, claves SQLCipher, paquetes, fotografías ni eventos pendientes al cerrar sesión. Solo se modifica la credencial de sesión conforme al flujo existente y se bloquea el acceso local.

Si falla la persistencia del cierre, la sesión queda cerrada **en memoria**, se evita restaurarla automáticamente durante ese proceso y se avisa que debe reintentarse antes de reiniciar. No se puede prometer persistencia de un marcador que el sistema rechazó guardar. Tampoco se declara revocación remota si no se confirmó. Esta limitación requiere atención si el dispositivo presenta fallos de almacenamiento.

## 2. Biometría: Huawei Y9 y alcance de la comprobación

### Confirmado

- El usuario indica que el lector está averiado y que cuenta con PIN.
- La aplicación usa `SecureStore.canUseBiometricAuthentication()` antes de acceder a la clave.
- La implementación Android instalada consulta `BiometricManager.canAuthenticate(BIOMETRIC_STRONG)`.
- Las operaciones de clave SQLCipher siguen utilizando `requireAuthentication:true`; no se habilitó un reemplazo con PIN.
- El guard biométrico original se ejecuta antes de importar/abrir SQLite y antes de `initializeCipher`.

**El PIN no sustituye la biometría fuerte en este diseño.** Con el lector averiado no se debe permitir descargar listas mediante una excepción de pruebas. Se necesita un sensor compatible operativo y biometría registrada, o un segundo dispositivo compatible. No se afirma que todos los Huawei Y9 sean incompatibles: el dato relevante confirmado es el lector averiado del teléfono probado.

Android distingue biometría fuerte, biometría débil y credencial del dispositivo; no son equivalentes. [Autenticadores biométricos Android](https://developer.android.com/identity/sign-in/biometric-auth).

### Probable y pendiente

El fallo del lector es una explicación **probable y consistente** del resultado negativo. Ese booleano no permite determinar por sí solo si Android informa hardware ausente, hardware temporalmente no disponible, falta de inscripción, actualización de seguridad u otro estado.

No se confirmó en el dispositivo la clase biométrica del sensor, el motivo nativo exacto ni si existía una huella registrada. No se inventó una clasificación de hardware basada únicamente en el nombre del modelo.

### Clasificación A–H

| Caso | Qué se puede saber | Comportamiento |
| --- | --- | --- |
| A. Hardware inadecuado/no disponible | Con false se sabe que no se confirmó disponibilidad; no que no exista hardware. Un error nativo explícito de hardware ausente permite una clasificación más precisa. | Bloquear; usar sensor operativo/dispositivo compatible. |
| B. Biometría no configurada | Solo se afirma si un error nativo informa que no hay biometría inscrita. No se deduce de false. | Indicar inscripción de biometría compatible y bloqueo seguro. |
| C. Cancelación | Se reconoce el prefijo estable de cancelación del error de autenticación del SecureStore instalado. | Mensaje de cancelación; conservar datos y permitir reintento. No confundir un null de clave con cancelar. |
| D. SecureStore/Keystore | Fallo de lectura/escritura/descifrado no identificado como otro caso. | Mensaje saneado; no mostrar keychain, alias, claves o detalles nativos. |
| E. Clave invalidada | Android SecureStore puede devolver null tras invalidación. Con marcador y null solo se confirma que la clave no está disponible; puede ser invalidación o pérdida. | No regenerar ni borrar. Solicitar revisión conservando base/pendientes. |
| F. SQLCipher | Solo se evalúa mediante el PRAGMA real o la apertura cifrada; un fallo biométrico previo no lo diagnostica. | Sin cipher_version válido se mantiene el bloqueo de persistencia. |
| G. Integración/permisos nativos | Error explícito de módulo/operación no disponible u otro fallo de integración. | Revisar APK y manifiesto final; no inventar permiso faltante a partir del booleano. |
| H. Interrupciones/provisión incompleta | Cambio de generación por cierre/bloqueo durante una operación; o clave guardada cuyo marcador falló. | Detener la operación antigua; reparar únicamente el marcador de una clave existente antes de abrir la base. |

El clasificador utiliza códigos y prefijos conocidos del código Android instalado. Un mensaje desconocido produce un error conservador; no se expone el mensaje crudo ni se interpreta como corrupción. No se agregaron logs de datos personales.

Expo documenta que cambios de biometría pueden invalidar material protegido y que los errores del diálogo deben tratarse como resultados de autenticación, no como autorización para borrar datos. [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## 3. Claves y corrección de provisión interrumpida

Se extrajo el tramo de acceso a clave a `protectedKey` para poder probarlo sin Android. La implementación real sigue usando SecureStore con sus mismas opciones protegidas y QuickCrypto para generar 32 bytes aleatorios.

**Fallo de código confirmado:** si se guardaba la clave pero fallaba escribir el marcador scope, el siguiente intento encontraba la clave y omitía crear el marcador. Podía continuar abriendo la base sin esa señal de conservación.

Ahora, antes de devolver la clave para abrir la base:

- Se valida su formato de 64 caracteres hexadecimales.
- Si no existe clave y ya existe marcador, o no hay autorización online, se bloquea sin generar otra.
- Si la clave existe pero falta marcador, se exige guardar ese marcador antes de continuar.
- Si falla la lectura, autenticación, escritura o el marcador, no se devuelve la clave ni se abre la base.
- Se comprueba la generación de acceso después de los awaits; una operación de la cuenta anterior no continúa después de logout/bloqueo.
- No hay delete en la interfaz de provisión y no se borra material para “recuperar” el acceso.
- No se elimina ni se reemplaza una clave existente para probar.

Los flags opening/work y sus finally se mantienen, de modo que un error recuperable permite reintentar. Una clave realmente inaccesible exige revisión; repetir no autoriza regenerarla.

## 4. SQLCipher: diagnóstico independiente y seguro

Se añadió `Comprobar biometría y SQLCipher` en el almacén bloqueado.

La acción:

1. Consulta disponibilidad biométrica con la API existente.
2. Independientemente de ese resultado, abre **una conexión nueva `:memory:`** mediante el expo-sqlite nativo instalado.
3. Ejecuta únicamente `PRAGMA cipher_version` y cierra la conexión.
4. Muestra disponibilidad y una versión numérica saneada, o diferencia “sin respuesta de cifrado” de “error al comprobar”.
5. No utiliza la base de la aplicación, no genera/lee su clave, no ejecuta DDL ni guarda estudiantes, fotografías o eventos.
6. No desbloquea, no cambia permisos y no reemplaza el guard de `initializeCipher`.

Esto permite comprobar el binario incluso en el Huawei sin biometría funcional. No equivale a haber abierto el almacén real o a validar su clave. **La versión de SQLCipher en el teléfono sigue pendiente hasta que el usuario pulse la acción y revise su resultado.**

Se conserva el guard real de `repository.ts`: PRAGMA antes de clave/DDL/PII, error si no hay versión, sin fallback a SQLite plano. Los tests no suministran un resultado ficticio a la implementación nativa: los valores sintéticos se limitan a puertos de pruebas unitarias.

Un error de apertura de base se describe como tal, sin atribuirlo a cancelación biométrica ni afirmar que SQLCipher sea la única causa.

## 5. Login: mensajes basados en el contrato real

Se consultó en solo lectura el backend autorizado `C:\proyecto\oidevs-examenes-backend`:

- `MobileAuthService` rechaza credenciales no válidas mediante 422 genérico, incluyendo ciertas condiciones de cuenta inactiva.
- Solo después de resolver credenciales puede devolver 403 con `MOBILE_OPERATOR_REQUIRED`.
- `PASSWORD_CHANGE_REQUIRED` comunica inequívocamente el cambio de contraseña inicial.
- `MobileLoginRequest` exige identificador de hasta 100 caracteres y contraseña de 8 a 20, además de datos de instalación.

No se cambió el servidor ni el contrato.

| Resultado | Presentación nueva |
| --- | --- |
| 401/422 durante login | “No se pudo iniciar sesión con esos datos. Revisa tu correo o código y tu contraseña.” |
| 403 + MOBILE_OPERATOR_REQUIRED | Falta de acceso móvil y requisito de examen propio/colaboración vigente; consultar administración. |
| 403 + PASSWORD_CHANGE_REQUIRED | Cambiar contraseña inicial en EIDA Web. |
| 403 genérico | El servidor no autorizó el inicio, sin atribuir un rol o motivo no confirmado. |
| Red/timeout | Se conserva el mensaje específico de conexión/espera del cliente HTTP. |
| 5xx | Inicio de sesión temporalmente no disponible; no mostrar detalles recibidos. |
| Campos vacíos/longitudes inválidas | Mensaje individual bajo Correo o Contraseña; sin enviar el formulario inválido. |

La adaptación se limita a `AuthApi.login` y conserva kind/status/code/fields. No se cambió el cliente HTTP compartido ni los permisos del controlador.

Una prueba antigua que esperaba divulgar “cuenta inactiva” por un campo de un 422 fue ajustada para exigir el mensaje genérico del login. No se interpreta un 422 como “es estudiante” ni como prueba de que el correo existe. No se necesitan nuevos códigos backend para las distinciones actuales; cualquier distinción adicional requiere un contrato seguro acordado con Equipo 1.

## 6. Teclado y botón de login

Se agregó una opción footer a Screen, usada por LoginScreen:

- Un único botón Iniciar sesión queda fuera del ScrollView, como hermano del contenido desplazable.
- El formulario, el logo y los demás mensajes siguen en el contenido desplazable.
- El footer usa altura natural y medida onLayout, sin altura fija que recorte fuentes ampliadas.
- El campo enfocado se revela teniendo en cuenta la altura medida del footer.
- ScreenFrame conserva el cálculo existente del solapamiento real con IME y Safe Area.
- El solapamiento se consume una sola vez en el contenedor del footer; el ScrollableContent recibe inset cero en ese modo.
- Si adjustResize ya redujo el viewport, el solapamiento es cero. No se añadió KeyboardAvoidingView ni otra compensación simultánea.
- Las pantallas que no pasan footer conservan su rama anterior.
- Se conservaron logo EidaBrand, paleta, etiquetas de campos, TalkBack y tamaños adaptables.

El manifiesto Android fuente ya contiene `windowSoftInputMode="adjustResize"`. No se modificó. El resultado de teclado, fuentes grandes, 360 dp y TalkBack **requiere validación física**; los tests de geometría/estructura no son una captura del teléfono.

## 7. Archivos modificados o creados

| Archivos | Cambio |
| --- | --- |
| `src/app/_layout.tsx` | Ancla login y orden explícito; Protected conservado. |
| `src/app/(private)/_layout.tsx` | Gate visual conservado sin Redirect competidor. |
| `src/features/auth/session.ts` | Invalidación sincrónica de logout y separación de restauración. |
| `src/features/auth/AuthProvider.tsx` | Restauración solo al retorno elegible desde background. |
| `src/features/auth/resume.ts` | Reglas puras de transición y elegibilidad de revalidación. |
| `src/features/auth/api.ts` | Presentación de errores exclusivamente de login. |
| `src/features/auth/loginFeedback.ts` | Validaciones individuales y mensajes del contrato. |
| `src/screens/LoginScreen.tsx` | Validaciones y CTA en footer. |
| `src/components/Screen.tsx` | Footer opcional que evita duplicar compensación IME. |
| `src/features/offline/nativeVault.ts` | Integración del acceso protegido probado, mensajes saneados y marcador obligatorio. |
| `src/features/offline/protection.ts` | Errores seguros, provisión de clave y diagnóstico mediante puertos. |
| `src/features/offline/nativeProtection.ts` | Adaptador real de diagnóstico de SecureStore/SQLite :memory:. |
| `src/components/control/ProtectionDiagnostics.tsx` | Acción manual y resultados sin datos personales. |
| `src/screens/OfflinePackagesScreen.tsx` | Acción de diagnóstico en almacén bloqueado. |
| `tests/session.test.ts` | Ajuste de expectativa del 422 para no divulgar estado de cuenta. |
| `tests/post-apk-auth.test.ts` | Regresiones de sesión, logout, respuestas antiguas y login. |
| `tests/post-apk-protection.test.ts` | Regresiones de protección y rechazo real de escritura sin cipher. |
| `tests/post-apk-ui.test.ts` | Contratos de navegación/presentación y geometría IME. |
| `docs/EIDA_CONTROL_CORRECCIONES_POST_APK_DEBUG.md` | Este informe. |

No se modificaron outbox, servicios de ingresos/sincronización HU37, distribución/listas HU35, contratos HTTP, cámara/verificador QR, incidencias, disciplina, roles o permisos. La modificación de HU36 se limita al acceso seguro al almacén, diagnóstico y provisión de clave descritos; no cambia descarga, datos, caducidad ni política de reinicio de Android.

## 8. Pruebas escritas y límites

**No ejecutadas.**

Autenticación:

- Logout inmediato sin identidad, una única variación true→false del guard y sin estados initializing.
- Pulsaciones repetidas sin duplicar POST.
- Bloqueo mientras se espera el cierre de recursos de seguridad.
- Fallo de persistencia con aviso y sin restauración automática.
- Respuestas antiguas 200/401 ignoradas tras logout y login de la segunda cuenta.
- Retorno desde background, transiciones inactive y sesión cerrada.
- Campos vacíos, credenciales rechazadas 401/422, código móvil explícito, 403 genérico, red y servidor.

Protección:

- Disponibilidad negativa bloquea generación/escritura/apertura.
- Motivos nativos explícitos de hardware/inscripción, sin inventarlos desde false.
- Cancelación y reintento con la misma clave.
- Lockout y errores de almacenamiento con mensajes saneados.
- Null de clave inválida/perdida con marcador: no regenerar.
- Marcador interrumpido: no abrir base hasta repararlo, sin generar otra clave.
- Sin autorización online no se provisiona una clave nueva.
- Cambio de generación detiene la operación anterior.
- Diagnóstico biométrico y cipher independientes y cierre de conexión.
- El `initializeCipher` real rechaza DDL/escrituras si cipher_version no está disponible.

Interfaz/navegación:

- Root Protected y ancla login; ausencia de Redirect en layout privado.
- CTA único situado en footer y errores individuales conectados.
- Contenido desplazable y footer con inset cero interno.
- Teclado cerrado, abierto con overlay, ya redimensionado y viewport pequeño.
- Altura medida para crecimiento de fuentes, logo y etiquetas conservados.

Las pruebas de presentación inspeccionan la estructura JSX real y funciones de geometría. No montan Expo Router, el teclado Android o TalkBack. La prueba de una variación del guard no equivale a medir una sola acción real del Router. La retirada del historial y ausencia del Maximum update depth deben verificarse físicamente; no se presentan como “tests Android aprobados”.

## 9. Android: cambios propuestos y recompilación

**No se modificó ningún archivo nativo ni se instaló una dependencia.** Se utilizan módulos ya presentes: SecureStore, QuickCrypto, SQLite, Safe Area y Expo Router.

No se propone debilitar el requisito biométrico ni agregar DEVICE_CREDENTIAL como fallback. Hacerlo sería un cambio de política y diseño de claves, fuera de este alcance.

Si el diagnóstico de integración falla en un dispositivo con biometría fuerte operativa:

1. Inspeccionar el manifiesto final del APK: USE_BIOMETRIC y, para compatibilidad de Android anteriores, USE_FINGERPRINT. SecureStore incorpora AndroidX Biometric, que normalmente los fusiona; su ausencia en el manifiesto fuente de app no prueba que falten en el APK.
2. Solo si faltan en el manifiesto final, evaluar con el usuario su declaración explícita en `android/app/src/main/AndroidManifest.xml`:
   `<uses-permission android:name="android.permission.USE_BIOMETRIC" />`
   y la declaración legacy `android.permission.USE_FINGERPRINT` si corresponde al soporte requerido. **No se aplicaron esas líneas.**
3. Confirmar registro y funcionamiento de SecureStore/SQLite/QuickCrypto/reloj en el binario. No ejecutar Prebuild indiscriminadamente.
4. Si no responde cipher_version, revisar la incorporación real de SQLCipher y recompilar con `-Pexpo.sqlite.useSQLCipher=true`, conservando `-Pandroid.cmakeVersion=3.31.6`. No retirar el guard para continuar.

Los cambios realizados son TypeScript/React Native. En un Debug conectado a un servidor de desarrollo, actualizar JS puede bastar para verlos, si el usuario decide hacerlo. Para probar el artefacto instalado con su bundle incorporado, debe generarse una APK nueva con estos cambios. Una actualización de JS no agrega un módulo nativo o SQLCipher ausentes del binario.

Una nueva compilación no repara un lector físico averiado. Tampoco se debe desinstalar la app o cambiar su firma si existen pendientes; conservar firma, instalación y datos.

## 10. Validación manual pendiente

Desde PowerShell, a cargo del usuario:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Después, con el procedimiento de compilación ya acordado y sin cambios automáticos de entorno:

1. En el Huawei, ejecutar “Comprobar biometría y SQLCipher” y registrar únicamente sus estados/versión. Se espera que el acceso a listas continúe bloqueado si no se confirma biometría fuerte.
2. Con sesión online válida, cerrar una vez desde Perfil; debe ir al login sin pasar por validación intermedia.
3. Pulsar Atrás/gesto y probar un enlace a una ruta privada; no deben aparecer datos anteriores.
4. Repetir con peticiones pendientes, pérdida de red y logout remoto pendiente; revisar que no se duplica la transición ni reaparece la cuenta.
5. Ingresar como una segunda cuenta y comprobar aislamiento de todos los datos.
6. Probar credenciales erróneas, falta de asignación comunicada por el código backend, red/servidor y campos vacíos.
7. Abrir Correo/Contraseña a 360 dp y con fuente ampliada: CTA utilizable, campo visible/scroll accesible, sin salto por doble compensación.
8. En otro dispositivo con biometría fuerte operativa: desbloquear, cancelar/reintentar y preparar una lista sintética. Comprobar guard de SQLCipher, fotografías, persistencia y pendientes.
9. Probar background real y retorno durante autenticación; si hay interrupciones repetidas del diálogo, registrar la secuencia de AppState sin datos personales antes de ajustar lifecycle. No se ignoró el bloqueo al ir a segundo plano.
10. Repetir cierre de proceso y reinicio físico por separado. Se conserva la exigencia de revalidar online tras cambiar el boot; no se modificó esa política.

### Pendientes expresos

| Hallazgo | Clasificación | Qué falta |
| --- | --- | --- |
| Navegación redundante original | Confirmado en código; corregido en código | Validar el renderer real. |
| Causa única del Maximum update depth | Probable por la coordinación encontrada | Repetir logout en Android; no se certifica desaparición todavía. |
| Lector averiado y PIN | Confirmado por el usuario | Dispositivo/sensor operativo para validar HU35/HU36 protegido. |
| Motivo Android exacto de biometría | Pendiente | La API boolean no lo comunica; no equiparar false a una causa única. |
| cipher_version del APK instalado | Pendiente | Ejecutar diagnóstico real en el celular. |
| Marcador incompleto de clave | Confirmado en código; corregido | Ejecutar regresión y validar provisión en Android. |
| Teclado/CTA/fuentes/TalkBack | Implementado; pendiente físico | Pruebas en tamaños y teclados reales. |
| Revocación remota | Solo se confirma por respuesta válida | No inferirla de la eliminación local o de estar en login. |

No se ejecutaron npm/npx, Node para scripts, pruebas, typecheck, Expo, Metro, Gradle, Prebuild, ADB, compilaciones, migraciones, instalaciones o Git. No se modificaron Windows, SDK, unidades, junctions, android/, backend ni frontend. No se accedió a producción ni a directorios -compare. No se leyeron secretos ni se imprimieron claves/tokens/contraseñas/fotos/SIS/CI.

