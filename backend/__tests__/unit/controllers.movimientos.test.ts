// __tests__/unit/controllers.movimientos.test.ts
import * as M from '../../src/controllers/movimiento.controller';
import * as S from '../../src/services/domain/movimiento.service';
import { mockReqRes } from '../helpers';
import { jest } from '@jest/globals';

jest.mock('../../src/services/domain/movimiento.service');

describe('movimiento.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listar: normaliza data si servicio regresa array', async () => {
    (S.listarMovimientos as any).mockResolvedValue([{ id: 1 }]);
    const { req, res, next } = mockReqRes({}, {}, { limit: 10, offset: 0 });
    await M.listar(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(r.data).toBeDefined();
    expect(Array.isArray(r.data.items)).toBe(true);
    expect(r.data.items.length).toBe(1);
    expect(r.data.meta).toBeDefined();
    expect(r.data.meta.limit).toBe(10);
    expect(r.data.meta.offset).toBe(0);
  });

  test('listar: cuando servicio ya trae {items, meta} lo pasa tal cual', async () => {
    (S.listarMovimientos as any).mockResolvedValue({
      items: [{ id: 2 }],
      meta: { limit: 5, offset: 0, count: 1 },
    });
    const { req, res, next } = mockReqRes({}, {}, { limit: 5, offset: 0 });
    await M.listar(req, res, next);
    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(r.data.items.length).toBe(1);
    expect(r.data.meta.count).toBe(1);
  });

  test('registrar: error STOCK_INSUFICIENTE mapeado', async () => {
    (S.registrarMovimiento as any).mockRejectedValue({
      code: 'STOCK_INSUFICIENTE',
      message: 'Cantidad solicitada excede el stock disponible',
    });
    const { req, res, next } = mockReqRes({
      entrada: false,
      producto_clave: 'P1',
      cantidad: 999,
      cliente_id: 1,
    });
    await M.registrar(req, res, next);
    const r = res.json.mock.calls[0][0];
    const msg = r?.message ?? r?.mensaje;
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/stock/i);
  });

  test('registrar: NOT_FOUND (404) mapeado', async () => {
    (S.registrarMovimiento as any).mockRejectedValue({
      status: 404,
      message: 'Producto no encontrado',
    });
    const { req, res, next } = mockReqRes({
      entrada: true,
      producto_clave: 'P404',
      cantidad: 1,
      proveedor_id: 1,
    });
    await M.registrar(req, res, next);
    const r = res.json.mock.calls[0][0];
    const msg = r?.message ?? r?.mensaje;
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/no encontrado/i);
  });

  test('registrar: VALIDATION_FAILED (400) mapeado', async () => {
    (S.registrarMovimiento as any).mockRejectedValue({
      status: 400,
      message: 'cliente_id es requerido para salidas',
    });
    const { req, res, next } = mockReqRes({
      entrada: false,
      producto_clave: 'P1',
      cantidad: 2,
      // cliente_id falta → valida que el controller pase el mensaje
    });
    await M.registrar(req, res, next);
    const r = res.json.mock.calls[0][0];
    const msg = r?.message ?? r?.mensaje;
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/cliente_id/i);
  });
});
