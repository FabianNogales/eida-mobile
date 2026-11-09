# EIDA Control — Fase 5: HU37 sincronización offline

Revisión de código: 9 de noviembre de 2026, America/La_Paz.

**Estado: implementación de código y revisión estática. Las pruebas nuevas NO se ejecutaron.** El usuario informó que ejecutó satisfactoriamente TypeScript y las pruebas de fase 4; ese resultado no se atribuye a las pruebas nuevas de fase 5 ni a una compilación Android.

Repositorios reales: `C:/proyecto/eida-mobile` y `C:/proyecto/oidevs-examenes-backend`. La ruta antigua del backend indicada en el adjunto no existe. No se accedió a `-compare` ni se hicieron búsquedas desde el directorio padre. Se respetó el modo código de AGENTS.md; el permiso backend de esta solicitud sustituye su anterior indicación de backend solo lectura. Frontend web, `.env`, dependencias/lockfile, autenticación de fase 3, verificador Android QR y archivos nativos permanecen sin modificaciones.

## 1. Auditoría inicial y contratos reutilizados

Se revisaron las fases anteriores, HU35–HU37 backend, el endpoint real `POST /api/v1/exams/{exam_id}/offline/sync`, `OfflineSyncService`, `SyncOfflineEntriesRequest`, las tablas y pruebas existentes, la captura HU36 y el prototipo estricto RS256 de Laravel.

El contrato anterior, **protocolo 1 implícito**, permanece:

```typescript
{
  package_id: UUID,
  list_id: integer,
  version: integer,
  room_id: integer,
  events: Array<{ // entre 1 y 100
    event_id: UUID,
    student_id: integer,
    method: 'MANUAL' | 'QR',
    captured_at: ISO8601_con_zona,
    device_id?: string | null, // hasta 100 caracteres
    qr_token?: string | null  // hasta 4096 caracteres
  }>
}
```

Examen en la URL; actor obtenido de Sanctum. No hay un campo de cuerpo que permita elegir otro actor. El protocolo anterior conserva las respuestas y la validación QR v2. No se alteraron `ExamEntryAvailability`, HU14 online ni el reparto congelado HU35.

Semántica exacta reutilizada:

| Resultado Laravel | Significado | Estado outbox |
| --- | --- | --- |
| `ACCEPTED` / `ENTRY_REGISTERED` | Se insertó un ingreso VALID en `exam_entries` con hora del servidor. | `CONFIRMED` |
| `DUPLICATE` / `ALREADY_REGISTERED` | Ya existe un ingreso oficial válido. Esta operación no genera otro. | `DUPLICATE` |
| `CONFLICT` | No se confirma un nuevo ingreso: autorización, examen, versión, QR o tiempo requieren revisión. | `CONFLICT` |
| `REJECTED` | La operación no cumple condiciones comprobables de ingreso/lista/evidencia. | `REJECTED` |

Un HTTP 200 no implica que todos los eventos fueran aceptados. Los cuatro resultados son definitivos **para ese UUID de transporte**: no se reenvían normalmente. Un conflicto puede seguir pendiente de revisión institucional; no equivale a un pendiente de envío.

## 2. Arquitectura

```text
events HU36 (JSON original inmutable)
   + packages.binding original
       ↓ reconciliación local sin actualizar events
sync_outbox (actor, solicitud congelada, hash, estado)
       ↓ sincronización manual con lease local
GET capacidades HU37 → lotes ≤100 por examen/paquete/lista/versión/ambiente
       ↓ SessionController.request → HttpClient HTTPS/Sanctum existentes
POST offline/sync → OfflineSyncService existente
       ↓ transacción individual + índices únicos + auditoría existentes
resultado por UUID + evidencia original cifrada en el registro backend
       ↓ validación de recibos + transacción local
sync_receipts inmutables / estado de outbox / interfaz
```

No hay otro sistema servidor de asistencia, otro motor de sincronización, sincronización automática al arrancar ni envío automático en segundo plano. Los únicos ingresos oficiales siguen siendo los de `exam_entries`, con el índice único existente. Tampoco hay un endpoint nuevo que apruebe asistencia.

## 3. Negociación y extensión aditiva de contrato

Nuevo endpoint:

```http
GET /api/v1/exams/{exam_id}/offline/sync-capabilities
Authorization: Bearer <token móvil original validado>
```

Respuesta por defecto:

```json
{
  "data": {
    "protocol_versions": [1, 2],
    "max_events": 100,
    "qr_versions": [2],
    "late_evidence": true,
    "late_policy": "REVIEW_ONLY",
    "time_evidence": "DEVICE_DECLARED_NOT_ATTESTED"
  }
}
```

Usa la ability existente `offline:sync`. Autoriza al responsable vigente o al propietario histórico de un paquete de ese examen con cuenta activa. No exige que el examen esté abierto ni que siga siendo colaborador: eso permite recibir evidencia y decidir el conflicto en el servicio existente. No concede permiso para aprobarla. Comprueba la presencia de las columnas nuevas antes de anunciar soporte; si falta la migración responde 503 `SYNC_MIGRATION_REQUIRED`.

El cliente nuevo exige protocolo 2, evidencia tardía y esa política antes de enviar. Un servidor anterior que devuelve 404 deja los eventos pendientes con `BACKEND_EXTENSION_REQUIRED`; no se envían a un contrato viejo esperando que los rechace. La negociación no cambia los UUID ni el contenido.

La extensión usa el **mismo POST** con `protocol_version:2` y añade `time_evidence` a cada evento. Los enteros identificadores se transmiten como cadenas decimales para conservar los IDs almacenados; la validación `integer` de Laravel los admite. Las respuestas existentes siguen expresando IDs numéricos.

La versión 2 del transporte y del esquema SQLite no cambia la distribución HU35 congelada en versión 1 ni el esquema del manifiesto móvil. No se crea una distribución nueva para sincronizar.

Ejemplo sintético de cuerpo real:

```json
{
  "protocol_version": 2,
  "package_id": "01234567-89ab-4cde-8f01-23456789abcd",
  "list_id": "2", "version": 1, "room_id": "1",
  "events": [{
    "event_id": "abcdef01-2345-4678-9abc-def012345678",
    "student_id": "101", "method": "MANUAL",
    "captured_at": "2030-01-01T00:01:00.000Z",
    "device_id": "7c4dfeaf-e588-4db1-9524-496a7905582d",
    "time_evidence": {
      "serverMs": 1893456060000, "boot": "3", "elapsed": 100000,
      "capturedElapsed": 100000, "source": "SERVER_ANCHORED_ESTIMATE"
    }
  }]
}
```

QR añade `qr_token` original. No se transportan `local_status`, `sync_compatibility`, el examen dentro del evento, ni un actor elegido por el teléfono. El servidor conserva su identidad autenticada y, cuando existe, el ID del dispositivo Sanctum. Para paquetes móviles vincula protocolo 2 al dispositivo/instalación originales; una diferencia produce `DEVICE_BINDING_MISMATCH`, no un cambio silencioso de actor.

El vínculo adicional se comprueba al procesar por primera vez. Como en HU37 anterior, un replay idéntico del propietario autenticado recupera el recibo histórico antes de reevaluar las condiciones del examen; no crea otra asistencia ni reemplaza la decisión original. Otro actor nunca obtiene ese recibo mediante un paquete ajeno.

Respuesta v2 ilustrativa:

```json
{
  "data": {
    "exam_id": 42,
    "protocol_version": 2,
    "results": [{
      "event_id": "abcdef01-2345-4678-9abc-def012345678",
      "status": "ACCEPTED", "code": "ENTRY_REGISTERED",
      "message": "Ingreso registrado.", "entry_id": 123,
      "review_required": false,
      "received_at": "2030-01-01T00:02:00.000000Z"
    }]
  }
}
```

Para CONFLICT, `entry_id=null` y `review_required=true`. Para REJECTED, `entry_id=null`. DUPLICATE identifica el registro oficial existente. `received_at` proviene de Laravel. Estas fechas no acreditan por sí mismas la captura previa. Los recibos de protocolo 1 no reciben estos campos nuevos.

## 4. Persistencia local, cifrado y actualización aditiva

Se conserva SQLCipher, la comprobación previa de `PRAGMA cipher_version`, la clave biométrica SecureStore y la conexión serializada de fase 4. No hay nuevas dependencias o fotos fuera de la base cifrada.

Al abrir la base, el código crea tablas adicionales y cambia `PRAGMA user_version` de 1 a 2. No borra ni reescribe eventos/paquetes existentes. Es lógica de actualización **preparada en código**, no una migración ejecutada por el asistente.

| Tabla nueva | Contenido |
| --- | --- |
| `sync_outbox` | FK al evento original, binding del paquete original, contexto y evento de transporte congelados, SHA-256, necesidad de QR v3, estado, intentos, último intento, error e intento activo. |
| `sync_receipts` | Un recibo definitivo por UUID, hash de la solicitud asociada y fecha informativa de recepción local. |
| `sync_attempts` | Solicitud completa de cada lote, actor, examen, comienzo, fin y resultado del intento. |
| `sync_lease` | Exclusión local persistente para impedir dos emisores simultáneos. |

Los triggers HU36 que prohíben actualizar/borrar `events` se mantienen. Nuevos triggers impiden cambiar el contenido congelado de la outbox, borrar sus filas, modificar/borrar recibos y reescribir la solicitud de un intento. El estado mutable vive separado de la evidencia.

La reconciliación incorpora eventos HU36 que aún no tienen outbox, usando **packages.binding**, no el usuario que acaba de iniciar sesión. Comprueba servidor, usuario, instalación y dispositivo. La solicitud se proyecta una vez, se guarda y se comprueba por hash. El emisor relee el original persistido antes de enviar; alterar un objeto en RAM no modifica la solicitud.

`ProvisionalEvent.local_status` conserva su valor histórico `PENDING_SYNC`: no se actualiza después de enviar. La interfaz consulta la outbox y el recibo separado para mostrar el estado actual. El marcador histórico `QR_V3_REQUIRES_BACKEND_EXTENSION` tampoco se modifica al habilitar soporte: se negocia con el servidor.

## 5. Estados, idempotencia y recuperación

```text
PENDING → SENDING → CONFIRMED | DUPLICATE | CONFLICT | REJECTED
             └─ error, timeout o UUID sin respuesta → PENDING
SENDING persistido al cerrar la app → PENDING al desbloquear de nuevo
```

Solo una acción manual inicia el envío. El proveedor impide solaparlo con una descarga; el controlador rechaza llamadas simultáneas y la lease protege también frente a otro controlador local. Al abrir de nuevo el almacén después de cerrar su conexión anterior se recuperan intentos incompletos. No se restablece una lease en cada consulta de pantalla.

Agrupación por contexto original completo; cada lote contiene como máximo 100 eventos y respeta el límite anunciado por el backend. No se sustituye un paquete vencido por uno nuevo para enviar pendientes. La caducidad bloquea nuevas capturas y consulta de estudiantes; no borra la evidencia ni impide presentar pendientes históricos con sesión válida y desbloqueo seguro.

Antes del POST se guarda el intento y SENDING. Después se validan protocolo, examen, UUIDs, estados, tipos de campos, relación entre estado/entry_id y condición de revisión. Recibos duplicados, UUID ajenos o una estructura inválida no producen confirmaciones oficiales.

Un subconjunto válido de resultados se conserva en una única transacción con los cambios de estado; los UUID ausentes quedan pendientes con `PARTIAL_RESPONSE`. Una falla de almacenamiento revierte los recibos y estados de esa transacción. No se finge el éxito de todo el lote.

Un timeout puede ocurrir **después** de que Laravel haya confirmado algunos o todos los eventos. El siguiente intento mantiene UUID, actor, paquete, lista, versión, ambiente, captura y QR. Laravel compara su huella y devuelve el resultado ya guardado; ACCEPTED repetido es recuperación del mismo registro. No se cuenta como un ingreso adicional.

Se reutilizan la transacción por evento, los bloqueos de examen/actor/estudiante y el UUID global único del backend. El hash v1 conserva su formato previo; v2 añade el protocolo y los campos de evidencia horaria en orden canónico. Cambiar datos bajo el mismo UUID devuelve `EVENT_ID_REUSED`, conserva el resultado original y audita el intento alterado cifrado. La serialización de recibos recuperados se normaliza porque PostgreSQL jsonb puede reordenar claves.

No hay reintentos automáticos infinitos ni reenvío normal de resultados definitivos. Un futuro flujo de reconciliación deberá ser explícito y autorizado; reenviar un conflicto con el mismo UUID no modifica la decisión persistida.

La fase 4 no enviaba eventos. Si un operador ya remitió un UUID por otro canal utilizando protocolo 1, no se debe reinterpretar su envío como protocolo 2: la evidencia adicional modifica la huella y el servidor puede devolver EVENT_ID_REUSED. Debe recuperarse/reconciliarse su recibo original mediante un procedimiento autorizado, sin generar otro UUID para ocultar el conflicto.

## 6. Errores y condiciones de sesión

| Situación | Tratamiento |
| --- | --- |
| Sin internet / timeout | Pendiente; conservar solicitud y advertir que el servidor pudo procesarla. |
| Token vencido / contraseña pendiente | Exigir validación de la cuenta original; no borrar eventos. |
| Cuenta inactiva / dispositivo revocado | Detener envío; fase 3 bloquea y retira acceso local según sus callbacks. Evidencia cifrada conservada. |
| Colaborador revocado | El servidor conserva el evento como `CONFLICT AUTHORIZATION_CHANGED`; capacidad histórica permite presentarlo. |
| Paquete ajeno | HTTP 403 `PACKAGE_NOT_OWNED`; no reasignar actor ni crear asistencia. La cola local conserva el pendiente. |
| Versión/lista incorrecta | Recibo `CONFLICT LIST_VERSION_MISMATCH`. |
| Examen cambiado/cancelado/cerrado | Recibo de conflicto existente, sin flexibilizar disponibilidad online. |
| Estudiante inactivo, no inscrito o no habilitado | REJECTED `ENTRY_CONDITIONS_NOT_MET`. Cambio desde el snapshot: `STUDENT_DATA_CHANGED`. |
| QR incorrecto/no correspondiente | REJECTED `INVALID_QR` / `QR_MISMATCH`. |
| QR revocado/expirado | Conflicto conservado para revisión. |
| Ingreso oficial duplicado | DUPLICATE con entry_id existente; no nuevo ingreso. |
| HTTP 422 estructural | Pendiente con error de contrato. Reintentar no repara datos automáticamente; requiere inspección sin mutar evidencia. |
| HTTP 429 / 5xx | Detener el ciclo y permitir reintento explícito, sin borrar datos. |
| Servidor anterior / capacidad incompatible | No iniciar el POST; pendiente hasta desplegar la extensión. |
| Respuesta parcial | Conservar recibos válidos y reintentar solo los faltantes. |

Si la app se bloquea durante una petición, la respuesta tardía no repuebla vistas de otra cuenta. Si no puede guardar el error porque la conexión cifrada ya se cerró, SENDING se recupera al próximo desbloqueo. Los mensajes genéricos no registran tokens ni fotografías en logs.

Se preservó la política de login móvil. **Dependencia institucional:** un antiguo colaborador sin ninguna autorización actual puede recibir `MOBILE_OPERATOR_REQUIRED` al intentar renovar una credencial vencida. No se amplió ese permiso de autenticación para sortear una revocación. Sus eventos se conservan hasta que la cuenta original pueda volver a autenticarse por un procedimiento institucional autorizado. Tampoco se eluden cuenta/dispositivo revocados.

## 7. Evidencia tardía y revisión institucional

El backend anterior respondía `CONFLICT EXAM_ENDED`; el QR v2 normalmente vence al cierre. Esa decisión se mantiene. **No se acepta automáticamente una declaración de captured_at, un contador del teléfono ni una firma QR expirada como prueba de hora real.**

La ampliación propuesta añade a `exam_offline_sync_events`:

- `evidence_ciphertext TEXT NULL`: JSON original cifrado con Crypt de Laravel y su clave ya configurada. Incluye contexto, evento completo/QR, identidad autenticada, dispositivo de servidor cuando existe y evaluación criptográfica v2.
- `evidence_schema_version SMALLINT NULL`: formato de la evidencia, actualmente 1.
- `review_required BOOLEAN DEFAULT false`, con índice: conflictos que necesitan revisión.

La evidencia y el resultado se guardan en la misma transacción que el posible ingreso y la auditoría. Si falla cifrado/auditoría/DB, se revierte el evento actual; otros eventos ya confirmados del lote conservan su idempotencia. En conflicto se agrega `OFFLINE_EVIDENCE_REVIEW_REQUIRED`. Un UUID reutilizado con otro contenido conserva la evidencia original; el intento alterado queda cifrado en su auditoría `OFFLINE_EVENT_ID_CONFLICT`.

No se añaden tablas de asistencia ni una segunda cola del servidor. Las filas anteriores al despliegue conservan columnas nulas: **no se puede recuperar un QR original que el backend previo nunca guardó**. No se inventa ni reconstruye esa evidencia.

La clave de cifrado de Laravel no se cambia ni se lee desde `.env` en esta entrega. Su conservación/rotación y las copias de seguridad deben seguir el procedimiento institucional; perderla impide descifrar la evidencia. La migración de rollback rechaza retirar columnas si ya existe evidencia cifrada, para no eliminarla inadvertidamente.

**Revisión futura, no implementada como permiso de aprobación:** el equipo debe acordar qué pruebas de hora son aceptables, quién decide, cuáles son los plazos y cómo se audita una resolución. Un contrato posterior puede añadir:

1. GET paginado de conflictos del examen, limitado mediante la política docente propietaria ya existente, con estado, actor, capture/receive times, motivo y evaluación de evidencia; sin exponer credenciales QR masivamente.
2. Detalle protegido de evidencia con trazabilidad de acceso y conservación.
3. Una resolución separada del recibo original, con identidad del revisor, fundamento y versión de política. No añadir una ruta POST de aprobación hasta confirmar esa política y su autorización.

No se desplegaron esas rutas ni se inventó una ability para aprobar asistencia. Los conflictos permanecen conservados, no convertidos en ACCEPTED por la interfaz.

## 8. QR v3 aditivo y compatible

`QrV3Service` comparte su verificación estricta mediante `verifyAuthentic`; `verify` continúa haciendo la misma comprobación temporal original. El verificador Android, sus vectores y `QrTokenValidator` v2 online no se modifican.

`OfflineQrEvidence` usa primero el autenticador v2 existente. Para RS256 reutiliza QrV3Service/KeyRing: header y claims exactos, codificación canónica, ausencia de claves duplicadas, firma, kid confiable, RSA ≥2048, issuer/audience, estudiante y examen firmados y vida máxima. No usa claves recibidas del teléfono ni el indicador local de firma válida. No carga la clave privada ni utiliza el factory de emisión.

Para aceptar durante la ventana vigente también se exige el registro institucional `StudentQrToken` para ese jti/estudiante/examen, estado activo/no revocado, generación compatible y validez temporal actual comprobada por Laravel. Un emisor v3 futuro tendrá que registrar ese episodio en el ledger existente; una firma sin autorización registral no basta.

Para evidencia tardía puede comprobarse autenticidad aun estando expirada, pero el resultado de disponibilidad continúa siendo conflicto. La evaluación se guarda junto a la evidencia y **no** se convierte en permiso de ingreso.

Nuevo flag de servidor: `EIDA_OFFLINE_SYNC_QR_V3_VERIFY=false` por defecto. Habilita solo verificación cuando se configure deliberadamente; no activa `qr_v3.enabled`, no activa `MOBILE_OFFLINE_QR_V3_ISSUED` y no cambia rutas productivas de emisión. El endpoint anuncia QR 3 únicamente si el flag y la configuración pública son válidos.

Mientras no se anuncie soporte, la cola deja pendientes los QR v3 y sincroniza los manuales del mismo paquete. Su marcador histórico y evidencia permanecen idénticos. Se puede desplegar/probar HU37 manual sin emitir QR v3 a estudiantes reales.

## 9. Interfaz

Nueva ruta `/offline/sync`, accesible desde paquetes tras desbloqueo seguro. Muestra filtros y cantidades de pendientes, en proceso, confirmados, duplicados, conflictos y rechazados; progreso por lotes, último intento/error y detalle del recibo.

El botón solo se habilita para una sesión remota validada del ámbito original. La pantalla puede consultar resultados guardados sin internet, según el desbloqueo local. La lista HU36 muestra confirmación oficial solo cuando encuentra el recibo ACCEPTED; DUPLICATE se informa como un ingreso previo, no como otro registro creado.

No hay rediseño, cámara ni nuevo sistema disciplinario. Los detalles de identificadores de operación/paquete permiten rastrear conflictos sin mostrar el token QR original en pantalla.

## 10. Pruebas escritas, NO ejecutadas

Móvil: `tests/sync.test.ts`, fixtures sintéticos en `tests/support/syncFixtures.ts`, reutilizando el SQLite real en memoria y los servicios HU36 existentes. Casos: 205 eventos separados en 100/100/5, resultados mixtos, UUID/solicitud inmutables, timeout después de commit simulado del servidor, respuesta parcial, UUID ajeno/duplicado, recibo inválido, concurrencia entre controladores, recuperación SENDING tras reinicio, 401/403/422/5xx/red/dispositivo/cuenta, cambio de usuario, triggers de conservación, manipulación de un DTO, error transaccional de guardado de recibos, negociación y QR v3 pendiente hasta soporte. El transporte HTTP se dobla en esas pruebas; las consultas/estados SQLite no se reemplazan por una simulación.

Backend: `tests/Feature/Offline/OfflineSyncEvidenceTest.php`, con base efímera aislada. Casos: protocolo v2, legado v1/QR v2, replay y alteración del mismo UUID, 100/101 eventos, mezcla de resultados, estructura, evidencia tardía, conflicto de lista, colaborador revocado, paquete ajeno, QR v3 con firma/claims/registro y expiración, cuenta/dispositivo revocados y rollback ante fallo de auditoría. Las claves RSA se generan solo en memoria cuando el usuario ejecute las pruebas; el archivo temporal contiene solo la pública.

PostgreSQL: `tests/Feature/Offline/OfflineSyncEvidencePostgresTest.php`. Reutiliza el worker existente y su barrera que observa espera real de bloqueo: replay concurrente en ventana abierta, evidencia tardía concurrente, cambio de contenido, un solo ingreso/recibo, cifrado y auditoría consistente. Exige opt-in, testing sin caché, DB_URL vacío, nombre `hu35_37_test_<12 hex>` y base pública vacía; de lo contrario se omite sin borrar tablas.

Se preservaron las pruebas anteriores. Los tests de escritorio que doblan cipher_version **no acreditan SQLCipher real Android**. Pendiente del usuario: ejecutar pruebas nuevas, validar el binario, desconectar red durante un envío real y comprobar recuperación con el mismo UUID después de una respuesta perdida.

La comparación de lectura al terminar conserva los hashes iniciales de esta fase para el lockfile, `src/features/auth/session.ts`, `src/features/qr/verifyQrV3.ts`, `/android/gradle.properties` y `/android/app/build.gradle`. No sustituye pruebas ni una compilación.

## 11. Comandos manuales propuestos — NO ejecutados

No hacen falta instalaciones nuevas ni cambios de lockfile.

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test

Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
php artisan test --filter=OfflineSyncEvidenceTest
php artisan test --filter=OfflineBackendTest
php artisan test --filter=MobileAuthenticationTest
php artisan test --filter=MobileOfflinePackageTest
php artisan test --filter=QrV3Test
```

Las pruebas feature usan el soporte de testing/SQLite `:memory:` y rechazan una configuración cacheada o conexión distinta antes de preparar su esquema efímero. No se ejecutaron suites ni se abrieron bases reales en esta entrega.

PostgreSQL necesita que el operador prepare por separado una base **nueva y vacía**, un rol aislado y credenciales de pruebas. En una terminal descartable, exclusivamente después de revisar ese destino:

```powershell
Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
$env:APP_ENV = 'testing'
$env:DB_CONNECTION = 'pgsql'
$env:DB_URL = ''
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_DATABASE = 'hu35_37_test_0123456789ab'
$env:DB_USERNAME = 'ROL_AISLADO_DE_PRUEBAS'
$env:DB_PASSWORD = 'CLAVE_DE_ESE_ROL'
$env:EIDA_OFFLINE_PG_CONCURRENCY = '1'
php artisan test --filter=OfflineSyncEvidencePostgresTest
```

Sustituye los dos marcadores de credenciales y el nombre por el destino real aislado. No se proporcionan comandos de creación/eliminación de DB. La prueba aplica migraciones **solo después** de sus guardas, deja sus tablas para inspección y no limpia bases. Para ejecutar la suite PostgreSQL anterior se requiere otra base vacía; no se deben compartir sus tablas de una ejecución previa. Estas variables son de esa terminal, no cambios globales del sistema.

## 12. Despliegue y APK independiente

Orden de integración del servidor: revisión/backup institucional, migración aditiva y código de servicios/request/rutas/allowlist, seguido de validación de capacidades y contratos por el usuario. La migración propuesta, todavía NO aplicada:

```powershell
Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
php artisan migrate --path=database/migrations/2026_11_08_000001_add_offline_sync_evidence.php
```

Ejecutar únicamente sobre el destino revisado y autorizado por el usuario. No se usó producción ni se propone migrate:fresh, seeders, borrado de cachés o reconstrucción de datos. La migración depende de las tablas HU35–HU37 previas; no las reemplaza. No activar emisión QR v3 para validar sincronización manual.

La lógica de fase 5 es TypeScript y esquema local; no añade módulos nativos ni dependencias. Sigue necesitando el binario con SQLCipher, QuickCrypto, SecureStore y EidaOfflineClock de fase 4. El ajuste nativo pendiente detectado antes de esta fase era la propiedad Gradle de SQLCipher; CMake 3.31.6 ya se seleccionaba en la configuración global del usuario.

Comando manual de debug que conserva esa selección y evita Prebuild:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile\android'
.\gradlew.bat :app:assembleDebug `
  '-Pexpo.sqlite.useSQLCipher=true' `
  '-Pandroid.cmakeVersion=3.31.6' `
  '-Pandroid.builder.sdkDownload=false' `
  --no-daemon --max-workers=2 --console=plain
```

No se ejecutó. Gradle puede descargar sus dependencias de build cuando el usuario lo ejecute; no es una instalación realizada por el asistente. El APK debug actual usa Metro y no incorpora JS por defecto. Para probar cierre completo/reapertura sin PC hace falta un APK con bundle incorporado. Esta fase no cambia la variante Android ni promete arranque independiente con el debug actual.

## 13. Inventario de archivos

Móvil nuevos:

- `src/features/offline/sync/contracts.ts`, `schema.ts`, `wire.ts`, `storageSchema.ts`, `outbox.ts`, `api.ts`, `controller.ts`.
- `src/screens/OfflineSyncScreen.tsx`, `src/app/offline/sync.tsx`.
- `tests/sync.test.ts`, `tests/support/syncFixtures.ts`.
- `docs/EIDA_CONTROL_FASE_5_HU37_SYNC.md`.

Móvil modificados:

- `src/features/offline/repository.ts`: tablas aditivas de esquema 2 y contador real de pendientes de envío.
- `src/features/offline/nativeVault.ts`: reconstrucción protegida y recuperación de outbox al desbloquear.
- `src/features/offline/OfflineProvider.tsx`: estado, recibos, progreso y acción manual de sincronización.
- `src/features/offline/contracts.ts`: comentario del formato histórico, sin reescribir sus eventos.
- `src/app/offline/_layout.tsx`: ruta de sincronización.
- `src/screens/OfflinePackagesScreen.tsx`, `OfflineListScreen.tsx`, `HomeScreen.tsx`: acceso a resultados y mensajes basados en ACK.

Backend nuevos:

- `app/Services/Offline/OfflineQrEvidence.php`.
- `config/offline_sync.php`.
- `database/migrations/2026_11_08_000001_add_offline_sync_evidence.php`.
- `tests/Feature/Offline/OfflineSyncEvidenceTest.php`.
- `tests/Feature/Offline/OfflineSyncEvidencePostgresTest.php`.

Backend modificados:

- `app/Services/Offline/OfflineSyncService.php`: capacidades, evidencia cifrada/recibos v2, vínculo móvil, verificación v3 opcional y auditoría; conserva procesamiento e ingreso oficial existentes.
- `app/Http/Requests/Offline/SyncOfflineEntriesRequest.php`: extensión opcional de protocolo/evidencia y límites existentes.
- `app/Services/QrV3/QrV3Service.php`: extracción aditiva de autenticidad sin comprobación de reloj, conservando verify estricto.
- `app/Http/Controllers/Api/V1/Entries/OfflineExamController.php`, `routes/api/v1.php`, `app/Services/Auth/MobileTokenPermissions.php`: capacidad de sincronización con la ability existente.

## 14. Límites y decisiones pendientes

- No hay política institucional implementada para aceptar evidencia tardía no acreditada. Se conserva como conflicto/revisión.
- No hay ruta/botón nuevo de aprobar asistencia ni flujo completo de revisión docente; se documentó su contrato futuro y la necesidad de autorización.
- El emisor QR v3 productivo y su registro institucional siguen pendientes. El soporte servidor de verificación está preparado, apagado por defecto y no reemplaza QR v2 online.
- Una cuenta o dispositivo revocado no obtiene acceso nuevo por tener una outbox. Se conserva evidencia para resolución institucional; no se cambia su actor.
- La pérdida de clave biométrica sigue el bloqueo conservador de fase 4; no se crea una clave encima de pendientes inaccesibles.
- Un lote puede superar el timeout HTTP existente o fallar después de commits parciales: se recupera mediante idempotencia, no regeneración de eventos. Medir carga/latencia en el entorno de pruebas antes del despliegue.
- La vista actual es sencilla y sin paginación del historial completo; con colas muy grandes se deberá medir consumo y paginar la presentación conservando el protocolo.
- Cámara, incidencias/infracciones/expulsiones, diseño visual y despliegue automático continúan excluidos.

**Confirmación:** en esta entrega únicamente se leyeron y escribieron fuentes, pruebas, migración propuesta y documentación. No se ejecutaron instalaciones, pruebas, typecheck, Expo/Metro/Prebuild, Gradle/CMake/ADB, APK, migraciones/seeders, cambios de DB, producción, Git, SUBST, junctions, limpiezas ni modificaciones del entorno Windows.
