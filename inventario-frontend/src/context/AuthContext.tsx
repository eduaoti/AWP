// src/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bindTokenGetter } from "../api/http";
import { clearAuth, loadAuth, saveAuth } from "../utils/storage";
import { refreshToken, logout as apiLogout } from "../api/auth";

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
}

interface AuthCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  isAuthed: boolean;
  logout: () => Promise<void>;
  user: Usuario | null;
  setUser: (u: Usuario | null) => void;

  // Cuenta regresiva que se muestra en el modal
  secondsLeft: number | null;
  showExpireModal: boolean;
  extendSession: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  token: null,
  setToken: () => {},
  isAuthed: false,
  logout: async () => {},
  user: null,
  setUser: () => {},
  secondsLeft: null,
  showExpireModal: false,
  extendSession: async () => {},
});

export const useAuth = () => useContext(Ctx);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setTok] = useState<string | null>(() => loadAuth()?.token ?? null);

  const [user, setUser] = useState<Usuario | null>(() => {
    const u = localStorage.getItem("usuario");
    return u ? JSON.parse(u) : null;
  });

  // ==========================
  // CONFIG DE INACTIVIDAD REAL
  // ==========================
  const INACTIVITY_LIMIT = 60; // 60s = 1 minuto de inactividad
  const MODAL_COUNTDOWN = 12; // mostrar modal cuando falten 12s de inactividad

  // ==========================
  // CONFIG DE EXPIRACIÓN REAL DEL TOKEN
  // ==========================
  const TOKEN_MODAL_BEFORE_SEC = 60; // mostrar modal 60s antes de que expire el JWT

  // Lo que se muestra en el modal
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Estado + ref para saber si el modal está visible
  const [showExpireModalState, _setShowExpireModalState] = useState(false);
  const showExpireModalRef = useRef(false);
  const setShowExpireModal = (v: boolean) => {
    showExpireModalRef.current = v;
    _setShowExpireModalState(v);
  };
  const showExpireModal = showExpireModalState;

  // Timer de inactividad
  const inactivityTimerRef = useRef<number | null>(null);

  // Timers para expiración de token
  const tokenWarningTimeoutRef = useRef<number | null>(null);
  const tokenCountdownRef = useRef<number | null>(null);

  // ---- helpers de timer de inactividad ----
  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // ---- helpers de timers de token ----
  const clearTokenTimers = useCallback(() => {
    if (tokenWarningTimeoutRef.current !== null) {
      clearTimeout(tokenWarningTimeoutRef.current);
      tokenWarningTimeoutRef.current = null;
    }
    if (tokenCountdownRef.current !== null) {
      clearInterval(tokenCountdownRef.current);
      tokenCountdownRef.current = null;
    }
  }, []);

  // ==========================
  // setToken centralizado
  // ==========================
  const setToken = useCallback(
    (t: string | null) => {
      setTok(t);

      if (t) {
        saveAuth(t);
      } else {
        // Limpieza global cuando no hay token
        clearAuth();
        clearInactivityTimer();
        clearTokenTimers();
        setSecondsLeft(null);
        setShowExpireModal(false);
      }
    },
    [clearInactivityTimer, clearTokenTimers]
  );

  // Versión real del contador de inactividad:
  const inactivityCounterRef = useRef<number | null>(null);

  // ==========================
  // LOGOUT GLOBAL (front + back)
  // ==========================
  const logout = useCallback(async () => {
    try {
      if (token) {
        // 🔥 cerrar sesión en backend
        await apiLogout(); // POST /auth/logout
      }
    } catch (e) {
      console.warn("⚠️ No se pudo cerrar sesión en backend (quizá token expirado)", e);
    }

    // Limpieza en el front (usa setToken(null) para limpiar timers y storage)
    setToken(null);
    setUser(null);
    localStorage.removeItem("usuario");
  }, [token, setToken]);

  // ==========================
  // INICIAR / REINICIAR CONTADOR DE INACTIVIDAD (no la lógica real)
  // ==========================
  const startInactivityTimer = useCallback(() => {
    if (!token) return;

    clearInactivityTimer();
    // Si reiniciamos por actividad, ocultamos modal de inactividad (si vino por eso)
    // OJO: si el modal vino por token, el ref se controla desde el programador de token.
    if (!showExpireModalRef.current) {
      setShowExpireModal(false);
    }

    setSecondsLeft(null); // la cuenta de inactividad solo se muestra al entrar al modal

    inactivityTimerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        // Aquí s lo manejamos solo cuando el modal esté activo por inactividad.
        // Para detectar inactividad, mejor controlamos internamente:
        return s;
      });
    }, 1000);
  }, [token, clearInactivityTimer]);

  // ==========================
  // LÓGICA REAL DE INACTIVIDAD
  // ==========================
  const resetInactividad = useCallback(() => {
    if (!token) return;
    // Solo reseteamos si el modal NO está visible (para no "cancelar" el aviso)
    if (showExpireModalRef.current) return;

    // Reiniciamos contador interno
    inactivityCounterRef.current = INACTIVITY_LIMIT;

    clearInactivityTimer();

    inactivityTimerRef.current = window.setInterval(() => {
      if (inactivityCounterRef.current == null) return;

      if (inactivityCounterRef.current <= 1) {
        // Se acabó el tiempo de inactividad → logout (front + back)
        clearInactivityTimer();
        inactivityCounterRef.current = null;
        logout();
        return;
      }

      const next = inactivityCounterRef.current - 1;
      inactivityCounterRef.current = next;

      // Cuando falten MODAL_COUNTDOWN segundos → mostrar modal
      if (next === MODAL_COUNTDOWN) {
        setShowExpireModal(true);
        setSecondsLeft(next);
      } else if (next < MODAL_COUNTDOWN && showExpireModalRef.current) {
        // Actualizamos el contador visible mientras el modal está por inactividad
        setSecondsLeft(next);
      }
    }, 1000);
  }, [INACTIVITY_LIMIT, MODAL_COUNTDOWN, clearInactivityTimer, logout, token]);

  // ==========================
  // PROGRAMAR VENCIMIENTO DEL TOKEN
  // ==========================
  const scheduleTokenExpiry = useCallback(
    (jwtToken: string | null) => {
      clearTokenTimers();

      if (!jwtToken) return;

      let exp: number | null = null;
      try {
        const payloadBase64 = jwtToken.split(".")[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        if (typeof payload.exp === "number") {
          exp = payload.exp;
        }
      } catch (e) {
        console.warn("No se pudo decodificar exp del token", e);
      }

      if (!exp) return;

      const nowSec = Math.floor(Date.now() / 1000);
      let diff = exp - nowSec; // segundos hasta expiración real del JWT

      if (diff <= 0) {
        // Ya expiró → logout inmediato (front + back)
        logout();
        return;
      }

      const untilWarning = diff - TOKEN_MODAL_BEFORE_SEC;

      const startTokenCountdown = (initial: number) => {
        // Importante: cuando el modal se activa por token, detenemos el timer de inactividad
        clearInactivityTimer();
        inactivityCounterRef.current = null;

        setShowExpireModal(true);
        setSecondsLeft(initial);

        let remaining = initial;
        tokenCountdownRef.current = window.setInterval(() => {
          remaining -= 1;
          setSecondsLeft(remaining);

          if (remaining <= 0) {
            clearTokenTimers();
            logout();
          }
        }, 1000);
      };

      if (untilWarning <= 0) {
        // El token vence en menos de TOKEN_MODAL_BEFORE_SEC → mostrar modal ya
        startTokenCountdown(diff);
      } else {
        // Programamos un timeout para entrar a la ventana de aviso
        tokenWarningTimeoutRef.current = window.setTimeout(() => {
          startTokenCountdown(TOKEN_MODAL_BEFORE_SEC);
        }, untilWarning * 1000);
      }
    },
    [TOKEN_MODAL_BEFORE_SEC, clearInactivityTimer, clearTokenTimers, logout]
  );

  // Cada vez que cambie el token, reprogramamos vencimiento de token y timers
  useEffect(() => {
    if (!token) {
      clearInactivityTimer();
      clearTokenTimers();
      setSecondsLeft(null);
      setShowExpireModal(false);
      return;
    }

    // Inactividad
    resetInactividad();
    // Expiración real del JWT
    scheduleTokenExpiry(token);
  }, [token, resetInactividad, scheduleTokenExpiry, clearInactivityTimer, clearTokenTimers]);

  // ==========================
  // LISTENERS DE ACTIVIDAD
  // ==========================
  useEffect(() => {
    if (!token) {
      clearInactivityTimer();
      inactivityCounterRef.current = null;
      return;
    }

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll"];

    const activityHandler = () => {
      // Solo reseteamos inactividad si el modal NO está visible
      if (!showExpireModalRef.current) {
        resetInactividad();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, activityHandler));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, activityHandler));
      clearInactivityTimer();
    };
  }, [token, resetInactividad, clearInactivityTimer]);

  // ==========================
  // EXTENDER SESIÓN (botón del modal)
  // ==========================
  async function extendSession() {
    try {
      const { data } = await refreshToken(); // llama a /auth/refresh

      if (data?.data?.token) {
        const newToken = data.data.token;

        // Guardamos el nuevo token
        setToken(newToken);

        // Ocultamos modal y reiniciamos contadores
        setShowExpireModal(false);
        setSecondsLeft(null);

        // Reiniciamos inactividad y timer de expiración de token
        resetInactividad();
        scheduleTokenExpiry(newToken);
      }
    } catch (e) {
      console.error("Error al extender sesión", e);
      await logout(); // si falla, cierra sesión localmente y en backend
    }
  }

  // Bind del getter para Axios
  useEffect(() => {
    bindTokenGetter(() => token);
  }, [token]);

  const v = useMemo(
    () => ({
      token,
      setToken,
      isAuthed: !!token,
      logout,
      user,
      setUser,
      secondsLeft,
      showExpireModal,
      extendSession,
    }),
    [token, logout, user, secondsLeft, showExpireModal]
  );

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
};
