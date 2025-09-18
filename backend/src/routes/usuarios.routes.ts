import { Router } from "express";
import {
  listUsers,
  createUser,
  deleteUser,
  updateUser,
} from "../controllers/usuarios.controller";

const router = Router();

router.get("/", listUsers);
router.post("/nuevo", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
