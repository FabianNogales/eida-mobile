# EIDA Control · Fase 8 · Bloques A–D y cierre visual

## Estado actual del cierre

**Logo integrado en UI** mediante PNG transparente derivado fielmente del SVG original, sin dependencias nuevas. **Poppins pendiente** de archivos locales/licencia y expo-font; se mantiene la fuente del sistema. Se corrigieron inconsistencias puntuales y el reinicio de campos durante revalidaciones temporales de Infracciones, sin modificar servicios ni guardas. Hay siete pruebas nuevas escritas, no ejecutadas.

Los apartados B/C/D siguientes se conservan como registro histórico. El estado actual de recursos, formulario y archivos está en «Cierre visual e identidad institucional» al final.

## Registro de las entregas

El usuario confirmó que ejecutó personalmente `npm run typecheck` y `npm test` con Node.js 22 y que todas las pruebas del Bloque A pasan. Ese resultado pertenece a la versión anterior a esta entrega.

En B se implementaron Login, Inicio, Exámenes y Perfil sobre A y se escribieron diez casos sin ejecutarlos. La conversación disponible no contiene una confirmación expresa del resultado de B; no se le atribuye el resultado anterior de A.

En C se implementaron centro del examen, distribución HU35, preparación HU36, lista y ficha de estudiante y se escribieron trece casos sin ejecutarlos. Tampoco se atribuye a C la validación anterior de A.

En D se implementaron **QR/confirmación, Pendientes, sincronización, incidencias e interfaces disciplinarias**. Se escribieron catorce casos nuevos, sin ejecutarlos. No se ejecutaron typecheck, pruebas, instalaciones, scripts, Expo, Prebuild, compilaciones, Git o comandos nativos. Los registros de B/C se conservan a continuación; D, su inventario y hallazgos están al final.

## Referencias y colores

Se usan las ocho capturas aportadas en la conversación como referencias flexibles: Login; Inicio y su continuación; Exámenes; Pendientes; centro de operaciones y su continuación; paquete offline. B toma composición del login, saludo/identidad, tarjeta de examen activo, indicadores operativos y tarjetas de examen. Perfil no tenía una captura propia: se compone con el mismo sistema de tarjetas y jerarquía. Las imágenes de operaciones/preparación orientan la coherencia visual; esas pantallas se incorporan en la entrega C documentada al final. No se consultó Figma MCP ni se afirma fidelidad píxel a píxel.

Fuente institucional consultada solo en lectura: `C:/proyecto/oidevs-examenes-frontend/src/assets/styles/global.css`. B utiliza exclusivamente los tokens ya existentes de `src/config/theme.ts`, sin otra paleta:

| Rol | Valores |
| --- | --- |
| Principal / presionado | `#0049A8` / `#002F7A` |
| Marino / texto | `#172554` |
| Carmesí / acento de acción | `#8B1E3F` / `#D9153B` |
| Fondo / superficie | `#EAF3FF` / `#FFFFFF` |
| Texto secundario / borde de campo | `#52627A` / `#5B6A80` |
| Borde decorativo | `#DCE5F2` |
| Éxito / advertencia / error | `#15803D` / `#B45309` / `#B91C1C` |

Se conservan los demás colores semánticos, espaciados 4–32, tarjetas de radio 20, controles de radio 12 y objetivos de al menos 48 dp de A. La tarjeta activa usa marino y acento carmesí; no añade un azul institucional alternativo.

## Logo oficial y Poppins: disponibilidad real

Se copió **sin alteraciones** el SVG original autorizado de Web a `assets/brand/eida-logo.svg`. La comparación de huellas confirmó igualdad. Origen: `src/assets/images/eida-logo.svg` de Web, utilizado por Home, Footer y AuthInfoPanel. No se reconstruyó ni recoloreó. Sus colores propios son `#EC1C24` y `#013975`; no se reemplazan por los tokens de los botones.

**El SVG todavía no se renderiza en la interfaz.** No se encontró renderer SVG declarado/instalado. Se evita cargarlo mediante Image de RN Android, porque esa solución no proporciona soporte SVG por sí sola. `EidaBrand` muestra el nombre de la aplicación en texto, como alternativa compatible; no dibuja un logo sustituto.

Para representar el recurso hacen falta un PNG oficial compatible derivado del original, o decidir una integración como react-native-svg. No se agregó ni instaló esa dependencia, no se añadió transformador Metro y no se modificó Android. `assets/brand/README.md` deja documentado ese límite.

Web declara Poppins en CSS, pero no se encontraron archivos locales de esa fuente en los recursos autorizados de Web/móvil. No hay expo-font instalado/declarado en este proyecto. Se mantiene la fuente del sistema, sus pesos y el escalado. No hay descargas remotas, bloqueo al arrancar ni cambio de distribución durante una carga de fuente. Poppins queda pendiente de archivos oficiales/licencia y mecanismo de carga compatible.

## Pantallas implementadas

### Login

- Marca de texto, título «Control de ingreso» y tarjeta de acceso institucional.
- Identificador y contraseña con los mismos límites y propiedades de autocompletado anteriores.
- «Siguiente» pasa al campo contraseña; «Ir» conserva el envío existente.
- Mostrar/ocultar contraseña sin reemplazar el input ni guardar su contenido fuera del estado local. Al enviar se limpia y vuelve a ocultar, manteniendo la llamada al controller original.
- Indicadores busy y mensajes originales del proveedor de sesión, incluidas credenciales incorrectas, red, cuenta inactiva, vencimiento y restricciones.
- Ayuda local explicativa; no se inventa endpoint de recuperación ni enlace institucional.
- Acceso offline y diagnóstico conservados.
- La revocación pendiente conserva Reintentar/Olvidar local; esta última requiere ConfirmDialog y advierte que no confirma revocación remota.

La función de presentación reproduce los destinos anteriores de Login y reutiliza canAccessPrivate. No se cambia Sanctum, validación de credenciales, almacenamiento o recuperación de sesión. No hay selector de rol de demostración ni valores precargados.

### Inicio

- Identidad autenticada, iniciales derivadas del nombre y roles exactamente disponibles en la sesión.
- Exámenes propios mediante `teacherExams(controller, 'upcoming', 1, signal)`; colaboraciones mediante `collaborations(controller, signal)`, en secciones independientes.
- Solo un estado oficial **IN_PROGRESS** de la página recibida produce la tarjeta «En desarrollo». Su acción abre la ruta existente de distribución/examen.
- Si no hay uno en la página, se muestra el primer examen de esa consulta sin inferir que esté activo.
- Se explicita que es la página inicial, hasta 10 registros; el total proviene de meta.total. No se afirma haber buscado activos en todas las páginas.
- Colaboraciones muestra hasta dos asignaciones y un enlace a la lista existente. La API no entrega su estado: no se inventa IN_PROGRESS ni se convierten en docencia.
- Indicadores locales del OfflineProvider: copias activas PREPARADO, PENDING/SENDING de ambas colas y conflictos/rechazos. Si está bloqueado se indica «Por consultar», nunca cero ficticio.
- El estado de copia corresponde al último refresco; vigencia, reloj, autorización y biometría se comprueban mediante los flujos originales al abrir.
- No hay porcentajes, tasa de ingreso, conteos de estudiantes ni conectividad inferidos.
- La revalidación se muestra con su fecha, no como prueba de internet continuo.

Los errores de cada consulta tienen mensaje y reintento. Un 403 de docencia no se convierte en éxito ni se usa para borrar colaboraciones. Los errores que el controller existente convierte en offline/expired/recoverable-error siguen la navegación de sesión ya implementada.

### Exámenes

- Única FlatList de ListScreen; no se anida en otro ScrollView.
- Filtros adaptables con semántica radio: próximos/activos, pasados, cancelados, todos. Conservan los valores HTTP existentes.
- Tarjetas con nombre, materia/código si existen, fecha/hora de America/La_Paz, duración, estado oficial, ambiente y procedencia de docencia.
- Disponibilidad local obtenida del almacén: bloqueado, sin copia, preparada, incompleta, vencida, desactualizada o error. «Preparada» no concede autorización ni evita las verificaciones al abrir.
- «Abrir examen» conserva `/(private)/offline-distribution?examId=…`.
- «Consultar incidencias y permisos» conserva la ruta anterior. La etiqueta no promete permiso disciplinario; el servidor y la pantalla existente comprueban la habilitación móvil. MOBILE_ABILITY_REQUIRED sigue siendo error.
- Colaboraciones conserva su destino independiente y no se mezcla en el paginado de docencia.
- Paginación anterior/siguiente y meta originales. Cambiar vista reinicia página; cambiar vista/página crea una frontera de consulta que no muestra los resultados de la selección anterior mientras llega la nueva.
- Carga, vacío y error diferenciados, con reintento sin datos simulados.

### Perfil

- Identidad real, correo, estado de cuenta y funciones disponibles; no se muestran secretos.
- Última validación y vencimiento de la sesión. Se conserva `controller.restore()`.
- Consulta de dispositivos mediante el servicio existente `devices()`: cantidades ACTIVE/REVOKED y nombre del dispositivo actual si está presente.
- «Administrar dispositivos» abre la pantalla existente. No se mueve ni altera su revocación.
- Se identifica el resultado como última consulta y se ofrece Actualizar dispositivos después de regresar de su administración.
- Resumen de pendientes por revisar y acceso a la pestaña correspondiente.
- Cierre mediante ConfirmDialog: informa cantidades cuando el almacén está abierto, o incertidumbre si está bloqueado. Advierte que cerrar no sincroniza los eventos y que se requerirá validar con internet la misma cuenta.
- Confirmar llama al mismo `controller.logout()`; cancelar/Atrás no lo ejecuta. La confirmación se oculta si pierde autorización.

No se borra ninguna cola. El comportamiento original de NativeOfflineVault conserva base, claves protegidas y eventos; el logout cierra el acceso y exige nueva validación. La UI no sustituye ese mecanismo ni promete acceso offline después del logout.

## Componentes reutilizados y creados

A permanece intacto: Screen/ScreenFrame, ListScreen, AppText, Card, ActionButton, FormField, Notice, StatusBadge, LoadingState, EmptyState y ConfirmDialog; tema, TabInsetsContext, MainHeader, MainTabBar y stacks.

Nuevos componentes específicos de B en `src/components/general/`:

| Componente | Función |
| --- | --- |
| EidaBrand | Alternativa de marca en texto mientras falta soporte de imagen oficial. |
| IdentityBlock | Nombre real, detalle e iniciales decorativas; ajuste de líneas. |
| TextAction | Acción secundaria con objetivo mínimo 48 dp y etiqueta accesible. |
| OperationalTile | Métrica explícita o estado desconocido, con acceso a su origen. |
| QueryFeedback | Carga, error original y reintento. |
| ExamFilters | Selección adaptable de las vistas HTTP existentes. |
| ExamCard | Presentación de TeacherExam, copia local y enlaces existentes. |

`src/ui/generalScreens.ts` contiene funciones puras usadas por las pantallas: destinos y estados de Login, iniciales, orden/resumen de página de exámenes, etiquetas de estado y copia local, enlaces con examId y texto de confirmación. No valida credenciales, autoriza usuarios ni modifica contratos o registros.

## Navegación, Safe Area y privacidad

No se añade otro Tab Navigator, layout o cabecera. Inicio, Exámenes y Perfil siguen dentro del grupo de A, con sus cuatro destinos:

- `/(private)`
- `/(private)/exams`
- `/(private)/pending`
- `/(private)/profile`

Dispositivos, colaboraciones y distribución siguen en el Stack privado; listas/escáner/colas en el Stack offline con sus protecciones previas. Se conservan los parámetros y el historial. La gestión de cuenta concentra Cerrar sesión en Perfil, accesible desde la barra; el diagnóstico anterior también permanece allí.

Stack.Protected y canAccessPrivate siguen retirando las rutas privadas tras logout, expiración o pérdida de autorización. No se cambia el acceso local independiente del Stack offline.

Screen/ScreenFrame de A gestionan insets y solapamiento residual de IME; Login usa el modo sin cabecera y las pestañas delegan sus barras a A. No se dibujan barras de hora/batería, no se duplican SafeArea ni se cambia adjustResize. La lista de exámenes se virtualiza y conserva su ruta al abrir un detalle.

Las pantallas con consultas se delimitan por userId para descartar estado visual de la cuenta anterior. El controller mantiene sus comprobaciones de epoch y cancelación; useRemoteQuery conserva su descarte de respuestas tardías y no mantiene autorizaciones antiguas tras fallo. No se crea caché local nueva.

Las tarjetas usan tamaños mínimos, texto escalable, filas que pueden envolver y etiquetas explícitas. No se desactiva allowFontScaling ni se ponen alturas máximas a los bloques. La navegación y el estado no dependen solo del color.

## Archivos de B

Modificados:

- `src/screens/LoginScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/ExamsScreen.tsx`
- `src/screens/ProfileScreen.tsx`
- Este documento.
- `docs/EIDA_CONTROL_FASE_2_EXPO_QR.md`
- `docs/HISTORIAL_FASE_2.md`

Nuevos:

- `src/components/general/EidaBrand.tsx`
- `src/components/general/IdentityBlock.tsx`
- `src/components/general/TextAction.tsx`
- `src/components/general/OperationalTile.tsx`
- `src/components/general/QueryFeedback.tsx`
- `src/components/general/ExamFilters.tsx`
- `src/components/general/ExamCard.tsx`
- `src/ui/generalScreens.ts`
- `tests/general-screens.test.ts`
- `assets/brand/eida-logo.svg`
- `assets/brand/README.md`

Al finalizar B no cambiaron src/features, src/services, src/hooks, src/navigation, src/app, módulos nativos, package.json, package-lock.json ni android/. B tampoco modificó las pantallas de C/D o dispositivos/colaboraciones. Backend no se consultó durante B; Web fue solo lectura.

La comparación de huellas antes/después confirmó sin cambios los 88 archivos incluidos en la revisión: features, services, hooks, navigation, app, modules, package.json, package-lock.json y los tres archivos nativos seleccionados (gradle.properties, app/build.gradle y AndroidManifest.xml). Esto es inspección de archivos, no ejecución de pruebas ni compilación.

## Pruebas escritas, no ejecutadas

`tests/general-screens.test.ts`: diez casos sobre:

1. Destinos de Login, guardas y restricciones busy/credencial.
2. Mensajes originales de credenciales, red, inactividad y vencimiento.
3. Iniciales desde nombres reales, con acentos y ausencia de datos de demostración.
4. Resumen de Inicio a partir de la página, estado IN_PROGRESS y fuente inmutable.
5. Diferencia entre datos ausentes y respuesta vacía.
6. Estados desconocidos y copia local bloqueada/inactiva/de otro examen/incompleta/vencida.
7. Confirmación de logout con dos colas y cantidades desconocidas si está bloqueado.
8. Destinos con examId y guardas de expiración/inactividad.
9. Adaptadores reales de docencia/colaboraciones y ausencia de estado/autoridad inventados.
10. Rechazo real de consulta 403 y conservación de MOBILE_ABILITY_REQUIRED.

Los últimos casos usan los adaptadores y SessionController reales con el transporte sintético exclusivo de tests ya existente. La aplicación no importa fixtures ni reemplaza servicios por simulaciones. Se mantienen las pruebas anteriores de navegación/guardas, HU35/HU36/HU37, autenticación, QR, cámara e incidencias sin alterarlas.

No se instalaron bibliotecas de renderizado RN. Las pruebas puras no comprueban visualmente mostrar/ocultar contraseña, foco, teclado, scroll, fuente grande, diálogos montados o TalkBack: requieren validación manual. No se declara que B apruebe pruebas o tipos. La confirmación del usuario solo acredita A antes de estos cambios.

## Comandos manuales y validación Android

No hay dependencias nuevas para ejecutar B con su alternativa de marca/fuente. No necesita Prebuild por estos cambios JS/TS y assets. Las dependencias nativas ya requeridas por fases anteriores deben estar resueltas en la instalación/development build del usuario.

El usuario debe ejecutar:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Con una development build compatible existente:

```powershell
npm run start
```

Pendientes físicos:

1. Login: credenciales incorrectas, cuenta inactiva, red fallida, carga, clave inicial, revocación pendiente; no deben aparecer accesos exitosos simulados.
2. Teclado Android: Siguiente/Ir, alternar visibilidad sin perder texto/foco, botón accesible, rotación disponible y regreso con IME; Safe Area con gestos/tres botones.
3. Inicio: usuario docente, solo colaborador y ambos; docencia 403 con colaboración vigente; sin datos; páginas múltiples sin afirmar cobertura global; almacén bloqueado y segunda cuenta.
4. Exámenes: las cuatro vistas, paginación, nombre largo, ambiente ausente, copia vencida/incompleta, error/reintento, apertura y Atrás conservando contexto. No convertir el indicador de copia en permiso.
5. Perfil: dispositivos vacíos/error/listado real; administrar y regresar; revalidar; cancelar logout con botón/gesto; confirmar con pendientes y con almacén bloqueado. No recuperar vistas privadas con Atrás.
6. Confirmar conservación de los eventos tras volver a validar la misma cuenta, usando datos de prueba; no inferir sincronización de un cambio visual.
7. Ancho 360 dp, fuente normal/ampliada/200%, TalkBack, objetivos táctiles, contraste y lectura de errores. Verificar scroll de la lista y posición al regresar.
8. El aspecto real del logo/Poppins no se puede aprobar todavía: sus requisitos pendientes se describen arriba.

## Plan posterior a B

C: centro de examen, distribución HU35, preparación HU36, lista y detalle de estudiante; implementado posteriormente en el apartado C siguiente. D: cámara/revisión/ingreso, sincronización, incidencias y disciplina; continúa pendiente. No se agregan simulación, permisos o endpoints.

El resumen de Pendientes y la navegación pertenecen a A y no se rediseñaron en B. El SVG original está disponible como recurso; su renderizado y Poppins siguen pendientes de una solución de assets/dependencias autorizada y compatible.

## Bloque C: centro del examen, HU35, HU36 y estudiantes

### Alcance y referencias

C utiliza las capturas del centro de operaciones y paquete sin conexión: hero marino, jerarquía de acciones, estado de preparación y separación entre lista propia y gestión. No se copian porcentajes, cantidades, fechas o «Simular actualización». No había una captura específica de estudiantes; la lista y ficha usan los componentes y tokens A/B, con la misma paleta oficial y fuente del sistema. No se volvió a consultar Web ni se accedió a backend o Figma MCP en C.

Se mantienen rutas, servicios y contratos. El centro de examen y HU35 comparten la ruta existente de distribución; HU36 mantiene el catálogo de paquetes. La ficha es un **Modal nativo dentro de la lista**, no una ruta con datos personales.

### Centro del examen y distribución HU35

`OfflineDistributionScreen` presenta examen, materia, fecha/hora, estado original y ambiente disponible mediante ExamHero. La relación del usuario se describe a partir de can_prepare y own_list_id: supervisión, acceso a lista propia o ausencia de asignación. No se deriva autoridad de roles globales ni se inventa el papel de colaborador.

Las acciones rápidas Ver mi lista / Buscar estudiante / Escanear QR solo se ofrecen para una copia propia activa PREPARADO, con autorización del contexto sin stale/unavailable_reason. El escáner se deshabilita si el paquete no anuncia material QR disponible. La apertura vuelve a comprobar repo.usable; estos botones no evitan las guardas.

La preparación personal mantiene `offline.download(examId)`. Las acciones de distribución conservan la operación existente `api.prepare(examId)` y la consulta assignments solo con can_prepare. Se bloquea visualmente la preparación si la distribución está desactualizada o el servidor informa un impedimento. No se añade un algoritmo de reparto, versión nueva o redistribución Android.

Supervisión y descarga son distintas:

- El supervisor ve responsables, rangos y cantidades devueltos por el servidor.
- Un usuario sin supervisión solo ve la fila de own_list_id.
- Las filas de otros responsables no tienen botones de descarga ni acceso a estudiantes.
- Un supervisor sin lista propia recibe una explicación y no un paquete personal ficticio.
- El ambiente se toma del examen: el contrato no entrega un ambiente diferente por lista.
- Solo se usan paquetes que coinciden con el examen y own_list_id para los accesos rápidos.
- Con el almacén bloqueado el estado local es desconocido; no se presenta como «No descargada» por ausencia de acceso.
- Los pendientes mostrados se filtran por examen y conservan separadas las dos colas y sus estados.
- Los enlaces a incidencias/sincronización abren pantallas existentes; no afirman autorización disciplinaria ni cambian sus contratos.

### Preparación HU36

`OfflinePackagesScreen`, PreparationStatus y PackageCard distinguen los siete estados existentes: NO_DESCARGADO, DESCARGANDO, INCOMPLETA, PREPARADO, DESACTUALIZADO, VENCIDO y ERROR. Un PREPARADO que ya no está activo se muestra como copia archivada y no se abre.

El progreso es **indeterminado**, porque OfflineProvider no expone bytes/fotografías completadas con denominador fiable. No se inventa una barra porcentual. Se muestran:

- Fecha de preparación y vigencia del manifiesto.
- Cantidad de miembros de la copia publicada, o cantidad prevista en el manifiesto si la preparación no está completa.
- Fotografías PRESENT previstas y ausencias ABSENT declaradas. Solo una publicación completa permite decir «verificadas al publicar».
- Error concreto, recuperación y revalidación mediante las llamadas anteriores con el mismo packageId.
- Aviso de revalidación con la misma cuenta tras reinicio/pérdida de concesión cuando el mecanismo real lo exige.

No se atribuye el estado global de cualquier operación al examen actual: el indicador de descarga del centro se activa solo cuando ese centro inicia su llamada. En el catálogo, busy se describe como operación local general y cada tarjeta usa su propio estado persistido.

Con runtime bloqueado no se renderizan paquetes, estudiantes, fotografías ni cantidades de colas. El catálogo muestra metadatos de recuperación tras desbloquear, sin nombres de estudiantes ni fotografías. Una copia incompleta no abre la lista. La copia publicada anterior se conserva conforme a la recuperación atómica existente; su vigencia se comprueba al abrirla.

### Lista de estudiantes

`OfflineListScreen` adopta ListScreen/FlatList, con una ventana de hasta 50 resultados por la consulta SQL existente y paginación anterior/siguiente. El buscador mantiene nombre, apellidos, SIS y CI, con una espera de 200 ms para evitar consultas por cada pulsación rápida.

**No cambió repository.search, su normalización, índices, parámetros ni ESCAPE '!'.** %, _ y ! siguen siendo literales. El resultado de una consulta se vincula a runtime, término y offset; no se muestran filas de una cuenta, búsqueda o página anterior mientras llega la nueva.

Las filas presentan nombre completo, SIS, CI, habilitación conocida en la copia y estado de ingreso. Se distinguen:

- Ingreso informado al descargar: no se convierte en estado oficial actual.
- Operación local pendiente: no se llama ingreso confirmado.
- Recibo ACCEPTED: confirmación del servidor.
- DUPLICATE: ingreso existente informado.
- CONFLICT/REJECTED: revisión explícita, sin nuevo ingreso confirmado.

Para evitar descifrar fotografías de todos los resultados o introducir cachés de miniaturas, las filas indican disponibilidad de foto en la ficha o ausencia declarada. La imagen completa se obtiene solo al seleccionar al estudiante. No se sustituye una fotografía PRESENT inválida por una ausencia ABSENT.

Se mantienen el vencimiento temporizado, nativeClock/anchoredNow y repo.usable. Un fallo de consulta elimina la copia visible; cambios de runtime/paquete o un estado bloqueado impiden renderizar filas y ficha. Búsqueda y paginación quedan en memoria de la pantalla, sin persistencia adicional ni datos personales en URLs.

### Ficha y acciones existentes

StudentDetailModal presenta la identidad del estudiante autorizado, SIS, CI, fotos, examen/aula, matrícula, habilitación/revisión y fecha de los datos de la copia. No fabrica una fecha de actualización individual.

El flujo de fotos conserva repo.photo, verificación de hash y data URI en memoria tras r.check. No hay escrituras a archivos, miniaturas persistentes, URLs públicas o nuevas cachés sin cifrar. Al cerrar la ficha se eliminan sus referencias de presentación a fotos, selección, evento y token; no se elimina ningún registro persistido.

Abrir una ficha **no registra un ingreso**. El botón manual utiliza eligible, la comprobación existente, para explicar/deshabilitar acciones imposibles en la copia. La confirmación conserva captureProvisional con el mismo repo, reloj, UUID, provider y token. El servicio sigue verificando vigencia, ventana de ingreso, duplicados y evidencia al guardar; las etiquetas no conceden permiso.

Se conservan identifyQr y el lector externo existente. Solo un resultado autenticado puede seleccionar al estudiante desde ese flujo. Un QR v2 sigue siendo rechazado por el verificador offline y nunca se usa como identidad. El acceso al escáner abre su ruta original sin modificar cámara o verificación.

Incidencias y borradores abren sus pantallas previas. El borrador docente continúa dependiendo de incidents.canDraft. El reporte en ficha se refiere a la lista: no se agrega un parámetro studentId que la pantalla de reportes no admite. Las reglas y servicios de incidencias no cambian.

### Navegación, Atrás, teclado y Safe Area

No se añade otro navegador, Stack, pestaña o ruta de detalle:

- Examen: `/(private)/offline-distribution?examId=…`.
- Paquetes: `/offline`.
- Lista: `/offline/list?packageId=…`.
- Buscar desde el centro añade únicamente `focusSearch=1`, una instrucción visual sin datos personales.
- Escáner: `/offline/scan?packageId=…`.
- Ficha: Modal nativo; onRequestClose y Volver a la lista cierran la selección sin navegar a Inicio.

La lista permanece montada detrás de la ficha. Cerrar el modal no altera término, página o ruta, por lo que puede conservar su posición visual. No se promete restauración del scroll después de cerrar el proceso, bloquear/recrear la pantalla o cambiar de cuenta. La conservación física se debe validar en Android.

Las rutas de operaciones conservan el Stack y parámetros originales. Los fallbacks existentes de un acceso bloqueado llevan al desbloqueo; no se reescribe todo Atrás como navegación a Inicio. Las guardas de raíz y el cierre del almacén tras los límites de seguridad permanecen intactos.

El modal tiene SafeAreaProvider de su propia ventana y Screen sin cabecera nativa, con bottomOwnedByNavigator=false. Lista/centro/paquetes siguen delegando sus cabeceras al Stack. No se simulan barras del sistema, no se toca edge-to-edge ni adjustResize.

Se extiende **ListScreen de forma compatible** para que los inputs de cabecera/pie registren el foco mediante KeyboardFocusContext y el scroll responder de FlatList los revele al aparecer/redimensionarse el teclado. Mantiene su API y el callback onLayout, sin ScrollView anidado. B puede seguir utilizando el componente sin cambios.

Los controles mantienen objetivos mínimos de 48 dp, textos escalables y filas que pueden envolver. No hay alturas fijas para los datos personales o botones. Las fotografías se adaptan al ancho y usan contain. TalkBack recibe etiquetas y estados textuales, sin depender únicamente del color.

### Archivos de C

Modificados:

- `src/screens/OfflineDistributionScreen.tsx`
- `src/screens/OfflinePackagesScreen.tsx`
- `src/screens/OfflineListScreen.tsx`
- `src/components/ListScreen.tsx`: foco/teclado para la lista virtualizada.
- Este documento.
- `docs/EIDA_CONTROL_FASE_2_EXPO_QR.md`
- `docs/HISTORIAL_FASE_2.md`

Nuevos:

- `src/components/control/ExamHero.tsx`
- `src/components/control/PreparationStatus.tsx`
- `src/components/control/PackageCard.tsx`
- `src/components/control/DistributionListCard.tsx`
- `src/components/control/StudentRow.tsx`
- `src/components/control/StudentDetailModal.tsx`
- `src/ui/controlScreens.ts`
- `tests/control-screens.test.ts`

Se reutilizan tema, Screen/ScreenFrame, ListScreen, AppText, Card, ActionButton, FormField, Notice, StatusBadge, ProgressBar/LoadingState, EmptyState y QueryFeedback de A/B.

La comparación de huellas confirmó sin cambios **104 archivos protegidos** incluidos en la comprobación: features, services, hooks, navigation, rutas/layouts, módulos nativos, componentes general de B, pantallas B/cámara/sincronización/incidencias seleccionadas, tema, package.json, lockfile y tres archivos Android seleccionados. La extensión declarada de ListScreen queda fuera de esa lista inalterada. Esto es inspección de archivos, no prueba ni compilación.

No se añadieron dependencias, fuentes, assets o transformadores. No se modificaron Android, SDK, entorno Windows, backend ni frontend. El logo/Poppins conservan los límites documentados en B.

### Trece pruebas escritas, sin ejecutar

`tests/control-screens.test.ts` agrega:

1. Contexto autorizado y separación entre supervisión y paquete personal.
2. Colaborador con su propia fila, sin preparar distribución.
3. Supervisor sin paquete y usuario sin asignación, sin privilegios inferidos.
4. Descarga bloqueada por stale, impedimento del servidor o almacén cerrado.
5. Los siete estados y acciones de abrir/reanudar/revalidar.
6. Ocultación ante copia inexistente, cambiada, inactiva, vencida o runtime distinto.
7. Ausencia legítima frente a fotografía PRESENT y disponibilidad no informada.
8. Disponibilidad manual reutilizando eligible y conocimiento del evento local.
9. Distinción entre copia, provisional y recibos del servidor.
10. Aislamiento de filas por runtime, término y offset.
11. Rutas de lista/búsqueda/cámara sin PII ni QR en sus parámetros.
12. Búsqueda real SQLite por acentos, SIS y CI; comodines literales y rechazo de estudiantes ajenos.
13. Descarga interrumpida real con PackageDownloader: nueva copia incompleta y publicación anterior utilizable.

Los casos 12/13 usan el repositorio y downloader reales con SQLite desktop y fixtures exclusivos de tests existentes. La app no importa datos sintéticos. Esos tests no prueban cifrado Android: SQLCipher sigue requiriendo comprobación nativa real.

No se modifican las pruebas de A/B ni las de autenticación, HU35/HU36/HU37, QR, cámara o incidencias. No se ejecutó ningún caso nuevo o anterior ni typecheck. El resultado confirmado por el usuario para A no se atribuye a B/C.

El cierre real de Modal/Atrás, TalkBack y scroll/foco no están cubiertos por un renderer RN: se documentan como validación física, sin simularlos mediante un motor alternativo de navegación.

### Validación manual de C y pendientes D

Ejecutar personalmente desde el proyecto:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Con una development build compatible existente:

```powershell
npm run start
```

Los cambios de C son JS/TS y no requieren Prebuild por sí mismos. La build debe tener los módulos nativos que ya exigían las fases previas. No se compila, no se toca CMake 3.31.6 y no se alteran dependencias.

En Android real, verificar con datos de prueba:

1. Docente con lista propia, docente supervisor sin lista y colaborador. Ninguno debe abrir paquetes de otros responsables.
2. Distribución congelada/desactualizada, sin asignación, 403 y MOBILE_ABILITY_REQUIRED; las restricciones deben permanecer visibles.
3. Preparación, interrupción, reanudación y nueva copia incompleta con anterior activa. No se debe presentar la incompleta como utilizable.
4. Almacén bloqueado, segundo plano, biometría, cierre de sesión y cambio de cuenta: no deben quedar filas/fotos/ficha visibles. Reinicio y referencia horaria inválida deben seguir exigiendo la revalidación real.
5. Búsqueda rápida con acentos/SIS/CI/%/_/!, páginas de 50, sin coincidencias y lista vacía. Revisar rendimiento en gama media.
6. Abrir ficha y volver mediante botón y gesto Atrás; conservar término/página/posición cuando la lista permanezca montada. Repetir desde cámara, incidencia y borrador existentes.
7. Foto PRESENT válida, ausencia ABSENT y bytes alterados: no mostrar una foto que falle integridad ni sustituirla por ausencia legítima.
8. Abrir una ficha no crea eventos. Cancelar registro no guarda. Confirmar crea un provisional con UUID estable; solo el recibo aceptado cambia a confirmado.
9. Fuente ampliada/200%, 360 dp, TalkBack, teclado en buscador y contenido externo QR, modo gestos/tres botones, recortes, cabeceras e insets sin duplicar.
10. Repetir las comprobaciones A/B y especialmente Exámenes, que comparte ListScreen ahora con foco de teclado.

Al terminar C, D seguía pendiente: cámara/revisión/confirmación, sincronización, incidencias y disciplina. Su implementación posterior se describe en el siguiente apartado. C solo incorporó accesos, sin alterar esos servicios.

## Bloque D: QR, pendientes, sincronización, incidencias y disciplina

### Alcance y referencias

D reutiliza los tokens oficiales de A, los componentes generales de B y la infraestructura de listas/modal de C. La captura de Pendientes orienta el resumen, colas y acciones; las capturas operativas orientan tarjetas y jerarquía. No había referencias completas de cámara, formularios o disciplina: se componen de forma coherente y nativa, sin afirmar reproducción exacta ni consultar Figma MCP.

Se conservan principal #0049A8, marino #172554, carmesí #8B1E3F y fondo #EAF3FF mediante theme. Los estados reutilizan los tonos accesibles ya existentes, texto e icono; no se crea otra paleta, familia tipográfica, dependencia o navegador.

### QR y confirmación explícita

OfflineScannerScreen mantiene íntegros QrScanSession, NativeQrCamera, sus callbacks, revalidación periódica, permisos reales, pausa por detección y protección frente a lecturas repetidas. El adaptador de cámara no se editó.

Se añade una guía visual decorativa sobre el preview de 300 dp que ya proporciona el adaptador. La guía no limita ni altera detecciones, no captura imágenes y no recibe eventos táctiles. El permiso inicial/denegado, solicitud y acceso a Ajustes siguen siendo los del adaptador original.

La presentación diferencia checking, idle, scanning, detected, verifying, review, saving, saved, duplicate, error, blocked y closed. Los motivos reales de rechazo se muestran sin reinterpretar el QR: inválido, vencido, examen incorrecto, fuera de lista, habilitación, v2 o integridad continúan proviniendo del verificador y servicios existentes. No hay otro verificador ni decodificación visual de PII sin autenticar.

ScanIdentityCard recibe identidad/fotos únicamente en review/duplicate/saved de la sesión autenticada, con nombre, SIS, CI, examen y habilitación de la copia. Las fotos usan las data URI protegidas existentes, sin archivos públicos o cachés nuevas.

En review hay Confirmar ingreso provisional y Cancelar sin registrar. Solo la confirmación llama al método confirm original; detectar, renderizar o cancelar no crea eventos. La compuerta síncrona y el UUID siguen siendo los del servicio.

Sin recibo válido se utiliza exactamente:

**INGRESO GUARDADO EN EL DISPOSITIVO — PENDIENTE DE SINCRONIZACIÓN**

ACCEPTED muestra confirmación oficial; DUPLICATE explica que ya existía un ingreso y no se creó otro. CONFLICT/REJECTED no se presentan como éxito y review_required queda visible. Los mensajes del registro manual en StudentDetailModal se integran con esa misma expresión y con la advertencia de comprobación personal sin autenticación QR; no cambia su captura.

Volver usa historial real y cierra la sesión de lectura. En entrada directa sin historial se usa el fallback explícito a la lista del packageId. No se fuerza el retorno a Inicio. El botón/gesto Atrás sin confirmar conserva el cierre por foco del servicio y no guarda.

### Pendientes y estados desconocidos

La pestaña existente agrupa HU37 e incidencias HU27 en dos tarjetas y procesos separados. No hay «enviar todo», lote combinado, nueva outbox o automatización de envíos.

useQueueReadiness recuerda únicamente la referencia del runtime que terminó su primera lectura; no almacena eventos. Mientras se desbloquea/lee por primera vez las cantidades son desconocidas, no cero. Al enviar más tarde se conservan contadores conocidos y se actualizan desde el proveedor. Cambiar/bloquear el runtime elimina esa certeza. MainTabBar recibe esta misma corrección de presentación para su distintivo y etiqueta accesible.

La pantalla distingue bloqueado, consultando, pendientes, sin pendientes de envío, conflictos/rechazos por revisar y error del proveedor. Si hay un error tras una lectura válida, no convierte la cola anterior en vacía ni presenta un recibo ficticio.

La conectividad se muestra offline cuando el estado real de sesión lo indica; en los demás casos se declara no comprobada. No se infiere «En línea» de la autenticación y no se agrega NetInfo o un sondeo de red. El último intento de ingresos proviene exclusivamente de lastAttemptAt; las incidencias no tienen esa fecha en su contrato y no se inventa.

### Ingresos HU37

OfflineSyncScreen usa ListScreen/FlatList y filtros por PENDING, SENDING, CONFIRMED interno (ACCEPTED en UI), DUPLICATE, CONFLICT y REJECTED. Se muestran cantidades de los eventos consultados, captura estimada, último intento y detalle en un Modal nativo que vuelve a la misma cola/filtro.

EntryDetails conserva UUID, paquete y actor original, intentos, errores, recibo, fecha y review_required. Un resultado aceptado necesita su recibo asociado; un estado sin recibo comprobable no se pinta como éxito. La evidencia tardía permanece señalada y no se ofrece aprobar asistencia.

Sincronizar/reintentar llama únicamente a synchronize existente. Los botones busy y la compuerta del proveedor conservan la prevención de dobles envíos. Se mantienen OfflineSyncController, API, contratos, leasing/outbox y reglas de idempotencia sin modificaciones.

El progreso numérico solo representa processed/total de recibos considerados cuando total es conocido; nunca un porcentaje de ingresos aceptados. Con total desconocido se usa progreso indeterminado.

### Incidencias, detalle y borradores

OfflineIncidentsScreen presenta la cola específica con sus filtros, iconos y detalle modal. PENDING/SENDING permanecen locales; REGISTERED necesita recibo asociado al evento y su hash. Confirmar un reporte no confirma una infracción ni aplica sanción. Conflictos, rechazos, errores técnicos y revisión tardía permanecen accesibles.

synchronizeIncidents sigue siendo la única operación de envío de reportes. Las incidencias no se envían por HU37. Actualizar solo vuelve a consultar los estados y borradores originales. Un fallo al leer borradores ahora se presenta como error, sin decir que no hay borradores.

Los borradores locales se muestran separados, sin envío automático. Revisar online abre la pantalla previa de Infracciones y exige su autorización vigente; el botón no concede un rol. Bloqueo, blur o cambio de runtime retiran contenido y detalle.

IncidentsScreen mantiene el listado oficial paginado de 15 registros mediante ListScreen y read del contexto del examen. IncidentDetailScreen conserva la ruta/API previas y muestra el estado del reporte, no una decisión disciplinaria. manage habilita únicamente los accesos que ya permitía el servidor. Los errores de autorización/conexión se muestran con reintento; no se agregan resultados de demostración.

ReportIncidentScreen conserva useProtectedPackage, canDraft, búsquedas de la lista autorizada y los métodos capture/saveDraft originales. Cambia la presentación de tipos, descripción, selección opcional de estudiante y guardado. La búsqueda distingue carga, fallo y vacío; el cuerpo se conserva en errores mientras la autorización siga permitiendo mostrarlo. La validación visual de descripción reutiliza el contrato existente.

No se cambian UUID, contenido del evento, hash, SQLCipher, almacenamiento o sincronización. La compuerta work/saved original permanece. El guardado explica por separado «reporte pendiente» y «borrador local», sin registrarlos como oficiales.

### Formularios, disciplina y permisos

InfractionsScreen mantiene consultas y mutaciones originales, estados oficiales, expected_revision y allowed del servidor. Se añaden tarjetas, selección accesible, detalle modal y estados de carga/error/vacío. Los botones sensibles siguen usando las confirmaciones existentes y consultando api.context fresco antes de la operación.

DisciplineActionsScreen conserva expulsión/anulación exclusivamente online, requireOwner, canAnnul, validación de respuesta y compuerta work. Cambiar de modo con un motivo sin enviar pide confirmación para descartarlo. Los mensajes de fallo ahora incluyen el error original, sin ocultar un rechazo tras un mensaje genérico.

Las vistas restringidas usan OnlineAccessState: no habilitan formularios ni acciones a partir del rol mostrado en Perfil. Un colaborador no obtiene manage. 403 MOBILE_ABILITY_REQUIRED conserva su rechazo y mensaje de los servicios; no se simula éxito ni se modifica la política del backend.

Los formularios reutilizan useUnsavedChanges y FormExitDialog de A. Cancelar conserva los campos; descartar solo limpia estado de formulario en memoria y repite la navegación original. Nunca elimina eventos/borradores cifrados ya guardados. Las protecciones se desactivan al perder runtime/autorización para no impedir logout, revocación o limpieza de datos privados. No se promete recuperar contenido tras cerrar proceso o perder acceso.

En Infracciones se deshabilita la revalidación que puede reiniciar el formulario mientras está modificado, ocupado o submitted. Se mantiene una actualización separada del listado oficial, que no reinicia esa consulta de permisos ni habilita un reenvío. El comportamiento original subyacente requiere la revisión funcional descrita más abajo.

### Navegación, Safe Area y accesibilidad

No se agrega ninguna ruta ni navegador inferior. Se conservan los Stacks, parámetros examId/packageId/eventId/draftId y la guarda privada. Los detalles de recibos son modales fuera de la lista virtualizada; Atrás los cierra y deja cola/filtro montados. El detalle oficial de incidencia conserva su Stack y regreso al listado de origen.

Los nuevos modales usan SafeAreaProvider de su propia ventana, Screen sin cabecera nativa y área inferior propia. El resto usa los headers/insets A. No hay barras del sistema falsas, cambios de edge-to-edge, alturas de status bar simuladas o modificaciones Android.

Los formularios usan Screen/FormField con foco y teclado existentes. Colas/listado oficial usan ListScreen sin ScrollView anidado. Botones/chips crecen con el texto y mantienen objetivos de al menos 48 dp; se conservan escalado, etiquetas TalkBack, roles radio/progressbar y estados textuales con símbolo. La guía de cámara es decorativa para accesibilidad. No hay animaciones pesadas.

### Archivos de D

Pantallas modificadas:

- src/screens/OfflineScannerScreen.tsx
- src/screens/OfflineSyncScreen.tsx
- src/screens/PendingOverviewScreen.tsx
- src/screens/OfflineIncidentsScreen.tsx
- src/screens/ReportIncidentScreen.tsx
- src/screens/IncidentsScreen.tsx (listado y detalle)
- src/screens/InfractionsScreen.tsx
- src/screens/DisciplineActionsScreen.tsx

Integraciones mínimas:

- src/components/MainTabBar.tsx: certeza de lectura del contador.
- src/components/control/StudentDetailModal.tsx: aviso manual y mensaje de guardado local, sin cambiar acciones.

Nuevos:

- src/ui/operations.ts
- src/ui/useQueueReadiness.ts
- src/components/operations/OperationState.tsx
- src/components/operations/ChoiceChips.tsx
- src/components/operations/OperationDetails.tsx
- src/components/operations/FormExitDialog.tsx
- src/components/operations/OnlineAccessState.tsx
- src/components/operations/ScanIdentityCard.tsx
- src/components/operations/EntryDetails.tsx
- src/components/operations/IncidentDetails.tsx
- tests/operations.test.ts

Documentación: este archivo, EIDA_CONTROL_FASE_2_EXPO_QR.md e HISTORIAL_FASE_2.md.

Se revisaron huellas de 114 archivos protegidos: 113 permanecen idénticos y el único cambio es StudentDetailModal, declarado arriba. Permanecen intactos features, services, hooks, navigation, rutas/layouts, módulos nativos, tema, pantallas B/C, componentes general, package.json, lockfile y los tres archivos Android seleccionados. Además se compararon textualmente las funciones originales de guardado local y mutaciones de infracciones: son idénticas. Esto no equivale a ejecutar pruebas.

No se modificaron backend, frontend, Android, herramientas o entorno. No se ejecutaron Git, instalaciones, pruebas, TypeScript, Expo, Prebuild, Gradle, CMake, ADB, APK, migraciones o despliegues.

### Catorce pruebas nuevas, sin ejecutar

tests/operations.test.ts incluye:

1. Etiquetas de lectura/verificación/revisión/guardado sin inventar ACK.
2. Detección/autenticación real sin registro automático; cancelar no crea evento.
3. Confirmación explícita doble sobre QrScanSession real: un UUID/evento.
4. QR inválido y v2 sin identidad ni evento.
5. Permiso de cámara denegado: sesión real no inicia.
6. Lectura desconocida/bloqueada frente a cantidades conocidas durante envío.
7. ACCEPTED/DUPLICATE/CONFLICT/REJECTED, recibos y evidencia por revisar.
8. Registro de reporte frente a infracción confirmada y ausencia de recibo.
9. Último intento tomado de fechas reales almacenadas.
10. Descripción válida/inválida y rechazo del estudiante ajeno a la lista.
11. Fallo de red con IncidentSync real: conserva UUID, descripción, hash y pendiente.
12. Disciplina owner-only y error MOBILE_ABILITY_REQUIRED, sin privilegios nuevos.
13. Cancelación/Atrás y repetición única de la confirmación existente.
14. Estados con texto y símbolo además de color.

Se usan los servicios/SQLite/verificador reales con fixtures de tests existentes, nunca simulaciones productivas. Las pruebas anteriores A/B/C, scanner, sync, incidents, auth y QR no se modificaron. No se ejecutó ninguna; la validación de A informada por el usuario no se atribuye a B/C/D.

Los tests no renderizan permisos Android, CameraView, modales o TalkBack. El cifrado SQLite desktop de prueba tampoco acredita SQLCipher nativo.

### Hallazgos funcionales fuera del rediseño

1. **Política central móvil:** MOBILE_ABILITY_REQUIRED continúa siendo un requisito de autorización/despliegue del backend. D no lo habilita ni modifica backend.
2. **Inicialización previa de Infracciones:** el efecto existente depende de p.manage/runtime/draftId y reinicia campos y submitted. Revalidar permisos puede reiniciar un formulario o su barrera de reenvío. La UI evita el botón conocido cuando hay cambios/submitted y permite actualizar solo el listado; no se alteró el efecto ni la idempotencia. Requiere revisión funcional separada antes de cambiar ese mecanismo.
3. **Sesión y formularios en memoria:** SessionController puede pasar a offline/expired y retirar rutas privadas después de un error de red/autorización. No se pueden prometer campos recuperables al perder esa ruta sin decidir persistencia cifrada o cambiar las guardas. D conserva las guardas y el borrado visual de datos privados; no agrega persistencia de formularios.
4. La vista de permisos/solicitud/Ajustes y el preview interno pertenecen al adaptador de cámara preservado. El cambio visual se limita a su contenedor, guía y resultados. Una build sin módulos nativos previos no se corrige con estos cambios JS.
5. Logo SVG visible/Poppins continúan con los pendientes de B; D no instala renderer, fuentes o transformadores.

### Verificación manual y cierre visual

Comandos a ejecutar personalmente:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Con una development build compatible ya instalada:

```powershell
npm run start
```

D no añade dependencias ni requiere Prebuild por sus cambios JS/TS. Debe existir la build nativa compatible con cámara, QuickCrypto, SQLCipher, biometría/reloj de fases anteriores. No se genera APK ni se toca CMake 3.31.6.

Pendientes en Android real:

- Primera solicitud de cámara, denegación temporal/permanente, Ajustes, cámara ocupada y permiso que envía la app al fondo. El almacén debe bloquearse conforme a su política previa.
- QR válido, inválido, vencido, otro examen, fuera de lista, no habilitado y v2. No debe aparecer identidad sin autenticar.
- Detecciones repetidas, Confirmar doble, Cancelar y Atrás: sin registro automático ni UUID nuevo por render.
- Fotos PRESENT/ABSENT e integridad; revisión de persona antes del registro manual.
- Provisional guardado, recibos ACCEPTED/DUPLICATE/CONFLICT/REJECTED y revisión tardía; cerrar/reabrir detalles conserva cola/filtro.
- Pendientes bloqueados, leyendo, vacíos, error y primera lectura lenta, sin cero ficticio; dos sincronizaciones independientes y sin envíos simultáneos por taps.
- Fallo de red y reintento con evidencia original; con pérdida de sesión prevalece la guarda y la limitación funcional descrita.
- Formulario de incidencia general/estudiante, descripción inválida, guardar una vez, cancelar salida y descartar explícitamente; ningún evento guardado se elimina.
- Colaborador sin manage, docente autorizado, MOBILE_ABILITY_REQUIRED, 403/409/422; nunca mostrar éxito ante rechazo.
- Confirmar/cancelar expulsión, anulación y cambio de estado; todas siguen siendo online, con motivo y revisión/autorización real.
- Fuente ampliada/200%, 360 dp, TalkBack, IME, navegación de gestos/tres botones, recortes e insets sin duplicar.
- Logout/revocación/cambio de cuenta durante lectura, modal o formulario: sin fotos/eventos/vistas privadas restaurables por Atrás.

A–D quedan implementados a nivel de presentación con los límites declarados, pendientes de verificaciones del usuario y Android. No se afirma validación funcional/nativa completa ni se inicia otro rediseño.

## Cierre visual e identidad institucional

### Logo oficial integrado

El archivo original assets/brand/eida-logo.svg se conserva byte por byte y coincide con el autorizado de EIDA Web. SHA-256: bb52c4f7b10ea81dda83dea764bb285285bf1d90edefc6e0adc0f210bd0f58c9.

No están instalados react-native-svg, react-native-svg-transformer, expo-image, expo-font o @expo-google-fonts/poppins. Metro usa getDefaultConfig con su blockList previa; no tiene un transformador SVG configurado. Se eligió la alternativa PNG compatible con Image de React Native, sin instalar paquetes ni modificar Metro.

Se creó assets/brand/eida-logo.png:

- 1520 × 1520, resolución 2× del viewBox 0 0 760 760 original.
- PNG RGBA 8 bits, transparente, 74 575 bytes.
- Los 25 paths originales se renderizaron directamente con sus curvas, rellenos #EC1C24/#013975 y reglas nonzero/evenodd.
- No se reconstruyó desde capturas, no se añadió fondo y no se recoloreó.
- SHA-256: 22c16696158fdeb9a2f79aead87539069021f4264fb9df4ea2ebbf5984d01cc8.

La conversión determinista utilizó las API WPF ya presentes en Windows, cargadas únicamente en el proceso de edición. Solo escribió el PNG dentro de assets/brand. No se ejecutaron scripts del proyecto, instaladores, generadores Expo, compiladores o pruebas; no se modificó Windows ni se descargaron herramientas. Se inspeccionó el bitmap resultante y su cabecera; eso no constituye una prueba de renderizado de la app en Android.

EidaLogo usa un require literal local, resizeMode=contain y dimensiones cuadradas, sin tintColor. resizeMethod=resize permite el tratamiento de tamaño por Image Android. El recurso se muestra a 96 dp en el login y 40 dp en MainHeader de Inicio/Exámenes/Pendientes/Perfil. El tamaño no altera las proporciones ni agrega recortes.

El login tiene etiqueta «Logotipo oficial de EIDA». La copia de cabecera es decorativa para evitar duplicar la lectura de TalkBack; el título sigue siendo un encabezado accesible. El header puede crecer con fuentes ampliadas y conserva sus insets superiores/laterales. No se agrega otro header, navegador o barra del sistema.

No hace falta renderer SVG ni transformador para este logo. Esta entrega integra la marca en la UI; no cambia launcher icon o splash nativo.

### Poppins: recursos pendientes exactos

No se encontraron fuentes locales en assets/src del móvil ni en los recursos autorizados del frontend. Web solo declara Poppins en CSS; eso no proporciona archivos de fuente para Android. No se descargaron fuentes ni se asumió una licencia ausente.

Para integrarla más adelante, el usuario debe aportar archivos legítimos y su licencia:

- assets/fonts/Poppins-Regular.ttf — 400.
- assets/fonts/Poppins-Medium.ttf — 500.
- assets/fonts/Poppins-SemiBold.ttf — 600.
- assets/fonts/Poppins-Bold.ttf — 700.
- assets/fonts/OFL.txt u otro archivo con la licencia que corresponda a esa distribución.

También se necesita expo-font compatible con el SDK instalado. node_modules/expo/bundledNativeModules.json indica ~58.0.11. El usuario puede instalarlo personalmente cuando decida integrar esos recursos:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npx expo install expo-font
```

Este comando es una dependencia pendiente opcional, no fue ejecutado y no es necesario para el logo/estado actual. Después hará falta conectar las cuatro fuentes locales al tema y su carga compatible antes de mostrar la UI; no se añadieron imports a archivos o paquetes inexistentes.

**Poppins no quedó integrada.** Se mantiene la fuente del sistema y su escalado Android, con pesos 400/500/600/700. No hay carga de red, espera nueva, pantalla en blanco por fuentes ni sustitución tardía que cambie la distribución.

### Revisión de consistencia A–D

Se revisaron tokens, cabeceras, pestañas, cards, botones, campos, estados vacíos/carga, modales, mensajes offline, fotos, formularios y la configuración de navegación. Cambios puntuales:

- MainHeader incorpora la marca sin duplicar Safe Area; el título conserva ajuste de líneas y altura dinámica.
- Stack headers usan fontSize/fontWeight del mismo subtitle del tema. No cambian Back, statusBarStyle, navigationBarHidden o contentStyle.
- El tamaño de inputs de 16 dp pasa a theme.typography.input, con lineHeight 24 y peso 400.
- contentStyles.card incorpora el borde tokenizado de Card para que las vistas antiguas de dispositivos/colaboraciones mantengan el mismo tratamiento.
- Dispositivos y colaboraciones reutilizan LoadingState/EmptyState accesibles. Se eliminan títulos repetidos con la cabecera nativa.
- El enlace de incidencias en colaboraciones pasa a «Consultar incidencias y permisos», sin insinuar autoridad por la asignación.
- Los estados e iconos operativos, colores semánticos, objetivos mínimos, virtualización, fotografías protegidas y mensajes de provisionales se conservan.
- El diagnóstico de desarrollo mantiene su presentación de código/monospace; no se cambia el verificador ni se rediseña ese flujo.

No se modifican las pantallas completas, APIs, datos reales o autorización para lograr estos ajustes. La paleta mantiene #0049A8/#172554/#8B1E3F/#EAF3FF; los colores propios del logo permanecen separados de los tokens de controles.

### Ajuste mínimo del formulario de Infracciones

El efecto previo reiniciaba body, student y submitted al variar p.manage/runtime, incluso cuando una revalidación temporal volvía a autorizar la misma cuenta. Se separó la inicialización visual por ámbito en src/ui/infractionFormScope.ts:

- Cuenta, dispositivo, examen y draftId identifican el formulario.
- Para un borrador protegido también se considera la identidad del runtime: bloquear/cambiar el almacén retira sus datos y exige leerlo de nuevo.
- Una consulta temporal de permisos (manage desconocido) conserva los campos en memoria, pero la UI no los muestra hasta recuperar autorización.
- Una denegación explícita o pérdida de sesión limpia los campos privados y no concede acceso.
- El borrador solo se hidrata con permisos actuales del examen correcto y almacén disponible. Se mantienen drafts(), repo.student y r.check originales.
- Cambiar el runtime no vuelve a habilitar el envío del mismo registro; submitted se reinicia únicamente para otro formulario lógico, no por revalidar permisos.
- Las funciones create y change, la autorización fresca del servidor, expected_revision, beginDraft/finishDraft y work/submitted de las mutaciones no se modifican.
- La revalidación vuelve a estar disponible con cambios sin guardar: los conserva si el servidor confirma la misma autorización. El motivo de un cambio de estado sigue protegido al salir incluso después de un registro.
- Cancelar la salida conserva campos; descartar solo limpia memoria de formulario. No se crea persistencia nueva.

**La pérdida de sesión sigue retirando las pantallas privadas.** No se modifica SessionController, Stack.Protected ni SecureStore. No se promete recuperar un formulario tras logout, revocación, pérdida de autorización, cierre del proceso o retirada de la ruta. Resolver la recuperación más allá de esos límites requeriría otra decisión funcional, por ejemplo persistencia cifrada autorizada.

Los cambios quedan en estado de UI y en su efecto de inicialización. No se modificó el servicio de Infracciones, ni sanciones, idempotencia del backend, SQLCipher, incidentes o contratos.

### Archivos de este cierre

Nuevos:

- assets/brand/eida-logo.png.
- src/config/identity.ts.
- src/components/general/EidaLogo.tsx.
- src/ui/infractionFormScope.ts.
- tests/visual-closure.test.ts.

Modificados:

- assets/brand/README.md.
- src/components/general/EidaBrand.tsx.
- src/components/MainHeader.tsx.
- src/components/contentStyles.ts.
- src/components/FormField.tsx.
- src/config/theme.ts.
- src/navigation/options.ts (solo tipografía).
- src/screens/InfractionsScreen.tsx (solo ámbito/estado visual del formulario).
- src/screens/CollaborationsScreen.tsx (solo presentación).
- src/screens/DevicesScreen.tsx (solo presentación).
- Este documento.
- docs/EIDA_CONTROL_FASE_2_EXPO_QR.md.
- docs/HISTORIAL_FASE_2.md.

No cambian package.json, lockfile, Metro, rutas/layouts, providers, servicios, módulos nativos o android/. Backend no se consultó; frontend se leyó únicamente para confirmar recursos y huella del logo. No se accedió a .env, repositorios -compare ni Git.

La comprobación de huellas de 92 archivos encontró únicamente los cambios previstos de README de marca y theme. Los restantes —features, services, hooks, rutas, módulos nativos, Screen/ScreenFrame/ListScreen, helpers de Back/salida, original SVG, package/lock, Metro y tres archivos Android seleccionados— permanecen idénticos. Además se compararon las funciones create y change de Infracciones antes/después: no cambiaron. Es inspección estática, no aprobación de pruebas.

### Siete pruebas nuevas, no ejecutadas

tests/visual-closure.test.ts comprueba mediante código:

1. Huella del SVG oficial, sus 25 paths y colores, y huella del PNG derivado.
2. PNG real: resolución cuadrada, canal alfa/transparencia y presencia de ambos colores sólidos originales. Se decodifican filtros PNG y zlib con módulos estándar de Node solo dentro del test.
3. Paleta oficial, alternativa de fuente del sistema, tamaño de input y escala compartida de headers.
4. Revalidación temporal del mismo formulario sin reinicializar campos o barrera de envío.
5. Denegación/pérdida de sesión y limpieza de datos privados con la guarda existente.
6. Cambio de cuenta, dispositivo, examen o borrador; ausencia de reinicio de un formulario online por un bloqueo local ajeno.
7. Hidratación de borrador condicionada a runtime/permiso y conservación de la barrera al cambiar runtime del mismo registro.

No se ejecutaron estos tests, typecheck ni las pruebas anteriores. Tampoco se instaló un renderer de tests React Native. La integración real de Image, headers y efecto React se debe validar en Android; los tests puros no acreditan el montaje nativo ni la conservación física del foco.

### Comandos personales y comprobación Android

Para el estado actual no hay dependencias nuevas, transformador o Prebuild requerido por estos cambios JS/PNG. El usuario debe ejecutar:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Con una development build ya compatible:

```powershell
npm run start
```

Pendientes antes de distribuir:

- Ver el logo en login y las cuatro cabeceras sobre fondos reales: transparencia, proporción, contraste, ausencia de tintes, calidad y memoria en un Android de gama media.
- Fuente normal/ampliada/200%, ancho 360 dp y nombres/títulos largos: que el logo no cubra títulos ni acciones, y que no haya alturas rígidas de cabecera.
- TalkBack: etiqueta del logo en login, logo decorativo en header, títulos y controles legibles.
- Teclado en login, búsqueda y formularios, modo gestos/tres botones y Safe Area sin padding duplicado.
- Escribir/seleccionar un estudiante en Infracciones; revalidar la misma autorización y comprobar campos y submitted; denegar permiso y comprobar que no se revelan datos anteriores.
- Borrador cifrado: bloquear/cambiar runtime durante consulta; no debe verse mientras está cerrado y el envío incierto no debe habilitarse por ese cambio.
- Logout/revocación/pérdida de sesión: no conservar vistas privadas accesibles ni frenar las guardas con un diálogo de salida.
- Regresión A–D, SQLCipher/PRAGMA cipher_version, fotos, cámara, registro provisional y ambas colas en la build nativa real. Esta revisión no sustituye esas pruebas.
- MOBILE_ABILITY_REQUIRED sigue requiriendo habilitación real de backend; no se eliminan controles.
- Poppins continúa pendiente si se exige coincidencia tipográfica institucional exacta. La alternativa actual es el sistema, sin inventar una fuente de marca.

El logo queda integrado y el cierre mantiene el diseño existente. No se declara APK lista para distribuir sin typecheck/tests del usuario, verificación Android y resolución de los requisitos funcionales/nativos pendientes. No se generó APK ni comenzó otra fase.
