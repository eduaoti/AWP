// backend/__tests__/setup.ts
import { jest } from '@jest/globals';

// ==== Entorno base ====
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt';
process.env.JWT_PREAUTH_SECRET = process.env.JWT_PREAUTH_SECRET || 'test-pre';
process.env.JWT_OFFLINE_SECRET = process.env.JWT_OFFLINE_SECRET || 'test-offline';
process.env.SESSION_TTL_MIN = process.env.SESSION_TTL_MIN || '5';
process.env.RECOVERY_TOKEN_MINUTES = process.env.RECOVERY_TOKEN_MINUTES || '15';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ==== Mocks de infraestructura común ====

// Nodemailer "real" no se usa en tests; simulamos transporte OK
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ accepted: ['test@example.com'] }),
  }),
}));

// Servicio de correo de la app
jest.mock('../src/services/system/mail', () => ({
  sendMail: jest.fn().mockResolvedValue(void 0),
}));

// Cola de correos
jest.mock('../src/services/system/emailQueue', () => ({
  enqueueMail: jest.fn().mockResolvedValue(void 0),
}));

// Conectividad
jest.mock('../src/services/utils/net', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

// Geolocalización
jest.mock('../src/services/utils/geo', () => ({
  reverseGeocodeOSM: jest.fn().mockResolvedValue({ short: 'UTNG, GTO' }),
  reverseGeocodeGoogle: jest.fn().mockResolvedValue({ short: 'UTNG, GTO' }),
  inferGeo: jest.fn().mockResolvedValue({ lat: 21.0, lon: -101.0, accuracy_m: 50 }),
  osmLink: (lat: number, lon: number) => `https://osm.org/?mlat=${lat}&mlon=${lon}`,
}));

// Pool de BD
jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
}));

// Modelos usados por auth (se sobreescriben en tests específicos si hace falta)
jest.mock('../src/models/usuario.model', () => ({
  UsuarioModel: {
    getOtpInfoById: jest.fn(),
    setOtpSecret: jest.fn(),
    findByEmail: jest.fn(),
  },
}));

jest.mock('../src/models/security.model', () => ({
  SecurityModel: {
    hasPendingOtpWindow: jest.fn(),
    openOtpWindow: jest.fn(),
    consumeBackupCode: jest.fn(),
    createRecoveryToken: jest.fn(),
    saveBackupCodes: jest.fn(),
    useRecoveryToken: jest.fn(),
  },
}));

// Sesiones / offline (coinciden con la API actual de tus controladores)
jest.mock('../src/services/system/sessions', () => ({
  createSession: jest.fn().mockResolvedValue(void 0),
  expireOldSessions: jest.fn().mockResolvedValue(void 0),
  hasActiveSession: jest.fn().mockResolvedValue(false),
  // Los métodos extra (revoke, list, etc.) se pueden mockear en tests que los usen
}));

jest.mock('../src/services/system/offline', () => ({
  createOfflinePinForUser: jest.fn().mockResolvedValue({
    pin: '9999',
    offlineJwt: 'off.jwt',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  consumeOfflinePin: jest.fn().mockResolvedValue(true),
  getClientIp: (_req: any) => '127.0.0.1',
  getUserAgent: (_req: any) => 'jest-agent',
}));

// Bcrypt por defecto "pasa"
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

// Nota: No se mockea aquí jsonwebtoken ni los helpers OTP de forma global,
// porque los tests unitarios de auth definen sus propios mocks específicos
// (y los sobreescriben). Si los necesitas globalmente en otro contexto,
// agrégalos con cuidado para no interferir con esos tests.
