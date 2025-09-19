import { Request, Response, NextFunction } from "express";
import { JWTPayload } from "jose";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface JwtPayload {
  sub: number;                     // id de usuario
  rol: "admin" | "editor" | "lector";
  email?: string;                   // opcional: incluir en el token
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    (req as any).user = payload; // guardamos el usuario en la request
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
