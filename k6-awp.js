// k6-awp.js
import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { hmac, sha1 } from 'k6/crypto';

// ==========================
// Configuración de escenarios
// ==========================
export const options = {
  scenarios: {
    smoke: {
      executor: 'per-vu-iterations',
      exec: 'full_auth_flow',
      vus: 1,
      iterations: 1,
      maxDuration: '1m',
    },
    volume: {
      executor: 'ramping-arrival-rate',
      exec: 'full_auth_flow',
      startRate: 5,         // reqs/s iniciales
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { target: 20, duration: '3m' },   // subir
        { target: 20, duration: '7m' },   // sostener (volumen)
        { target: 0, duration: '1m' },    // bajar
      ],
    },
    stress: {
      executor: 'ramping-arrival-rate',
      exec: 'full_auth_flow',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { target: 50, duration: '2m' },
        { target: 100, duration: '3m' },
        { target: 150, duration: '3m' },
        { target: 0, duration: '1m' },
      ],
    },
    spike: {
      executor: 'constant-arrival-rate',
      exec: 'full_auth_flow',
      rate: 200,                 // ráfaga
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 250,
      maxVUs: 500,
      startTime: '0s',
    },
    // Lecturas simples sin auth (salud/listados)
    reads: {
      executor: 'constant-vus',
      exec: 'read_endpoints',
      vus: 10,
      duration: '5m',
      startTime: '0s',
      tags: { flow: 'reads' },
      env: { ONLY_READS: '1' },
      gracefulStop: '30s',
    },
  },

  // ==========================
  // Umbrales por latencia/éxito
  // ==========================
  thresholds: {
    'http_req_duration{endpoint:health}': ['p(95)<200'],
    'http_req_duration{flow:reads}': ['p(95)<400'],
    'http_req_duration{endpoint:usuarios_nuevo}': ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{endpoint:auth_login}':      ['p(95)<600', 'p(99)<1200'],
    'http_req_duration{endpoint:otp_setup_start}': ['p(95)<700'],
    'http_req_duration{endpoint:otp_setup_confirm}':['p(95)<700'],
    'http_req_duration{endpoint:auth_login_otp}':  ['p(95)<700'],
    'http_req_duration{endpoint:sessions}':        ['p(95)<500'],
    'checks': ['rate>0.95'], // 95% de checks OK globales
    'success_rate': ['rate>0.90'], // acumulado de nuestro Rate
  },
};

// ==========================
// Métricas custom
// ==========================
export const success_rate = new Rate('success_rate');
export const created_users = new Counter('created_users');
export const t_auth_flow = new Trend('t_auth_flow');

// ==========================
// Helpers
// ==========================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// fuerza password válido para tu strongPassword()
function strongPwd() {
  // Min 8, con minúscula, mayúscula, dígito y símbolo, sin ' y sin secuencias triviales
  return 'Abc123!@#X';
}

function rndEmail() {
  const n = `${__VU}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `user${n}@mail.com`;
}

function jsonPost(url, body, params = {}) {
  return http.post(url, JSON.stringify(body), {
    headers: JSON_HEADERS,
    tags: params.tags,
  });
}

function jsonPut(url, body, params = {}) {
  return http.put(url, JSON.stringify(body), {
    headers: JSON_HEADERS,
    tags: params.tags,
  });
}

function jsonGet(url, params = {}) {
  return http.get(url, params);
}

function jsonPostAuth(url, token, body, params = {}) {
  const headers = { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
  return http.post(url, JSON.stringify(body), { headers, tags: params.tags });
}

function jsonGetAuth(url, token, params = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  return http.get(url, { headers, tags: params.tags });
}

// ==========================
// Base32 → bytes (RFC4648)
// ==========================
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(b32) {
  const cleaned = b32.replace(/=+$/g, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let b = 0; b + 8 <= bits.length; b += 8) {
    bytes.push(parseInt(bits.slice(b, b + 8), 2));
  }
  return bytes;
}

// ==========================
// TOTP (HMAC-SHA1, step=30s)
// ==========================
function hotp(secretBytes, counter) {
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    msg[i] = counter & 0xff;
    counter = counter >> 8;
  }
  const key = new Uint8Array(secretBytes);
  const digest = hmac('sha1', key, msg, 'binary'); // returns ArrayBuffer
  const h = new Uint8Array(digest);
  const offset = h[h.length - 1] & 0x0f;
  const code =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

function totp(base32Secret, step = 30, skew = 0) {
  const secretBytes = base32Decode(base32Secret);
  const now = Math.floor(Date.now() / 1000) + skew;
  const counter = Math.floor(now / step);
  return hotp(secretBytes, counter);
}

// ==========================
// Endpoints simples de lectura
// ==========================
export function read_endpoints() {
  group('health', () => {
    const r = jsonGet(`${BASE_URL}/health`, { tags: { endpoint: 'health', flow: 'reads' } });
    const ok = check(r, {
      'health 200': (res) => res.status === 200,
      'health ok:true': (res) => res.json('ok') === true,
    });
    success_rate.add(ok);
  });

  group('usuarios_list', () => {
    const r = jsonGet(`${BASE_URL}/usuarios`, { tags: { endpoint: 'usuarios_list', flow: 'reads' } });
    const ok = check(r, {
      'usuarios list 200': (res) => res.status === 200,
      'payload codigo 0': (res) => res.json('codigo') === 0,
      'data is array': (res) => Array.isArray(res.json('data')),
    });
    success_rate.add(ok);
  });

  sleep(0.5);
}

// ==========================
// Flujo completo con OTP
// ==========================
export function full_auth_flow() {
  const t0 = Date.now();

  // 0) Salud rápida (etiquetado)
  jsonGet(`${BASE_URL}/health`, { tags: { endpoint: 'health', flow: 'boot' } });

  // 1) Crear usuario
  const email = rndEmail();
  const bodyNuevo = {
    nombre: 'Edu Test',
    email,
    password: strongPwd(),
    rol: 'editor',
  };

  group('usuarios_nuevo', () => {
    const r = jsonPost(`${BASE_URL}/usuarios/nuevo`, bodyNuevo, { tags: { endpoint: 'usuarios_nuevo' } });
    const ok1 = check(r, {
      '201 creado': (res) => res.status === 201,
      'codigo=0': (res) => res.json('codigo') === 0,
      'tiene id': (res) => !!res.json('data.id'),
    });
    if (!ok1) {
      success_rate.add(false);
      fail(`Fallo creando usuario: ${r.status} ${r.body}`);
    }
    created_users.add(1);
    success_rate.add(ok1);
  });

  // 2) Login paso 1 (password) -> preAuth (sin OTP habilitado: needsEnrollment)
  let preAuth = '';
  group('auth_login', () => {
    const r = jsonPost(`${BASE_URL}/auth/login`, { email, password: bodyNuevo.password }, { tags: { endpoint: 'auth_login' } });
    const ok2 = check(r, {
      '200 login': (res) => res.status === 200,
      'requiresOtp': (res) => res.json('data.requiresOtp') === true,
      'preAuth presente': (res) => !!res.json('data.preAuth'),
    });
    if (!ok2) {
      success_rate.add(false);
      fail(`Fallo login paso 1: ${r.status} ${r.body}`);
    }
    preAuth = r.json('data.preAuth');
    success_rate.add(ok2);
  });

  // 3) Iniciar setup OTP (obtener secreto y QR)
  let secret = '';
  group('otp_setup_start', () => {
    const r = jsonPost(`${BASE_URL}/auth/otp/setup/start`, { preAuth }, { tags: { endpoint: 'otp_setup_start' } });
    const ok3 = check(r, {
      '200 setup start': (res) => res.status === 200,
      'secret presente': (res) => !!res.json('data.secret'),
      'uri presente': (res) => !!res.json('data.otpauth_uri'),
    });
    if (!ok3) {
      success_rate.add(false);
      fail(`Fallo otp setup start: ${r.status} ${r.body}`);
    }
    secret = r.json('data.secret'); // Base32
    success_rate.add(ok3);
  });

  // 4) Confirmar setup OTP con TOTP ahora
  group('otp_setup_confirm', () => {
    const code = totp(secret, 30, 0);
    const r = jsonPost(
      `${BASE_URL}/auth/otp/setup/confirm`,
      { preAuth, secret, code, deviceId: 'k6-device' },
      { tags: { endpoint: 'otp_setup_confirm' } },
    );
    const ok4 = check(r, {
      '200 setup confirm': (res) => res.status === 200,
      'otp_enabled true': (res) => res.json('data.otp_enabled') === true,
      'backup_codes recibidos': (res) => Array.isArray(res.json('data.backup_codes')),
    });
    if (!ok4) {
      success_rate.add(false);
      fail(`Fallo otp confirm: ${r.status} ${r.body}`);
    }
    success_rate.add(ok4);
  });

  // 5) Nuevo login (password) ya con OTP habilitado → preAuth corto
  group('auth_login_again', () => {
    const r = jsonPost(`${BASE_URL}/auth/login`, { email, password: bodyNuevo.password }, { tags: { endpoint: 'auth_login' } });
    const ok5 = check(r, {
      '200 login again': (res) => res.status === 200,
      'requiresOtp': (res) => res.json('data.requiresOtp') === true,
      'preAuth presente': (res) => !!res.json('data.preAuth'),
    });
    if (!ok5) {
      success_rate.add(false);
      fail(`Fallo login again: ${r.status} ${r.body}`);
    }
    preAuth = r.json('data.preAuth');
    success_rate.add(ok5);
  });

  // 6) Login con OTP calculado (sin depender de correo)
  let accessToken = '';
  group('auth_login_otp', () => {
    const code = totp(secret, 30, 0);
    const r = jsonPost(
      `${BASE_URL}/auth/login/otp`,
      { preAuth, code, deviceId: 'k6-device' },
      { tags: { endpoint: 'auth_login_otp' } },
    );
    const ok6 = check(r, {
      '200 login otp': (res) => res.status === 200,
      'token presente': (res) => !!res.json('data.token'),
    });
    if (!ok6) {
      success_rate.add(false);
      fail(`Fallo login OTP: ${r.status} ${r.body}`);
    }
    accessToken = r.json('data.token');
    success_rate.add(ok6);
  });

  // 7) Endpoints protegidos: listar sesiones
  group('auth_sessions', () => {
    const r = jsonGetAuth(`${BASE_URL}/auth/sessions`, accessToken, { tags: { endpoint: 'sessions' } });
    const ok7 = check(r, {
      '200 sessions': (res) => res.status === 200,
      'codigo 0': (res) => res.json('codigo') === 0,
      'data array': (res) => Array.isArray(res.json('data')),
    });
    success_rate.add(ok7);
  });

  // 8) Logout actual
  group('auth_logout', () => {
    const r = jsonPostAuth(`${BASE_URL}/auth/logout`, accessToken, {}, { tags: { endpoint: 'logout' } });
    const ok8 = check(r, {
      '200 logout': (res) => res.status === 200,
      'codigo 0': (res) => res.json('codigo') === 0,
    });
    success_rate.add(ok8);
  });

  // 9) Login otra vez y logout-all para cubrir endpoints
  group('auth_login_otp_again', () => {
    const r1 = jsonPost(`${BASE_URL}/auth/login`, { email, password: bodyNuevo.password }, { tags: { endpoint: 'auth_login' } });
    const ok9a = r1.status === 200 && !!r1.json('data.preAuth');
    success_rate.add(ok9a);
    if (!ok9a) fail(`Login again for logout-all fallo: ${r1.status}`);

    const pre2 = r1.json('data.preAuth');
    const code2 = totp(secret, 30, 0);
    const r2 = jsonPost(`${BASE_URL}/auth/login/otp`, { preAuth: pre2, code: code2, deviceId: 'k6-device' }, { tags: { endpoint: 'auth_login_otp' } });
    const ok9b = r2.status === 200 && !!r2.json('data.token');
    success_rate.add(ok9b);
    if (!ok9b) fail(`OTP again fallo: ${r2.status}`);

    const token2 = r2.json('data.token');

    const r3 = jsonPostAuth(`${BASE_URL}/auth/logout-all`, token2, {}, { tags: { endpoint: 'logout_all' } });
    const ok9c = r3.status === 200 && r3.json('codigo') === 0;
    success_rate.add(ok9c);
  });

  // (Opcional) probar recuperación de contraseña (solo request, sin confirmar)
  group('recovery_request', () => {
    const r = jsonPost(`${BASE_URL}/auth/recovery/request`, { email }, { tags: { endpoint: 'recovery_request' } });
    // Tu API retorna 200 con codigo 0 si el email existe; 400 si no.
    const okR = check(r, {
      'recovery request ok': (res) => res.status === 200 || res.status === 400,
    });
    success_rate.add(okR);
  });

  // Lecturas públicas finales
  read_endpoints();

  // Pequeña espera para no gatillar rate-limit tan fácil en volume
  sleep(0.3);

  t_auth_flow.add(Date.now() - t0);
}
