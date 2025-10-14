// src/middlewares/require-json.ts
import { Request, Response, NextFunction } from "express";
import { AppCode } from "../status/codes";
import { sendCode } from "../status/respond";

export function requireJson(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers["content-type"] || "";
  if (!ct.includes("application/json")) {
    return sendCode(req, res, AppCode.BAD_CONTENT_TYPE);
  }
  next();
}
