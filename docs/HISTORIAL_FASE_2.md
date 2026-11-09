# EIDA Control — informe acumulado de fase 2

Actualizado el 7 de noviembre de 2026, America/La_Paz. Incluye lo realizado en los prompts anteriores de fase 2 y en la sesión actual exclusivamente de código. No incluye como trabajo de fase 2 la implementación backend de fase 1.

## 1. Estado final real

| Área | Estado |
| --- | --- |
| Base Expo/React Native/TypeScript y navegación | Código preparado |
| Verificador RS256 y diagnóstico | Implementados; revisión estática actual |
| Vectores empaquetados | 10 originales PHP + 19 adicionales PHP |
| Pruebas actuales | 44 escritas; NO ejecutadas en la sesión actual |
| Resultado histórico de escritorio | 40 aprobadas antes de los últimos cambios |
| Verificación dentro de Android | Pendiente de ejecución por el usuario en celular |
| APK/AAB | No generado |
| Login y operaciones de producción | No conectados |
| Git móvil | No inicializado por el asistente |

## 2. Lo realizado en los prompts anteriores de fase 2

### Código y documentación

1. Se inspeccionaron, solo en lectura, fase 1, el prototipo Laravel, su contrato real y los vectores de interoperabilidad; también se tomó la paleta pública del frontend.
2. Se creó el proyecto móvil independiente, inicialmente inexistente, sin copiar pantallas web ni alterar los repositorios existentes.
3. Se configuraron Expo SDK 58, React Native 0.88.1, React 19.3.0, TypeScript, Router, identidad Android bo.eida.control.dev, orientación, tema y development client.
4. Se declararon dependencias y perfiles EAS development/internal preview. No se utilizó una cuenta ni un servicio de compilación externo.
5. Se crearon pantalla inicial, pantalla Verificación QR v3, componentes comunes y rutas; se separaron configuración, tipos, utilidades, verificador, adaptador nativo y diagnóstico.
6. Se implementó el contrato RS256: cabeceras exactas, kid confiable, firma de segmentos originales, claims, IDs de 64 bits como strings, examen/estudiante esperado y expiración con reloj inyectable.
7. Se conservó byte por byte el fixture público original de PHP y se incorporaron 19 casos adicionales. Para estos últimos se ejecutó un generador PHP que usa el prototipo Laravel sin arrancar la aplicación ni cargar .env; generó una clave efímera en memoria y persistió solo pública y tokens sintéticos.
8. Se preparó QuickCrypto con sus peers nativos, sin fallback Node/browser en la app, sin Expo Go como sustituto y sin descargar claves de direcciones del QR.
9. Se escribió una suite inicial de 40 pruebas de escritorio, con proveedor Node/OpenSSL, independiente del adaptador nativo.
10. Se añadieron informes de diagnóstico compartibles, registro fragmentado para logcat, ruta autorun y un lector manual de informes ADB. No se obtuvo todavía ningún informe ejecutado en Android.
11. Se creó una validación de URL HTTPS para el cliente futuro, sin conectar con producción. No se implementaron login, almacenamiento seguro, SQLite, cámara, listas, incidencias o sincronización.
12. Se escribieron README, documentación de fase 2, scripts de comprobación/compilación y exclusiones Git para herramientas, generación, secretos y artefactos.

### Instalaciones, descargas y entorno anteriores

Estas acciones **sí ocurrieron antes de la restricción de solo código**. Se conservan; no se repitieron ni desinstalaron ahora.

| Recurso | Acción anterior y finalidad |
| --- | --- |
| Dependencias npm | Se instalaron Expo, React Native, QuickCrypto, Nitro, Quick Base64 y dependencias de navegación/desarrollo en node_modules; se generó package-lock.json. |
| React DOM | Se corrigió un conflicto de peers fijando 19.3.0, igual que React; se reinstalaron dependencias sin force/legacy-peer-deps. |
| Node 22.23.1 local | Se descargó mediante el paquete node dentro de `.tools/node`. El Node global 20.19.0 no se reemplazó. |
| SDK base / Android Studio | Ya instalados por el usuario al retomar. Ubicación usada: `C:/Users/HP/AppData/Local/Android/Sdk`. No se atribuye su instalación al asistente. |
| JDK de Android Studio | Se usó el JBR 25.0.4 ya existente para los procesos de compilación. No se instaló Java ni se cambió JAVA_HOME persistente. |
| Gradle 9.4.1 | El wrapper descargó la distribución y dependencias a la caché del usuario, habitualmente `C:/Users/HP/.gradle`. |
| NDK 27.1.12297006 | Gradle lo descargó e instaló en `Sdk/ndk/27.1.12297006`, con la licencia SDK previamente aceptada, para compilar código nativo. |
| Imagen Android API 36 | Se descargó AOSP ATD x86_64 a `Sdk/system-images/android-36/aosp_atd/x86_64` para la prueba en emulador. |
| AVD EIDA_Control_Phase2 | Se creó y se inició en modo headless. Permaneció sin conexión ADB utilizable durante el intento; se detuvo para liberar memoria. No se ejecutó EIDA en él. |
| CMake | No llegó a instalarse durante esos intentos. Su estado posterior queda a revisión manual del usuario. |
| Variables de proceso | Se seleccionaron temporalmente Node/JDK/SDK y se limitó paralelismo para los comandos. No se modificaron variables persistentes de Windows. |

Las descargas ocupan espacio normal de archivos. No se creó ni cambió ninguna partición del disco.

### Comandos, verificaciones e intentos anteriores

- Se ejecutaron instalaciones npm y consultas de dependencias. npm ls y expo install --check terminaron sin conflictos después del ajuste de React DOM.
- Se ejecutaron typecheck de aplicación/pruebas y 40 pruebas TS con Node/OpenSSL; se reportaron todas aprobadas. Son resultados del código de entonces.
- Se ejecutó Expo prebuild, que generó android/ y archivos de plantilla, incluida su firma Android de desarrollo. Esa firma de prueba no es una clave privada QR del backend.
- Se detectaron SDK, Java, ADB, aceleración WHPX y herramientas Android; se utilizaron comandos de SDK/AVD/emulador y consultas ADB para intentar disponer de Android.
- Se intentó compilar localmente. Un primer comando manual tuvo problemas de argumentos PowerShell. Otro build falló al ejecutar autolinking en la raíz de una unidad virtual; Expo omitía buscar package.json en esa raíz.
- Se corrigió entonces el acceso de compilación mediante una junction y se volvió a intentar. Se compilaron plugins Gradle/Kotlin y se instaló el NDK, pero el usuario detuvo el trabajo antes de finalizar el APK.
- Se investigó autolinking con un script temporal y se conservaron logs en .artifacts. Ninguna de estas acciones constituye una prueba RS256 ejecutada en Android.
- Se consultaron documentación oficial de Expo y QuickCrypto y las declaraciones/código de los paquetes instalados.
- Se leyeron estado, ramas, HEAD e índices Git de backend/frontend para comprobar preservación. No se inicializó Git móvil, no se cambiaron ramas/HEAD/staging, no se hicieron commits ni operaciones remotas.

### Unidad virtual y detención solicitada

Se utilizó **SUBST R:** como acceso corto al proyecto y después a su carpeta `.tools`; se creó `.tools/project` como junction al mismo proyecto. No era una partición, no se reservó espacio de partición ni se movieron los repositorios.

Cuando el usuario pidió parar, se canceló la compilación, se verificó que no quedaran los procesos propios de build, se retiró la unidad R: y se eliminó la junction temporal. No se desinstalaron Node, NDK, la imagen, el AVD ni las dependencias.

## 3. Sesión actual: exclusivamente código

### Archivos creados

- `AGENTS.md`: deja persistente la restricción de solo código y ejecución manual por el usuario.
- `docs/HISTORIAL_FASE_2.md`: este informe acumulado.

### Archivos modificados

| Archivo | Cambio actual |
| --- | --- |
| src/features/qr/verifyQrV3.ts | Ajuste del orden de rechazo cabecera/kid/firma al backend; respuestas no booleanas del proveedor fallan con CRYPTO_UNAVAILABLE. |
| src/screens/QrDiagnosticsScreen.tsx | Un conjunto vacío no puede mostrar éxito. |
| tests/qr-v3.test.ts | Cuatro pruebas nuevas, cobertura de kid sin invocar criptografía y prueba determinista del reloj por defecto; suite escrita de 44 casos. |
| scripts/build-android.mjs | Eliminados SUBST, junctions, selección automática de Node/JDK y cambios de variables. Usa la ruta real y herramientas elegidas por el usuario; desactiva descarga SDK por AGP. No ejecutado. |
| scripts/check-android.mjs | Inventario por lectura; retirado el lanzamiento de ADB. No ejecutado. |
| scripts/collect-android-report.mjs | Validación de fragmentos, informe más reciente completo, API Android, hash y expectativas; exige SDK y dispositivo explícitos. No ejecutado. |
| .artifacts/probe-autolink.mjs | Deshabilitado el antiguo experimento: se retiraron todos los comandos y operaciones sobre unidades, conservando el archivo. |
| metro.config.js | Comentario actualizado; se mantienen las exclusiones .tools/.artifacts. |
| README.md | Estado honesto, nueva regla y enlaces a documentación e historial. |
| docs/EIDA_CONTROL_FASE_2_EXPO_QR.md | Reescrito para revisión estática, resultados históricos separados y procedimiento manual PowerShell completo. |

No se modificaron dependencias, package.json, package-lock.json, fixtures, node_modules ni archivos nativos generados. La huella SHA-256 del lockfile conservado es `E8DBBC8867411F86B44F4271E8922CFFEBCA4A8457B5DA4C550209663B8AB963`.

### Revisión realizada ahora

Se leyeron fuentes/configuraciones, contrato Laravel, tests, README/tipos de QuickCrypto 1.1.9 y versiones declaradas. Se contrastaron las firmas de API sin ejecutar la biblioteca. Se revisaron estáticamente los cambios y las instrucciones manuales. No se presentan como resultados nuevos las ejecuciones de la sesión anterior.

**Pruebas, typecheck y scripts actuales: NO ejecutados.** No se instalaron/descargaron herramientas, no se compilaron APK/AAB, no se crearon/iniciaron emuladores, no se ejecutaron ADB/Expo/Gradle/npm/Node, no se alteraron unidades/enlaces/variables del sistema y no se realizaron operaciones Git. No se desinstaló nada.

## 4. Inventario completo del código de fase 2

Todos los archivos fuente/configuración y su estructura se enumeran en [el árbol de la documentación principal](EIDA_CONTROL_FASE_2_EXPO_QR.md#b-arquitectura-y-archivos). Salvo AGENTS.md y este historial, todos esos archivos ya existían al comenzar la sesión actual; los diez modificados se detallan arriba. El resto se conservó.

Los directorios generados o de dependencias contienen muchos archivos de terceros; se identifican por directorio y finalidad, sin atribuirlos como código escrito a mano: node_modules, .tools/node, android, cachés y logs .artifacts. No se eliminaron esos contenidos.

## 5. Preservación de backend/frontend

En toda la fase 2, backend y frontend se trataron como solo lectura. No se hicieron migraciones, seeders, cambios a .env ni peticiones de producción.

La última comprobación de preservación se realizó **antes de la sesión exclusivamente código**, con los siguientes valores iguales a los iniciales de fase 2:

| Repositorio | HEAD / índice SHA-256 |
| --- | --- |
| Backend, main | ca126a63af4c3dfe1faa14b2dec38c5960bb4273 / DF856E45A5C95582E38183E60371CA82D640E302699D76510CD7AD34BA3085DA |
| Frontend, main | ad444911e2fb694614a05daeaa6f81776fe6f4c8 / 7AA3B09D75ECFE5A19C9F0603CB585A1BB92649848DFE7C43410CED433232E53 |

Huellas agregadas históricas de archivos versionados/no ignorados:

- Backend: `2E2AF34568351BC130F45BDC5EC0D4BEDD2193DF6AE698AF02CD5289BF4B0A3F`.
- Frontend: `37A4E81B0842E09F6C454B7F5B08C752BDC4DACBE2DF2D839602ACE6BD44781F`.

Los cambios backend de fase 1 ya existentes se conservaron. No se repitieron comandos Git en la sesión actual.

## 6. Trabajo que corresponde al usuario

El procedimiento PowerShell está en [la documentación principal](EIDA_CONTROL_FASE_2_EXPO_QR.md#g-procedimiento-manual-powershell-en-windows): versiones Node/Java, dependencias, SDK, dispositivo físico, development build, Metro, pruebas de escritorio, diagnóstico real y generación posterior de APK.

Pendientes: ejecutar las 44 pruebas/typecheck, completar compilación nativa en la ruta real, verificar 29/29 en celular y guardar evidencia, generar y probar un APK autónomo sin red. Después podrán abordarse login HTTPS/Sanctum, SecureStore, HU36, SQLite cifrado, cámara, incidencias y HU37.

## Referencia posterior: fase 6 (solo código)

El párrafo anterior conserva los pendientes históricos de aquella sesión. La cámara ahora tiene integración fuente documentada en [Fase 6](EIDA_CONTROL_FASE_6_CAMERA_QR.md), sobre HU36/HU37 existentes. El usuario confirmó posteriormente el verificador QR v3 en Android y las pruebas de fase 4; esos resultados no se atribuyen a las nuevas pruebas de cámara o fase 5. En fase 6 no se ejecutaron instalaciones, pruebas, comandos Git, Prebuild, compilaciones ni cambios de Windows, `android/` o lockfile. La cámara física y la APK independiente continúan pendientes.

## Referencia posterior: fase 7 (solo código)

Se escribió la integración de incidencias y acciones disciplinarias descrita en [Fase 7](EIDA_CONTROL_FASE_7_INCIDENCIAS.md). Se conserva el historial anterior: no se atribuye aprobación a las nuevas pruebas. En esta fase no se ejecutaron instalaciones, pruebas, compilaciones, migraciones, Git, despliegues ni modificaciones del sistema. La política central de tokens disciplinarios queda pendiente de coordinación expresa y permanece sin cambios.

## Referencia posterior: fase 8, bloque A (solo código)

Se desarrolló la base compartida de presentación y navegación descrita en [Fase 8, bloque A](EIDA_CONTROL_FASE_8_IMPLEMENTACION_FIGMA.md). La actualización con capturas flexibles incorpora Inicio, Exámenes, Pendientes y Perfil mediante Expo Router; agrega únicamente un resumen de navegación hacia las dos colas existentes. No se tocaron las fuentes QR/cámara, servicios ni pantallas previas de los otros bloques. La integración visual de logo/Poppins y las comprobaciones Android siguen pendientes. No se ejecutaron pruebas, instalaciones, compilaciones, Git o modificaciones del sistema; los resultados históricos previos no se atribuyen a estas pruebas nuevas.

## Referencia posterior: fase 8, bloque B (solo código)

El usuario informó que typecheck y todas las pruebas de A pasan con Node.js 22; ese resultado no se atribuye a B. Se rediseñaron únicamente Login, Inicio, Exámenes y Perfil, como documenta [Fase 8](EIDA_CONTROL_FASE_8_IMPLEMENTACION_FIGMA.md). Se escribieron diez casos sin ejecutarlos. Se copió sin alterar el SVG oficial; su visualización y Poppins requieren recursos/soporte compatibles y no se instalaron dependencias. No se modificaron servicios, QR/cámara, Android, backend, frontend ni entorno. No se ejecutaron pruebas, compilaciones, Git o instalaciones y no se comenzaron C/D.

## Referencia posterior: fase 8, bloque C (solo código)

Se implementó el rediseño de centro de examen/HU35, preparación HU36 y lista/ficha de estudiante descrito en [Fase 8](EIDA_CONTROL_FASE_8_IMPLEMENTACION_FIGMA.md). Se conserva el historial: solo A tiene una confirmación explícita de pruebas del usuario en esta conversación; los trece casos de C no fueron ejecutados por el asistente. Se preservaron servicios, contratos, SQLCipher, QR, cámara, outbox y sincronización; ListScreen recibió una extensión compatible para foco/teclado. No se modificaron Android, Windows, backend o frontend y no se ejecutaron instalaciones, pruebas, compilaciones o Git. El Bloque D sigue pendiente.

## Referencia posterior: fase 8, bloque D (solo código)

Se implementó la presentación de QR/confirmación, Pendientes, sincronización, incidencias, infracciones y disciplina descrita en [Fase 8](EIDA_CONTROL_FASE_8_IMPLEMENTACION_FIGMA.md). Se escribieron catorce casos sin ejecutarlos; la confirmación previa de A no se atribuye a B/C/D. Se conservan los servicios y reglas de las fases anteriores. Los únicos ajustes de integración A/C son certeza del contador y mensajes de registro manual/local. Los hallazgos de revalidación/formularios y habilitación móvil se documentaron fuera del rediseño, sin cambiar backend o guardas. No se ejecutaron instalaciones, pruebas, Git, compilaciones, despliegues o cambios nativos/del sistema; no se generó APK ni se inició otro rediseño.

## Referencia posterior: cierre visual e identidad de fase 8

Se integró la marca oficial mediante PNG transparente renderizado fielmente del SVG local, usando capacidades gráficas existentes y escribiendo solo el recurso en assets/brand. No se descargaron o instalaron herramientas. Se mantuvo la fuente del sistema porque faltan recursos locales de Poppins y expo-font. Los ajustes de formulario son de memoria/interfaz: preservan campos y barrera de envío durante revalidaciones de la misma autorización, sin cambiar los servicios ni conservar datos accesibles tras denegación. Se escribieron siete casos sin ejecutarlos y se documentaron los pendientes Android en [Fase 8](EIDA_CONTROL_FASE_8_IMPLEMENTACION_FIGMA.md). No se ejecutaron instalaciones, pruebas, typecheck, Expo, Git, compilaciones o cambios de entorno/nativos. No se generó APK; los resultados históricos anteriores no se atribuyen a este cierre.
