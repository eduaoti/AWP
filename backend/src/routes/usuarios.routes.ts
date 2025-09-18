import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/usuarios.controller";
import { validate } from "../middlewares/validate";
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  eliminarUsuarioSchema,
} from "../schemas/usuario.schemas";

const router = Router();

// GET listado (puedes protegerla con JWT si quieres)
// router.get("/listar", requireAuth, validate(listarUsuariosSchema), listUsers);
router.get("/", listUsers);
router.post("/nuevo", validate(crearUsuarioSchema), createUser);
router.put("/actualizar", /* requireAuth, */ validate(actualizarUsuarioSchema), updateUser);
router.post("/eliminar", /* requireAuth, */ validate(eliminarUsuarioSchema), deleteUser);

export default router;
