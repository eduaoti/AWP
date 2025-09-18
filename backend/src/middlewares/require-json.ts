import { Request, Response, NextFunction } from "express";
export function requireJson(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers["content-type"] || "";
  if (!ct.includes("application/json")) {
    return res.status(415).json({ error: "Content-Type debe ser application/json" });
  }
  next();
}
