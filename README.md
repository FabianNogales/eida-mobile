# EIDA Control

Base Android Expo SDK 58 + React Native + TypeScript. Fase 3: login Sanctum, sesión segura y consultas de exámenes/colaboraciones sobre los contratos reales de Laravel.

**Modo exclusivamente código:** el asistente revisa y escribe archivos; el usuario instala, ejecuta pruebas y compila. Consulta [AGENTS.md](AGENTS.md).

El usuario confirmó QR v3 de fase 2 en un celular Android real. Su verificador, 29 vectores y 44 pruebas se conservan. La fase 3 añade 49 pruebas escritas, NO ejecutadas por el asistente, sin typecheck o build ejecutados en esta fase.

Pendiente: instalar manualmente expo-secure-store ~58.0.2 y actualizar el lockfile mediante npm, configurar EXPO_PUBLIC_EIDA_API_BASE_URL, ejecutar verificaciones y generar una build que contenga SecureStore. No usar npm ci antes de sincronizar el lockfile. Expo Go no sustituye los módulos nativos.

- [Fase 3: contratos, arquitectura, seguridad y procedimientos manuales](docs/EIDA_CONTROL_FASE_3_AUTH_EXAMS.md).
- [Fase 2: arquitectura criptográfica y procedimientos manuales](docs/EIDA_CONTROL_FASE_2_EXPO_QR.md).
- [Historial acumulado de fase 2](docs/HISTORIAL_FASE_2.md).
