import axios from "axios";

// === Instancia principal ===
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// === GEO HEADERS opcionales ===
let geoReady = false;
let geo: { lat?: number; lon?: number; acc?: number } = {};

function ensureGeo() {
  if (geoReady) return;
  if (!("geolocation" in navigator)) {
    geoReady = true;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geo = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        acc: pos.coords.accuracy,
      };
      geoReady = true;
    },
    () => {
      geoReady = true;
    },
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 1200 }
  );
}
ensureGeo();

// === TOKEN GETTER (AuthContext conecta aquí) ===
let getToken: () => string | null = () => null;
export function bindTokenGetter(fn: typeof getToken) {
  getToken = fn;
}

// === INTERCEPTOR DE REQUEST ===
api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.set("Authorization", `Bearer ${token}`);
  if (geo.lat && geo.lon) {
    cfg.headers.set("x-geo-lat", String(geo.lat));
    cfg.headers.set("x-geo-lon", String(geo.lon));
    if (geo.acc) cfg.headers.set("x-geo-acc", String(geo.acc));
  }
  return cfg;
});

// === INTERCEPTOR DE RESPUESTA ===
api.interceptors.response.use(
  (res) => {
    const data: any = res.data;
    // ⚠️ Si backend devuelve { codigo ≠ 0 }, se considera error
    if (data && typeof data.codigo === "number" && data.codigo !== 0) {
      return Promise.reject({
        response: { status: res.status, data },
      });
    }
    return res;
  },
  (err) => {
    // ⚠️ Error sin respuesta (red, CORS, timeout)
    if (!err?.response) return Promise.reject(err);

    // Uniformizamos la forma del error
    const r = err.response;
    return Promise.reject({
      status: r.status,
      data: r.data,
    });
  }
);

export default api;
