import { Request, Response, NextFunction } from "express";

export function withAuditContext(req: Request, res: Response, next: NextFunction) {
  try {
    if ((req as any).user?.id) {
      (req as any).db?.none("SET LOCAL app.current_user_id = $1", [(req as any).user.id]).catch(() => {});
    }
    const ip = req.headers["x-forwarded-for"] ?? req.ip ?? null;
    (req as any).db?.none("SET LOCAL app.current_ip = $1", [String(ip)]).catch(() => {});

    const ua = req.headers["user-agent"] ?? null;
    (req as any).db?.none("SET LOCAL app.current_user_agent = $1", [String(ua)]).catch(() => {});
  } catch (_) {}
  next();
}
