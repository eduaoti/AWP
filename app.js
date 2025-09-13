require('dotenv').config();

const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const redoc = require('redoc-express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json());

// Cargar OpenAPI
const openapi = require('./openapi.json');

// Conexión a PostgreSQL (usa variables de entorno)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'app_usuarios',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// --- Endpoints básicos ---
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Hello from App de Hassani API' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// --- CRUD Usuarios ---
// GET /usuarios -> listar
app.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, email, rol FROM usuarios ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// POST /usuarios -> crear
app.post('/usuarios', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Validar rol permitido
    const rolesPermitidos = ['admin', 'editor', 'lector'];
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Verificar email único
    const existe = await pool.query('SELECT 1 FROM usuarios WHERE email=$1', [email]);
    if (existe.rowCount > 0) {
      return res.status(400).json({ error: 'El email ya existe' });
    }

    // Hashear password
    const hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol',
      [nombre, email, hash, rol]
    );

    res.status(201).json({ message: 'Usuario creado', usuario: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// --- Swagger y Redoc ---
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Alias 1: /v3/api-docs  -> JSON OpenAPI
app.get('/v3/api-docs', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openapi);
});

// Alias 2: /swagger-ui.html -> redirige a /docs (UI de Swagger)
app.get(['/swagger-ui.html', '/swagger-ui'], (_req, res) => {
  res.redirect(301, '/docs');
});

app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openapi);
});

app.get('/redoc', redoc({
  title: 'App de Hassani API – Redoc',
  specUrl: '/openapi.json',
}));

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📘 Swagger UI: http://localhost:${PORT}/docs`);
  console.log(`📕 Redoc:      http://localhost:${PORT}/redoc`);
});
