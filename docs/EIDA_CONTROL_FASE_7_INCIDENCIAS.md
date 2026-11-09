# EIDA Control · Fase 7 · Incidencias e integración disciplinaria

## Estado real

Implementación de código y pruebas escritas, sin ejecutar. La captura local de incidencias y borradores usa el almacén existente. Los adaptadores y pantallas online y el nuevo transporte están preparados, pero **los tokens móviles actuales seguirán recibiendo `403 MOBILE_ABILITY_REQUIRED` para las rutas disciplinarias** hasta revisar y activar el mapeo central descrito abajo. No se anuncia una integración operativa en producción ni pruebas aprobadas.

La solicitud exige dejar pendiente cualquier cambio en una regla central o política de otro equipo. Por ello no se alteraron `MobileTokenPermissions`, `EnforceMobileTokenAccess`, login, controladores/políticas/servicios HU27–HU31, ni reglas de sanción del Equipo 1. Se escribió un mapeo propuesto independiente, no conectado al middleware. La migración y el despliegue también están pendientes.

Ubicaciones comprobadas: móvil `C:/proyecto/eida-mobile`; backend `C:/proyecto/oidevs-examenes-backend`. La ubicación antigua del backend indicada en la solicitud no existe. No se accedió a copias `-compare`, padres de repositorios, producción, `.env` ni claves privadas. No fue necesario consultar EIDA Web.

## Auditoría de contratos existentes

Se leyeron rutas, controladores, Form Requests, recursos JSON y servicios de Incidents, Infractions, Expulsions y EntryAnnulment, sus controles de acceso, pruebas existentes y la política de tokens móviles.

| HU | Contrato real y autorización |
| --- | --- |
| HU27 | `POST /api/v1/exams/{exam_id}/incidents`: `{type,description,student_id?}`; descripción obligatoria recortada, estudiante opcional/nulo relacionado con examen. Rechaza campos extra, incluidos UUID, actor o hora cliente. `IncidentRegistrationService::register` fija actor autenticado, hora de servidor y estado interno PENDING, con transacción/auditoría. No tiene idempotencia por UUID. |
| HU29 | `GET .../incidents` paginado (`data`, `meta`, `exam`, `permissions`, filtros/resumen); `GET .../incidents/{incident_id}` devuelve `data`. ID manual numérico; automático puede ser `qr-N`. Permisos contextuales de `IncidentAccessService`. Exportación y reportes globales existentes no se ampliaron. |
| HU30 | `GET/POST .../infractions`, `/options`, `/students`, `/{infraction_id}`, `/history`, `/students/{student_id}/history`. Crear: `{student_id,type,description,observations?}`, respuesta 201 `data`, estado REPORTED fijado por Laravel. Solo docente responsable activo, mediante middleware y `InfractionAccess`. |
| HU30 edición | `PATCH .../infractions/{id}` admite tipo/descripción/observaciones y `expected_revision`; `PATCH .../{id}/status` exige estado, motivo y `expected_revision` o fecha precisa. La APK integra cambios de estado con revisión numérica y las transiciones ofrecidas por `allowed_statuses`. Conflicto concurrente: 409; no se fuerza ni se sobrescribe el estado recibido. La edición general de texto/observaciones no se agregó a esta interfaz. |
| HU31 | `GET/POST .../expulsions`, `/students`, `/eligible-infractions`, `/{id}` e historiales existentes. Crear: `{student_id,reason,infraction_id?}`; respuesta 201 `data.status=EXPELLED`. El servicio controla docente responsable, horario/disponibilidad, asociación y unicidad. La interfaz usa el motivo obligatorio y asociación opcional omitida; no deriva expulsiones de otras acciones. |
| HU28 | `GET .../entry-control/entries` devuelve `data[{student,entry,permissions.can_annul}]` y `meta`. `POST .../entries/{entry_id}/annulment` acepta **solo `{reason}`**, respuesta `data` con la proyección histórica `{student,entry,permissions}`. El alias `/annul` exige `confirmed:true`; la APK usa `/annulment` y confirmación explícita de interfaz. El servicio solo permite al docente responsable y exige ingreso VALID. |

`InfractionService`, `ExpulsionRegistrationService` y `EntryAnnulmentService` se reutilizan a través de sus endpoints actuales. El adaptador nuevo invoca directamente **`IncidentRegistrationService::register`**, conservando sus comprobaciones, transacción interna y `INCIDENT_REPORTED`. No se llama HU30/HU31 desde la sincronización de incidencias.

### Tipos y estados

- Incidencias internas: IDENTIFICATION, SUSPECTED_IMPERSONATION, INELIGIBILITY, **WRONG_EXAM_QR**, ENVIRONMENT.
- El valor público de WRONG_EXAM_QR es **WRONG_EXAM**. `StoreIncidentRequest` acepta el alias público; `IncidentResource` lo devuelve. La APK usa WRONG_EXAM y el adaptador lo traduce antes de llamar al servicio existente.
- Incidencia interna PENDING se publica como **REPORTED** (Reportada); interna REJECTED se publica como **REGISTERED** (Registrada). Otros estados públicos observados en el vocabulario: OPEN, UNDER_REVIEW, RESOLVED, CLOSED. No se confunden con la entrega de la cola.
- Infracciones: COPYING (Copia), CHEATING (Trampa), IMPERSONATION (Suplantación). Estados REPORTED, CONFIRMED, RESOLVED; transiciones actuales REPORTED → CONFIRMED/RESOLVED y CONFIRMED → RESOLVED. Laravel conserva la autoridad sobre transiciones y revisiones.
- Entrega local: PENDING → «PENDIENTE DE SINCRONIZACIÓN», SENDING → «ENVIANDO», REGISTERED → «REGISTRADA EN SERVIDOR», CONFLICT → «CONFLICTO», REJECTED → «RECHAZADA». **REGISTERED de transporte confirma el reporte HU27, nunca una infracción confirmada.**

## Matriz de permisos

| Operación | Docente responsable | Colaborador vigente del examen | Sin conexión |
| --- | --- | --- | --- |
| Reportar incidencia | Sí | Sí, según HU27 | Sí, paquete propio preparado/vigente y reloj válido |
| Consultar incidencias oficiales | Sí | Sí, según HU29 | Solo reportes locales del actor; no se crea un caché de todos los reportes del servidor |
| Consultar/registrar infracciones | Sí | No | Solo borrador cifrado con permiso contextual docente previamente validado |
| Confirmar/resolver infracción | Sí, revisión y motivo | No | No |
| Expulsar | Sí, reglas HU31 | No | No |
| Anular ingreso | Sí, reglas HU28 | No | No |

Un rol global DOCENTE no convierte al usuario en responsable de todos los exámenes. La navegación no concede permisos: se consulta contexto del examen y el backend vuelve a autorizarlos. El administrador que puede consultar incidencias según HU29 no recibe por ello permisos nuevos de reporte o disciplina.

## Arquitectura y almacenamiento

Se agrega esquema local **v3** al inicializador existente, después de comprobar `PRAGMA cipher_version` y aplicar la clave. Se mantiene la misma conexión serializada SQLCipher, separación por servidor/usuario/dispositivo, SecureStore, biometría y reloj nativo. No hay segunda base local, fotos de cámara, nuevas dependencias ni almacenamiento en AsyncStorage/archivos planos.

Tablas nuevas: `incident_events` (JSON original, actor y SHA-256), `incident_delivery` (proyección mutable de entrega), `incident_receipts` (recibos inmutables), `incident_lease` (exclusión de envíos), `discipline_owner_grants`, `infraction_drafts` y `infraction_draft_submission`. Triggers impiden reescribir/eliminar originales y recibos. HU36/HU37 conservan sus tablas, UUID, payload y contrato; la versión de esquema solo incorpora las tablas nuevas.

El formulario local parte del paquete abierto; solo ofrece estudiantes de su lista, con búsqueda SQL real existente y paginación. Permite incidencia general sin estudiante. No exige que el estudiante esté habilitado para describir precisamente un problema de habilitación. Sí exige pertenencia al paquete al seleccionar estudiante y vuelve a comprobar acceso antes de persistir. Una incidencia no modifica estudiantes, habilitación, ingresos o sanciones.

La captura usa hora de servidor anclada a boot/elapsedRealtime y conserva `time_evidence`, actor original, examen, paquete, instalación, UUID y texto original. Solo se captura durante la ventana offline autorizada. Expiración, paquete incompleto/desactualizado, cambio de boot o bloqueo impiden capturar. Los pendientes/resultados del actor se pueden consultar en el almacén desbloqueado aunque su paquete ya no permita nuevas capturas.

Las pantallas de captura se desmontan al perder foco/acceso; los cambios de cuenta y segundo plano conservan el bloqueo existente. Los resultados tardíos no pueden repoblar una vista de otro ámbito. Los detalles/descripciones no se escriben en logs móviles ni en mensajes de errores técnicos de transporte.

### Borradores de infracción

El contexto online del examen devuelve permiso de gestión y hora de observación del servidor. Solo con la cuenta/dispositivo actuales coincidentes se conserva ese permiso en SQLCipher, vinculado a la huella del paquete y limitado por su vigencia. Una negativa observada reemplaza un permiso anterior; una respuesta positiva antigua no restaura un permiso ya denegado. No se deduce el permiso desde un rol global ni desde datos del estudiante.

Un borrador conserva identidad, tipo, descripción y hora declarada; no entra en el transporte de incidencias y no cambia estados oficiales. Al revisarlo online se vuelve a consultar autorización y se usa el POST HU30 existente. Ese POST no ofrece UUID idempotente: antes de enviarlo se marca SUBMITTING. Ante respuesta perdida/cierre se conserva UNCERTAIN y se bloquea el reenvío automático del mismo borrador; debe consultarse el servidor y coordinarse la reconciliación. Ante rechazo definitivo sin creación puede volver a DRAFT. Los originales no se alteran.

El permiso previamente validado sigue siendo un snapshot: una revocación no conocida puede ocurrir offline. Permite únicamente preparar evidencia, nunca confirmar una infracción. Una revocación conocida de acceso marca el paquete desactualizado; `MOBILE_ABILITY_REQUIRED` se distingue de una revocación y no invalida paquetes por un despliegue pendiente.

## Extensión idempotente de incidencias

Rutas nuevas, aditivas:

```text
GET  /api/v1/exams/{exam_id}/discipline-context
POST /api/v1/exams/{exam_id}/offline/incidents
```

El POST recibe una incidencia por solicitud y devuelve un recibo individual, separado de `offline/sync` de HU37. Sobre:

```json
{"event_json":"<JSON original persistido>","event_sha256":"<SHA-256 de esos bytes UTF-8>"}
```

El objeto serializado tiene exactamente `v:1`, `event_id`, `exam_id`, `package_id`, `actor_id`, `mobile_device_id`, `installation_id`, `student_id` (string positiva o null), `type`, `description`, `captured_at` y `time_evidence` con `serverMs`, `boot`, `elapsed`, `capturedElapsed`, `source`. UUID en minúsculas; identificadores decimales como strings. Límite de este transporte: 4000 caracteres de descripción y 65536 bytes de JSON. El contrato HU27 clásico conserva sus límites originales. No se reserializa el original para un reintento: la huella identifica sus bytes, incluida la representación JSON.

Respuesta `data`:

```text
event_id, request_hash, status (REGISTERED | CONFLICT | REJECTED), code,
incident_id (positivo solo si REGISTERED), review_required, received_at
```

Procesamiento:

1. Valida sobre, hash, campos, tipos, versión y timestamps; campos extra o estructura inválida: 422, sin crear evidencia/registro.
2. Autentica al actor y dispositivo reales. Exige paquete descargado por ese actor, lista/examen correspondientes y la vinculación móvil original. No confía en el actor enviado por el cliente.
3. Transacción con orden de bloqueos examen → actor; PK UUID y bloqueo del recibo serializan repeticiones. Conserva el JSON original cifrado con `Crypt` y la hora propia de recepción.
4. Mismo UUID/actor/hash: recupera exactamente el recibo conservado, incluso si se perdió la respuesta o luego se revocó la colaboración. Otro actor no puede recuperar ese resultado. UUID con otro contenido: EVENT_ID_REUSED, sin alterar el original.
5. En el primer procesamiento comprueba estudiante del snapshot, consistencia temporal y autorización actual/histórica de la lista. La hora declarada no está atestada por hardware y no acredita una decisión disciplinaria. Fallos de autorización/tiempo producen conflicto; fuera de lista, rechazo. Conserva evidencia sin crear reporte oficial.
6. Si HU27 autoriza actualmente, invoca su servicio para crear el reporte PENDING. El docente responsable puede reportar después del examen según la política HU27 actual: recepción tardía se marca para revisión. El colaborador fuera de su ventana/revocado conserva conflicto. No se amplía su autorización para crear un reporte oficial tardío.
7. Reporte, recibo y auditoría se confirman juntos; cualquier fallo de infraestructura/auditoría revierte todo. La auditoría nueva conserva UUID/huellas/resultado; la auditoría descriptiva propia de HU27 no se reemplaza.

En el móvil solo un recibo con UUID/hash/estructura coherentes permite mostrar «REGISTRADA EN SERVIDOR». Se persisten resultados terminales y no se reenvían automáticamente. 401/403/422/5xx, timeout, respuesta inválida o pérdida de conexión conservan el original pendiente. Un SENDING interrumpido se recupera en el siguiente desbloqueo. La cola tiene exclusión propia; el provider evita ejecuciones simultáneas y conserva sin cambios la cola de ingresos HU37.

## Coordinación obligatoria con Equipo 1 y política central

`MobileTokenPermissions::requiredAbility` actualmente deniega todas las APIs no listadas, incluso con token `*`. Esa regla permanece intacta. `MobileDisciplinePermissions.php` es **una propuesta inactiva** de coincidencias exactas con los scopes `incidents:read`, `incidents:report`, `discipline:manage`; no otorga esos scopes ni altera login.

Cambio concreto pendiente de revisión del equipo responsable:

1. Aprobar los endpoints exactos de esa clase y las tres abilities. Añadirlas a las credenciales móviles emitidas solo mediante el flujo autorizado, manteniendo las verificaciones de operador existentes.
2. Delegar explícitamente el fallback de `MobileTokenPermissions::requiredAbility` al mapeo propuesto para esas rutas; conservar deny-by-default. No usar comodines ni quitar `EnforceMobileTokenAccess`.
3. Mantener los middlewares y servicios HU27–HU31 que verifican responsable/colaborador. Un scope no sustituye la autorización contextual. Las pruebas incluyen un colaborador con scopes que sigue sin poder disciplinar.
4. Decidir la transición de tokens existentes, que no tendrán los scopes nuevos. Revalidación/reemisión de credencial mediante el mecanismo acordado; no editar silenciosamente tokens almacenados.

Los casos HTTP positivos nuevos activan la propuesta **solo mediante un doble en el contenedor aislado de pruebas**. Un caso conserva la política real y espera 403. No se oculta el bloqueo actual ni se debilita producción para que pasen pruebas.

Coordinar también conservación/retención de evidencia, revisión de conflictos tardíos, actores que ya no pueden renovar login tras perder todas sus colaboraciones, y reconciliación de borradores con respuesta incierta. No se implementan nuevos permisos de revisor, sanciones, aprobación masiva o emisión QR v3.

## Archivos creados/modificados

Móvil, creados:

- `src/features/incidents/{contracts,api,storageSchema,repository,sync,useProtectedPackage,useDiscipline}.ts`.
- `src/screens/{ReportIncidentScreen,OfflineIncidentsScreen,IncidentsScreen,InfractionsScreen,DisciplineActionsScreen}.tsx`.
- Rutas `src/app/offline/{incidents,report-incident,infraction-draft}.tsx` y `src/app/(private)/{incidents,incident,infractions,discipline-actions}.tsx`.
- `tests/incidents.test.ts` y este documento.

Móvil, modificados:

- `src/features/offline/repository.ts`: incorporación de esquema v3 tras comprobar SQLCipher.
- `src/features/offline/nativeVault.ts`: repositorio de incidencias en la conexión existente y recuperación de envíos.
- `src/features/offline/OfflineProvider.tsx`: lista/estado/envío de incidencias, con límites de ámbito y mutex existente.
- `src/services/http/client.ts`: tipo de método PATCH, usando el transporte existente.
- Layouts offline/privado y pantallas `OfflineListScreen`, `OfflinePackagesScreen`, `ExamsScreen`, `CollaborationsScreen`: enlaces/pantallas del mismo Router.
- Dos documentos de fase 2: referencia posterior, sin reescribir historial.

Backend, creados:

- `app/Http/Controllers/Api/V1/Incidents/MobileIncidentController.php`.
- `app/Http/Requests/Incidents/SyncMobileIncidentRequest.php`.
- `app/Services/Incidents/MobileIncidentSyncService.php`.
- `app/Services/Auth/MobileDisciplinePermissions.php` (propuesta inactiva).
- `routes/api/mobile-discipline.php`.
- `database/migrations/2026_11_09_000001_create_mobile_incident_sync_events.php`.
- `tests/Feature/Incidents/MobileIncidentSyncTest.php` y `docs/EIDA_CONTROL_FASE_7_INCIDENCIAS.md`.

Backend, modificado: `routes/api/v1.php`, únicamente para incluir el archivo de rutas aditivas. Los servicios/controladores de dominio del Equipo 1 siguen intactos. No se modificaron frontend, dependencias, lockfile, verificador/vectores QR, escáner nativo, autenticación o carpetas Android.

## Pruebas escritas, sin ejecutar

`tests/incidents.test.ts`: catálogo/alias públicos, estudiante opcional, descripción/tipos inválidos, estudiante no asignado, actor/huella inmutables, cambio de cuenta, pérdida de respuesta y reintento con los mismos bytes/UUID, 401/403/422/500, conflictos/rechazos terminales, ACK incoherente, recuperación SENDING, caducidad/boot/bloqueo, fallo cerrado sin SQLCipher, conservación real de HU37, permiso contextual de borradores y respuesta positiva antigua, bloqueo de reenvío incierto, restricciones del colaborador y contratos online de infracción/estado/expulsión/anulación.

`MobileIncidentSyncTest.php`: política móvil real cerrada, docente y colaborador, incidencia general y estudiante asignado, alias WRONG_EXAM, original cifrado y recibo estable, UUID alterado, aislamiento entre actores, colaboración/cuenta/dispositivo revocados, recepción tardía sin sanción, 422 y rollback completo al fallar auditoría. Utiliza la base SQLite en memoria y guardas de aislamiento de pruebas ya existentes. **No verifica contención real PostgreSQL.**

Las pruebas originales de cámara QR, QR v3, HU35–HU37 y autenticación no se reemplazaron ni se ejecutaron. La comprobación desktop de PRAGMA es un doble de disponibilidad: no demuestra que los bytes Android estén cifrados. Se necesita verificación física SQLCipher/biometría y pruebas de concurrencia en PostgreSQL aislado antes de desplegar.

## Comandos manuales y despliegue

Solo el usuario ejecuta estos comandos. Fase 7 no agrega dependencias; deben estar resueltas las pendientes de fases anteriores, incluida cámara.

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Para el caso nuevo de backend, revisar primero `phpunit.xml` y configuración de testing. Su guarda exige SQLite `:memory:`, sin configuración cacheada ni DB_URL, antes de migrar fixtures:

```powershell
Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
php artisan test --filter=MobileIncidentSyncTest
```

Las regresiones existentes del Equipo 1 y PostgreSQL deben ejecutarse por el equipo en una base **aislada de pruebas** con su configuración revisada. No apuntarlas a datos de desarrollo compartidos o producción por defecto.

En una base de desarrollo elegida y respaldada por el usuario, revisar/aplicar la nueva migración cuando corresponda:

```powershell
php artisan migrate --pretend --path=database/migrations/2026_11_09_000001_create_mobile_incident_sync_events.php
php artisan migrate --path=database/migrations/2026_11_09_000001_create_mobile_incident_sync_events.php
```

La migración crea una tabla aditiva con FK de conservación. Su rollback se niega si hay evidencia; no se propone borrar registros para habilitarlo. Deben estar desplegadas también las migraciones/endpoints de fases anteriores que utiliza la APK. El orden de liberación es revisión de política/Equipo 1 → pruebas → migración/adaptadores → habilitación controlada de scopes/tokens → prueba móvil. No hay despliegue automático.

No se requiere Prebuild por esta fase: solo cambia JavaScript/TypeScript y esquema local aplicado por la app después de desbloquear SQLCipher. Si falta el módulo de cámara/SQLCipher/reloj de fases previas, siguen siendo necesarias su preparación y build manuales, según [Fase 6](EIDA_CONTROL_FASE_6_CAMERA_QR.md). La APK independiente con bundle incluido y validación sin Metro continúa como trabajo posterior.

## Pendientes y límites explícitos

- Habilitación de la política central: bloqueo real de operaciones online/sync en tokens actuales, sin bypass implementado.
- Ejecutar typecheck, nuevas pruebas, regresiones y concurrencia PostgreSQL; validar físicamente persistencia cifrada y recuperación tras cierre.
- Desplegar migración y adaptadores en el entorno elegido; no se ejecutó ninguna migración o despliegue.
- Borradores con respuesta incierta y conflictos terminales requieren revisión institucional; no existe un contrato nuevo de resolución automática.
- La primera interfaz reporta incidencias mediante paquete propio vigente. No agrega un segundo POST no idempotente para reportes sin paquete; el endpoint web HU27 conserva ese uso existente.
- No se cachea el historial disciplinario completo offline ni se amplía la lista de estudiantes autorizados. La edición general de infracciones y asociación opcional de expulsión a una infracción no se exponen aún en la interfaz móvil.
- No se incorporan adjuntos, fotografías nuevas, sanciones automáticas, cambios de estado offline o excepciones de reloj/permisos.

Confirmación: esta fase solo escribió/revisó código y documentación. No se ejecutaron instalaciones, pruebas, typecheck, builds, Prebuild, Gradle, ADB, migraciones, seeders, Git, despliegues o modificaciones del sistema operativo.
