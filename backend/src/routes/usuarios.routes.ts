import { Router } from "express";
import { listUsers, createUser, deleteUser, updateUser } from "../controllers/usuarios.controller";
const r = Router();

r.get("/", listUsers);
r.post("/nuevo", createUser);
r.delete("/:id", deleteUser);
r.put("/:id", updateUser);

export default r;
