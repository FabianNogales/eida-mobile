# EIDA Control — Fase 4: HU35 y HU36 offline

Fecha: 8 de noviembre de 2026. **Entrega de código pendiente de validación por el usuario.** No se ejecutaron instalaciones, pruebas, typecheck, Expo, prebuild, compilaciones, emuladores, migraciones, despliegues ni operaciones Git. No se conectó con producción ni se leyeron secretos de `.env`.

Repositorios reales utilizados: `C:/proyecto/eida-mobile` y `C:/proyecto/oidevs-examenes-backend`. La ruta antigua del backend incluida en la solicitud ya no existe. No se recorrió el directorio padre `proyecto`, no se accedió a `-compare` y no se modificó EIDA Web.

Se respetó el modo código de `AGENTS.md`. La autorización expresa del prompt de fase 4 permite los cambios backend aditivos descritos aquí y sustituye la indicación anterior de backend solo lectura. Se consultaron los informes de fases anteriores, `HU35_HU36_HU37_OFFLINE_BACKEND.md`, los servicios reales y la documentación oficial de Expo. La prueba física de fases 2–3 es la informada por el usuario; no demuestra que estos cambios nuevos ya funcionen en Android.

## 1. Incompatibilidad HU37 detectada antes de fijar el evento local

`SyncOfflineEntriesRequest` admite únicamente `event_id, student_id, method, captured_at, device_id, qr_token` dentro de cada evento. Paquete, lista, versión y ambiente pertenecen al sobre del lote; el examen pertenece a la URL.

`OfflineSyncService` utiliza `QrTokenValidator`, que valida QR **HS256 v2**, mientras que el verificador móvil de fase 2 valida **RS256 v3**. Enviar evidencia v3 al servicio actual no representa una sincronización compatible.

Por ello el esquema local separa el contexto y la evidencia horaria del futuro evento de transporte. Los eventos manuales llevan `HU37_MANUAL_V1`; los QR llevan `QR_V3_REQUIRES_BACKEND_EXTENSION`. **No hay sender ni llamadas a `/offline/sync` en esta fase.** No se modificaron el request, el servicio ni la validación QR productiva de HU37. Una futura implementación deberá negociar esa ampliación antes de enviar v3, sin convertirlo a v2 ni eliminar evidencia.

## 2. Arquitectura implementada

```text
Exámenes / colaboraciones de fase 3
  └─ Distribución: prepare + assignments + mobile-context (HU35 Laravel)
       └─ Desbloqueo biométrico de clave local en SecureStore
            └─ SQLCipher confirmado en ejecución
                 └─ Manifiesto móvil + fotos privadas por paquete
                      └─ Staging cifrado → comprobaciones → publicación transaccional

/offline, accesible sin validar /me primero
  └─ Grant local del último usuario autorizado + biometría
       └─ Referencia horaria del servidor y vigencia del paquete
            └─ Búsqueda SQLite → detalle/fotos → captura provisional inmutable
```

HU35 conserva el reparto original de Laravel: orden alfabético, responsables vigentes, grupos exclusivos, versión 1 congelada, autorización por episodio y política del examen. Se extrajo el cálculo existente de entradas a un método privado compartido para consultar si la distribución cambió; no se cambió el algoritmo ni se añadió regeneración.

El docente ve responsables, cantidades, rangos y su lista propia si existe. Puede supervisar sin tener paquete personal. El colaborador recibe únicamente los metadatos de su lista y no puede preparar, consultar assignments ni pedir paquetes de otros responsables. Android no reparte estudiantes.

## 3. Endpoints reales reutilizados y añadidos

Rutas relativas a la base HTTPS configurada, que incluye `/api/v1` y cualquier prefijo de proxy. Se conserva el cliente de fase 3: Bearer privado, sin cookies, redirecciones bloqueadas y timeout. Las fotos usan el mismo cliente con respuesta binaria; no se envía el token a una URL proporcionada por el servidor.

| Método y ruta | Contrato / función | Ability móvil |
| --- | --- | --- |
| POST `exams/{exam_id}/offline/prepare` | HU35 existente, propietario exclusivamente. Idempotente si no cambian entradas. | `offline:prepare` |
| GET `exams/{exam_id}/offline/assignments` | Respuesta existente sin cambios; docente propietario. | `control:read` |
| GET `exams/{exam_id}/offline/package` | Respuesta anterior exacta para EIDA Web y clientes previos. | `offline:download` |
| GET `exams/{exam_id}/offline/package?schema_version=2` | Opt-in móvil: conserva campos anteriores y añade `mobile`. Exige token ligado a instalación. | `offline:download` |
| GET `exams/{exam_id}/offline/mobile-context` | Nuevo: distribución, congelamiento, desactualización, lista propia; propietario ve todos los responsables, colaborador solo el suyo. | `control:read` |
| GET `exams/{exam_id}/offline/packages/{package_id}` | Nuevo: reanuda el **mismo** manifiesto y entrega hora actual del servidor. No crea paquetes. | `offline:download` |
| GET `exams/{exam_id}/offline/packages/{package_id}/photos/{student_id}/{kind}` | Nuevo: bytes institucionales originales, `kind=profile|historical`. | `offline:download` |

Las rutas siguen bajo Sanctum, sesión vigente, contraseña cambiada y el límite existente de **60 solicitudes/minuto**. No se flexibilizaron permisos ni límites de otros equipos. El flujo nativo espacia cada foto 1,2 segundos para reservar margen a las demás solicitudes; no realiza reintentos automáticos. Otras consultas concurrentes aún pueden provocar HTTP 429: se conserva el progreso cifrado y se permite reanudar después de esperar. La comprobación completa de entradas HU35 en cada autorización favorece seguridad; debe medirse su costo con listas grandes antes de producción.

Un token móvil sin la ability correspondiente recibe 403. Las variantes móviles requieren `PersonalAccessToken.mobile_device_id`, dispositivo del actor con `revoked_at=null`, y los permisos existentes; no aceptan una sesión SPA como sustituto de ese vínculo.

## 4. Contratos JSON

### Contexto móvil

Forma de `data`, ejemplo sintético reducido a un responsable:

```json
{
  "exam": {
    "id": 42, "name": "Parcial", "subject_name": "Programación",
    "exam_date": "2030-01-01", "start_time": "10:00:00", "duration_minutes": 60,
    "evaluation_type": "partial", "status": "ACTIVE", "entry_available": true,
    "entry_unavailable_reason": null,
    "entry_opens_at": "2030-01-01T14:00:00.000000Z",
    "entry_closes_at": "2030-01-01T15:00:00.000000Z",
    "server_time": "2030-01-01T14:05:00.000000Z",
    "room": { "id": 1, "name": "Aula 1", "code": "A1", "location": null }
  },
  "can_prepare": true, "unavailable_reason": null,
  "distribution_id": "1", "version": 1, "frozen": true, "stale": false,
  "prepared_at": "2030-01-01T13:30:00.000000Z", "own_list_id": "2",
  "lists": [{
    "list_id": "2", "responsible_id": "7", "responsible_name": "Responsable sintético",
    "student_count": 1, "surname_range": { "from": "Álvarez", "to": "Álvarez" }
  }]
}
```

### Sobre versionado

`data.mobile` contiene `schema_version:1`, `manifest_json:string` y `manifest_sha256:string`. El hash se calcula sobre los bytes UTF-8 **exactos** de `manifest_json`; el cliente no reordena ni reserializa el JSON antes de comprobarlo. La query `schema_version=2` selecciona la extensión HTTP compatible; el formato interno empieza en esquema 1. Ninguno de estos números es la versión de distribución HU35.

El resto de `data` conserva los campos legacy: `package_id, exam_id, exam, list_id, version, responsible_id, prepared_at, expires_at, timezone, room_id, surname_range, qr_validation, students`. Los estudiantes legacy no reciben campos nuevos. El endpoint sin query no incluye `mobile`.

Contenido expandido de `manifest_json` (ejemplo sintético; `exam` tiene el mismo objeto mostrado arriba):

```typescript
interface Manifest {
  schema_version: 1;
  package_id: string; exam_id: string; distribution_id: string;
  list_id: string; version: number;
  exam: OfflineExam;
  binding: { user_id: string; device_id: string; installation_id: string };
  authorization_id: string; // referencia opaca = package_id; nunca authorization_hash
  responsible_name: string;
  prepared_at: string; server_time: string; expires_at: string;
  timezone: 'America/La_Paz'; room_id: string;
  surname_range: { from: string | null; to: string | null };
  students: OfflineStudent[];
  qr: {
    available: boolean; reason: string | null;
    issuer: string | null; audience: string | null;
    keys: { kid: string; algorithm: 'RS256'; pem: string }[];
    revoked_jtis: string[] | null;
  };
}
```

Estudiante del manifiesto, con ausencia legítima de foto de perfil y foto histórica presente:

```json
{
  "student_id": "101", "first_names": "Ana", "last_names": "Álvarez",
  "sis_code": "203000101", "identity_number": "CI-101",
  "student_status": "ACTIVE", "enrollment_status": "ACTIVE",
  "eligibility_status": "ELIGIBLE", "eligibility_revision": 1,
  "entry_status": "PENDING",
  "photos": [
    { "kind": "profile", "state": "ABSENT" },
    {
      "kind": "historical", "state": "PRESENT", "mime": "image/png",
      "size": 68, "revision": "1",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "path": "exams/42/offline/packages/01234567-89ab-4cde-8f01-23456789abcd/photos/101/historical"
    }
  ]
}
```

El hash de esa muestra es ilustrativo, no corresponde a una fotografía real. En ejecución siempre se entrega el hash real de los bytes institucionales. La revisión de perfil usa el ID de imagen o su hash para referencias antiguas; la histórica usa la revisión institucional.

El parser comprueba esquema, tipos, IDs, fechas con zona, examen, validez temporal, miembros únicos, dos descriptores fotográficos por estudiante, MIME permitido, límite 5 MiB por foto, hash y ruta **exacta** por examen/paquete/estudiante/tipo. Exige nombres/SIS/CI presentes como cadenas no vacías; no inventa identidad ni publica una lista con esas identidades incompletas. Limita manifiestos a 32 MiB de texto y 50 000 miembros.

Reanudar devuelve `{data:{mobile:{schema_version,manifest_json,manifest_sha256},server_time}}`. El contenido original no cambia. Solo la referencia horaria local puede actualizarse tras revalidación online. El hash es comprobación de integridad; la confianza de origen proviene del HTTPS autenticado y de la autorización del backend, no de una firma independiente del manifiesto.

## 5. SQLite, SQLCipher y gestión de claves

Se declara `expo-sqlite ~58.0.15` y el plugin `['expo-sqlite', { useSQLCipher: true }]`. SecureStore ya pertenecía a fase 3. No se instalaron ni descargaron paquetes ni se regeneró el lockfile.

Antes de `PRAGMA key`, DDL o escritura personal, `initializeCipher` consulta `PRAGMA cipher_version` y exige una versión reconocible. Si falta, se bloquea la preparación y se pide una nueva development build. **No existe fallback a SQLite plano.** El mero éxito de `PRAGMA key` no prueba cifrado.

La clave SQLCipher es aleatoria de 32 bytes, generada por QuickCrypto y protegida con SecureStore `requireAuthentication:true`. No se almacena en código, `.env`, manifiesto, logs ni claves públicas. Este diseño requiere biometría segura configurada en Android. Un equipo sin esa capacidad queda bloqueado; no se sustituye silenciosamente por un secreto en texto o por la contraseña institucional.

Un marcador por ámbito permite detectar la pérdida/inaccesibilidad de una clave ya creada. No se genera una nueva clave encima de datos pendientes ni se borra una base que ya no puede abrirse. Cambiar las huellas/biometría puede invalidar la clave de Android: es una limitación que debe probarse y explicarse al operador; esta fase no incorpora recuperación administrativa ni exportación de claves. JS no permite prometer borrado físico inmediato de todas las copias de una clave en RAM.

Archivo privado: `eida-<sha256(apiBase,userId,installationId,deviceId)>.db`, dentro del directorio privado de SQLite. Cada paquete almacena además ese vínculo completo dentro de la base cifrada y se comprueba al leer/reanudar. Examen, paquete y versión quedan separados en el esquema. La ruta privada de Android por sí sola **no** es la protección: la proporciona SQLCipher comprobado y la clave protegida.

Se mantienen `temp_store=MEMORY`, claves foráneas y `secure_delete`. No se exportan bases ni se escriben fotos temporales en archivos. La configuración existente conserva `android.allowBackup=false`; debe mantenerse al generar la nueva build.

`SerializedSql` serializa **todas** las consultas y transacciones en una sola conexión que ya tiene la clave. Se ejecutan BEGIN IMMEDIATE/COMMIT/ROLLBACK en esa conexión y se espera su cola antes de cerrarla. No se utiliza el `withExclusiveTransactionAsync` nativo de Expo porque abre otra conexión sin heredar clave ni PRAGMAs. Ninguna consulta externa puede colarse dentro de una transacción de la cola. Un bloqueo de la app invalida operaciones en espera y fuerza rollback antes de publicar.

| Tabla | Datos / restricciones |
| --- | --- |
| `packages` | UUID, examen, binding, estado, sobre íntegro, ancla horaria, error fijo y publicación. Índice único de snapshot activo por examen. |
| `students` | PK paquete/estudiante, nombres, SIS, CI, búsqueda normalizada y snapshot JSON. FK paquete. |
| `photos` | PK paquete/estudiante/tipo, hash y bytes BLOB. FK al miembro del paquete. |
| `events` | UUID estable, examen, estudiante, paquete y JSON inmutable. UNIQUE examen/estudiante incluso entre paquetes. |

`user_version=1`. Triggers impiden actualizar o borrar eventos pendientes. HU37 deberá guardar ACK/resultados en una estructura separada y definir una política explícita de conservación; no debe quitar esos triggers para mutar evidencia. El esquema SQL concreto está en `src/features/offline/repository.ts`.

## 6. Fotografías

Se reutiliza `DatabaseImageService` con operaciones aditivas `metadata` y `read`. `response` utiliza la misma lectura previa conservando su respuesta web. No se añadió almacenamiento de fotos en el servidor.

Fuentes: imagen de perfil del usuario del estudiante, imagen histórica del estudiante, y compatibilidad de lectura para rutas institucionales locales previas. No se consultan URLs externas. La ausencia se informa solo si no hay referencia institucional; una referencia rota, un 404 o bytes corruptos **no** se convierten en `ABSENT`.

Las referencias privadas de la foto y el manifiesto exacto se agregan a `ExamOfflinePackage.snapshot`; no salen en la respuesta pública. No hacen falta tablas ni migraciones nuevas para esta extensión. Cada descarga/reanudación comprueba actor, dispositivo, instalación, lista propia, episodio de autorización, examen, distribución y vigencia; la foto exige además membresía en esa lista. El propietario que supervisa no obtiene fotos de un paquete ajeno.

Se comprueban tamaño, SHA-256 y tipo contra el manifiesto. Solo bytes completos y verificados ingresan al BLOB cifrado. Un hash distinto bloquea la publicación. Las fotos se presentan mediante una data URI creada en RAM después del desbloqueo; no se usa galería, URL pública ni archivo plano de caché creado por la aplicación. Se conservan los bytes originales disponibles en el almacenamiento institucional, sin transformarlos de nuevo al descargar.

Una foto de perfil anterior puede desaparecer por el comportamiento previo de sustitución del backend. En ese caso se conserva el staging incompleto y el operador puede solicitar un paquete nuevo; el código no modifica ni recupera fotografías ajenas. Una foto histórica anterior sigue las reglas de conservación institucional existentes.

## 7. Preparación, listas y estados

1. Sesión móvil validada con internet y lista propia autorizada.
2. Desbloqueo del almacén cifrado y comprobación del reloj nativo.
3. Descarga opt-in del manifiesto; comprobación de hash, esquema, identidad y claves anunciadas.
4. Inserción transaccional de paquete y miembros en staging cifrado.
5. Descarga secuencial de fotos requeridas y comprobación de integridad. Los `ABSENT` legítimos no requieren descarga.
6. Reautorización final del **mismo paquete** en el servidor, incluso si no había fotos.
7. Comprobación de lista y todos los BLOBs; transacción final cambia el snapshot activo a PREPARADO.

Un snapshot nuevo no desactiva al anterior hasta que termina la transacción final. Una interrupción no borra el anterior ni eventos. Reanudar usa el mismo UUID y hash; estudiantes y fotos tienen claves únicas. Las fotos completas se vuelven a comprobar localmente antes de omitir su descarga. Al reabrir una base, un staging `DESCARGANDO` se convierte en `INCOMPLETA`.

| Estado | Uso |
| --- | --- |
| `NO_DESCARGADO` | Sin paquete para ese flujo; estado inicial de preparación. |
| `DESCARGANDO` | Preparación en curso, todavía no consultable. |
| `INCOMPLETA` | Staging interrumpido; permite reanudar con internet. |
| `PREPARADO` | Snapshot completo publicado para consulta, sujeto a desbloqueo/reloj/vigencia. |
| `DESACTUALIZADO` | Cambio de entradas HU35, autorización denegada conocida o examen ya no disponible. Captura bloqueada. |
| `VENCIDO` | Se alcanzó el cierre autorizado del paquete. Pendientes conservados. |
| `ERROR` | Error de configuración, cifrado, contrato o preparación; pantalla explica la causa. No habilita datos incompletos. |

`DISTRIBUTION_FROZEN` se muestra explícitamente. No se cambian miembros ni se genera versión 2. Si el backend exige revisión de una distribución congelada, la resolución depende del flujo institucional de ese equipo; no se incluyó una operación administrativa alternativa.

La preparación para consulta y la capacidad QR son distintas. Una lista sin claves puede estar PREPARADA para consulta manual, con **QR NO DISPONIBLE**.

## 8. Desbloqueo, sesiones y referencia horaria

La primera autenticación y toda descarga requieren internet. Se añade un grant local de ámbito mínimo en SecureStore, separado del Bearer. Para abrir la base se exige la clave biométrica, el mismo servidor, instalación, usuario y dispositivo. Si hay credencial remota local de otra cuenta, se rechaza el grant anterior.

La ruta `/offline` es independiente del guard remoto de fase 3. Login, sesión y home permiten llegar a ella sin consultar primero Laravel. Al volver del fondo se requiere desbloqueo; se cierra la conexión y se vacían las vistas del proveedor. Los callbacks de seguridad cierran también operaciones en curso; una respuesta de una sesión anterior no puede publicar datos en la cuenta siguiente. Las escrituras del grant se serializan con su revocación para evitar que una descarga/desbloqueo tardío lo reactive.

| Situación | Acceso y conservación |
| --- | --- |
| Sin internet | No elimina credencial, base, claves ni pendientes. Consulta local con grant, biometría y vigencia. |
| Token alcanzó vencimiento local | Bloquea el almacén; permite volver a desbloquear paquetes aún vigentes. No extiende su vencimiento. |
| 401, cambio de contraseña o revocación confirmada | Retira el grant y bloquea. Conserva base, clave y eventos cifrados. |
| Logout remoto o cierre local | Retira el grant antes de cerrar la sesión; conserva pendientes protegidos. Mantiene la distinción de revocación remota pendiente de fase 3. |
| Nuevo login/cambio de cuenta | Retira el grant anterior; cada usuario abre su propio ámbito tras validación online. |

Se añadió el módulo fuente local `modules/eida-offline-clock`, sin modificar el directorio nativo generado `/android`. Obtiene `SystemClock.elapsedRealtime()` (incluye reposo) y `Settings.Global.BOOT_COUNT`. No pide permisos adicionales, no cambia la hora ni instala herramientas. Si no existe el módulo o no se obtiene el identificador de arranque, falla cerrado.

La referencia es `hora HTTPS del servidor + elapsedRealtime actual − elapsedRealtime al iniciar la solicitud`. Incluir el recorrido de red puede adelantar conservadoramente el vencimiento, nunca prolongarlo por latencia. Se conserva entre reinicios de la **aplicación** mientras Android siga en el mismo arranque. Cambiar el reloj de pared no cambia esa cuenta. Después de reiniciar el **teléfono**, se exige revalidar el mismo paquete online para obtener una nueva referencia; no hay fallback al reloj editable.

Esta estimación no es un sellado horario acreditado ni protege frente a un Android comprometido. La evidencia horaria se guarda separadamente y HU37 seguirá siendo la autoridad. Un cambio de fecha del servidor requiere corregir el servidor, no ajustar silenciosamente la vigencia local.

## 9. Consulta e identidad

Pantallas añadidas: distribución/preparación, paquetes/estado/desbloqueo, lista local con búsqueda paginada de 50 resultados, y detalle dentro de la lista con SIS, CI, habilitación/revisión, ingreso conocido y fotografías de ambos tipos.

La búsqueda se ejecuta con SQL parametrizado sobre nombres, apellidos, SIS y CI normalizados. Se escapan comodines para tratarlos como texto literal. No busca estudiantes en Laravel, otra lista o la galería.

Se muestra la actualización original del snapshot y su vigencia, no se presenta la fecha de reanudación como una actualización de habilitación. Consulta y captura comprueban vigencia con el reloj anclado. La vista local retira identidades/fotos al vencer o bloquearse.

**Entrada QR de esta entrega:** campo de contenido para pegado manual o lector externo. No se añadió cámara ni biblioteca de escaneo. La identificación criptográfica funcional usa el contenido recibido; un lector con cámara integrado requiere trabajo adicional de UI/permisos si se solicita.

## 10. QR offline

Se importa `verifyQrV3` y el proveedor nativo QuickCrypto de fase 2 **sin reescribirlos**. El flujo usa claves públicas del manifiesto autorizado, firma RS256, emisor/audiencia, examen esperado y reloj anclado. La identidad se toma del `sub` firmado y se exige pertenencia a la lista. Después se comprueban habilitación conocida, ingreso conocido, revocaciones conocidas y duplicados locales.

El QR v2 se informa como no verificable criptográficamente offline; decodificarlo no autoriza identidad. No se usa un payload sin firma para registrar.

El backend actual **no emite v3 por sus rutas productivas**, aunque exista un servicio experimental. Por defecto se devuelve:

```json
{
  "available": false, "reason": "PRODUCTION_QR_V3_NOT_CONFIRMED",
  "issuer": null, "audience": null, "keys": [], "revoked_jtis": null
}
```

La nueva configuración `mobile_offline.qr_v3_issued` es falsa por defecto. No activa emisión. Solo un despliegue futuro que realmente emita v3 podrá revisar su activación junto con `qr_v3.enabled` y la clave **pública** configurada, RSA de al menos 2048 bits, kid, issuer y audience. El servicio móvil nunca lee `private_key_path` ni `APP_KEY`.

No hay feed institucional de revocaciones QR en el contrato actual. `revoked_jtis:null` significa desconocido; no se inventa una lista vacía que sugiera cobertura. Ni una firma válida ni un snapshot reciente prueban que no existan revocaciones posteriores.

## 11. Captura provisional inmutable

Confirmación explícita de identidad antes de registrar MANUAL o QR. Se exige snapshot preparado/vigente, horario abierto, miembro propio, estudiante/inscripción ACTIVE, habilitación ELIGIBLE e ingreso conocido PENDING.

Ejemplo sintético de evento local manual:

```json
{
  "event_id": "abcdef01-2345-4678-9abc-def012345678",
  "exam_id": "42", "package_id": "01234567-89ab-4cde-8f01-23456789abcd",
  "list_id": "2", "version": 1, "room_id": "1", "student_id": "101",
  "method": "MANUAL", "captured_at": "2030-01-01T14:05:00.000Z",
  "device_id": "7c4dfeaf-e588-4db1-9524-496a7905582d",
  "local_status": "PENDING_SYNC", "sync_compatibility": "HU37_MANUAL_V1",
  "time_evidence": {
    "serverMs": 1893506700000, "boot": "3", "elapsed": 100000,
    "capturedElapsed": 100000, "source": "SERVER_ANCHORED_ESTIMATE"
  }
}
```

`device_id` del evento reutiliza el UUID de instalación permitido por HU37; el ID numérico del dispositivo de servidor queda además en el binding del paquete. Un evento QR añade `qr_token` original y cambia el marcador de compatibilidad. Nunca se reconstruye/re-firma un QR.

La misma captura guardada devuelve el mismo UUID al reintentar. La restricción única examen/estudiante es la última defensa ante pulsaciones simultáneas y cambios de paquete. El registro se conserva como `PENDING_SYNC`; la interfaz dice **REGISTRADO LOCALMENTE / PENDIENTE DE SINCRONIZACIÓN**, sin registro oficial confirmado. No hay transición a ACCEPTED ni ACK ficticio.

## 12. Dependencias y configuración

Nueva dependencia declarada: **`expo-sqlite ~58.0.15`**, versión encontrada en `expo/bundledNativeModules.json` del SDK instalado. Reutilizadas: SecureStore, QuickCrypto, Nitro, Expo Router y los componentes existentes. No se añade UI externa, cámara, sistema de fotos, `expo-device` ni servicio de sincronización.

El módulo pequeño de reloj se mantiene como fuente local con package/config/Gradle/manifest/Kotlin; autolinking usa `expo.autolinking.nativeModulesDir=./modules`. Necesita incorporarse a la nueva build nativa.

`.gitignore` ahora limita `/android/` e `/ios/` a la raíz para conservar el código del módulo local; ignora sus salidas build/Gradle y bases SQLite. Se conservan reglas de `.env`, secretos, keystores, dependencias y artefactos. Las claves públicas/vectores sintéticos JSON de fase 2 pueden versionarse; las claves privadas, bases reales, fotos descargadas y tokens no.

`package-lock.json` se conserva exactamente como estaba al iniciar esta fase. El usuario debe actualizarlo al instalar la dependencia. El lockfile ya reflejaba instalaciones realizadas por el usuario después de fase 3; no se intentó restaurar una versión anterior.

## 13. Instrucciones manuales Windows — NO ejecutadas

Estos comandos son para revisión y ejecución manual del usuario, por separado. Utiliza el entorno que ya tienes preparado. El comando de compilación inicia Gradle: según lo que falte en tu equipo, puede descargar Gradle, dependencias o componentes Android. Revisa el entorno antes de ejecutarlo; el asistente no ejecutó ese comando ni descargó ninguna herramienta.

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
# Instalar únicamente la dependencia declarada y actualizar el lockfile:
npx expo install expo-sqlite

# Revisar TypeScript y ejecutar pruebas, cuando decidas hacerlo:
npm run typecheck
npm test
```

Los nuevos tests de escritorio usan `node:sqlite` en memoria con datos sintéticos; necesitan una versión de Node soportada por el proyecto que incluya ese módulo (por ejemplo, el Node 22 ya previsto). La disponibilidad de cipher se dobla exclusivamente en el adaptador de pruebas SQL. **Estas pruebas no acreditan cifrado real Android.** La prueba negativa de falta de SQLCipher exige que no se ejecute ninguna escritura.

Después de revisar cambios y resultados, necesitas una **nueva development build**, no Expo Go ni solo recargar JS. Primero incorpora la configuración nativa:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
# Cambia Android generado: ejecútalo solo después de revisar/resguardar cambios nativos propios.
npx expo prebuild --platform android --no-install
# Compila e instala en el dispositivo que selecciones:
npx expo run:android --device
```

No se propone `--clean`, borrar Android, borrar caches ni reinstalar herramientas. El usuario decide cómo conservar/modificar sus archivos nativos. El plugin debe habilitar SQLCipher y el autolinking incluir EidaOfflineClock. Con la build anterior se bloqueará el almacenamiento si faltan esos módulos; esa pantalla es intencional.

## 14. Pruebas backend escritas, sin ejecutar

Nuevo `tests/Feature/Offline/MobileOfflinePackageTest.php`, reutilizando `IsolatedMobileDatabase`, `OfflineExamFixture` y las pruebas HU35–HU37 previas sin alterarlas. Cubre preparación docente, prohibición de colaborador, exclusividad, congelamiento, contexto propio, supervisión sin paquete, contrato legacy, extensión versionada/hash/vínculo, ausencia legítima, bytes de perfil/histórica, rechazo de fotos ajenas, otro usuario/dispositivo, permisos Bearer, revocación, distribución obsoleta, vigencia y reanudación sin duplicar paquetes.

Propuesta manual, después de revisar la configuración de tests:

```powershell
Set-Location -LiteralPath 'C:\proyecto\oidevs-examenes-backend'
php artisan test --filter=MobileOfflinePackageTest
php artisan test --filter=OfflineBackendTest
php artisan test --filter=MobileAuthenticationTest
```

`phpunit.xml` declara testing y SQLite `:memory:`. El soporte aislado rechaza configuración cacheada, DB_URL o conexiones distintas antes de migrar el esquema efímero de tests. No ejecutar estas suites contra PostgreSQL ni producción. No se ejecutó ninguno de estos comandos en esta entrega.

## 15. Pruebas móviles escritas y verificación manual pendiente

Nuevos `tests/offline.test.ts` y `tests/support/offlineFixtures.ts`: esquema/hash, miembros exclusivos, paths de foto, cipher ausente, reloj/arranque, preparación completa/ausencia, descarga interrumpida, conservación del snapshot anterior, reanudación sin duplicados, fotos manipuladas/tamaño/hash, búsqueda local/acento/SIS/CI/wildcards, restauración del repositorio, aislamiento de usuario/dispositivo/instalación/servidor, snapshot inmutable, publicación incompleta, rollback de staging, serialización de transacciones/consultas en una conexión, recuperación de staging interrumpido, respuesta stale preservando pendientes, vencimiento, claves incompletas, QR real v3/vectores originales, manipulación, otro examen, fuera de lista, v2, habilitación inválida, revocación conocida, captura MANUAL/QR, UUID estable, triggers, límites de sesión y HTTP binario.

No se modificaron las suites anteriores. La prueba de reinicio de repositorio reutiliza la base sintética en memoria; **no sustituye** matar/reabrir la APK y desbloquear Keystore/SQLCipher en Android. Pendiente de ejecutar por el usuario:

1. Build sin SQLCipher: intentar preparar y comprobar bloqueo sin datos personales persistidos.
2. Nueva build: login docente y colaborador, preparación real, fotos presentes/ausentes y búsqueda offline.
3. Cortar red durante fotos, comprobar INCOMPLETA y snapshot previo accesible; restablecer sesión y reanudar sin duplicados.
4. Cerrar/reabrir APK en modo avión en el mismo arranque: biometría, lista, detalle, fotos y pendientes conservados.
5. Cambiar reloj de pared: no extender vigencia. Reiniciar teléfono: exigir revalidación online del paquete.
6. Vencer paquete con la vista abierta: retirar identidades y bloquear nuevas capturas, conservar pendientes.
7. Cerrar sesión/cambiar de usuario/revocar dispositivo durante descarga: bloquear, no mezclar cuentas ni perder pendientes.
8. Cancelar biometría, agregar/cambiar huellas y revisar el comportamiento de clave inválida sin recreación automática.
9. Con QR productivo actual v2: rechazo explícito offline. V3 futuro: firma/lista/habilitación/duplicado; ningún envío a HU37 actual.
10. Confirmar cifrado real con inspección controlada de una base **sintética** fuera de la app: SQLite sin clave no debe leer sus tablas. No exportar una base de alumnos reales ni su clave.

La revisión de esta entrega fue lectura estática de código; no se ejecutaron suites, linters, typecheck ni herramientas de validación.

## 16. Despliegue backend pendiente y preparación HU37

Para que el móvil nuevo funcione, el usuario debe revisar e integrar los archivos backend inventariados abajo y desplegarlos por su procedimiento habitual. No se tocó el servidor desplegado. La presencia de código local no significa que Vercel/u otro servidor ya tenga estas rutas.

Esta fase no añade migraciones. Requiere las tablas de HU35–HU37, `mobile_devices`/Sanctum y `stored_images` de fases previas; si aún no están desplegadas, su revisión/migración pertenece al procedimiento previo del usuario. No ejecutar seeders ni migraciones para probar esta entrega contra datos reales.

Mantener QR productivo actual sin cambios. `MOBILE_OFFLINE_QR_V3_ISSUED` permanece falso por defecto. Verificar en el despliegue que el proxy preserve rutas de API, Bearer, respuestas binarias y `Cache-Control: private, no-store`; no cachear manifiestos/fotos de otra cuenta.

HU37 pendiente: adaptador de lote con IDs/contexto correctos, negociación de evidencia v3, envío explícito/idempotencia, ACK reales en almacenamiento separado, reintento de red, conflictos y sincronización tardía, estado institucional/disciplinario y política de conservación. No se añaden llamadas automáticas, ACCEPTED locales, incidencias o expulsiones. La consulta manual y los pendientes no garantizan aceptación futura: matrícula, habilitación, revocación o duplicados de otro dispositivo pueden haber cambiado.

## 17. Inventario exacto de esta entrega

### Móvil: nuevos

- `src/features/offline/contracts.ts`, `manifest.ts`, `clock.ts`, `api.ts`, `repository.ts`, `serializedSql.ts`, `download.ts`, `identity.ts`, `nativeVault.ts`, `OfflineProvider.tsx`.
- `src/screens/OfflineDistributionScreen.tsx`, `OfflinePackagesScreen.tsx`, `OfflineListScreen.tsx`.
- `src/app/(private)/offline-distribution.tsx`, `src/app/offline/_layout.tsx`, `src/app/offline/index.tsx`, `src/app/offline/list.tsx`.
- `modules/eida-offline-clock/package.json`, `expo-module.config.json`, `android/build.gradle`, `android/src/main/AndroidManifest.xml`, `android/src/main/java/bo/eida/control/clock/EidaOfflineClockModule.kt`.
- `tests/offline.test.ts`, `tests/support/offlineFixtures.ts`.
- Este documento `docs/EIDA_CONTROL_FASE_4_HU35_HU36_OFFLINE.md`.

### Móvil: modificados

- `.gitignore`, `package.json`, `app.config.ts`.
- `src/services/http/client.ts` y `errors.ts`: bytes con las mismas restricciones HTTP y errores HU35/HU36 explícitos.
- `src/features/auth/session.ts`: binding mínimo y callbacks aditivos de cierre/vencimiento/revocación, sin reescribir login ni dispositivos.
- `src/app/_layout.tsx`, `src/app/(private)/_layout.tsx`: proveedor y rutas añadidas.
- `src/screens/HomeScreen.tsx`, `ExamsScreen.tsx`, `CollaborationsScreen.tsx`, `LoginScreen.tsx`, `SessionScreen.tsx`: enlaces a funciones nuevas y texto actualizado.

### Backend: nuevos

- `app/Services/Offline/MobileOfflinePackageService.php`.
- `config/mobile_offline.php`.
- `tests/Feature/Offline/MobileOfflinePackageTest.php`.

### Backend: modificados

- `app/Services/Offline/OfflineAssignmentService.php`: extracción del mismo cálculo de entradas y consulta read-only `isStale`.
- `app/Services/Images/DatabaseImageService.php`: `metadata/read` compartidas; comportamiento de respuesta anterior conservado.
- `app/Http/Controllers/Api/V1/Entries/OfflineExamController.php`: opt-in y acciones móviles nuevas.
- `app/Services/Auth/MobileTokenPermissions.php`: allowlist de las rutas añadidas con abilities existentes.
- `routes/api/v1.php`: tres rutas móviles aditivas.

No se modificaron `OfflinePackageService`, `OfflineExamAccess`, `OfflineSyncService`, las tablas/modelos de reparto, servicios online de ingreso, contratos HU37, QR productivo, frontend, `.env`, lockfile, `/android` generado, SDK/NDK/Java/Node o scripts de herramientas.

Comparación de lectura SHA-256 antes/después en archivos protegidos relevantes:

| Archivo | SHA-256 conservado |
| --- | --- |
| Móvil `package-lock.json` | `CB2B5D3CD4CEA2A982FA2D37AA337DD287FC00FDF4EA75345F9A8416CFACA037` |
| Móvil `/android/gradle.properties` | `41D98FE06DBAF94EBA443646A22989EB5CBDE71E8E87F0D3C5414C2D63E0F04C` |
| Móvil `/android/app/build.gradle` | `0C62198E008527F9E5D3162590E56B69FFA0723E267528F64F3E622AA9D5FE68` |
| Móvil `src/features/qr/verifyQrV3.ts` | `DF644F11B33CE84E5FAAB7BD1F95661AA743395DB14325D14DDBEFE36B1A3C3F` |
| Backend `OfflinePackageService.php` | `F8C3EF174B0B30F7F734BD0461799B4910F3FBED8920FD0AC854B7F4B1D57F40` |
| Backend `OfflineSyncService.php` | `6A1CA70C4885FF48EFBC79B4C1A1E82F2737DC0D709837BA723A87A9595B1904` |

También coinciden con sus referencias previas el proveedor/codec/contratos QR, los dos fixtures públicos y `tests/qr-v3.test.ts`. Esto acredita conservación de esos archivos; no sustituye ejecutar pruebas.

## Corrección posterior: descubrimiento de pruebas Windows y parser TypeScript

Esta sección registra la corrección posterior a los errores reportados por el usuario. El inventario y los hashes anteriores corresponden a la entrega original de fase 4; no implican que se haya ejecutado la validación de esta corrección.

**Causa de npm test:** `tsx --test tests/*.test.ts` dependía de que la terminal expandiera el comodín. En la ejecución Windows reportada, el ejecutor recibió literalmente `tests/*.test.ts` y buscó un archivo con ese nombre.

Se inspeccionaron estos cinco archivos existentes: `tests/exams.test.ts`, `http.test.ts`, `offline.test.ts`, `qr-v3.test.ts` y `session.test.ts`. Se añade `tests/manifest.test.ts`. No se cambiaron las pruebas anteriores para resolver el descubrimiento.

El script de package.json pasa a ser `node scripts/run-tests.mjs`. El nuevo script:

- Descubre archivos reales terminados en `.test.ts`, recursivamente dentro de `tests/`, sin seguir enlaces simbólicos ni junctions.
- Resuelve la raíz del proyecto desde su propio archivo, ordena las rutas y mantiene esa raíz como directorio de trabajo del ejecutor.
- Resuelve el CLI del `tsx` ya instalado mediante `createRequire`; no usa npx, no descarga paquetes y no instala dependencias.
- Ejecuta el Node actual con el CLI, `--test` y cada ruta concreta como argumento separado, con `shell:false`. Los argumentos adicionales de npm se pasan antes de las rutas.
- Falla con mensaje y código 1 si no encuentra archivos, no puede descubrirlos, falta el ejecutor o falla su lanzamiento. Conserva el código de salida de las pruebas; una interrupción tampoco se presenta como éxito.

Esto elimina la dependencia de expansión de comodines en PowerShell, cmd, Git Bash y shells de otros sistemas. El script requiere ejecución manual del usuario: no fue ejecutado durante esta corrección.

**Causa de TypeScript:** `object()` entrega propiedades de tipo `unknown`. Las ramas anteriores llamaban a `fail()` y luego devolvían directamente `p.kind` y `s.entry_status`; el análisis de flujo no las reconocía como las uniones literales exigidas en esos retornos.

Se añadieron funciones explícitas que validan el valor `unknown` y retornan únicamente en una rama válida:

- `parsePhotoKind(): Photo['kind']` acepta solamente `profile` o `historical`.
- `parseEntryStatus(): OfflineStudent['entry_status']` acepta solamente `PENDING` o `REGISTERED`.

Los valores tipados se guardan en constantes y se usan en los objetos devueltos; el tipo de foto validado también forma parte de la ruta esperada. Todo valor inesperado termina en el mismo rechazo de contrato. No se usaron `as any`, `@ts-ignore` ni conversiones que eviten validar. Se revisó `contracts.ts` y se conservó sin modificar sus uniones.

Se mantienen los estados fotográficos ABSENT/PRESENT, los dos descriptores distintos, tamaño positivo y máximo de 5 MiB, MIME, SHA-256 y ruta exacta por miembro/paquete/examen/tipo.

**Pruebas nuevas, escritas sin ejecutar:** ambos tipos de foto con ABSENT y PRESENT; tipos de foto desconocidos y valores que no son cadenas; ambos estados de ingreso válidos y estados desconocidos; manifiestos, estudiantes, fotos y JSON malformados; regresión de tamaño/hash/MIME/ruta; y conservación del manifiesto y sobre sintéticos válidos existentes, sin mutar la entrada.

Archivos de esta corrección:

| Archivo | Cambio |
| --- | --- |
| `package.json` | Nuevo comando npm test multiplataforma. |
| `scripts/run-tests.mjs` | Nuevo descubridor y lanzador del CLI local. |
| `src/features/offline/manifest.ts` | Conversión validada de unknown a uniones literales. |
| `tests/manifest.test.ts` | Nuevas pruebas del parser y sus validaciones. |
| Este documento | Causas, alcance y ejecución manual pendiente. |

Comandos para que el usuario ejecute manualmente, en PowerShell:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

No se ejecutaron esos comandos, instalaciones, pruebas, builds, prebuild, operaciones Git ni cambios del entorno. No se modificaron backend, frontend web, `/android`, autenticación, QR v3, lockfile ni dependencias. **El resultado de las suites y del typecheck queda pendiente de la ejecución manual del usuario.**

## Referencias oficiales consultadas

- [Expo SQLite: SQLCipher y plugin](https://docs.expo.dev/versions/latest/sdk/sqlite/): requiere compilación nativa; Expo Go no incorpora SQLCipher.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): autenticación local, disponibilidad biométrica e invalidación de claves.
- [Expo módulos locales](https://docs.expo.dev/modules/overview/): código nativo local/autolinking. Para esta entrega se contrastó además la estructura con el módulo SecureStore del SDK 58 instalado.
- Se descartó `expo-device.getUptimeAsync` para vigencia: su implementación Android usa `uptimeMillis`, que no incluye reposo. El módulo local usa `elapsedRealtime` y boot count; no se declaró ni instaló expo-device.

**Confirmación final:** únicamente se leyeron archivos/documentación y se escribieron fuentes, configuración, pruebas y este informe. No se realizaron instalaciones, descargas de herramientas, compilaciones, prebuild, pruebas, typecheck, migraciones, cambios de datos, despliegues, operaciones Git, limpieza, SUBST, junctions o modificaciones del entorno Windows.
