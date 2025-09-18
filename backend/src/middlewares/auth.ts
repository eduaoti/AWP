import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface JwtPayload { uid: number; rol: "admin"|"editor"|"lector"; }

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
