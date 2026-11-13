# EIDA Control — rediseño post-APK, Bloque 1

Fecha: 10 de noviembre de 2026.

## Alcance y estado

Se implementó el rediseño de Login, Inicio, Exámenes y Detalle del examen en `C:\proyecto\eida-mobile`.

**Estado: implementado en código; pruebas escritas y validación Android pendientes.** No se ejecutaron pruebas, typecheck, Expo, compilaciones ni herramientas Android. No se afirma que el renderizado físico coincida píxel a píxel con los mockups.

El Bloque 2 no se inició. No se modificaron servicios, contratos HTTP, autenticación, permisos, SQLCipher, SecureStore, claves, outbox, cámara, verificador QR, sincronización, incidencias o disciplina. La excepción de laboratorio `__DEV__` continúa como estaba: este bloque solo lee su estado para mantener el aviso en el detalle.

## 1. Referencias utilizadas

Las cuatro capturas adjuntas en este mensaje son la referencia visual prioritaria:

1. **Login:** marca centrada, título EIDA Control, formulario simple, control de visibilidad de contraseña y acción azul.
2. **Inicio:** saludo breve, tarjeta marina del examen y accesos secundarios compactos.
3. **Mis exámenes:** filtros agrupados, tarjetas claras con materia/tipo/fecha/ambiente/rol y Abrir examen.
4. **Detalle del examen:** jerarquía de materia y tipo, Mi lista, Controlar ingreso, Preparar lista offline y opciones secundarias.

Se aplicó la guía de diseño a código de Figma, adaptada a React Native. Para este bloque se trabajó con las capturas aportadas; no se atribuye a una consulta nueva de Figma MCP ningún contenido que no se haya consultado. No se descargaron assets ni se generó código web.

Las capturas no se utilizaron como imágenes de fondo ni como implementación. Se conservaron el PNG oficial local y su proporción; no se sustituyó por el texto de un logotipo inventado.

## 2. Identidad y componentes

Se mantienen los tokens existentes:

| Uso | Color |
| --- | --- |
| Principal | `#0049A8` |
| Marino | `#172554` |
| Carmesí | `#8B1E3F` |
| Fondo | `#EAF3FF` |

Fuente: sistema. No se instaló Poppins, una librería de iconos ni otra dependencia.

Logo: `assets/brand/eida-logo.png`, sin modificar. Se inspeccionó visualmente el archivo existente. Sigue renderizándose mediante EidaLogo con resizeMode contain, a 96 dp en login y 40 dp en el header. La nueva composición centra el mismo asset; no cambia sus píxeles, colores, recorte ni relación de aspecto.

### Nuevos componentes de presentación

- **ExamIcon:** iconos decorativos mediante trazos nativos. Reutiliza MainTabIcon para calendario, reloj y persona; agrega ubicación, chevron, descarga, lista, acciones y ojo.
- **ExamMeta:** fecha natural, hora y datos opcionales de ambiente/relación, con ajuste de línea.
- **ExamActionRow:** acceso secundario con icono, etiqueta, descripción opcional y chevron; mínimo táctil y estado disabled accesibles.

### Componentes reutilizados o adaptados

Screen, ScreenFrame, ListScreen, Safe Area, ActionButton, AppText, Card, Notice, StatusBadge, QueryFeedback, EmptyState, TextAction, FormField, EidaBrand/EidaLogo, MainHeader, MainTabBar, ExamCard, ExamFilters, ExamHero, PreparationStatus y DistributionListCard.

FormField incorpora un accesorio trailing opcional para el ojo de contraseña. Cuando no recibe ese accesorio conserva el TextInput directo de su estructura anterior. Se preservan refs, foco, validación, etiquetas y callbacks.

## 3. Pantallas modificadas

### Login

- Marca centrada con EIDA Control y Control de ingreso a exámenes.
- Se retiró la tarjeta exterior del formulario y los títulos duplicados.
- Correo/código y contraseña conservan sus reglas, datos y límites.
- Mostrar/ocultar contraseña se presenta como ojo dentro del campo, con etiqueta accesible y área táctil de al menos 48 dp.
- El botón Iniciar sesión sigue siendo único y se mantiene en el footer de Screen.
- Se conservan los mensajes ya corregidos, validaciones por campo, limpieza de contraseña al enviar y selección de destino existente.
- Ayuda, paquetes offline y diagnóstico existente quedan bajo Más opciones.
- El cierre remoto pendiente y sus acciones no se esconden en ese menú.
- Se conserva la identidad UMSS; no se muestra “prototipo demostrativo” porque la app ya es funcional.

**Adaptación del mockup:** el CTA queda anclado en el footer en lugar de imitar una posición fija debajo del formulario. Esto conserva la corrección del teclado. El formulario puede desplazarse si falta altura.

La etiqueta conserva “Correo o código institucional”: el contrato actual acepta ambos. No se restringió silenciosamente el inicio de sesión a correos.

### Inicio

- Saludo breve con el nombre realmente informado por la sesión.
- Tarjeta marina con materia como título y nombre del examen como subtítulo cuando son diferentes.
- Fecha/hora naturales, ambiente solo cuando existe y relación real de docencia/colaboración.
- Continuar control usa el ID del examen elegido y la ruta existente.
- Accesos compactos a Mis exámenes, Mis colaboraciones cuando corresponde, y pendientes.
- Los contadores proceden de respuestas reales o del almacén cuya lectura ya es conocida. No se muestra cero por defecto mientras el almacén esté bloqueado.
- Se retiraron tarjetas de estadísticas redundantes, explicación de roles globales, hora técnica y párrafos sobre operación interna.

#### Selección del examen destacado

1. Se consideran los exámenes propios devueltos por la consulta upcoming existente.
2. Se prioriza IN_PROGRESS; después SCHEDULED, ordenando fecha/hora e ID entre los registros devueltos.
3. No se presenta el resultado como el “siguiente global” cuando la respuesta está paginada. El rótulo es Examen asignado.
4. Una colaboración única puede destacarse como asignación, sin inventarle estado de examen.
5. Si hay varias colaboraciones y faltan estados suficientes para seleccionar una, se ofrece elegir desde las rutas existentes.
6. Una respuesta nula, error o consulta en curso no equivale a “sin exámenes”.

No se añadieron horarios, ambientes, porcentajes, estados HOY o exámenes de demostración.

### Exámenes

- Se mantiene ListScreen/FlatList con virtualización.
- Se conservan página de 10, query, parámetros y límite del backend.
- Los cambios de vista/página conservan la frontera keyed que descarta resultados anteriores.
- Filtros con fondo claro y selección blanca, adaptables a dos filas cuando la anchura o la fuente lo requieren.
- Tarjetas con materia, nombre real del examen, fecha/hora, ambiente opcional, relación, estado real y preparación local diferenciada.
- Una acción principal por tarjeta: Abrir examen.
- Incidencias queda accesible desde el detalle, donde se comprueba su permiso.
- Se mantienen Anterior/Siguiente, actualización y acceso a colaboraciones.
- No se añadieron efectos de foco ni recargas al volver a la pestaña.

#### Filtros reales

El contrato actual admite `upcoming`, `past`, `cancelled` y `all`. Se conservan como:

- Próximos y activos.
- Anteriores.
- Cancelados.
- Todos.

**Diferencia necesaria:** no se introdujo un filtro “En curso” que filtrara solamente una página y pudiera ocultar resultados existentes en otras páginas. La vista conjunta conserva el significado de la consulta real. No se cambió el backend ni se descargaron todas las páginas para reconstruir un filtro local.

### Detalle del examen

La ruta existente offline-distribution se presenta ahora con título Detalle del examen.

- Encabezado plano: materia, nombre real del examen, fecha/hora, ambiente disponible y relación.
- Mi lista muestra únicamente asignación propia y cantidad conocida. Un valor desconocido no se convierte en cero.
- PreparationStatus conserva los estados diferenciados y el conocimiento del almacén bloqueado.
- **Controlar ingreso** abre la lista de estudiantes existente; solo se habilita para el paquete propio preparado y con acceso permitido.
- **Preparar lista offline** llama al mismo `offline.download(examId)` de HU36; no se implementó otro downloader.
- Se mantiene Desbloquear mi lista cuando hace falta abrir el almacén existente, sin crear pantallas biométricas.
- El docente conserva la preparación HU35 mediante el servicio existente.
- La distribución general se despliega al pedir Supervisar distribución.
- Las acciones adicionales se organizan como filas: incidencias, seguimiento de registros propios, acciones autorizadas, supervisión y paquetes.

La consulta de acciones usa `DisciplineApi.context` existente, solo después de obtener el contexto del examen. No se modificó ese servicio ni su contrato. Se ignoran resultados cancelados y se exige que el ID de permiso coincida con el examen.

- Incidencias requiere el permiso de lectura devuelto por el servidor.
- Infracciones/expulsiones/anulación requieren manage explícito; no se infieren de un rol global o del texto Docente.
- Los controles de cada pantalla destino y del backend siguen vigentes.
- Si faltan abilities/rutas en el servidor, se ocultan esas acciones y se ofrece volver a consultar. Esa condición no se presenta como que la app haya concedido el permiso.
- Seguimiento significa consultar los ingresos/recibos propios en la pantalla de sincronización existente. No se inventó un endpoint de seguimiento general del examen.

El aviso existente de laboratorio se presenta brevemente; no se amplió ni se cambió la política de protección.

## 4. HU35/HU36 y seguridad preservadas

La presentación reutiliza `distributionAccess` y `ownExamPackages`:

| Contexto | Resultado |
| --- | --- |
| Colaborador con lista propia | Ve su asignación y puede actuar sobre su paquete cuando los guardas existentes lo permiten. |
| Colaborador sin lista | No recibe botones para descargar listas de otra persona. |
| Docente con supervisión, sin lista propia | Puede revisar distribución/prepararla cuando esté permitido; no descarga listas ajenas. |
| Paquete preparado de otro examen/lista | No se utiliza como paquete local del detalle actual. |
| Almacén bloqueado | No se utiliza el contenido local ni se inventa cantidad preparada. |
| Distribución stale o unavailable_reason | Se mantienen bloqueados control/preparación según las condiciones existentes. |
| Sin concesión online vigente | No se habilita preparar/actualizar paquete. |
| Lista local propia válida con acceso offline | La presentación no añade una nueva exigencia de red para el control local; el destino conserva sus validaciones de vigencia/reloj. |

Se conserva la detección existente de cambio de contexto y la marca DESACTUALIZADO ante los casos ya manejados por el flujo de consulta. No se regeneran distribuciones ni se alteran miembros o esquemas.

No se modificaron `nativeVault.ts`, `protection.ts`, `offlineLab.ts`, servicios HU35/HU36/HU37, el reloj, las claves ni el verificador QR en este bloque.

## 5. Navegación y estados

- Se conservan las cuatro pestañas y la misma MainTabBar.
- Solo Inicio y Exámenes optan por la alineación compacta del header compartido. Pendientes y Perfil conservan su presentación anterior.
- No se creó una segunda barra inferior ni un header pintado dentro del contenido.
- La raíz mantiene Protected y el ancla login.
- El layout privado mantiene su gate sin Redirect competidor.
- Login conserva su mecanismo de destino y la acción logout no recibió nuevas llamadas de navegación.
- No se agregaron efectos que reaccionen al objeto completo de sesión o permisos para navegar.

Rutas conservadas:

| Flujo | Ruta |
| --- | --- |
| Inicio | `/(private)/(tabs)/index` |
| Exámenes | `/(private)/(tabs)/exams` |
| Detalle | `/(private)/offline-distribution?examId=...` |
| Control de ingreso | `/offline/list?packageId=...` |
| Colaboraciones | `/(private)/collaborations` |
| Pendientes | `/(private)/pending` |
| Incidencias | `/(private)/incidents?examId=...` |
| Infracciones | `/(private)/infractions?examId=...` |
| Expulsiones/anulación | `/(private)/discipline-actions?examId=...` |

Las rutas de pestañas conservan sus alias de navegación existentes, sin mover archivos. Al volver desde detalle se conserva el origen del stack: Exámenes mantiene su contexto de vista/página; si se abrió desde Inicio se vuelve a Inicio.

**Diferencia con la captura:** Detalle sigue fuera del grupo de pestañas, como en la estructura actual. Conserva header/Atrás nativos y no clona una barra inferior decorativa. No se reestructuraron rutas para simular la barra del mockup.

### Conectividad

No hay un monitor de conectividad continua en el contrato inspeccionado. Una sesión validada no demuestra acceso actual a internet. Por ello no se inventó un indicador verde permanente de “Con conexión”.

Se conservan errores/reintentos de consulta y la política de sesión: un fallo de red puede retirar las rutas privadas y conducir al flujo existente de validación/acceso offline. No se añade caché de exámenes privados para mantener un dashboard visible después de perder autorización. El estado sin conexión se sigue gestionando con los guardas y pantallas existentes.

## 6. Textos simplificados

En las pantallas de este bloque se retiraron o redujeron:

- America/La_Paz como texto visible; la zona se mantiene internamente al formatear.
- Descripciones de HU35, reparto en Laravel, hashes, versiones y atribuciones técnicas.
- Explicaciones extensas sobre copias protegidas/colas en Inicio.
- Contadores de copias, conflictos y tarjetas operativas redundantes.
- Duplicación de marca/título en login.
- Acciones de incidencias por cada tarjeta de exámenes.
- Detalle de distribución desplegado permanentemente.

Se conservaron errores de operación que el usuario necesita resolver, restricciones de acceso, cierre remoto pendiente y estados de datos desconocidos. No se ocultó una operación fallida presentándola como exitosa.

## 7. Archivos modificados y creados

| Archivo | Cambio |
| --- | --- |
| `src/screens/LoginScreen.tsx` | Composición limpia, ojo integrado, opciones secundarias agrupadas; mismo footer y submit. |
| `src/screens/HomeScreen.tsx` | Examen destacado real y accesos compactos. |
| `src/screens/ExamsScreen.tsx` | Listado compacto con consulta/paginación existentes. |
| `src/screens/OfflineDistributionScreen.tsx` | Detalle del examen y acciones condicionadas por autorización. |
| `src/components/FormField.tsx` | Trailing opcional sin alterar el campo cuando no se utiliza. |
| `src/components/ActionButton.tsx` | Icono opcional en las acciones de control; estado busy/disabled conservado. |
| `src/components/MainHeader.tsx` | Variante compacta opcional; default conservado. |
| `src/components/general/EidaBrand.tsx` | Marca centrada y subtítulo del login. |
| `src/components/general/ExamCard.tsx` | Jerarquía compacta y acción Abrir examen. |
| `src/components/general/ExamFilters.tsx` | Presentación agrupada, mismas vistas del backend. |
| `src/components/control/ExamHero.tsx` | Encabezado plano para detalle. |
| `src/components/general/ExamIcon.tsx` | Nuevo: iconografía nativa decorativa/reutilizada. |
| `src/components/general/ExamMeta.tsx` | Nuevo: metadatos legibles y adaptables. |
| `src/components/general/ExamActionRow.tsx` | Nuevo: acceso secundario reutilizable. |
| `src/ui/examPresentation.ts` | Nuevo: utilidades puras de presentación y selección de datos conocidos. |
| `src/app/(private)/(tabs)/_layout.tsx` | Títulos/header compactos solo en Inicio y Exámenes. |
| `src/app/(private)/_layout.tsx` | Título Detalle del examen; guard intacto. |
| `tests/support/renderPresentation.ts` | Nuevo: render de funciones de presentación con hosts nativos sustituidos. |
| `tests/redesign-block1.test.ts` | Nuevo: regresiones del bloque. |
| `docs/EIDA_CONTROL_REDISENO_POST_APK_BLOQUE_1.md` | Este informe. |

## 8. Pruebas escritas

**No ejecutadas.** Se añadieron casos para:

- Jerarquía materia/nombre sin inventar tipo de examen.
- Fechas naturales y valores malformados.
- Selección de examen activo/programado entre datos recibidos, sin mutar respuesta.
- Colaboración única sin estado inventado y elección manual cuando hay ambigüedad.
- Carga/error separados de estado vacío.
- Filtros que conservan los valores reales del backend.
- Preparación desconocida, paquete ajeno, paquete inactivo y snapshot anterior.
- Docente supervisor sin paquete propio.
- Colaborador con acceso exclusivo a su lista.
- Distribución desactualizada, busy, almacén bloqueado y falta de red para preparar.
- Acciones disciplinarias solo con permisos explícitos del mismo examen.
- Render real de los componentes stateless ExamCard, ExamHero, ExamMeta, ExamFilters, ExamActionRow y EidaBrand, sustituyendo únicamente hosts nativos y hojas de presentación.
- Selección, callbacks, disabled, etiquetas accesibles, logo y ausencia de textos técnicos en tarjetas.
- Estructura de login con CTA único en footer, visibilidad de contraseña y validaciones conservadas.
- Root/guard y virtualización sin efectos de foco nuevos.

Las pruebas anteriores de login, logout, teclado, FlatList y roles permanecen. No se modificaron sus expectativas para acomodar una regresión.

El harness no monta un navegador Android, un teclado ni un dispositivo. No acredita tamaños renderizados, TalkBack o ausencia física del Maximum update depth: eso se verifica en Android.

## 9. Validación manual pendiente

El usuario debe ejecutar:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Después, con su procedimiento de actualización de JS/APK:

1. **Login:** logo, marca, campos, ojo, errores locales y del servidor, opciones y cierre pendiente.
2. **Teclado:** correo/contraseña a 360 dp, teclado abierto/cerrado, CTA visible, campos desplazables y fuentes ampliadas.
3. **Logout:** una transición al login, Atrás sin volver a datos privados, requests anteriores descartadas y segunda cuenta aislada.
4. **Inicio:** activo/programado, sin exámenes, varias colaboraciones, carga parcial/error y datos desconocidos del almacén.
5. **Exámenes:** todas las vistas reales, paginación, retorno desde detalle sin perder página y ausencia de consultas nuevas al cambiar pestaña.
6. **Detalle:** docente, colaborador, supervisor sin lista, sin distribución, lista sin preparar/preparada/incompleta/desactualizada y almacén bloqueado.
7. **Acciones adicionales:** permisos positivos, denegados y endpoint/ability no desplegado; no mostrar sanciones por un rol global.
8. **HU35/HU36:** preparar usando los mismos servicios, acceso solo a lista propia y conservación de pendientes.
9. **Sistema:** Safe Area, edge-to-edge, gesto y botón Atrás, tres botones Android, TalkBack, contraste, fuentes grandes y nombres largos.
10. **Visual:** comparar con las cuatro capturas, incluyendo los cambios necesarios de logo oficial, fuente del sistema, filtros, footer y stack de detalle.

No hay dependencias nuevas ni cambios nativos que requieran instalación o Prebuild. Una APK con bundle incorporado necesita actualizar ese bundle mediante la generación correspondiente para reflejar los cambios; editar archivos locales no actualiza una APK ya instalada.

## 10. Registro de restricciones

Solo se realizaron lecturas y ediciones de código/documentación dentro del repositorio autorizado, además de leer el prompt y la guía de skill proporcionados.

No se ejecutaron npm/npx, pruebas, typecheck, Expo, Metro, Prebuild, Gradle, ADB, compilaciones, migraciones ni Git. No se modificaron android/, SDK, Java, Node, NDK, CMake, entorno Windows, unidades o junctions. No se instalaron dependencias, no se accedió a -compare y no se modificaron backend/frontend.

No se hicieron capturas de una app ejecutándose ni se inventaron resultados de pruebas.

## 11. Ajustes finales del Bloque 1

### Actualización mediante gesto

- Retirados los botones de consulta rutinaria de Inicio, Exámenes, Detalle del examen, Colaboraciones, Perfil, Dispositivos, lista y detalle de Incidencias oficiales, Infracciones, Acciones disciplinarias e Incidencias locales.
- Arrastrar hacia abajo desde el inicio del contenido activa `RefreshControl` en el `ScrollView` o `FlatList` existente. El indicador usa el azul EIDA. TalkBack dispone de la acción «Actualizar contenido» en el contenedor. Los errores mantienen una acción de reintento cuando corresponde.
- La misma lectura en curso se comparte entre llamadas. El gesto comprueba la autorización privada actual y el vencimiento antes de consultar. Una respuesta de una pantalla desmontada o de un filtro anterior se descarta. En incidencias e infracciones, primero se revalida el permiso y las consultas dependientes se disparan con el permiso recibido.
- Las consultas de detalle y permisos conservan la invalidación de copias y la revisión de permisos locales que ya aplicaban por seguridad. El gesto no prepara distribuciones, descarga paquetes ni envía registros.
- Incidencias locales vuelve a leer estados y borradores del almacén abierto, incluso sin internet. En Paquetes se conserva «Verificar vigencia de copias locales» como acción explícita, porque la operación existente puede persistir vencimientos y reconciliar la cola. En el detalle se conservan los controles de preparación y descarga, y en Perfil la validación explícita de sesión. Sincronizar y confirmar siguen requiriendo su propia acción.

### Páginas y orden de exámenes

- Las flechas del pie muestran `‹ 1 / 3 ›`, con objetivos de 48 dp, etiquetas para TalkBack y estados deshabilitados en los extremos y durante la carga. Con cero a cinco exámenes el pie se oculta. El cambio de página conserva el filtro y desplaza la lista al inicio.
- `GET /teacher/exams` admite únicamente `per_page=10`. Se presentan hasta cinco exámenes por página visual, reutilizando ambas mitades de la misma respuesta. Solo se consulta otro bloque al cruzar el límite de diez o al actualizar. El total visual se calcula con `total` y se verifica con `last_page`, `per_page` y `current_page`. Los metadatos ausentes o incoherentes producen un error recuperable. Si el total disminuye, se vuelve a la última página válida.
- Para «Próximos y activos», Laravel ordena globalmente por fecha, hora e ID ascendentes. Para «Anteriores», «Cancelados» y «Todos» ordena en sentido descendente. En las vistas de varias páginas se conserva ese orden. El servidor carece de un criterio global por estado o proximidad para «Todos». Un examen marcado en curso puede quedar detrás de otro si el servidor lo devuelve en una página posterior.
- Cuando «Próximos y activos» o «Todos» cabe por completo en una respuesta, se prioriza el estado oficial en curso o un examen programado dentro de su horario y duración informados. Después van los programados futuros de más cercano a más lejano y luego el resto. Los empates con fecha y hora usan el ID. Los registros sin horario válido no reciben uno ficticio y mantienen el orden de respuesta entre ellos dentro de su grupo. Las horas se interpretan en La Paz y la tarjeta conserva el estado oficial.
- Inicio destaca el primer examen docente elegible del mismo orden que utiliza «Próximos y activos». Si falta un candidato docente, se conserva la opción de mostrar una única colaboración autorizada con estado desconocido.

### Archivos y verificación

- Componentes compartidos `Screen`, `ListScreen`, `screenRefresh`, `ExamPagination` y `ExamMeta`. Lógica en `useRemoteQuery`, `useScreenRefresh`, `usePrivateRefresh` y `examPresentation`, además de las pantallas indicadas arriba.
- Pruebas escritas en `block1-refresh.test.ts`, `redesign-block1.test.ts`, `ui-typescript-regressions.test.ts` y `exams.test.ts`. Cubren control nativo y acción accesible, consultas concurrentes, reintento, sesión vencida, desmontaje, navegación disponible, 0/1/5/6 resultados, extremos de página, metadatos incompletos, orden entre respuestas y coherencia entre Inicio y Exámenes.
- Validación pendiente en Android con el procedimiento de la sección 9. Comprobar el gesto con listas vacías y cortas, el indicador con red lenta, Atrás y pestañas durante la carga, reintento tras un error, bloqueo de sesión, acciones de TalkBack, cambio de página entre bloques, tamaño de fuente ampliado y lectura local sin conexión. Las pruebas, el typecheck y la compilación quedan para ejecución manual del usuario.

