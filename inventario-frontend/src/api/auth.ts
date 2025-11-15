import api from "./http";

// --- 1️⃣ LOGIN CON CONTRASEÑA ---
export function loginPassword(email: string, password: string) {
  return api.post("/auth/login", { email, password });
}

// 🔄 renovar token
export function refreshToken() {
  return api.post("/auth/refresh", {});
}

// --- 2️⃣ VERIFICAR OTP (flujo online) ---
export function verificarOtpLogin(preAuth: string, code: string, deviceId?: string) {
  return api.post("/auth/login/otp", { preAuth, code, deviceId });
}

// --- 3️⃣ VERIFICAR OTP OFFLINE (PIN) ---
export function verificarOtpOffline(preAuth: string, offlineJwt: string, pin: string, deviceId?: string) {
  return api.post("/auth/login/offline", { preAuth, offlineJwt, pin, deviceId });
}

// --- 4️⃣ INICIO DE CONFIGURACIÓN OTP ---
export function otpSetupStart(preAuth: string) {
  return api.post("/auth/otp/setup/start", { preAuth });
}

// --- 5️⃣ CONFIRMAR CONFIGURACIÓN OTP ---
export function otpSetupConfirm(preAuth: string, secret: string, code: string, deviceId?: string) {
  return api.post("/auth/otp/setup/confirm", { preAuth, secret, code, deviceId });
}

// --- 6️⃣ SOLICITAR RECUPERACIÓN DE CONTRASEÑA ---
export function recoveryRequest(email: string) {
  return api.post("/auth/recovery/request", { email });
}

// --- 7️⃣ CONFIRMAR NUEVA CONTRASEÑA ---
export function recoveryConfirm(token: string, newPassword: string) {
  return api.post("/auth/recovery/confirm", { token, newPassword });
}

// --- 8️⃣ CERRAR SESIÓN (logout individual) ---
export function logout() {
  // ⚠️ Se debe enviar un cuerpo vacío `{}` para que Axios incluya Content-Type
  return api.post("/auth/logout", {});
}

// --- 9️⃣ OBTENER SESIONES ACTIVAS ---
export function obtenerSesiones() {
  return api.get("/auth/sessions");
}

// --- 🔟 CERRAR TODAS LAS SESIONES ACTIVAS ---
export function cerrarTodas() {
  // ⚠️ Igual que logout: siempre enviar cuerpo JSON vacío
  return api.post("/auth/logout-all", {});
}
