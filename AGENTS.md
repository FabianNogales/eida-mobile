# EIDA Control: modo exclusivamente código

Instrucción expresa del usuario para este proyecto:

- Leer, escribir, revisar y documentar código. Se pueden escribir pruebas, pero no ejecutarlas.
- El usuario instala dependencias, prepara herramientas, ejecuta Expo, compila, instala en Android y genera APK/AAB.
- No ejecutar npm/npx, Node para ejecutar scripts, pruebas, typecheck, Expo, Gradle, ADB, EAS, instaladores ni generadores.
- No descargar paquetes ni herramientas; no modificar variables del sistema, unidades, enlaces ni particiones. No usar SUBST ni junctions.
- No ejecutar scripts de scripts/; sus instrucciones son exclusivamente para ejecución manual del usuario.
- No desinstalar herramientas o dependencias existentes. No regenerar package-lock.json ni editar android/, node_modules/ o archivos nativos generados.
- No inicializar Git ni hacer operaciones Git. No crear commits ni modificar staging.
- Backend y frontend web son solo lectura. No leer secretos de sus .env ni copiar claves privadas.
- No buscar desde el directorio padre proyecto ni acceder a directorios -compare.
- No conectar con producción. El usuario confirmó al iniciar fase 3 que validó QR v3 en un celular Android real; preservar ese código y distinguir ese resultado de nuevas pruebas no ejecutadas por el asistente.

Si una parte requiere herramientas o compilación, documentar el comando manual y continuar con el código independiente. No pedir autorización para cambios de código ya incluidos en este alcance.

Mantener en docs/EIDA_CONTROL_FASE_2_EXPO_QR.md el estado actual y en docs/HISTORIAL_FASE_2.md la distinción entre acciones históricas y la sesión exclusivamente de código.

Fase 3: documentar en docs/EIDA_CONTROL_FASE_3_AUTH_EXAMS.md. No modificar manualmente lockfiles; el usuario instala SecureStore, actualiza el lockfile, ejecuta pruebas y genera la build nativa. No alterar android/ ni el verificador/vectores QR.
