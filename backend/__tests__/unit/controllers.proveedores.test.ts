// __tests__/unit/controllers.proveedores.test.ts
import { jest } from "@jest/globals";
import * as C from "../../src/controllers/proveedores.controller";
import * as S from "../../src/services/domain/proveedores.service";
import { validarProveedorCrear } from "../../src/dto/proveedor.dto";
import { mockReqRes } from "../helpers/http";
import { getMsg } from "../helpers/resp";

jest.mock("../../src/services/domain/proveedores.service");
jest.mock("../../src/dto/proveedor.dto", () => ({
  validarProveedorCrear: jest.fn(() => ({ ok: true })),
}));

describe("proveedores.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validarProveedorCrear as jest.Mock).mockReturnValue({ ok: true });
  });

  test("list: usa límites defensivos y empaqueta meta", async () => {
    (S.list as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { req, res } = mockReqRes({}, {}, { limit: "10", offset: "0" });
    req.method = "GET";
    await C.list(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(r.data.items).toHaveLength(2);
    expect(r.data.meta.limit).toBe(10);
    expect(r.data.meta.offset).toBe(0);
  });

  test("create: DTO inválido → VALIDATION_FAILED con mensajes concatenados", async () => {
    (validarProveedorCrear as jest.Mock).mockReturnValue({
      ok: false,
      errores: ["nombre → Debe tener 2+ chars", "telefono → 10-11 dígitos"],
    });
    const { req, res } = mockReqRes({ nombre: "x", telefono: "123" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    const msg = getMsg(r);
    expect(msg).toMatch(/nombre/i);
    expect(msg).toMatch(/tel[eé]fono/i);
  });

  test("create: conflicto uniq por nombre → DB_CONSTRAINT (409)", async () => {
    (S.create as jest.Mock).mockRejectedValue({
      code: "23505",
      constraint: "uniq_proveedores_nombre_norm",
    });
    const { req, res } = mockReqRes({ nombre: "Proveedor X" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/nombre de proveedor ya registrado/i);
  });

  test("create: conflicto uniq por teléfono → DB_CONSTRAINT (409)", async () => {
    (S.create as jest.Mock).mockRejectedValue({
      code: "23505",
      constraint: "uniq_proveedores_tel_digits",
    });
    const { req, res } = mockReqRes({ nombre: "Proveedor Y", telefono: "4775551234" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/tel[eé]fono ya registrado/i);
  });

  test("create: 23505 genérico (sin constraint reconocido) → DB_CONSTRAINT", async () => {
    (S.create as jest.Mock).mockRejectedValue({ code: "23505" });
    const { req, res } = mockReqRes({ nombre: "Proveedor Z" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r).toLowerCase()).toMatch(/existe|mismo|tel[eé]fono|duplicado/);
  });

  test("create: 23514 (check_violation) → VALIDATION_FAILED", async () => {
    (S.create as jest.Mock).mockRejectedValue({ code: "23514" });
    const { req, res } = mockReqRes({ nombre: "Proveedor OK" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/inválido|restricciones/i);
  });

  test("create: error controlado con status 404 → NOT_FOUND", async () => {
    (S.create as jest.Mock).mockRejectedValue({ status: 404, message: "Algo no existe" });
    const { req, res } = mockReqRes({ nombre: "Prov" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/algo no existe/i);
  });

  test("create: error genérico → DB_ERROR (500)", async () => {
    (S.create as jest.Mock).mockRejectedValue(new Error("boom"));
    const { req, res } = mockReqRes({ nombre: "Prov" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/error de base de datos/i);
  });

  test('create: éxito → "Proveedor creado con éxito"', async () => {
    (S.create as jest.Mock).mockResolvedValue({ id: 1 });
    const { req, res } = mockReqRes({ nombre: "Proveedor Bueno" });
    await C.create(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/creado con éxito/i);
  });
});
