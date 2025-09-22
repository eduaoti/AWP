// src/utils/dnsMx.ts
import { promises as dns } from "dns";

export async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}
