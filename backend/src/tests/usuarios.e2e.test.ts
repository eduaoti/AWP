import request from "supertest";
import app from "../../src/app"; // tu app Express exportada desde app.ts

describe("Usuarios API (validaciones y flujo)", () => {
  let idCreado = 0;
  const email = `test${Date.now()}@mail.com`; // email único por test

  it("rechaza Content-Type inválido", async () => {
    const r = await request(app).post("/usuarios/nuevo").send("nombre=EDU");
    expect([400,415]).toContain(r.status);
  });

  it("valida password débil (min 8)", async () => {
    const r = await request(app).post("/usuarios/nuevo").set("Content-Type","application/json")
      .send({ nombre: "Edu", email: "weak@test.com", password: "1234567", rol: "editor" });
    expect(r.status).toBe(400);
  });

  it("crea usuario OK (sin password en respuesta)", async () => {
    const r = await request(app).post("/usuarios/nuevo").set("Content-Type","application/json")
      .send({ nombre: "Edu Ortiz", email, password: "Abcdef12", rol: "editor" });
    expect(r.status).toBe(201);
    idCreado = r.body.id;
    expect(r.body).not.toHaveProperty("password");
  });

  it("evita duplicado por email", async () => {
    const r = await request(app).post("/usuarios/nuevo").set("Content-Type","application/json")
      .send({ nombre: "Otro", email, password: "Abcdef12", rol: "editor" });
    expect(r.status).toBe(400);
  });

  it("lista usuarios", async () => {
    const r = await request(app).get("/usuarios");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it("actualiza usuario SIN path var", async () => {
    const r = await request(app).put("/usuarios/actualizar").set("Content-Type","application/json")
      .send({ id: idCreado, nombre: "Edu Actualizado", email, rol: "admin" });
    expect(r.status).toBe(200);
    expect(r.body.nombre).toBe("Edu Actualizado");
  });

  it("rechaza campos extra por .strict()", async () => {
    const r = await request(app).put("/usuarios/actualizar").set("Content-Type","application/json")
      .send({ id: idCreado, nombre: "X", email, rol: "admin", extra: "no" });
    expect(r.status).toBe(400);
  });

  it("elimina usuario SIN path var", async () => {
    const r = await request(app).post("/usuarios/eliminar").set("Content-Type","application/json")
      .send({ id: idCreado });
    expect(r.status).toBe(200);
  });

  it("eliminar usuario inexistente", async () => {
    const r = await request(app).post("/usuarios/eliminar").set("Content-Type","application/json")
      .send({ id: 99999999 });
    expect(r.status).toBe(404);
  });
});
