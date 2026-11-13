# EIDA Control · Rediseño post-APK del Bloque 2

## Referencias y adaptación

Las cinco capturas de Figma Make muestran Control de ingreso, Detalle del examen, Revisar ingreso y Preparar lista offline en dos estados. La implementación sigue la jerarquía visual de esas referencias con los colores y la tipografía del Bloque 1. El escáner, la ficha separada y el resultado se diseñaron con los mismos componentes porque no tienen una captura propia en el encargo.

La preparación refleja el almacén y la autorización reales. Se omiten los controles de demostración «Error» y «Vencida». La conexión solo se indica cuando la sesión ha observado un fallo de red. Las cuatro pestañas siguen en la navegación principal y las pantallas operativas conservan sus pilas existentes y su encabezado nativo.

## Flujo de trabajo

| Pantalla | Comportamiento |
| --- | --- |
| Detalle del examen | «Controlar ingreso» abre la copia autorizada y preparada. «Preparar lista offline» lleva al estado de la lista asignada. |
| Preparar lista offline | Muestra el examen, el total si se conoce y el estado de preparación. El indicador es indeterminado. La copia debe estar activa y pasar la verificación local de vigencia para ofrecer «Ir al control de ingreso». El reintento puede continuar una preparación incompleta. El bloqueo conserva la acción de desbloqueo vigente. |
| Control de ingreso | Muestra el examen, «Escanear QR», la búsqueda y las filas compactas. La lista virtualizada conserva la espera de 200 ms, la normalización existente y las páginas de 50. La actualización por gesto vuelve a consultar la copia local. Una copia bloqueada, vencida o con error se distingue de una lista vacía o sin coincidencias. |
| Ficha del estudiante | Muestra SIS, CI, estado de habilitación e ingreso conocido. Las fotos proceden del almacén protegido y se verifican antes de mostrarlas. Atrás cierra la ficha y conserva la búsqueda, la página y el examen. |
| Escáner QR | Usa la vista real del adaptador, con marco decorativo. La lectura inicia cuando el paquete está vigente y la cámara concede acceso. «Buscar manualmente» vuelve a la misma lista y enfoca el buscador. Tras un resultado se puede volver al control o escanear otro QR. |
| Revisar ingreso | Usa la misma presentación para QR y búsqueda manual. Muestra el método, el examen, la foto disponible y el documento enmascarado. «Confirmar ingreso» es el paso que llama al registro existente. |
| Resultado del ingreso | «Ingreso registrado» lleva el estado «Pendiente de sincronización». «Ingreso confirmado» exige un recibo de aceptación correspondiente al mismo evento. Los duplicados, conflictos y rechazos tienen mensajes propios y permiten desplegar el detalle disponible. |

Los textos del flujo diario se redujeron a estados y acciones concretos. En las filas solo aparecen nombre, SIS y estados pertinentes. El lector externo queda bajo una acción secundaria. Las fotografías adicionales permanecen disponibles para verificar la identidad.

## Permisos y datos protegidos

La consulta de preparación usa el contexto autorizado del examen y limita la selección de paquetes a la lista propia. El desbloqueo, la concesión del dispositivo y la verificación de vigencia siguen a cargo de los mecanismos existentes. El escáner conserva el adaptador de permisos, la protección contra capturas repetidas y la verificación offline RS256. Un QR v2 se deriva a búsqueda manual y un QR rechazado carece de ficha y acción de registro. Los tokens y las fotos de revisión permanecen en memoria y no viajan en las rutas.

La ficha manual conserva las comprobaciones de habilitación, vigencia, horario y duplicados. La confirmación sigue pasando por las comprobaciones de captura, integridad, hora y UUID existentes. La consulta local y la sincronización siguen siendo acciones distintas.

## Componentes y archivos

- Pantallas nuevas o modificadas en `src/screens/`: `PrepareOfflineScreen.tsx`, `OfflineListScreen.tsx`, `OfflineScannerScreen.tsx` y `OfflineDistributionScreen.tsx`.
- Presentación en `src/components/control/`: `EntryReview.tsx` comparte ficha visual, revisión y resultado. `StudentRow.tsx` y `StudentDetailModal.tsx` se adaptaron. La antigua `ScanIdentityCard.tsx` fue reemplazada por la vista compartida.
- Se reutilizan `Screen`, `ListScreen`, `Card`, `ActionButton`, `StatusBadge`, `Notice`, `ExamIcon`, `TextAction` y `EntryDetails`. `FormField.tsx` admite ocultar la etiqueta visual conservando su nombre accesible.
- Se añadió `src/ui/entryPresentation.ts`. La ruta de preparación y su título están en `src/app/(private)/prepare-offline.tsx` y `src/app/(private)/_layout.tsx`. El título del control se configuró en `src/app/offline/_layout.tsx`.

## Pruebas y validación pendiente

`tests/redesign-block2.test.ts` cubre estados de preparación, habilitación y privacidad de las filas, render de fotos autorizadas, CI enmascarado, confirmación y cancelación explícitas, resultados y retorno del escáner al buscador. Las suites existentes `control-screens.test.ts`, `offline.test.ts`, `scanner.test.ts`, `operations.test.ts` y `sync.test.ts` cubren las reglas de acceso, búsqueda, QR, repetición y recibos.

Las pruebas y el typecheck quedan para ejecución manual con `npm test` y `npm run typecheck` desde el proyecto móvil. En `ExamPagination.tsx` se corrigió la referencia al radio de las flechas para usar `theme.radius.small`.

En Android, comprobar en 360 dp y con fuente ampliada el marco y el permiso de cámara, el retorno desde ajustes y desde la ficha, TalkBack, el teclado, el gesto sobre listas cortas y el regreso a la misma búsqueda tras varios ingresos. Validar además descarga interrumpida, paquete vencido o bloqueado, QR inválido o de otro examen, lectura repetida, cancelación, ingreso provisional y el cambio de estado al recibir un resultado válido del servidor.
