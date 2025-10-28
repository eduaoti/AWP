// __tests__/unit/controllers.clientes.test.ts
import * as C from '../../src/controllers/clientes.controller';
import * as S from '../../src/services/domain/clientes.service';
import * as DTO from '../../src/dto/cliente.dto';
import { mockReqRes, getMsg, getCode } from '../helpers';
import { jest } from '@jest/globals';

jest.mock('../../src/services/domain/clientes.service');

describe('clientes.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(DTO, 'validarClienteCrear').mockReturnValue({ ok: true } as any);
    jest.spyOn(DTO, 'validarClienteActualizar').mockReturnValue({ ok: true } as any);
    jest.spyOn(DTO, 'validarClienteEliminar').mockReturnValue({ ok: true } as any);
  });

  /* ========================= list ========================= */
  test('list: retorna items + meta (limit/offset defensivos)', async () => {
    (S.list as any).mockResolvedValue([{ id: 1 }]);
    const { req, res } = mockReqRes({}, {}, { limit: '10', offset: '0' });

    await C.list(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(r.data.items.length).toBe(1);
    expect(r.data.meta.limit).toBe(10);
    expect(r.data.meta.offset).toBe(0);
    expect(r.data.meta.returned).toBe(1);
    expect(getCode(r)).toBeDefined(); // AppCode.OK
  });

  /* ========================= create ========================= */
  test('create: DTO inválido → VALIDATION_FAILED con mensajes concatenados', async () => {
    (DTO.validarClienteCrear as any).mockReturnValue({
      ok: false,
      errores: ['nombre → Debe tener al menos 2 caracteres', 'telefono → Debe contener 10 a 11 dígitos'],
    });
    const { req, res } = mockReqRes({ nombre: 'X', telefono: '123' });

    await C.create(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    const msg = getMsg(r);
    expect(msg).toMatch(/nombre/i);
    expect(msg).toMatch(/tel[eé]fono/i);
    expect(getCode(r)).toBeDefined(); // VALIDATION_FAILED
  });

  test('create: conflicto 409 del servicio → DB_CONSTRAINT', async () => {
    (S.create as any).mockRejectedValue({ status: 409, message: 'dup' });
    const { req, res } = mockReqRes({ nombre: 'Cliente X' });

    await C.create(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(getCode(r)).toBeDefined(); // DB_CONSTRAINT
    expect(getMsg(r)).toMatch(/dup|conflicto|duplicado/i);
  });

  test('create: 23505 (unique_violation) → DB_CONSTRAINT', async () => {
    (S.create as any).mockRejectedValue({ code: '23505' });
    const { req, res } = mockReqRes({ nombre: 'Cliente Y' });

    await C.create(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/conflicto|duplicado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('create: 23514 (check_violation) → VALIDATION_FAILED', async () => {
    (S.create as any).mockRejectedValue({ code: '23514' });
    const { req, res } = mockReqRes({ nombre: 'Cliente OK' });

    await C.create(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/inválido|restricciones/i);
    expect(getCode(r)).toBeDefined();
  });

  test('create: error controlado con status+message → respeta message', async () => {
    (S.create as any).mockRejectedValue({ status: 404, message: 'Algo no existe' });
    const { req, res } = mockReqRes({ nombre: 'Cliente Z' });

    await C.create(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/algo no existe/i);
  });

  test('create: éxito → "Cliente creado con éxito"', async () => {
    (S.create as any).mockResolvedValue({ id: 1, nombre: 'Bueno' });
    const { req, res } = mockReqRes({ nombre: 'Bueno' });

    await C.create(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/creado con éxito/i);
    expect(getCode(r)).toBeDefined();
  });

  /* ========================= getOne ========================= */
  test('getOne: id inválido → VALIDATION_FAILED', async () => {
    const { req, res } = mockReqRes({}, { id: 'abc' });

    await C.getOne(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/inv[aá]lido/i);
    expect(getCode(r)).toBeDefined();
  });

  test('getOne: no encontrado → NOT_FOUND', async () => {
    (S.getById as any).mockResolvedValue(undefined);
    const { req, res } = mockReqRes({}, { id: '999' });

    await C.getOne(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('getOne: OK → row', async () => {
    (S.getById as any).mockResolvedValue({ id: 7, nombre: 'C7' });
    const { req, res } = mockReqRes({}, { id: '7' });

    await C.getOne(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(r.data.id).toBe(7);
    expect(getCode(r)).toBeDefined();
  });

  /* ========================= update ========================= */
  test('update: DTO inválido → mensaje del validador', async () => {
    (DTO.validarClienteActualizar as any).mockReturnValue({
      ok: false,
      errores: ['nombre → No se permiten emojis', 'telefono → Debe contener 10 a 11 dígitos'],
    });
    const { req, res } = mockReqRes({ id: 1, nombre: '😅' });

    await C.update(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    const msg = getMsg(r);
    expect(msg).toMatch(/emojis/i);
    expect(msg).toMatch(/d[ií]gitos/i);
    expect(getCode(r)).toBeDefined();
  });

  test('update: 404 → NOT_FOUND', async () => {
    (S.update as any).mockRejectedValue({ status: 404 });
    const { req, res } = mockReqRes({ id: 1, nombre: 'Nuevo' });

    await C.update(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
  });

  test('update: 409 CLIENTE_DUPLICADO_NOMBRE → DB_CONSTRAINT', async () => {
    (S.update as any).mockRejectedValue({ status: 409, code: 'CLIENTE_DUPLICADO_NOMBRE', message: 'Nombre duplicado' });
    const { req, res } = mockReqRes({ id: 1, nombre: 'Repetido' });

    await C.update(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/duplicado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('update: éxito → "Cliente actualizado con éxito"', async () => {
    (S.update as any).mockResolvedValue({ id: 1, nombre: 'OK' });
    const { req, res } = mockReqRes({ id: 1, nombre: 'OK' });

    await C.update(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/actualizado con éxito/i);
    expect(r.data.id).toBe(1);
  });

  /* ========================= remove ========================= */
  test('remove: DTO inválido → mensaje del validador', async () => {
    (DTO.validarClienteEliminar as any).mockReturnValue({
      ok: false,
      errores: ['id → Debe ser un entero positivo'],
    });
    const { req, res } = mockReqRes({ id: 'x' });

    await C.remove(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/entero positivo/i);
    expect(getCode(r)).toBeDefined();
  });

  test('remove: 404 → NOT_FOUND', async () => {
    (S.remove as any).mockRejectedValue({ status: 404 });
    const { req, res } = mockReqRes({ id: 123 });

    await C.remove(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('remove: éxito → "Cliente eliminado con éxito"', async () => {
    (S.remove as any).mockResolvedValue({ id: 10 });
    const { req, res } = mockReqRes({ id: 10 });

    await C.remove(req as any, res as any);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/eliminado con éxito/i);
    expect(getCode(r)).toBeDefined();
  });
});
