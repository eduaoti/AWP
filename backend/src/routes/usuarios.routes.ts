import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/usuarios.controller";
import { validateBody /*, validateQuery, validateParams */ } from "../middlewares/validate";
import { crearUsuarioSchema, actualizarUsuarioSchema, eliminarUsuarioSchema } from "../schemas/usuario.schemas";

const router = Router();
router.get("/", listUsers);
router.post("/nuevo", validateBody(crearUsuarioSchema), createUser);
router.put("/actualizar", validateBody(actualizarUsuarioSchema), updateUser);
router.post("/eliminar", validateBody(eliminarUsuarioSchema), deleteUser);
export default router;
