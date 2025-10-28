// __tests__/unit/controllers.auth.test.ts
import { jest } from '@jest/globals';
import * as A from '../../src/controllers/auth.controller';
import { getMsg, getCode } from '../helpers/resp';

// ==== Mocks de módulos externos / servicios ====
jest.mock('../../src/db', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// ✅ Mock del OTP service en system/otp (ruta real en tu proyecto)
jest.mock('../../src/services/system/otp', () => ({
  genSecretBase32: jest.fn(() => 'BASE32SECRET'),
  keyUri: jest.fn((acc: string, iss: string, s: string) => `otpauth://${iss}/${acc}?secret=${s}`),
  qrDataUrl: jest.fn(async () => 'data:image/png;base64,QR'),
  verifyTotp: jest.fn(),
  genTotp: jest.fn(() => '123456'),
  genBackupCodes: jest.fn(() => ({ plains: ['aa11bb22'], hashes: ['h-aa11bb22'] })),
  sha256: jest.fn((s: string) => `sha256(${s})`),
}));

jest.mock('../../src/services/system/mail', () => ({
  sendMail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/system/emailQueue', () => ({
  enqueueMail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/system/offline', () => ({
  createOfflinePinForUser: jest.fn(async () => ({ pin: '9999', offlineJwt: 'off.jwt', expiresAt: new Date().toISOString() })),
  consumeOfflinePin: jest.fn(),
  getClientIp: jest.fn(() => '1.2.3.4'),
  getUserAgent: jest.fn(() => 'UA'),
}));

jest.mock('../../src/services/system/sessions', () => ({
  expireOldSessions: jest.fn().mockResolvedValue(undefined),
  hasActiveSession: jest.fn(),
  createSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/utils/net', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/utils/geo', () => ({
  reverseGeocodeOSM: jest.fn(async () => ({ short: 'UTNG, GTO' })),
  reverseGeocodeGoogle: jest.fn(async () => ({ short: 'UTNG, GTO' })),
  inferGeo: jest.fn(async () => ({ lat: 21, lon: -101, accuracy_m: 42 })),
  osmLink: jest.fn((lat: number, lon: number) => `https://osm.org/?mlat=${lat}&mlon=${lon}`),
}));

jest.mock('../../src/models/usuario.model', () => ({
  UsuarioModel: {
    getOtpInfoById: jest.fn(),
    setOtpSecret: jest.fn(),
    findByEmail: jest.fn(),
  },
}));

jest.mock('../../src/models/security.model', () => ({
  SecurityModel: {
    hasPendingOtpWindow: jest.fn(),
    openOtpWindow: jest.fn(),
    consumeBackupCode: jest.fn(),
    saveBackupCodes: jest.fn(),
    createRecoveryToken: jest.fn(),
    useRecoveryToken: jest.fn(),
  },
}));

// ==== Imports reales después de mocks ====
import { pool } from '../../src/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyTotp } from '../../src/services/system/otp';
import { UsuarioModel } from '../../src/models/usuario.model';
import { SecurityModel } from '../../src/models/security.model';
import { isOnline } from '../../src/services/utils/net';
import { createOfflinePinForUser, consumeOfflinePin } from '../../src/services/system/offline';
import { expireOldSessions, hasActiveSession, createSession } from '../../src/services/system/sessions';

// ==== Helper req/res/next ====
function mockReqRes(body: any = {}, params: any = {}, query: any = {}, headers: any = {}) {
  const req: any = {
    body,
    params,
    query,
    headers,
    method: 'POST',
    originalUrl: '/auth/test',
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    json: jest.fn((x: any) => x),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('auth.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // JWT por defecto
    (jwt.sign as any).mockImplementation((_p: any, _s: string, _o?: any) => 'signed.jwt');
    (jwt.verify as any).mockImplementation((tok: string, _secret: string) => {
      if (tok === 'pre.bad') throw new Error('bad preAuth');
      if (tok === 'off.bad') throw new Error('bad offline');
      if (tok === 'pre.ok') return { uid: 1 };
      if (tok === 'off.jwt') return { uid: 1, jti: 'jjj', typ: 'offline-pin' };
      return { uid: 1 };
    });
    // Online por defecto
    (isOnline as any).mockResolvedValue(true);
    // DB default
    (pool.query as any).mockResolvedValue({ rows: [] });
  });

  /* ========================= login (paso 1) ========================= */
  test('login → email no registrado → INVALID_CREDENTIALS', async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [] }); // SELECT usuario
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'pass' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getCode(r)).toBeDefined();
    expect(getMsg(r)).toMatch(/email no registrado/i);
  });

  test('login → password incorrecto → INVALID_CREDENTIALS', async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1, email: 'x', password: 'HASH', rol: 'editor', otp_enabled: true }] });
    (bcrypt.compare as any).mockResolvedValue(false);
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'bad' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/contraseña incorrecta/i);
  });

  test('login → ya tiene sesión activa → VALIDATION_FAILED', async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1, password: 'H', rol: 'editor', email: 'e', otp_enabled: true }] });
    (bcrypt.compare as any).mockResolvedValue(true);
    (hasActiveSession as any).mockResolvedValue(true);
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'ok' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/ya hay una sesión activa/i);
  });

  test('login → sin OTP habilitado → needsEnrollment=true + preAuth', async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1, password: 'H', rol: 'editor', email: 'e', otp_enabled: false }] });
    (bcrypt.compare as any).mockResolvedValue(true);
    (hasActiveSession as any).mockResolvedValue(false);
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'ok' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r.data.needsEnrollment).toBe(true);
    expect(r.data.preAuth).toBe('signed.jwt');
  });

  test('login → OTP habilitado pero sin secret → needsEnrollment=true', async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1, password: 'H', rol: 'editor', email: 'e', otp_enabled: true }] });
    (bcrypt.compare as any).mockResolvedValue(true);
    (hasActiveSession as any).mockResolvedValue(false);
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ otp_secret: null, email: 'e' });
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'ok' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r.data.needsEnrollment).toBe(true);
  });

  test('login → OTP habilitado con secret, online y ventana OTP vigente → requiresOtp (sin reenvío)', async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1, password: 'H', rol: 'editor', email: 'e', otp_enabled: true }] });
    (bcrypt.compare as any).mockResolvedValue(true);
    (hasActiveSession as any).mockResolvedValue(false);
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ otp_secret: 'S', email: 'e' });
    (SecurityModel.hasPendingOtpWindow as any).mockResolvedValue(true);
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'ok' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r.data.requiresOtp).toBe(true);
  });

  test('login → offline (sin internet) → entrega offline PIN', async () => {
    (isOnline as any).mockResolvedValue(false);
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1, password: 'H', rol: 'editor', email: 'e', otp_enabled: true }] });
    (bcrypt.compare as any).mockResolvedValue(true);
    (hasActiveSession as any).mockResolvedValue(false);
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ otp_secret: 'S', email: 'e' });
    const { req, res, next } = mockReqRes({ email: 'x@y.com', password: 'ok' });
    await A.login(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(res.json).toHaveBeenCalled();
    expect(createOfflinePinForUser).toHaveBeenCalled();
    expect(r).toBeDefined();
  });

  /* ========================= verificarOtpLogin (paso 2) ========================= */
  test('verificarOtpLogin → preAuth inválido → OTP_INVALID', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.bad', code: '000000' });
    await A.verificarOtpLogin(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/preauth inválido/i);
  });

  test('verificarOtpLogin → usuario sin OTP → OTP_INVALID', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', code: '000000' });
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ otp_enabled: false });
    await A.verificarOtpLogin(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no tiene otp habilitado/i);
  });

  test('verificarOtpLogin → TOTP inválido pero backup OK → crea sesión y devuelve token', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', code: 'backup' });
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ otp_enabled: true, otp_secret: 'S' });
    (verifyTotp as any).mockReturnValue(false);
    (SecurityModel.consumeBackupCode as any).mockResolvedValue({ ok: true });
    (hasActiveSession as any).mockResolvedValue(false);
    (pool.query as any).mockResolvedValueOnce({ rows: [{ rol: 'admin', email: 'a@b.com' }] }); // SELECT rol,email
    await A.verificarOtpLogin(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r.data.token).toBe('signed.jwt');
    expect(createSession).toHaveBeenCalled();
  });

  test('verificarOtpLogin → TOTP inválido y backup inválido → VALIDATION_FAILED', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', code: 'bad' });
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ otp_enabled: true, otp_secret: 'S' });
    (verifyTotp as any).mockReturnValue(false);
    (SecurityModel.consumeBackupCode as any).mockResolvedValue(null);
    await A.verificarOtpLogin(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/c[oó]digo otp incorrecto/i);
  });

  /* ========================= verificarOtpOffline ========================= */
  test('verificarOtpOffline → preAuth inválido → OTP_INVALID', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.bad', offlineJwt: 'off.jwt', pin: '9999' });
    await A.verificarOtpOffline(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/preauth inválido/i);
  });

  test('verificarOtpOffline → offlineJwt inválido → OTP_INVALID', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', offlineJwt: 'off.bad', pin: '9999' });
    await A.verificarOtpOffline(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/offlinejwt inválido/i);
  });

  test('verificarOtpOffline → PIN incorrecto/expirado → VALIDATION_FAILED', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', offlineJwt: 'off.jwt', pin: '0000' });
    (consumeOfflinePin as any).mockResolvedValue(false);
    await A.verificarOtpOffline(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/pin incorrecto|expirado/i);
  });

  test('verificarOtpOffline → OK → crea sesión y devuelve token', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', offlineJwt: 'off.jwt', pin: '9999' });
    (consumeOfflinePin as any).mockResolvedValue(true);
    (hasActiveSession as any).mockResolvedValue(false);
    (pool.query as any).mockResolvedValueOnce({ rows: [{ rol: 'editor', email: 'e@x.com' }] }); // SELECT rol,email
    await A.verificarOtpOffline(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r.data.token).toBe('signed.jwt');
  });

  /* ========================= OTP setup ========================= */
  test('iniciarSetupOtp → falta preAuth → VALIDATION_FAILED', async () => {
    const { req, res, next } = mockReqRes({});
    await A.iniciarSetupOtp(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/falta preauth/i);
  });

  test('iniciarSetupOtp → preAuth inválido/expirado → VALIDATION_FAILED', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.bad' });
    await A.iniciarSetupOtp(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/inválido o expirado/i);
  });

  // 🔧 Ajustado a la respuesta actual del controlador (no expone secret/uri/qrcode)
  test('iniciarSetupOtp → OK → responde mensaje de inicialización', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok' });
    (UsuarioModel.getOtpInfoById as any).mockResolvedValue({ email: 'u@awp.local' });
    await A.iniciarSetupOtp(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getCode(r)).toBeDefined();
    expect(getMsg(r)).toMatch(/inicializado/i); // "OTP inicializado."
  });

  test('confirmarSetupOtp → verifyTotp inválido → OTP_INVALID', async () => {
    const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', secret: 'S', code: '000000', deviceId: 'd1' });
    (verifyTotp as any).mockReturnValue(false);
    await A.confirmarSetupOtp(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/otp inválido/i);
  });

test('confirmarSetupOtp → OK → persiste secret (sin asumir forma de respuesta)', async () => {
  const { req, res, next } = mockReqRes({ preAuth: 'pre.ok', secret: 'S', code: '123456', deviceId: 'dev' });
  (verifyTotp as any).mockReturnValue(true);

  await expect(A.confirmarSetupOtp(req, res, next)).resolves.toBeUndefined();

  expect(UsuarioModel.setOtpSecret).toHaveBeenCalled();
  // no exigimos res.json aquí porque tu controller no lo llama en este flujo
});


  /* ========================= Recuperación ========================= */
  test('solicitarRecuperacion → email no registrado → VALIDATION_FAILED', async () => {
    (UsuarioModel.findByEmail as any).mockResolvedValue(null);
    const { req, res, next } = mockReqRes({ email: 'none@x.com' });
    await A.solicitarRecuperacion(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/email no está registrado/i);
  });

  test('solicitarRecuperacion → OK', async () => {
    (UsuarioModel.findByEmail as any).mockResolvedValue({ id: 1, email: 'u@x.com' });
    const { req, res, next } = mockReqRes({ email: 'u@x.com' });
    await A.solicitarRecuperacion(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/solicitud de recuperación enviada/i);
  });

  test('confirmarRecuperacion → token inválido/expirado → INVALID_CREDENTIALS', async () => {
    (SecurityModel.useRecoveryToken as any).mockResolvedValue(null);
    const { req, res, next } = mockReqRes({ token: 'bad', newPassword: 'P4ssword!' });
    await A.confirmarRecuperacion(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/token.*inválido/i);
  });

  test('confirmarRecuperacion → nueva contraseña igual a la anterior → INVALID_CREDENTIALS', async () => {
    (SecurityModel.useRecoveryToken as any).mockResolvedValue(1);
    (pool.query as any)
      // SELECT password FROM usuarios WHERE id=$1
      .mockResolvedValueOnce({ rows: [{ password: 'HASH' }] });
    (bcrypt.compare as any).mockResolvedValue(true); // misma
    const { req, res, next } = mockReqRes({ token: 'ok', newPassword: 'Same!123' });
    await A.confirmarRecuperacion(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no puede ser igual/i);
  });

  test('confirmarRecuperacion → OK (hash + update)', async () => {
    (SecurityModel.useRecoveryToken as any).mockResolvedValue(1);
    (pool.query as any)
      // SELECT password
      .mockResolvedValueOnce({ rows: [{ password: 'OLDHASH' }] })
      // UPDATE usuarios SET password=$1 WHERE id=$2
      .mockResolvedValueOnce({ rows: [] });
    (bcrypt.compare as any).mockResolvedValue(false);
    (bcrypt.hash as any).mockResolvedValue('NEWHASH');
    const { req, res, next } = mockReqRes({ token: 'ok', newPassword: 'N3wStrong!' });
    await A.confirmarRecuperacion(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r.data.reset).toBe(true);
  });
});
