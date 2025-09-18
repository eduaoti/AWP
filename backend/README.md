# 📦 Backend AWP – Node.js + TypeScript + Express

Este proyecto implementa la **API base** para el sistema AWP.  
Incluye configuración inicial, conexión a Postgres, endpoints de usuarios, autenticación básica con JWT y OTP, y documentación con Swagger.

---

## ⚙️ Tecnologías Utilizadas
- Node.js + TypeScript  
- Express  
- PostgreSQL (`pg`)  
- Bcrypt (hash de contraseñas)  
- JSON Web Tokens (JWT)  
- OTP (`otplib`)  
- Swagger UI (`swagger-ui-express`)  
- Nodemon + ts-node (dev)  

---

## 📂 Estructura de Carpetas

```
backend/
 ├─ db/                 # Scripts SQL iniciales
 │   └─ init.sql
 ├─ docs/               # Documentación Swagger/OpenAPI
 │   └─ openapi.json
 ├─ src/
 │   ├─ controllers/    # Controladores con lógica de endpoints
 │   ├─ models/         # (futuro) Modelos/DTOs
 │   ├─ routes/         # Definición de rutas Express
 │   ├─ app.ts          # Configuración principal de Express
 │   ├─ db.ts           # Conexión a Postgres (Pool)
 │   └─ index.ts        # Punto de entrada
 ├─ .env                # Variables de entorno (ignorado en Git)
 ├─ .env.example        # Ejemplo de variables de entorno
 ├─ .gitignore
 ├─ package.json
 ├─ tsconfig.json
```

---

## 🔑 Variables de Entorno

Archivo `.env` (no subir a GitHub).  

Ejemplo en `.env.example`:

```env
PORT=3000
DATABASE_URL=postgresql://usuario:password@localhost:5432/seguridad
DB_SSL=false
JWT_SECRET=supersecreto
OTP_WINDOW=1
```

---

## 🗄️ Base de Datos

Archivo `db/init.sql`:

```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre   VARCHAR(120) NOT NULL,
  email    VARCHAR(180) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol      VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','editor','lector')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚀 Scripts de NPM

```bash
npm run dev     # Ejecutar en modo desarrollo (nodemon + ts-node)
npm run build   # Compilar a JavaScript (dist/)
npm start       # Ejecutar versión compilada
```

---

## 🌐 Endpoints Iniciales

### Healthcheck
```http
GET /health
```
**Respuesta:**
```json
{ "ok": true }
```

---

### Usuarios
- **POST /usuarios/nuevo** → Crear usuario (hash con bcrypt).  
  Ejemplo body:
  ```json
  {
    "nombre": "Eduardo",
    "email": "edu@test.com",
    "password": "123456",
    "rol": "admin"
  }
  ```

- **GET /usuarios** → Listar usuarios (sin password).  
  Respuesta ejemplo:
  ```json
  [
    {
      "id": 1,
      "nombre": "Eduardo",
      "email": "edu@test.com",
      "rol": "admin"
    }
  ]
  ```

---

### Autenticación
- **POST /auth/login**  
  Recibe `email` + `password`, devuelve `token` y flag de OTP.  
  Respuesta:
  ```json
  { "token": "eyJhbGciOi...", "requiresOtp": true }
  ```

- **POST /auth/login/otp**  
  Valida código OTP (demo con `otplib`).  
  ```json
  { "ok": true }
  ```

- **POST /auth/recuperar-usuario**  
  Recuperación básica (stub).  
  ```json
  { "ok": true }
  ```

---

### Documentación API
- **GET /docs** → Abre Swagger UI con la especificación en `docs/openapi.json`.

---