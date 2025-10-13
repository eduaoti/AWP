// src/routes/proveedores.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { CreateProveedorSchema } from "../schemas/proveedor.schemas";
import { crearProveedor, listarProveedores } from "../models/proveedor.model";

const r = Router();

r.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const offset = Number(req.query.offset ?? 0);
    const data = await listarProveedores(limit, offset);
    return res.json({ codigo: 0, mensaje: "OK", data });
  } catch (e) { next(e); }
});

r.post("/", validateBodySimple(CreateProveedorSchema), async (req, res, next) => {
  try {
    const prov = await crearProveedor(req.body);
    return res.status(201).json({ codigo: 0, mensaje: "OK", data: prov });
  } catch (e) { next(e); }
});

export default r;
