# EIDA Control · Acceso offline sin biometría adicional

## Causa y política vigente

El almacén anterior guardaba una clave SQLCipher de 256 bits en SecureStore con `requireAuthentication: true`. La apertura comprobaba biometría fuerte antes de leerla. En Android, SecureStore conserva el requisito en la entrada cifrada y selecciona la clave de Keystore según ese valor. Cambiar la opción de lectura de una entrada existente no cambia su protección. La excepción de laboratorio utilizaba otro servicio y otra base, habilitados con `__DEV__`.

Debug y Release usan el mismo servicio de SecureStore `bo.eida.control.offline.v2` y bases `eida-v2-<ámbito>.db`. La clave aleatoria se guarda cifrada mediante SecureStore y Android Keystore, con `requireAuthentication: false`. El ámbito incluye servidor, cuenta, instalación y dispositivo. La apertura comprueba `PRAGMA cipher_version` en la conexión real antes de aplicar la clave y antes de cualquier consulta de esquema o escritura. Si el binario usa SQLite sin SQLCipher, la apertura falla y el flujo no permite guardar información sensible.

Después de validar la sesión EIDA, la app abre el almacén en primer plano. Al pasar a segundo plano, cerrar sesión, caducar la sesión, revocar el acceso o cambiar de cuenta, invalida la conexión y limpia las vistas. La concesión local exige la credencial guardada de esa misma cuenta y dispositivo. Dentro del mismo arranque, la reapertura offline conserva el vencimiento de la sesión y se apoya en el reloj monotónico. La vigencia y la autorización de cada paquete siguen verificándose al usarlo. Los envíos conservan sus requisitos online y el servicio existente.

## Bases anteriores y recuperación

El proceso consulta únicamente los marcadores de los dos servicios anteriores, que se guardaban antes de abrir sus bases. Si detecta alguno para el ámbito actual, detiene la apertura y explica que la información requiere recuperación. La base anterior, su clave y sus registros quedan en su lugar. Esta decisión también evita que una cola nueva vacía parezca sustituir a la anterior.

Para datos de laboratorio, conservar la instalación y consultar o sincronizar primero mediante la versión de laboratorio compatible, con la cuenta original y su servidor de pruebas. Para el almacén biométrico, un flujo de recuperación separado necesita la clave original y la autenticación que Android todavía permita en esa instalación. Si Android deniega o ha invalidado esa clave, la app no puede descifrar la base. La detección actual depende de los marcadores accesibles en SecureStore. Una base cuyos marcadores se perdieron no puede identificarse por esos marcadores. La base nueva usa otro nombre y no abre ni sobrescribe archivos anteriores.

Habilitar la transición de una cuenta que conserva un marcador requiere un procedimiento específico y autorizado de recuperación o archivo. Ese procedimiento deberá verificar el inventario de ingresos, reportes y recibos antes de habilitar el ámbito nuevo y conservar la base original. No limpiar datos ni desinstalar la app para probar la transición.

## Cambios y pruebas

- Apertura, concesión y comprobaciones de almacenamiento en `src/features/offline/`: `nativeVault.ts`, `vaultAccess.ts`, `OfflineProvider.tsx`, `protection.ts`, `nativeProtection.ts` y `repository.ts`. Se retiró la configuración de laboratorio de `src/config/offlineLab.ts`.
- La apertura y los fallos se muestran mediante `OfflineAccessStatus.tsx` y el diagnóstico se concentra en SQLCipher. Se actualizaron Preparación, Detalle del examen, Control, Escáner, Paquetes y Pendientes, los mensajes del acceso a reportes y borradores, y la confirmación de cierre de sesión. Ficha y confirmación de ingreso siguen usando el alcance protegido de Control.
- `tests/offline-access.test.ts` cubre sesión y cuenta originales, vigencia, reapertura, reloj atrasado, reinicio, detección de almacenes anteriores y uso de la misma política en ambas variantes. `tests/post-apk-protection.test.ts` cubre protección de la clave y bloqueo sin SQLCipher. Las suites de login, paquetes, ingresos, incidencias y sincronización conservan sus escenarios de regresión. Las pruebas con puertos simulados no verifican el cifrado físico de un binario Android.

## Límites y validación Android

La clave sigue cifrada en reposo. El código autorizado de la app puede obtenerla en el proceso sin una confirmación del sistema. Una persona con acceso a una sesión EIDA abierta en el dispositivo tiene acceso a los datos de esa sesión. Un entorno rooteado o un proceso comprometido pueden reducir las garantías de aislamiento del sistema.

Después de reiniciar el teléfono sin internet, la concesión anterior se rechaza por cambio del identificador de arranque. Recuperar conexión permite validar EIDA y abrir el almacén. Los paquetes cuyo reloj quedó anclado al arranque anterior requieren su propia revalidación con internet antes de controlar ingresos. Los registros pendientes siguen cifrados en la base.

1. Ejecutar manualmente `npm run typecheck` y `npm test`.
2. Con una instalación de prueba sin datos anteriores y datos ficticios, iniciar sesión en el Huawei Y9. En Paquetes, usar «Comprobar SQLCipher». Validar el mismo recorrido en Debug y Release con sus configuraciones de prueba.
3. Preparar una lista, registrar un ingreso y una incidencia, abrir Pendientes y consultar ambos. Cerrar y volver a abrir la app en el mismo arranque. Verificar los mismos registros y sincronizar una sola vez. Comprobar que los recibos se conservan y que el contador disminuye según los envíos reales.
4. Probar cierre de sesión, cambio de cuenta, revocación y caducidad. Comprobar que los datos de una cuenta no aparecen en la otra y que el regreso a la cuenta original recupera los registros conservados.
5. Probar pérdida de internet dentro del mismo arranque y reinicio offline por separado. Confirmar el bloqueo descrito tras el reinicio y revalidar en línea antes de seguir.
6. Actualizar una instalación de prueba que tenga datos de laboratorio o una base biométrica. Verificar el aviso de recuperación y la conservación de la base. Si se dispone de una APK de prueba sin SQLCipher, verificar que el flujo de preparación queda bloqueado.

La configuración Expo ya solicita SQLCipher. Esta entrega no requiere cambios en `android/` ni en los módulos nativos. La presencia efectiva de SQLCipher y el recorrido sin solicitudes adicionales quedan pendientes de prueba en los binarios Android. Si un binario no incluye SQLCipher o el reloj nativo, se requiere una compilación compatible antes de habilitar datos reales.
