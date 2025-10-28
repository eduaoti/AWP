// __tests__/unit/controllers.productos.test.ts
import * as P from '../../src/controllers/producto.controller';
import * as S from '../../src/services/domain/producto.service';
import { mockReqRes, getMsg, getCode } from '../helpers';
import { jest } from '@jest/globals';

// Auto-mock del módulo de servicio
jest.mock('../../src/services/domain/producto.service');
const MS = jest.mocked(S, { shallow: true });

describe('producto.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ========================= crearProducto ========================= */
  test('crearProducto: OK → "Producto creado con éxito"', async () => {
    MS.crearProducto.mockResolvedValueOnce({ id: 1 } as any);
    const { req, res, next } = mockReqRes({
      clave: 'P1', nombre: 'Prod 1', unidad: 'pieza', categoria: 'general',
      precio: 10, stock_minimo: 1, stock_actual: 5
    });

    await P.crearProducto(req as any, res as any, next);

    expect(res.json).toHaveBeenCalled();
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/creado con éxito/i);
    expect(getCode(r)).toBeDefined(); // AppCode.OK
    expect(next).not.toHaveBeenCalled();
  });

  test('crearProducto: 23505 → DB_CONSTRAINT mantiene mensaje', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    MS.crearProducto.mockRejectedValueOnce(err);

    const { req, res, next } = mockReqRes({
      clave: 'P1', nombre: 'Prod 1', unidad: 'pieza', categoria: 'general',
      precio: 10, stock_minimo: 1, stock_actual: 5
    });
    await P.crearProducto(req as any, res as any, next);

    expect(res.json).toHaveBeenCalled();
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/ya existe|duplicad/i);
    expect(getCode(r)).toBeDefined(); // DB_CONSTRAINT
    expect(next).not.toHaveBeenCalled();
  });

  /* ========================= actualizarPorCodigo ========================= */
  test('actualizarPorCodigo: NOT_FOUND cuando servicio devuelve false', async () => {
    MS.actualizarProducto.mockResolvedValueOnce(false as any);
    const { req, res, next } = mockReqRes({}, { codigo: 'P1' });

    await P.actualizarPorCodigo(req as any, res as any, next);

    expect(res.json).toHaveBeenCalled();
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined(); // NOT_FOUND
    expect(next).not.toHaveBeenCalled();
  });

  test('actualizarPorCodigo: 23505 → DB_CONSTRAINT', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    MS.actualizarProducto.mockRejectedValueOnce(err);
    const { req, res, next } = mockReqRes({ nombre: 'X' }, { codigo: 'P1' });

    await P.actualizarPorCodigo(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/ya existe|duplicad/i);
    expect(getCode(r)).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  test('actualizarPorCodigo: OK → "Producto actualizado con éxito"', async () => {
    MS.actualizarProducto.mockResolvedValueOnce(true as any);
    const { req, res, next } = mockReqRes({ nombre: 'Nuevo' }, { codigo: 'P1' });

    await P.actualizarPorCodigo(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/actualizado con éxito/i);
    expect(getCode(r)).toBeDefined();
  });

  /* ========================= eliminarPorCodigo ========================= */
  test('eliminarPorCodigo: NOT_FOUND', async () => {
    MS.eliminarProducto.mockResolvedValueOnce(false as any);
    const { req, res, next } = mockReqRes({}, { codigo: 'P1' });

    await P.eliminarPorCodigo(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('eliminarPorCodigo: OK → "Producto eliminado con éxito"', async () => {
    MS.eliminarProducto.mockResolvedValueOnce(true as any);
    const { req, res, next } = mockReqRes({}, { codigo: 'P1' });

    await P.eliminarPorCodigo(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/eliminado con éxito/i);
    expect(getCode(r)).toBeDefined();
  });

  /* ========================= listar ========================= */
  test('listar: pasa data de servicio y envía OK', async () => {
    MS.listarProductos.mockResolvedValueOnce({ items: [], meta: { count: 0 } } as any);
    const { req, res, next } = mockReqRes({});

    await P.listar(req as any, res as any, next);

    expect(res.json).toHaveBeenCalled();
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/listado/i);
    expect(getCode(r)).toBeDefined(); // OK
    expect(next).not.toHaveBeenCalled();
  });

  test('listar: servicio lanza PARAMETRO_INVALIDO → VALIDATION_FAILED', async () => {
    const err: any = new Error('per_page inválido');
    err.status = 400;
    err.code = 'PARAMETRO_INVALIDO';
    MS.listarProductos.mockRejectedValueOnce(err);

    const { req, res, next } = mockReqRes({ page: 0, per_page: 0 });
    await P.listar(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/inválid|fall/i);
    expect(getCode(r)).toBeDefined(); // VALIDATION_FAILED
    expect(next).not.toHaveBeenCalled();
  });

  /* ========================= actualizar (por body.clave/nombre) ========================= */
  test('actualizar: NOT_FOUND', async () => {
    MS.actualizarProducto.mockResolvedValueOnce(false as any);
    const { req, res, next } = mockReqRes({ clave: 'P1', nombre: 'N', precio: 123 });

    await P.actualizar(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('actualizar: 23505 → DB_CONSTRAINT', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    MS.actualizarProducto.mockRejectedValueOnce(err);
    const { req, res, next } = mockReqRes({ clave: 'P1', nombre: 'N', precio: 123 });

    await P.actualizar(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/ya existe|duplicad/i);
    expect(getCode(r)).toBeDefined();
  });

  test('actualizar: OK', async () => {
    MS.actualizarProducto.mockResolvedValueOnce(true as any);
    const { req, res, next } = mockReqRes({ clave: 'P1', precio: 99 });

    await P.actualizar(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/actualizado con éxito/i);
    expect(getCode(r)).toBeDefined();
  });

  /* ========================= actualizarStockMinimo ========================= */
  test('actualizarStockMinimo: NOT_FOUND', async () => {
    MS.actualizarStockMinimo.mockResolvedValueOnce(false as any);
    const { req, res, next } = mockReqRes({ clave: 'P1', stock_minimo: 7 });

    await P.actualizarStockMinimo(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('actualizarStockMinimo: OK', async () => {
    MS.actualizarStockMinimo.mockResolvedValueOnce(true as any);
    const { req, res, next } = mockReqRes({ clave: 'P1', stock_minimo: 7 });

    await P.actualizarStockMinimo(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/stock mínimo actualizado/i);
    expect(getCode(r)).toBeDefined();
  });

  /* ========================= eliminar (por body.clave/nombre) ========================= */
  test('eliminar: NOT_FOUND', async () => {
    MS.eliminarProducto.mockResolvedValueOnce(false as any);
    const { req, res, next } = mockReqRes({ clave: 'P1' });

    await P.eliminar(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
    expect(getCode(r)).toBeDefined();
  });

  test('eliminar: OK', async () => {
    MS.eliminarProducto.mockResolvedValueOnce(true as any);
    const { req, res, next } = mockReqRes({ clave: 'P1' });

    await P.eliminar(req as any, res as any, next);

    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/eliminado con éxito/i);
    expect(getCode(r)).toBeDefined();
  });
});
