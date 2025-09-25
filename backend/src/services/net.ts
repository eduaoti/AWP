import dns from "node:dns/promises";

// Endpoint que responde 204 muy rápido (usado en Android para captive portal)
const CONNECTIVITY_URL =
  process.env.CONNECTIVITY_URL ?? "https://clients3.google.com/generate_204";

// Timeout por defecto (ms)
const CONNECTIVITY_TIMEOUT_MS = Number(process.env.CONNECTIVITY_TIMEOUT_MS ?? 500);

/** Devuelve true si hay conectividad “útil” a internet en ≤ ~0.5 s */
export async function isOnline(): Promise<boolean> {
  // 1) HTTP 204 rápido
  try {
    const res = await fetch(CONNECTIVITY_URL, {
      method: "GET",
      signal: AbortSignal.timeout(CONNECTIVITY_TIMEOUT_MS),
    });
    if (res.ok) return true;
  } catch {
    /* ignore */
  }

  // 2) DNS como respaldo (independiente de HTTP)
  try {
    const ips = await dns.resolve("google.com");
    if (ips && ips.length) return true;
  } catch {
    /* ignore */
  }

  return false;
}
