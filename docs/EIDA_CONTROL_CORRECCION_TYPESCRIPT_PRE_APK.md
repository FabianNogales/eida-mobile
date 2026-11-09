# Corrección TypeScript previa a las APK de laboratorio

## Alcance

Corrección puntual de presentación, sin nuevo rediseño ni cambios de negocio.
El usuario comunicó que Android API 37 está instalado y que el backend cuenta con
las nuevas migraciones. No se volvió a auditar ni se modificó ese entorno.

## Causas y correcciones

1. React Native 0.88.1 resuelve sus declaraciones generadas. En
   `@react-native/virtualized-lists/types_generated/Lists/VirtualizedListProps.d.ts`,
   `ListEmptyComponent` y `ListFooterComponent` permiten elemento, componente o
   `undefined`, sin `null`. Las declaraciones antiguas de la librería todavía
   contienen `null`, pero no son el contrato generado que origina estos errores.
   Se sustituyeron únicamente las siete ramas de ausencia de las cinco pantallas
   afectadas. Los predicados y el contenido JSX permanecen iguales.
2. El genérico de ChoiceChips permitía inferir el parámetro desde las opciones,
   el valor y el callback; podía ampliarse a `string` y exigir al setter aceptar
   valores fuera de su unión. Ahora usa `const Value extends string` para retener
   literales de opciones inline, `NoInfer<Value>` en el valor/callback para inferir
   exclusivamente desde `options`, y una propiedad de función con parámetro tipado.
   `NoInfer` está disponible en TypeScript 6.0.3 instalado. No hay casts, `any` ni
   supresiones de errores en el componente de producción.

## Archivos de producción modificados

- `src/components/operations/ChoiceChips.tsx`: firma genérica y comentario; cuerpo
  de renderizado, accesibilidad, estilos y Pressable sin cambios.
- `src/screens/ExamsScreen.tsx`: vacío y footer condicionales.
- `src/screens/IncidentsScreen.tsx`: vacío y footer condicionales.
- `src/screens/OfflineIncidentsScreen.tsx`: vacío condicional.
- `src/screens/OfflineListScreen.tsx`: vacío condicional.
- `src/screens/OfflineSyncScreen.tsx`: vacío condicional.

InfractionsScreen y ReportIncidentScreen no requieren cambios locales: sus
constantes y setters se conservan y reciben la corrección del componente compartido.
DisciplineActionsScreen también conserva su contrato de opciones específico.

## Pruebas escritas, no ejecutadas

- `tests/ui-typescript-regressions.test.ts`: siete casos Node. Lee las condiciones
  JSX reales para comprobar vacío resuelto, carga, errores, falta de autorización,
  búsqueda sin resolver y colas bloqueadas/no conocidas. Comprueba además que los
  footers mantienen sus condiciones originales. Ejecuta la función real de
  ChoiceChips con React y primitivas nativas sustituidas para comprobar opciones
  de dominio, selección controlada, callback, disabled y accesibilidad.
- `tests/support/choiceChips.types.ts`: casos exclusivamente de compilación, ya
  incluidos por `tests/**/*.ts` en tsconfig.tests.json. Comprueba los setters reales
  y las uniones exactas de infracciones, incidencias, sus filtros, HU37 y operaciones
  disciplinarias, además de opciones inline. Las expectativas negativas usan
  `@ts-expect-error` solamente para exigir que valores/callbacks inválidos y `null`
  en los slots de FlatList sigan dando error. No se usa `@ts-ignore`; una expectativa
  negativa que deje de producir error falla en TypeScript. El archivo no es un
  `.test.ts` y no se importa en runtime.

Las pruebas de presentación no montan las pantallas ni ejecutan servicios nativos.
Disabled se verifica en los props entregados a Pressable; el bloqueo físico del
toque y la interacción de FlatList deben comprobarse también en Android. No se
instaló un renderer ni se añadieron dependencias. Se usan React y TypeScript ya
declarados en el proyecto.

## Validación manual pendiente

Desde PowerShell:

```powershell
Set-Location -LiteralPath 'C:\proyecto\eida-mobile'
npm run typecheck
npm test
```

Primero revisar TypeScript, que incluye los casos de compilación, y después la suite
Node con descubrimiento de archivos existente. No se afirma que aprueben: no se
ejecutaron. Las compilaciones Debug/Release quedan a cargo del usuario después de
esta validación, con la configuración nativa que haya preparado.

No se modificaron servicios HU35/HU36/HU37, permisos, paginación, virtualización,
búsqueda, autenticación, contratos HTTP, SQLCipher, SecureStore, cámara, QR,
constantes/reglas disciplinarias, backend, frontend web, Android, Gradle ni lockfile.
No se ejecutaron pruebas, typecheck, instalaciones, compilaciones, Expo/Metro,
Prebuild, ADB, migraciones, Git, limpieza o cambios del entorno Windows.
