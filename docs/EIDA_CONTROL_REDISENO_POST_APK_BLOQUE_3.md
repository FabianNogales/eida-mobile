# EIDA Control · Rediseño post-APK del Bloque 3

## Referencias y cambios visuales

La captura de Pendientes sirvió de referencia para el encabezado compacto con el logo oficial, los segmentos Ingresos e Incidencias, el botón Sincronizar y las filas breves con icono, fecha y estado. La captura de Detalle de sincronización guio la jerarquía del encabezado, el estado visible, las filas de datos y la acción Volver. Las variaciones de carga, error y resultado usan la misma paleta y los componentes del proyecto.

Los nombres ficticios de Figma se sustituyen por los identificadores de estudiante y examen de los registros locales. Las incidencias muestran el tipo y solo incluyen un estudiante cuando el evento lo identifica. La fecha se presenta en hora de La Paz. El detalle muestra el método de ingreso o la descripción del reporte y los motivos disponibles en lenguaje sencillo.

## Estados, filtros y navegación

- La pestaña Pendientes y los accesos existentes desde Paquetes y Control comparten una lista virtualizada. La pestaña muestra ambos segmentos y cada acceso directo abre su cola correspondiente. Se conserva el enlace al reporte oficial para sesiones de la cuenta original y el acceso a borradores desde Incidencias locales.
- Los contadores representan operaciones pendientes o en envío. Un almacén bloqueado o que falla al leer deja el contador sin valor. Un ingreso guardado puede contar como pendiente antes de que esté disponible su fila de detalle.
- El control Filtros abre Todos, Por enviar, Confirmados o Recibidos, Conflictos y Rechazados. Duplicados está disponible en Ingresos. Los filtros se guardan por segmento y Atrás o Volver cierran el detalle con la lista montada.
- Confirmado requiere un recibo válido de aceptación. Los duplicados se distinguen de los ingresos aceptados. En incidencias, Reporte recibido representa el acuse del servidor y la marca de revisión se muestra por separado.
- Los detalles son modales del flujo existente. En Android usan Safe Area y cierre con Atrás. Las cuatro pestañas permanecen en la navegación principal y el modal ocupa su propia pantalla.

## Lectura y sincronización

Arrastrar hacia abajo o usar «Actualizar contenido» en TalkBack vuelve a leer las colas protegidas. La lectura usa los repositorios existentes y comparte una consulta en curso. El estado vacío solo se muestra después de una lectura válida. El gesto consulta datos locales sin iniciar un envío.

Sincronizar requiere registros pendientes, almacén disponible y una sesión válida de la cuenta y el dispositivo originales. El botón verifica el acceso al servidor con la consulta existente de la cuenta antes de invocar el sincronizador correspondiente. La pantalla indica «Conexión comprobada» durante ese intento y «Sin conexión» cuando la sesión informa ese estado.

La pantalla bloquea pulsaciones simultáneas antes de consultar al servidor y utiliza las acciones de sincronización existentes. Ingresos muestra el progreso de recibos procesados cuando hay un total disponible. Incidencias usa un indicador indeterminado. La lógica existente conserva los registros sin recibo para reintento.

El resumen compara los recibos verificados con los registros pendientes conocidos al iniciar el intento. Si el alcance inicial no incluyó todos los identificadores, solo muestra el total restante verificable. Incidencias carece de una categoría de duplicados. Las advertencias se basan en los estados y motivos disponibles y el resumen permite ver los resultados o volver a la lista.

## Archivos

- Pantallas `PendingOverviewScreen.tsx`, `OfflineSyncScreen.tsx` y `OfflineIncidentsScreen.tsx`.
- Nuevos componentes de segmentos, filas y detalle en `components/operations/QueueViews.tsx`. Se reutilizan `ListScreen`, `OperationDetails`, `StatusBadge`, `Notice`, `ProgressBar` y `ChoiceChips`.
- Utilidades de presentación en `ui/queuePresentation.ts`. El título compacto de Pendientes se configura en la navegación de pestañas.
- Pruebas nuevas en `tests/redesign-block3.test.ts` y ajuste de la prueba de estados vacíos en `tests/ui-typescript-regressions.test.ts`. Las suites existentes de sincronización e incidencias cubren idempotencia, respuestas parciales y fallos de transporte.

## Validación pendiente en Android

Ejecutar manualmente `npm run typecheck` y `npm test`. En Android, comprobar diseño a 360 dp y con fuente ampliada, TalkBack, el gesto con colas cortas o vacías, Atrás desde el detalle y la conservación del filtro y la posición. Verificar bloqueo y desbloqueo del almacén, cambio de cuenta, pérdida de conexión antes y durante el envío, pulsaciones repetidas y resumen tras recibos parciales. Probar también el regreso a la cola desde las rutas de Paquetes, Control e Incidencias locales.
