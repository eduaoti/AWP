import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function requireAuthEvenIfExpired(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    // ⛔ Validamos incluso expirado
    const decoded: any = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    if (!decoded?.sub || !decoded?.rol) {
      return res.status(401).json({ error: "Token inválido" });
    }

    // lo guardamos en req.user (aunque esté expirado)
    (req as any).user = decoded;

    return next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}
