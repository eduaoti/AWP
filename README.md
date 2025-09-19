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
DATABASE_URL=postgresql://usuario:password@localhost:5432/Seguridad
DB_SSL=false
JWT_SECRET=cambia_esto_ya
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



- **Spring Boot** fue descartado en esta versión para priorizar velocidad de desarrollo y mantener un único stack en Node.js + TypeScript.  
- Todo el MVP se desarrolla con esta base; futuras épicas (notificaciones, social login, pagos, mapas, offline) se construirán sobre este backend.
