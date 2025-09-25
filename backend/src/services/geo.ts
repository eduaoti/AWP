// src/services/geo.ts

/** ==== Reverse Geocoding (OSM y Google) ==== */
export async function reverseGeocodeOSM(
  lat: number,
  lon: number
): Promise<{ short?: string; full?: string } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=es`;
    const r = await fetch(url, {
      headers: { "User-Agent": "AWP-App/1.0 (eduardo4t8@gmail.com)" },
      // ⏱️ Timeout corto para no bloquear el login
      signal: AbortSignal.timeout(800)
    });
    const j = await r.json();
    if (j?.address) {
      const city = j.address.city || j.address.town || j.address.village || j.address.state;
      const country = j.address.country_code?.toUpperCase();
      return { short: city && country ? `${city}, ${country}` : undefined, full: j.display_name };
    }
    return null;
  } catch {
    return null;
  }
}

export async function reverseGeocodeGoogle(
  lat: number,
  lon: number
): Promise<{ short?: string; full?: string } | null> {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lon}`);
    url.searchParams.set("language", "es");
    url.searchParams.set("key", key);
    const r = await fetch(url.toString(), {
      // ⏱️ Timeout corto también aquí
      signal: AbortSignal.timeout(800)
    });
    const j = await r.json();
    if (j.status === "OK" && j.results?.length) {
      const addr = j.results[0].formatted_address as string;
      // “CDMX, MX” rápido:
      const parts = addr.split(",").map((s) => s.trim());
      const short =
        parts.length >= 2
          ? `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(" ").pop()}`
          : undefined;
      return { short, full: addr };
    }
    return null;
  } catch {
    return null;
  }
}

/** Link a mapa (OpenStreetMap) */
export function osmLink(lat?: number, lon?: number, zoom = 15) {
  if (lat == null || lon == null) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}

/** ==== Inferencia geo (headers → IP → dev fallback) ==== */
function extractClientIp(req: import("express").Request): string {
  const xf = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
  const ip = xf || req.socket?.remoteAddress || "";
  // ::ffff:187.190.10.20 → 187.190.10.20
  const m = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
  return m ? m[1] : ip;
}
function isLoopbackOrPrivate(ip: string) {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  // 10.0.0.0/8, 172.16/12, 192.168/16
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) return true;
  return false;
}

/**
 * Infere geolocalización automáticamente SIN que el cliente la mande:
 * 1) Headers x-geo-* (del navegador o gateway)
 * 2) IP → lat/lon (si ENABLE_IP_GEO=1 y la IP es pública)
 * 3) DEV_DEFAULT_IP para desarrollo (si la IP es loopback/privada)
 */
export async function inferGeo(
  req: import("express").Request
): Promise<{ lat?: number; lon?: number; accuracy_m?: number } | undefined> {
  const h = req.headers;

  // 1) Headers x-geo-*
  const latH = h["x-geo-lat"];
  const lonH = h["x-geo-lon"];
  const accH = h["x-geo-acc"];
  if (latH && lonH) {
    const lat = Number(Array.isArray(latH) ? latH[0] : latH);
    const lon = Number(Array.isArray(lonH) ? lonH[0] : lonH);
    const accuracy_m = accH ? Number(Array.isArray(accH) ? accH[0] : accH) : undefined;
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon, accuracy_m };
  }

  // 2) IP pública → geo
  const enableIp = process.env.ENABLE_IP_GEO === "1";
  let ip = extractClientIp(req);
  if (enableIp) {
    if (isLoopbackOrPrivate(ip)) {
      // 3) Fallback solo en DEV
      const devIp = process.env.DEV_DEFAULT_IP || "";
      if (devIp) ip = devIp;
    }
    if (ip && !isLoopbackOrPrivate(ip)) {
      try {
        const url = new URL(`http://ip-api.com/json/${ip}`);
        url.searchParams.set("fields", "status,lat,lon");
        const r = await fetch(url, {
          // ⏱️ Timeout reducido para no afectar latencia del login
          signal: AbortSignal.timeout(700)
        });
        const j = await r.json();
        if (j?.status === "success" && typeof j.lat === "number" && typeof j.lon === "number") {
          return { lat: j.lat, lon: j.lon, accuracy_m: undefined };
        }
      } catch {
        /* ignore */
      }
    }
  }

  return undefined;
}
