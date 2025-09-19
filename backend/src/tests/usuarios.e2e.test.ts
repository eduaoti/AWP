import request from "supertest";
import app from "../../src/app"; // tu app Express exportada desde app.ts

describe("Usuarios API (validaciones y flujo)", () => {
  let idCreado = 0;
  const email = `test${Date.now()}@mail.com`; // email único por test

  it("rechaza Content-Type inválido", async () => {
    const r = await request(app).post("/usuarios/nuevo").send("nombre=EDU");
    expect([400,415]).toContain(r.status);
    expect(r.body).toHaveProperty("codigo");
    expect(r.body.codigo).not.toBe(0);
  });

  it("valida password débil", async () => {
    const r = await request(app).post("/usuarios/nuevo")
      .set("Content-Type","application/json")
      .send({ nombre: "Edu", email: "weak@test.com", password: "1234567", rol: "editor" });
    expect(r.status).toBe(400);
    expect(r.body.codigo).toBeGreaterThan(0);
  });

  it("crea usuario OK (data con id, sin password)", async () => {
    const r = await request(app).post("/usuarios/nuevo")
      .set("Content-Type","application/json")
      .send({ nombre: "Edu Ortiz", email, password: "Abcdef1!", rol: "editor" });
    expect(r.status).toBe(201);
    expect(r.body.codigo).toBe(0);
    expect(r.body.data).toHaveProperty("id");
    expect(r.body.data).not.toHaveProperty("password");
    idCreado = r.body.data.id;
  });

  it("evita duplicado por email", async () => {
    const r = await request(app).post("/usuarios/nuevo")
      .set("Content-Type","application/json")
      .send({ nombre: "Otro", email, password: "Abcdef1!", rol: "editor" });
    expect([400,409]).toContain(r.status);
    expect(r.body.codigo).toBeGreaterThan(0);
  });

  it("lista usuarios", async () => {
    const r = await request(app).get("/usuarios");
    expect(r.status).toBe(200);
    expect(r.body.codigo).toBe(0);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  it("actualiza usuario OK", async () => {
    const r = await request(app).put("/usuarios/actualizar")
      .set("Content-Type","application/json")
      .send({ id: idCreado, nombre: "Edu Actualizado", email, rol: "admin" });
    expect(r.status).toBe(200);
    expect(r.body.codigo).toBe(0);
    expect(r.body.data.nombre).toBe("Edu Actualizado");
  });

  it("rechaza campos extra (strict)", async () => {
    const r = await request(app).put("/usuarios/actualizar")
      .set("Content-Type","application/json")
      .send({ id: idCreado, nombre: "X", email, rol: "admin", extra: "no" });
    expect(r.status).toBe(400);
    expect(r.body.codigo).toBe(1);
  });

  it("elimina usuario OK", async () => {
    const r = await request(app).post("/usuarios/eliminar")
      .set("Content-Type","application/json")
      .send({ id: idCreado });
    expect(r.status).toBe(200);
    expect(r.body.codigo).toBe(0);
    expect(r.body.data.id).toBe(idCreado);
  });

  it("eliminar usuario inexistente", async () => {
    const r = await request(app).post("/usuarios/eliminar")
      .set("Content-Type","application/json")
      .send({ id: 99999999 });
    expect(r.status).toBe(404);
    expect(r.body.codigo).toBe(41); // USER_NOT_FOUND
  });
});
