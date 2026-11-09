# EIDA Control · Fase 8 · Bloque A

## Entrega y alcance

Se mantiene la base visual compartida implementada en A y se incorpora navegación real con cuatro pestañas: Inicio, Exámenes, Pendientes y Perfil. Se aplican las ocho capturas aportadas como referencias flexibles, conforme al último prompt. No es necesario consultar Figma MCP en esta entrega. Los fallos anteriores de lectura de Make no se presentan como una validación visual de sus pantallas.

Solo A: tema, componentes compartidos, Safe Area, cabeceras, pestañas, stacks y accesibilidad. Los cuerpos de Login, Inicio, Exámenes y Perfil conservan su implementación; su rediseño corresponde a B. Los detalles y operaciones de C/D tampoco se rediseñaron. Pendientes incorpora exclusivamente el destino estructural necesario para agrupar el acceso a las dos colas existentes.

No se incorporan nombres, exámenes, porcentajes, fechas o contadores de demostración. El selector de rol del prototipo no concede permisos y no se agrega. Tampoco se agrega «Simular actualización». Una sesión autenticada no demuestra conectividad actual: no se muestra un distintivo «En línea» basado en ese supuesto.

## Identidad oficial y sistema visual

Fuente consultada exclusivamente en lectura: `C:/proyecto/oidevs-examenes-frontend/src/assets/styles/global.css`.

| Uso | HEX | Fuente |
| --- | --- | --- |
| Principal / presionado | `#0049a8` / `#002f7a` | brand-cobalt / color-primary-deep |
| Marino y texto principal | `#172554` | brand-navy |
| Carmesí / acento de acción | `#8b1e3f` / `#d9153b` | brand-crimson / color-accent |
| Azul secundario / rosa decorativo | `#2563eb` / `#d67a8c` | brand-blue / brand-pink |
| Fondos suaves | `#eaf3ff`, `#f7e9ed`, `#e9f9f6` | brand-blue-light / brand-pink-light / brand-azure-mist |
| Superficie / blanco cálido | `#ffffff` / `#fafafa` | superficie / brand-white-warm |
| Texto secundario / borde de campo | `#52627a` / `#5b6a80` | color-text-secondary / color-text-muted |
| Borde decorativo | `#dce5f2` | color-border |
| Éxito / advertencia / error | `#15803d` / `#b45309` / `#b91c1c` | roles semánticos del tema |

El logo oficial se identificó en `src/assets/images/eida-logo.svg` de Web, utilizado por Home, Footer y AuthInfoPanel: SVG 760 × 760, con colores propios `#EC1C24` y `#013975`. No se altera, recolorea ni reconstruye a partir de las capturas. Se inspeccionó también `logo-home.png`: es una fotografía del edificio, no el logotipo. No se utiliza como marca.

La cabecera de A usa texto institucional, sin dibujar un logo alternativo. La presentación del SVG oficial se reserva al trabajo de marca/login en B: falta un recurso oficial compatible con Image nativo o un renderer SVG. No se agregó una dependencia solo para esa imagen. Esta limitación queda explícita; no se afirma que el logo ya esté integrado en la cabecera.

Web declara Poppins. En A se mantiene la fuente del sistema Android, sin descargar fuentes, instalar expo-font o desactivar el escalado. Para Poppins en B hacen falta archivos oficiales locales y decidir su carga.

Tokens existentes en `src/config/theme.ts`: escala de espacios 4/8/12/16/20/24/32, radio de controles 12 y tarjetas 20, objetivos táctiles mínimos de 48, botones de altura mínima 54 y contenido centrado de ancho máximo 720. Se permiten varias líneas y altura creciente. No se trasladan medidas de batería, hora o barras del sistema desde la captura.

Componentes compartidos de la base A:

| Componente | Función |
| --- | --- |
| ScreenFrame / Screen | Insets, IME y contenido desplazable sin perder el estado de campos. |
| ListScreen | FlatList sin envolverla en un ScrollView adicional; adopción por las listas en C. |
| AppText / Card | Tipografía y superficies institucionales. |
| ActionButton / FormField | Contraste, estados accesibles, etiquetas, errores y foco. |
| StatusBadge / FeedbackStates / ProgressBar | Estados explícitos, carga, vacío y progreso acotado; no conceden permisos ni prueban conexión. |
| AppHeader / BackButton | Encabezado de contenido y regreso por historial; fallback únicamente si el consumidor lo proporciona. |
| ConfirmDialog / useUnsavedChanges | Confirmación optativa; Atrás cancela y una decisión se resuelve una vez. No conectados automáticamente a formularios de otros bloques. |
| MainHeader / MainTabBar / MainTabIcon | Cabecera adaptable y barra real de las cuatro pestañas; iconos decorativos con trazos nativos, sin fuentes ni nuevas dependencias. |

## Navegación implementada

Estructura actual:

```text
Root Stack — AuthProvider y OfflineProvider únicos, sin cambios
├─ index / login / session / qr-diagnostics
├─ offline Stack — acceso local protegido existente
│  └─ index, list, scan, sync, incidents, report-incident, infraction-draft
└─ (private) Stack — misma guarda canAccessPrivate
   ├─ (tabs) — Expo Router js-tabs, backBehavior="history"
   │  └─ index, exams, pending, profile
   └─ collaborations, devices, offline-distribution, incidents,
      incident, infractions, discipline-actions
```

Las tres envolturas de ruta de Inicio, Exámenes y Perfil se trasladan al grupo sin segmento público `(tabs)`; los módulos de sus pantallas no se modifican. No hay pantallas duplicadas ni barras con botones que simulen el Router.

| Destino | Href compatible / ruta |
| --- | --- |
| Inicio | `/(private)` → `(private)/(tabs)/index` |
| Exámenes | `/(private)/exams` y `/exams` → pestaña exams |
| Perfil | `/(private)/profile` y `/profile` → pestaña profile |
| Pendientes | `/(private)/pending` y `/pending` → pestaña pending |
| Colaboraciones / dispositivos | `/(private)/collaborations`, `/(private)/devices` |
| Examen / distribución HU35 | `/(private)/offline-distribution?examId=…` |
| Paquetes / lista / escáner | `/offline`, `/offline/list?packageId=…`, `/offline/scan?packageId=…` |
| Ingresos HU37 | `/offline/sync` |
| Incidencias locales / formulario / borrador | `/offline/incidents`, `/offline/report-incident`, `/offline/infraction-draft` |
| Incidencias online / detalle | `/(private)/incidents`, `/(private)/incident`, con sus parámetros existentes |
| Infracciones / disciplina | `/(private)/infractions`, `/(private)/discipline-actions` |

Se escribieron pruebas que descubren los archivos reales de rutas y usan el matcher instalado de Expo para comprobar esa compatibilidad; aún no se ejecutaron.

La barra usa las APIs públicas `expo-router/js-tabs` de la versión instalada. Respeta los eventos cancelables tabPress/tabLongPress y llama a navigateToTab con la key existente. No hace push para cada pulsación ni vuelve a navegar si la pestaña ya está seleccionada. El historial de pestañas conserva los destinos visitados sin acumular repeticiones; no se configura popToTopOnBlur.

Los detalles siguen en stacks, fuera de las pestañas. Así mantienen la flecha nativa, el gesto/botón Atrás y el contexto de procedencia, sin llenar la barra con operaciones. Al abrir una cola desde Pendientes se usa el Stack offline existente y su regreso permite volver al destino anterior. No se introducen redirecciones sistemáticas al inicio.

El cierre de sesión y la pérdida de autorización siguen retirando todo `(private)` mediante Stack.Protected. El Stack offline permanece fuera de esa guarda por diseño previo: conserva sus comprobaciones de cuenta, almacén, biometría y concesión local. No se trasladó debajo de la sesión online ni se cambió esa autorización.

El navegador conserva las pantallas montadas mientras sus rutas permanecen en el árbol. No se implementa persistencia nueva del scroll ni se promete restaurarlo después de eliminar una ruta, cerrar el proceso o cambiar de cuenta. El detalle de estudiante actual continúa integrado en la lista. La adopción de ListScreen y los formularios específicos corresponde a C/D.

## Pendientes: agregación de presentación

`PendingOverviewScreen` utiliza exclusivamente runtime, syncItems, incidentItems, busy, error y unlock del OfflineProvider existente.

- Con almacén bloqueado las cantidades son desconocidas; no se informa cero ni se muestran datos de eventos anteriores. El usuario puede ejecutar el desbloqueo existente.
- Con almacén desbloqueado se muestran dos tarjetas: Ingresos e Incidencias. Cada una distingue PENDING, SENDING, CONFLICT y REJECTED.
- CONFIRMED/DUPLICATE de ingresos y REGISTERED de incidencias no se cuentan como pendientes.
- El indicador de pestaña suma PENDING/SENDING de ambas colas. Conflictos y rechazos aparecen como «Revisar» y en su etiqueta accesible; no desaparecen cuando los envíos pendientes llegan a cero.
- Las tarjetas abren `/offline/sync` y `/offline/incidents`. No existe un nuevo botón «Sincronizar todo», endpoint, repositorio, reintento o transporte combinado.
- Los recibos, resultados, mensajes de permisos y acciones de envío continúan en las pantallas existentes. El resumen no interpreta un envío como aceptación oficial.

No se cambia el bloqueo MOBILE_ABILITY_REQUIRED, el carácter provisional de los ingresos, la validación QR v2/v3, los permisos docentes ni las acciones disciplinarias.

## Safe Area, barras, teclado y accesibilidad

El Root conserva SafeAreaProvider con initialWindowMetrics, ThemeProvider y StatusBar de texto oscuro. La configuración de Stack mantiene barras visibles y no utiliza las opciones de color/translucidez de Stack deprecadas para Android 35. No se cambian archivos nativos ni CMake 3.31.6.

MainHeader consume únicamente top/left/right. El cuerpo no duplica el inset superior de su cabecera. MainTabBar consume bottom/left/right con los insets reales y comunica su altura medida a BottomTabBarHeightCallbackContext. No tiene una altura total fija ni posición absoluta que cubra el contenido. TabInsetsContext delega el inset inferior de ScreenFrame a la barra solamente dentro de las pestañas; los stacks hermanos conservan el tratamiento anterior.

La barra inferior se oculta cuando aparece el teclado y notifica altura cero. Al cerrar IME vuelve a medir su altura, incluido el escalado de fuente. El adjustResize existente permanece intacto. ScreenFrame calcula únicamente el solapamiento residual en coordenadas de ventana; no descuenta el teclado dos veces. Screen conserva el componente y desplaza el campo enfocado sin copiar su valor. Las ref de FormField permiten continuar el foco en los bloques posteriores.

Las pestañas tienen rol tab, estado selected, etiqueta en español y objetivo mínimo 48 dp. El icono es decorativo; texto, selección y contadores no dependen solo del color. No se recortan etiquetas con numberOfLines ni se desactiva el escalado. Los contadores también aparecen en la etiqueta para TalkBack. La cabecera crece con su texto; botones/tarjetas conservan altura mínima y ajuste de líneas.

La comprobación física de teclado, contraste de las barras nativas, TalkBack, gestos y escalado sigue pendiente. La base no acredita que cada formulario o lista previa de B/C/D ya esté adaptado.

## Archivos de esta actualización

Nuevos:

- `src/app/(private)/(tabs)/_layout.tsx`
- `src/app/(private)/(tabs)/index.tsx`
- `src/app/(private)/(tabs)/exams.tsx`
- `src/app/(private)/(tabs)/profile.tsx`
- `src/app/(private)/(tabs)/pending.tsx`
- `src/navigation/TabInsetsContext.ts`
- `src/navigation/mainTabs.ts`
- `src/components/MainHeader.tsx`
- `src/components/MainTabBar.tsx`
- `src/components/MainTabIcon.tsx`
- `src/ui/pendingSummary.ts`
- `src/screens/PendingOverviewScreen.tsx`
- `tests/main-tabs.test.ts`

Modificados:

- `src/app/(private)/_layout.tsx`: el grupo de pestañas sustituye las tres declaraciones principales.
- `src/components/ScreenFrame.tsx`: propiedad opcional del inset inferior heredada del navegador.
- Este documento, `docs/EIDA_CONTROL_FASE_2_EXPO_QR.md` y `docs/HISTORIAL_FASE_2.md`.

Las antiguas envolturas `src/app/(private)/index.tsx`, `exams.tsx` y `profile.tsx` se retiran de esa ubicación para evitar rutas duplicadas; conservan su función en `(tabs)`. Los componentes HomeScreen, ExamsScreen y ProfileScreen no cambian.

Inventario de la base A previa, conservada en esta actualización: `src/config/theme.ts`; `src/ui/presentation.ts`, `dialogDecision.ts`; `src/navigation/options.ts`, `back.ts`, `useUnsavedChanges.ts`; root/offline layouts; `components/Screen.tsx`, `ListScreen.tsx`, `FormField.tsx`, `keyboardFocus.ts`, `ActionButton.tsx`, `AppText.tsx`, `Card.tsx`, `StatusBadge.tsx`, `FeedbackStates.tsx`, `ProgressBar.tsx`, `AppHeader.tsx`, `BackButton.tsx`, `ConfirmDialog.tsx`, `contentStyles.ts`, `DiagnosticCaseCard.tsx`; `tests/design-system.test.ts` y `tests/navigation.test.ts`.

No se modifican package.json, lockfile, android/, servicios, contratos, almacenamiento, autenticación, QR/cámara ni pantallas previas de B/C/D. Web se consultó exclusivamente en lectura; no se accedió al backend en esta actualización.

La comparación de huellas antes/después confirmó sin cambios los 66 archivos preexistentes incluidos en la comprobación: src/features, src/screens, package.json, package-lock.json y los tres archivos nativos seleccionados (gradle.properties, app/build.gradle y AndroidManifest.xml). La nueva pantalla de resumen se agrega sin editar las pantallas previas. Esta comparación es una inspección de archivos, no una ejecución de pruebas.

## Pruebas escritas, no ejecutadas

`tests/main-tabs.test.ts` agrega seis casos:

1. Hrefs anteriores y URLs públicas resueltos por el matcher real, con grupos sin segmento público.
2. Detalles y offline fuera de las pestañas, conservando parámetros.
3. Historial del TabRouter instalado: selección, repetición, Atrás y contexto de la ruta.
4. Evento cancelable y ausencia de navegación repetida al seleccionar la pestaña actual.
5. Conteos independientes, exclusión de recibos terminales aceptados, conflictos/rechazos y ausencia de mutación.
6. Retirada del subárbol de pestañas al perder la autorización privada.

La base previa conserva sus 13 casos en design-system/navigation: contraste, botones, Safe Area, IME, progreso, barras, diálogo, reducer Stack real, regreso con parámetros y guardas de sesión. No se cambiaron pruebas funcionales anteriores ni se reemplazaron repositorios reales por simulaciones.

Los tests nuevos usan utilidades/reducers puros instalados de Expo Router; la app usa APIs públicas. Al actualizar Expo habrá que revisar los imports internos de los tests. No son pruebas de renderizado RN, teclado físico ni TalkBack.

Ninguna prueba, typecheck, instalación, compilación u operación Git se ejecutó. La inspección de fuentes y huellas de archivos no sustituye su ejecución.

## Dependencias y comprobación manual

A no agrega dependencias, no cambia el lockfile y no requiere Prebuild por sus cambios JS/TS. La instalación actual sigue sin `node_modules/expo-camera/package.json`, aunque expo-camera ya está declarado desde la fase 6. Esa dependencia previa puede impedir typecheck o arrancar la app. No se resolvió instalando paquetes ni retirando la cámara del código. Tampoco hay renderer SVG ni expo-font instalados; no se importan en A.

Comandos a ejecutar personalmente, desde una instalación que tenga resueltos sus paquetes declarados:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Con una development build compatible ya instalada:

```powershell
npm run start
```

No se genera una APK ni se toca CMake. Una development build antigua sin los módulos nativos necesarios de fases anteriores sigue requiriendo su procedimiento nativo propio; A no lo sustituye.

Lista manual en Android:

1. Probar las cuatro pestañas; pulsar repetidamente la activa. Cambiar Inicio → Exámenes → Pendientes y comprobar Atrás por destinos visitados.
2. Abrir dispositivo/detalle/distribución desde su pantalla; abrir lista, estudiante integrado y escáner; regresar al contexto anterior. Comprobar búsqueda y posición visual, sin asumir que un test de parámetros prueba el scroll.
3. Probar inicio directo/deep links anteriores con sus IDs; no duplicar cabeceras ni redirigir todos los regresos a Inicio.
4. Probar Pendientes bloqueado/desbloqueado, cero eventos, ambas colas con envíos y solo conflictos/rechazos. Revisar cada cola y sus permisos sin confirmar ingresos por un cambio visual.
5. Logout, expiración/revocación y cambio de cuenta: sin regreso a pestañas privadas ni contadores de otra cuenta. El acceso offline mantiene sus controles anteriores.
6. Pantalla 360 dp, orientación horizontal, fuente normal/ampliada/200%, TalkBack, texto largo, navegación de gestos y tres botones.
7. Abrir/cerrar teclado en login y formularios existentes; comprobar foco, texto preservado, botón accesible e insets sin duplicación. La cámara/biometría pueden bloquear el almacén por la política previa de segundo plano.

## Trabajo pendiente por bloques

| Bloque | Pendiente |
| --- | --- |
| B | Rediseñar Login, Inicio, Exámenes y Perfil con datos reales; integrar logo oficial compatible y decidir Poppins local; ayuda institucional solo con destino real. No agregar el selector de roles de demostración. |
| C | Rediseñar centro de examen, distribución, preparación offline, lista virtualizada y detalle integrado. Reutilizar servicios HU35/HU36, vencimientos, búsqueda y permisos. No agregar «Simular actualización». |
| D | Rediseñar cámara/revisión/ingreso, ambas colas existentes, incidencias y disciplina. Adoptar diálogos y protección de formularios donde corresponda sin bloquear límites de seguridad. Mantener ACK, conflictos, rechazos y MOBILE_ABILITY_REQUIRED explícitos. |

La navegación y el resumen estructural de Pendientes quedan en A; sus pantallas operativas siguen pendientes de D.
