// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Payload que esperamos en NUESTROS JWTs
export interface AuthPayload {
  sub: number;                     // id de usuario
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
  email?: string;
  jti?: string;                    // opcional: id de sesión
  exp?: number;                    // unix seconds
}

/** Type guard para validar que el decoded cumple con AuthPayload mínimo */
function isAuthPayload(x: unknown): x is AuthPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const hasSub = typeof o.sub === "number" || typeof o.sub === "string";
  const hasRol =
    typeof o.rol === "string" &&
    (o.rol === "admin" || o.rol === "editor" || o.rol === "lector" || o.rol === "jefe_inventario");
  return hasSub && hasRol;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    // jsonwebtoken puede devolver string | object; validamos con type guard
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string" || !isAuthPayload(decoded)) {
      return res.status(401).json({ error: "Token inválido o sin claims requeridos" });
    }

    // Normalizamos sub a number por si vino como string
    const payload: AuthPayload = {
      sub: typeof decoded.sub === "string" ? Number(decoded.sub) : decoded.sub,
      rol: decoded.rol,
      email: decoded.email,
      jti: decoded.jti,
      exp: decoded.exp
    };

    // Guardamos el usuario en la request
    (req as any).user = payload;

    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
