// src/routes/proveedores.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { CreateProveedorSchema } from "../schemas/proveedor.schemas";
import { crearProveedor, listarProveedores } from "../models/proveedor.model";

const r = Router();

/** GET /proveedores (directorio) */
r.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const offset = Number(req.query.offset ?? 0);
    const data = await listarProveedores(limit, offset);
    res.json(data);
  } catch (e) { next(e); }
});

/** POST /proveedores (registrar proveedor) */
r.post("/", validateBodySimple(CreateProveedorSchema), async (req, res, next) => {
  try {
    const prov = await crearProveedor(req.body);
    res.status(201).json(prov);
  } catch (e) { next(e); }
});

export default r;
