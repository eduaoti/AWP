// backend/__tests__/helpers/resp.ts
// Busca un string razonable dentro de un objeto de respuesta.
// Si no hay un "message" directo, intenta variantes comunes.
// Como último recurso, devuelve JSON.stringify(r) para que el .toMatch()
// funcione aunque el texto esté anidado en otra parte.
export function getMsg(r: any): string {
  if (r == null) return "";
  if (typeof r === "string") return r;

  const pick = (...paths: Array<string | string[]>) => {
    for (const p of paths) {
      const parts = Array.isArray(p) ? p : String(p).split(".");
      let cur: any = r;
      let ok = true;
      for (const k of parts) {
        if (cur && typeof cur === "object" && k in cur) {
          cur = cur[k];
        } else {
          ok = false;
          break;
        }
      }
      if (ok && typeof cur === "string" && cur.trim() !== "") return cur;
    }
    return "";
  };

  // Candidatos más probables primero
  const direct =
    pick("message") ||
    pick("msg") ||
    pick("error.message", "error") ||
    pick("meta.message", "meta.msg", "meta.error", "meta.detail") ||
    pick("extra.message", "extra.detail", "extra.error") ||
    pick("details.message", "detail");

  if (direct) return direct;

  try {
    const s = JSON.stringify(r);
    return typeof s === "string" ? s : "";
  } catch {
    return "";
  }
}

export function getCode(r: any): string {
  if (r == null) return "";
  if (typeof r === "string") return "";

  const tryNumOrStr = (v: any) =>
    v == null ? "" : typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

  const candidates = [
    r.code,
    r?.meta?.code,
    r?.extra?.code,
    r?.error?.code,
    r?.status, // a veces se usa status como code lógico
  ];

  for (const c of candidates) {
    const s = tryNumOrStr(c);
    if (s) return s;
  }
  return "";
}
