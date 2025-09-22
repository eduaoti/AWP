// src/routes/usuarios.routes.ts
import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/usuarios.controller";
import { validate /*, validateQuery*/ } from "../middlewares/validate";
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  eliminarUsuarioSchema,
  // listarUsuariosSchema, // si luego quieres validar query en GET
} from "../schemas/usuario.schemas";

const router = Router();

// GET listado (si quieres validar query: validateQuery(listarUsuariosSchema))
// router.get("/", validateQuery(listarUsuariosSchema), listUsers);
router.get("/", listUsers);

router.post("/nuevo", validate(crearUsuarioSchema), createUser);
router.put("/actualizar", /* requireAuth, */ validate(actualizarUsuarioSchema), updateUser);
router.post("/eliminar", /* requireAuth, */ validate(eliminarUsuarioSchema), deleteUser);

export default router;
