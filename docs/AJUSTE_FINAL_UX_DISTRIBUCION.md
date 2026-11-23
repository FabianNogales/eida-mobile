# Ajuste final de UX y distribución de EIDA Control

Fecha: 20 de noviembre de 2026, America/La_Paz. Alcance exclusivo: eida-mobile.
Implementación de código y revisión de fuentes. No se ejecutaron pruebas, typecheck,
Node/npm/npx, Expo, Gradle, prebuild, EAS, instalaciones, ADB ni generación de APK.
No se modificaron Laravel, la web, android/, módulos nativos ni lockfiles.

La validación anterior del QR en Android fue informada por el usuario; no demuestra
el funcionamiento de estos cambios. Este bloque queda pendiente de prueba manual en Huawei Y9.

## 1. Perfil y Ayuda

Perfil conserva identidad real, roles informados por la cuenta, conectividad y
validación de sesión, Ayuda, versión de la aplicación y cierre de sesión.
Se elimina «Dispositivos autorizados» y su aviso de conexión. No se eliminan las APIs
de dispositivos, la asociación de instalación, las revocaciones ni las barreras de
sesión. El enlace antiguo /(private)/devices redirige a Perfil tanto en sesión
validada como en acceso local autorizado.

Ayuda reutiliza el panel existente con cinco tarjetas breves:

1. Preparar la lista con internet.
2. Escanear o buscar al estudiante y confirmar el ingreso sin internet.
3. Enviar ingresos y reportes desde Pendientes y revisar sus resultados.
4. Actualizar la copia si cambió la distribución.
5. Resolver falta de asignación, descarga incompleta, vencimiento o QR ilegible.

Incluye accesos a Pendientes y Listas descargadas. No explica versiones QR,
manifiestos, cifrado, paquetes o diagnósticos. Perfil, Login y Sesión dejan de
ofrecer accesos a diagnósticos. Se retira ProtectionDiagnostics de la vista normal;
su código y las comprobaciones de protección subyacentes se conservan.
El diagnóstico QR anterior sigue siendo una ruta exclusivamente de desarrollo,
sin enlaces desde el flujo normal y sin cambiar el verificador ni sus vectores.

## 2. Listas descargadas

Se conserva /offline y se renombra su título y todos los enlaces visibles a
«Listas descargadas». Es necesaria: permite encontrar copias incompletas, vencidas
o desactualizadas que el listado de exámenes locales utilizables oculta.
Eliminarla dejaría sin una vía clara para recuperarlas.

Las tarjetas reutilizadas muestran examen/materia, ambiente, cantidad, preparación,
vencimiento y acciones disponibles. Se retiran versión de distribución, manifiesto
y explicaciones técnicas. «Actualizar copia» y «Reanudar descarga» llevan al
formulario existente del examen, que vuelve a consultar la asignación antes de descargar.
Abrir una copia desde esta vista comprueba el contexto actual si hay conexión; un
fallo de red no borra la copia autorizada y las comprobaciones locales siguen vigentes.

Los enlaces desde examen, Perfil/Ayuda, Inicio, Pendientes, incidencias, búsqueda y
escáner usan la misma ruta. No se crean pantallas duplicadas ni rutas sin destino.
El cierre de sesión explica pendientes y recuperación con la misma cuenta en
lenguaje simple, sin alterar su lógica.

## 3. Copia desactualizada y actualización

Hallazgos de código anteriores:

- La interfaz deshabilitaba tanto la descarga como la solicitud de preparación
  cuando stale era true. El responsable no tenía una acción directa de recuperación.
- Una copia se asociaba al contexto solo por examen/list_id; faltaba comparar la
  distribución y su versión, incluso si el servidor ya no marcaba stale.
- «Revalidar» trataba de reanudar el mismo paquete anterior. Esa operación nunca
  crea una copia nueva cuando la asignación cambió.
- Una consulta adicional de assignments, cuyo resultado no se utilizaba, podía
  impedir abrir el detalle antes de mostrar las acciones disponibles.

Cambios:

- distribution.ts compara examen, lista propia, distribution_id y version, además
  de stale/unavailable_reason. Las lecturas siguen siendo del contexto autorizado.
- Al consultar el detalle, preparación o apertura desde Listas descargadas se
  marcan DESACTUALIZADO las copias incompatibles del mismo examen. También se
  bloquean ante una pérdida de acceso conocida. Un fallo de red no equivale a
  revocación; MOBILE_ABILITY_REQUIRED sigue siendo un error de capacidad, no una
  redistribución inventada.
- El control no se habilita con esas copias. La comprobación de repo.usable y las
  guardas existentes de captura/escáner impiden nuevas capturas; la lista bloqueada
  ofrece «Actualizar copia» cuando el acceso online está disponible.
- El detalle y la pantalla de preparación ofrecen «Actualizar copia», con el
  motivo del cambio y la conservación de pendientes.
- Cada intento consulta otra vez el contexto. Solo si can_prepare sigue siendo
  true se puede solicitar el POST de preparación ya existente; el colaborador
  nunca lo solicita. Se vuelve a leer el resultado antes de descargar la copia propia.
- Una descarga o reanudación vuelve a comprobar el contexto en OfflineProvider.
  El ID anterior se reutiliza solo si aún coincide y no está vencido ni desactualizado;
  en otro caso se solicita una copia nueva, sin reanimar la anterior.
- Se conserva el proceso de fotos, integridad, hora autorizada, comprobación final
  del servidor y activación de la copia completa. No se cambia el algoritmo de reparto.
- No se borran ni reescriben eventos, reportes, UUID, pendientes o resultados antiguos.
  La activación de la copia nueva mantiene los registros originales para sincronizar.

Al volver a Inicio, colaboraciones, detalle o preparación se refrescan las consultas.
La vista sin conexión conserva el acceso a copias localmente utilizables. Si la app
no tiene conexión, no puede conocer un cambio que todavía no recibió del servidor:
se conserva el modelo existente de vigencia local. Una desactualización ya conocida
permanece bloqueada también al perder internet.

### Límite real del servidor

El contrato móvil documentado ya distingue DISTRIBUTION_STALE y DISTRIBUTION_FROZEN.
El POST de preparación pertenece al responsable y el servidor puede rechazar la
regeneración de una distribución congelada. No se añadió un endpoint, parámetro
force, versión inventada ni redistribución local para eludirlo.

Si el servidor permite preparar la distribución actual, el flujo solicita la
preparación y permite descargar la copia resultante. Si devuelve
DISTRIBUTION_FROZEN, el mensaje indica que el responsable de EIDA debe revisar el
cambio; permite volver a pulsar Actualizar copia cuando se resuelva y conserva
Pendientes. El APK no puede garantizar desbloquear ese caso mediante un cambio
exclusivamente móvil. La resolución institucional/servidor no se implementa aquí.
Los contratos se revisaron desde código y documentación móvil locales; no se
consultó ni verificó un despliegue.

## 4. Colaborador

No se supone un rol global COLABORADOR. La asignación sigue procediendo de
me/collaborations y el acceso a la lista de mobile-context.

Inicio omite la consulta de exámenes docentes para una cuenta sin rol DOCENTE.
Mis exámenes reutiliza CollaborationsScreen en ese caso, mostrando los exámenes
que la API devuelve como asignados. La cuenta docente conserva su lista de docencia
y el acceso a colaboraciones. No se inventan exámenes propios, cantidades docentes
ni permisos cuando una consulta no se ejecutó.

Cada colaboración lleva a su examen y a «Preparar mi lista». Una copia anterior
incompatible queda bloqueada y se ofrece actualizar. Si el responsable todavía no
actualizó la distribución o no asignó una lista personal, el colaborador recibe
esa instrucción concreta y puede volver a consultar. Nunca prepara el reparto,
descarga una lista ajena ni accede a acciones disciplinarias sin las comprobaciones
de permiso por examen ya existentes. La falta de lista de un supervisor tampoco
se transforma en una asignación implícita.

## 5. Archivos y rutas afectados

Pantallas:

- src/screens/ProfileScreen.tsx.
- src/screens/HomeScreen.tsx.
- src/screens/ExamsScreen.tsx.
- src/screens/CollaborationsScreen.tsx.
- src/screens/OfflineDistributionScreen.tsx.
- src/screens/PrepareOfflineScreen.tsx.
- src/screens/OfflinePackagesScreen.tsx.
- src/screens/OfflineListScreen.tsx.
- src/screens/OfflineScannerScreen.tsx (nombre del enlace).
- src/screens/IncidentsScreen.tsx (nombre del enlace).
- src/screens/OfflineIncidentsScreen.tsx (nombre del enlace).
- src/screens/PendingOverviewScreen.tsx (nombre del enlace).
- src/screens/ReportIncidentScreen.tsx (nombre del enlace).
- src/screens/LoginScreen.tsx y src/screens/SessionScreen.tsx (retirar enlaces de diagnóstico).

Componentes y presentación:

- src/components/general/ControlHelp.tsx (nuevo).
- src/components/control/PackageCard.tsx.
- src/ui/controlScreens.ts.
- src/ui/examPresentation.ts.
- src/ui/entryPresentation.ts.
- src/ui/generalScreens.ts.
- src/ui/operations.ts.
- src/hooks/useRefreshOnFocus.ts (nuevo).

Acceso y preparación:

- src/features/offline/distribution.ts (nuevo).
- src/features/offline/api.ts (signal opcional en la consulta existente).
- src/features/offline/OfflineProvider.tsx.
- src/features/offline/download.ts (invalida también ante DISTRIBUTION_FROZEN durante la descarga).
- src/features/offline/repository.ts (mensajes; mismas condiciones de uso).
- src/services/http/errors.ts (códigos conservados, mensajes operativos).

Rutas:

- src/app/(private)/devices.tsx: redirección de compatibilidad a /(private)/(tabs)/profile.
- src/app/(private)/_layout.tsx: título de preparación y ruta de compatibilidad.
- src/app/offline/_layout.tsx: título Listas descargadas.

Se conservan /(private)/(tabs)/{index,exams,pending,profile},
/(private)/collaborations, /(private)/offline-distribution?examId=…,
/(private)/prepare-offline?examId=… y /offline/{list,scan,sync,incidents,…}.
Los parámetros packageId/examId siguen siendo referencias, sin datos personales añadidos.

Pruebas escritas o actualizadas, NO ejecutadas:

- tests/final-ux-distribution.test.ts (nuevo): versión/lista/distribución, sustitución
  de copia con pendientes intactos, rechazo de captura antigua, preparación del
  responsable, prohibición de preparación del colaborador, rechazo real del servidor,
  errores de red, asignaciones en Inicio y ausencia de herramientas en UI normal.
- tests/control-screens.test.ts: permite al responsable solicitar actualización,
  manteniendo bloqueada la descarga de una distribución desactualizada.
- tests/general-screens.test.ts: textos de cierre y cuenta con pendientes desconocidos.
- tests/offline.test.ts: conserva el código de rechazo con un mensaje operativo.
- tests/redesign-block2.test.ts: texto de apertura de listas.

Documentación:

- docs/AJUSTE_FINAL_UX_DISTRIBUCION.md (este documento).
- docs/EIDA_CONTROL_FASE_2_EXPO_QR.md.
- docs/HISTORIAL_FASE_2.md.
- docs/EIDA_CONTROL_FASE_3_AUTH_EXAMS.md.

## 6. Lista de comprobación manual — Huawei Y9

Usar un entorno y cuentas de prueba autorizados. No se ejecutó esta lista en esta sesión.

1. Perfil docente y colaborador: identidad, rol, conectividad, Ayuda, versión y cierre.
   No aparece Dispositivos autorizados ni diagnóstico. Abrir un enlace antiguo a
   devices debe llevar a Perfil. Verificar navegación Atrás, desplazamiento y texto grande.
2. Ayuda: leer los cinco pasos, abrir Pendientes y Listas descargadas, volver con el
   botón y con Atrás de Android. No debe perderse la sesión.
3. Preparar con internet una lista como docente. Esperar Lista preparada, abrirla,
   buscar un estudiante y usar el lector ya existente. No confirmar ingresos de prueba
   en producción. Probar doble toque sin iniciar dos descargas.
4. Activar modo avión con copia vigente. Abrir desde Mis exámenes, Inicio y Listas
   descargadas. Registrar un ingreso manual y uno con QR, comprobando identidad.
   La copia vencida/desactualizada conocida no debe permitir registrar.
5. Volver a internet. Revisar Pendientes, enviar ingresos/reportes y comprobar el
   resultado real. Reintentar un envío no debe crear otro ingreso.
6. Con una copia preparada, cambiar asignaciones/distribución usando el flujo
   autorizado de EIDA. Volver al examen: ver motivo y Actualizar copia; Controlar ingreso
   queda deshabilitado. Repetir cuando cambie version/distribution_id conservando list_id.
7. Pulsar Actualizar copia como responsable. Si el servidor lo permite, esperar la nueva
   descarga y abrir únicamente la lista actual. Confirmar que los ingresos y reportes
   anteriores siguen en Pendientes con sus resultados, sin borrados ni duplicaciones.
8. Simular DISTRIBUTION_FROZEN: debe explicar que el servidor bloqueó el cambio y quién
   debe revisarlo, conservar pendientes y ofrecer una nueva consulta; no abrir la copia
   antigua ni presentar éxito. Resolver la distribución por el flujo autorizado y reintentar.
9. Entrar con una cuenta colaboradora sin rol DOCENTE: Inicio y Mis exámenes muestran
   su examen asignado sin un error de catálogo docente. Preparar solo su propia copia.
   No aparecen preparación de reparto ni acciones disciplinarias no autorizadas.
10. Colaborador con copia antigua: cambiar la distribución, volver y pulsar Actualizar
    copia. Si el reparto todavía no está listo, indicar al docente y reintentar después.
    Si se retira la asignación, la consulta debe rechazar y bloquear la copia conocida;
    no debe aparecer otra lista como sustituto.
11. Interrumpir una descarga, volver al examen y reanudar la copia actual. Si cambió la
    asignación durante la interrupción, solicitar copia nueva, sin reanudar la anterior.
12. Cambiar de cuenta, dejar vencer la sesión y cerrar/reabrir la app. Ningún callback
    anterior debe mostrar datos de otra cuenta. Verificar conservación de pendientes
    y recuperación únicamente con la cuenta original.

Pendiente de ejecución por el usuario: pruebas existentes y nuevas, revisión de tipos,
compilación y validación en el dispositivo. No hay APK nuevo ni resultados de ejecución
atribuibles al asistente.

Revisión estática realizada: lectura de los flujos y comprobación de referencias de
importación locales y ausencia de marcas de conflicto en 37 archivos de código/pruebas.
Esto no sustituye typecheck, ejecución de pruebas, compilación ni verificación en Android.

