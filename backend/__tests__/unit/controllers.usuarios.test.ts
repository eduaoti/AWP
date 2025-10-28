// __tests__/unit/controllers.usuarios.test.ts
import { jest } from "@jest/globals";
import * as C from "../../src/controllers/usuarios.controller";
import * as U from "../../src/services/domain/usuarios.service";
import { mockReqRes } from "../helpers/http";
import { getMsg } from "../helpers/resp";

jest.mock("../../src/services/domain/usuarios.service");

describe("usuarios.controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("createUser → éxito (201, usuario creado)", async () => {
    (U.crearUsuario as jest.Mock).mockResolvedValue({
      id: 1,
      nombre: "Eduardo",
      email: "edu@utng.mx",
      rol: "admin",
    });

    const { req, res } = mockReqRes({
      nombre: "Eduardo",
      email: "edu@utng.mx",
      password: "123456",
      rol: "admin",
    });

    await C.createUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(r.data.email).toBe("edu@utng.mx");
  });

  test("createUser → email duplicado → USER_ALREADY_EXISTS (409)", async () => {
    (U.crearUsuario as jest.Mock).mockRejectedValue({
      status: 409,
      code: "USER_ALREADY_EXISTS",
      message: "El email ya está registrado",
    });

    const { req, res } = mockReqRes({
      nombre: "Eduardo",
      email: "edu@utng.mx",
      password: "123456",
      rol: "admin",
    });

    await C.createUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/ya está registrado/i);
  });

  test("createUser → error genérico → INTERNAL_ERROR (500)", async () => {
    (U.crearUsuario as jest.Mock).mockRejectedValue(new Error("fallo"));

    const { req, res } = mockReqRes({
      nombre: "Gerardo",
      email: "ger@utng.mx",
      password: "123456",
      rol: "editor",
    });

    await C.createUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/error al crear usuario/i);
  });

  test("listUsers → devuelve lista de usuarios", async () => {
    (U.listarUsuarios as jest.Mock).mockResolvedValue([
      { id: 1, nombre: "Edu", email: "edu@utng.mx" },
      { id: 2, nombre: "Ger", email: "ger@utng.mx" },
    ]);

    const { req, res } = mockReqRes();

    await C.listUsers(req as any, res as any);
    const r = res.json.mock.calls[0][0];

    expect(r).toBeDefined();
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data).toHaveLength(2);
  });

  test("updateUser → éxito (200, usuario actualizado)", async () => {
    (U.actualizarUsuario as jest.Mock).mockResolvedValue({
      id: 1,
      nombre: "Eduardo Actualizado",
      email: "edu@utng.mx",
      rol: "editor",
    });

    const { req, res } = mockReqRes({
      id: 1,
      nombre: "Eduardo Actualizado",
      email: "edu@utng.mx",
      rol: "editor",
    });

    await C.updateUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(r).toBeDefined();
    expect(r.data.nombre).toMatch(/actualizado/i);
  });

  test("updateUser → no encontrado (404)", async () => {
    (U.actualizarUsuario as jest.Mock).mockRejectedValue({
      status: 404,
      message: "Usuario no encontrado",
    });

    const { req, res } = mockReqRes({
      id: 999,
      nombre: "Nadie",
      email: "no@utng.mx",
      rol: "lector",
    });

    await C.updateUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
  });

  test("updateUser → error genérico (500)", async () => {
    (U.actualizarUsuario as jest.Mock).mockRejectedValue(new Error("fallo general"));

    const { req, res } = mockReqRes({
      id: 1,
      nombre: "Edu",
      email: "edu@utng.mx",
      rol: "admin",
    });

    await C.updateUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/error al actualizar usuario/i);
  });

  test("deleteUser → éxito (200, usuario eliminado)", async () => {
    (U.eliminarUsuario as jest.Mock).mockResolvedValue({ id: 7 });

    const { req, res } = mockReqRes({ id: 7 });

    await C.deleteUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];

    expect(r).toBeDefined();
    expect(r.data.id).toBe(7);
    expect(String(r.data.mensaje)).toMatch(/eliminado/i);
  });

  test("deleteUser → no encontrado (404)", async () => {
    (U.eliminarUsuario as jest.Mock).mockRejectedValue({
      status: 404,
      message: "Usuario no encontrado",
    });

    const { req, res } = mockReqRes({ id: 999 });

    await C.deleteUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/no encontrado/i);
  });

  test("deleteUser → error genérico (500)", async () => {
    (U.eliminarUsuario as jest.Mock).mockRejectedValue(new Error("fallo general"));

    const { req, res } = mockReqRes({ id: 5 });

    await C.deleteUser(req as any, res as any);
    const r = res.json.mock.calls[0][0];
    expect(getMsg(r)).toMatch(/error al eliminar usuario/i);
  });
});
