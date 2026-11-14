# EIDA Control · Diagnóstico del escáner QR en Android

## Causa del bloqueo

En `src/screens/OfflineListScreen.tsx`, el botón usaba `disabled={busy || refresh.refreshing || !p.manifest.qr.available}`. `busy` y `refresh.refreshing` son bloqueos temporales. El aviso persistente «QR no disponible para esta lista» aparecía únicamente cuando `qr.available` era falso en el manifiesto descargado. Para llegar a ese botón, Control ya exige una copia local activa, preparada y utilizable del almacén autorizado. La cámara y su permiso se consultan después de entrar al escáner. Un código QR aún no se ha leído en ese momento.

El cliente obtiene la bandera y el material público de `GET …/offline/package?schema_version=2`. Los antecedentes del proyecto documentan una respuesta por defecto con `qr.available: false`, razón `PRODUCTION_QR_V3_NOT_CONFIRMED` y claves vacías. El mensaje del botón permite identificar la bandera en la copia del Huawei. La razón concreta del paquete y la configuración efectiva del servidor requieren comprobación en el dispositivo o en el despliegue autorizado.

## Cámara, verificación e ingreso

| Requisito | Comprobación |
| --- | --- |
| Paquete autorizado | La ruta del escáner comprueba vigencia y acceso con `repo.usable` antes de cargar la cámara. La bandera del manifiesto, el emisor, la audiencia y las claves públicas determinan si esta lista ofrece verificación offline. |
| Módulo instalado | El proyecto tiene `expo-camera` 58.0.14 y declara el permiso Cámara y el escáner en `app.config.ts`. Una importación fallida muestra un aviso propio. La presencia efectiva del módulo en la APK del Huawei se confirma al abrir el escáner con una lista compatible. |
| Permiso y lectura | El adaptador consulta el permiso, ofrece solicitarlo o abrir ajustes cuando corresponde y muestra un error si la consulta falla. `CameraView` usa la cámara trasera y escucha solo QR. Un error de montaje o 15 segundos sin `onCameraReady` señalan que la vista previa no arrancó. No se solicita micrófono. |
| Autenticidad offline | El código debe ser QR v3 RS256 con el formato y el `kid` esperados. El verificador comprueba firma, emisor, audiencia, examen y vigencia con el reloj anclado. Solo entonces se resuelve el estudiante dentro de la lista autorizada y se comprueban su habilitación, el ingreso previo y las revocaciones conocidas. |
| QR v2 y conexión | El cliente móvil rechaza v2 offline y no tiene un flujo online de validación de identidad v2 conectado al escáner. Los antecedentes describen emisión v2 HS256. Los endpoints existentes de paquete o sincronización no son una validación de identidad v2 antes del registro. |
| Registro | La detección duplicada se descarta en la sesión del escáner. El botón «Confirmar ingreso» llama al servicio existente, que vuelve a verificar la identidad y la copia antes de persistir. Un ingreso local sigue provisional hasta recibir un resultado válido de sincronización. |

## Cambios

- `OfflineListScreen.tsx`, `qrAvailability.ts` y `scanSession.ts` comparten el diagnóstico de la capacidad QR. La pantalla distingue QR v3 no anunciado, claves ausentes y verificación sin habilitar. Un acceso directo al escáner respeta el mismo bloqueo. La búsqueda manual sigue disponible.
- `OfflineScannerScreen.tsx` carga la cámara después de comprobar el paquete. `NativeQrCamera.tsx` maneja errores de consulta de permisos y evita solicitudes simultáneas. `entryPresentation.ts` distingue v2 y una clave pública desconocida con mensajes breves. Los mensajes del manifiesto se traducen a categorías conocidas sin mostrar sus valores crudos, claves, tokens ni datos de estudiantes.
- Se ajustaron `tests/scanner.test.ts` y `tests/redesign-block2.test.ts` para cubrir el bloqueo desde la lista y el acceso directo sin claves. Las pruebas existentes cubren v3 válido, firma inválida, otro examen, caducidad, v2, cámara y permisos, duplicados, confirmación explícita y retorno a búsqueda manual. La ejecución queda a cargo del usuario.

## Validación en Huawei Y9

1. Inicia sesión y abre Control con una lista del entorno de pruebas. Anota el texto exacto bajo «Escanear QR» si el botón sigue deshabilitado. Si la lista carece de verificación, usa búsqueda manual.
2. Con conexión, abre «Preparar lista offline» y elige «Preparar una copia nueva» si ya hay una lista preparada o una descarga interrumpida. «Reanudar descarga anterior» conserva el manifiesto original y sus claves. La nueva copia se activa al completar la preparación y los ingresos pendientes siguen vinculados al paquete que los originó. HU37 debe anunciar verificación v3.
3. Con una lista compatible, abre el escáner, prueba conceder y denegar Cámara y regresa desde ajustes. Comprueba que «Buscar manualmente» vuelve a la misma lista y enfoca el campo. Si aparece un fallo de montaje, comprueba también si otra aplicación usa la cámara.
4. Escanea ejemplos de prueba válidos, v2, alterados, vencidos y de otro examen. Pulsa Atrás y verifica que solo «Confirmar ingreso» genera un registro. Repite una lectura válida para comprobar el manejo de duplicados y revisa el estado provisional en Pendientes.
5. Pide al estudiante abrir «Mis exámenes» → «QR para EIDA Control» en el portal de laboratorio. Escanea la imagen con el móvil sin conexión. Después de confirmar, recupera conexión durante la ventana del examen, abre «Pendientes» y pulsa «Sincronizar». Comprueba el recibo del ingreso. La regresión de escritorio en `tests/scanner.test.ts` recorre renovación, verificación del vector firmado por Laravel, confirmación y recepción simulada con los IDs originales. La cámara, Quick Crypto y el servidor de laboratorio se validan en el dispositivo.

**APK Debug.** Los cambios de esta entrega son TypeScript. Una development build que ya incluye `ExpoCamera` solo necesita cargar el JavaScript actualizado. Una APK con bundle incorporado necesita el bundle actualizado. Si la APK carece del módulo o de la integración nativa de cámara, se requiere reconstruirla con `expo-camera`, el permiso Cámara y el escáner habilitado. Reconstruir la APK no cambia la bandera del manifiesto.
