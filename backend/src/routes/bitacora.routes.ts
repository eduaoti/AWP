// src/routes/bitacora.routes.ts
import { Router } from "express";
import * as BitacoraCtrl from "../controllers/bitacora.controller";
import { requireAuth } from "../middlewares/security/auth";

const r = Router();

// Si solo admin y jefe_inventario deben verlas, podrías añadir
// un middleware de autorización extra aquí.
r.get("/accesos", requireAuth, BitacoraCtrl.listaAccesos);
r.get("/movimientos", requireAuth, BitacoraCtrl.listaMovimientos);
r.get("/sistema", requireAuth, BitacoraCtrl.listaSistema);

export default r;
