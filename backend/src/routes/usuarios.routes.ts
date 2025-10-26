// src/routes/usuarios.routes.ts
import { Router } from "express";
import { validate } from "../middlewares/validation/validate"; // ← usa validate
import * as C from "../controllers/usuarios.controller";
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  eliminarUsuarioSchema,
  listarUsuariosSchema,
} from "../schemas/domain/usuario.schemas";

const r = Router();

// Listar (JSON-only)
r.post("/listar", validate(listarUsuariosSchema), C.listUsers);

// Crear
r.post("/", validate(crearUsuarioSchema), C.createUser);

// Actualizar
r.put("/", validate(actualizarUsuarioSchema), C.updateUser);

// Eliminar
r.post("/eliminar", validate(eliminarUsuarioSchema), C.deleteUser);

export default r;
