# 🤖 Copilot Instructions for AWP Backend

## Arquitectura General
- **Stack:** Node.js + TypeScript + Express, PostgreSQL (driver `pg`), autenticación JWT y OTP.
- **Estructura:**
  - `src/` contiene controladores, rutas, modelos, middlewares, servicios y utilidades.
  - `db/init.sql` define el esquema inicial (tabla `usuarios`).
  - `docs/openapi.json` contiene la especificación Swagger/OpenAPI.
- **Flujo:**
  - Express inicializa en `src/app.ts` y arranca en `src/index.ts`.
  - Conexión a Postgres vía `src/db.ts` (usa Pool, inicializa y aplica `init.sql` si es necesario).
  - Rutas y controladores siguen patrón REST, separados por entidad.

## Convenciones y Patrones
- **DTOs y validaciones:**
  - DTOs en `src/dto/`, validaciones con esquemas en `src/schemas/`.
  - Middlewares de validación y autenticación en `src/middlewares/`.
- **Respuestas:**
  - Usa helpers en `src/status/` para respuestas y códigos estándar.
- **Errores:**
  - Manejo centralizado en `src/middlewares/error-handler.ts`.
- **Autenticación:**
  - JWT y OTP implementados en `src/services/sessions.ts` y `src/services/otp.ts`.

## Flujos de Desarrollo
- **Desarrollo:** `npm run dev` (nodemon + ts-node)
- **Build:** `npm run build` (compila a `dist/`)
- **Producción:** `npm start` (ejecuta versión compilada)
- **Variables de entorno:**
  - `.env.example` documenta todas las necesarias (DB, JWT, OTP, etc).
- **Inicialización de BD:**
  - `src/db.ts` asegura la existencia de la BD y aplica `db/init.sql` automáticamente.

## Integraciones y Dependencias
- **Swagger UI:** `/docs` expone la documentación OpenAPI.
- **Correo y OTP:** Servicios en `src/services/` (stub para email, OTP funcional con `otplib`).
- **Rate limiting y seguridad:** Middlewares en `src/middlewares/`.

## Ejemplos de Endpoints
- Crear usuario: `POST /usuarios/nuevo`
- Login: `POST /auth/login` (devuelve JWT y flag OTP)
- Validar OTP: `POST /auth/login/otp`
- Documentación: `GET /docs`

## Notas y Reglas Específicas
- No modificar directamente archivos en `dist/`.
- Mantener separación clara entre controladores, rutas y servicios.
- Usar DTOs y validaciones para toda entrada de usuario.
- Seguir ejemplos de controladores y rutas existentes para nuevas entidades.
- Consultar `README.md` y comentarios en código para detalles adicionales.
