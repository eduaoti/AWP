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
import { refreshToken } from "../api/auth";

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

  // Inactividad real
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
  const INACTIVITY_LIMIT = 60; // 60s para pruebas
  const MODAL_COUNTDOWN = 12;  // mostrar modal cuando falten 12s

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // usamos un setter custom para tener también un ref con el valor actual
  const [showExpireModalState, _setShowExpireModalState] = useState(false);
  const showExpireModalRef = useRef(false);
  const setShowExpireModal = (v: boolean) => {
    showExpireModalRef.current = v;
    _setShowExpireModalState(v);
  };
  const showExpireModal = showExpireModalState;

  const timerRef = useRef<number | null>(null);

  // ---- helpers de timer ----
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setToken = useCallback((t: string | null) => {
    setTok(t);
    if (t) saveAuth(t);
    else clearAuth();
  }, []);

  const logout = useCallback(async () => {
    clearTimer();
    setSecondsLeft(null);
    setShowExpireModal(false);

    setToken(null);
    setUser(null);
    localStorage.removeItem("usuario");
  }, [clearTimer, setToken]);

  // ==========================
  // INICIAR / REINICIAR CONTADOR
  // ==========================
  const startInactivityTimer = useCallback(() => {
    if (!token) return;

    clearTimer();
    setShowExpireModal(false);
    setSecondsLeft(INACTIVITY_LIMIT);

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;

        if (s <= 1) {
          logout();       // tiempo agotado → logout automático
          return 0;
        }

        const next = s - 1;

        // Mostrar modal justo cuando falten MODAL_COUNTDOWN segundos
        if (next === MODAL_COUNTDOWN) {
          setShowExpireModal(true);
        }

        return next;
      });
    }, 1000);
  }, [token, clearTimer, logout]);

  // ==========================
  // RESET POR ACTIVIDAD
  // ==========================
  const resetInactivity = useCallback(() => {
    if (!token) return;
    // IMPORTANTE: aquí ya NO usamos showExpireModal,
    // eso lo controlamos en el handler con el ref.
    startInactivityTimer();
  }, [token, startInactivityTimer]);

  // ==========================
  // LISTENERS DE ACTIVIDAD
  // ==========================
  useEffect(() => {
    if (!token) {
      clearTimer();
      setSecondsLeft(null);
      setShowExpireModal(false);
      return;
    }

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
    ];

    const activityHandler = () => {
      // 👀 Sólo reseteamos si el modal NO está visible
      if (!showExpireModalRef.current) {
        resetInactivity();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, activityHandler));

    // arranca el contador al entrar/loguearse
    startInactivityTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, activityHandler));
      clearTimer();
    };
  }, [token, resetInactivity, startInactivityTimer, clearTimer]);

  // ==========================
  // EXTENDER SESIÓN (botón del modal)
  // ==========================
  async function extendSession() {
    try {
      const { data } = await refreshToken(); // llama a /auth/refresh

      if (data?.data?.token) {
        setToken(data.data.token);  // guarda nuevo token
        setShowExpireModal(false);  // oculta modal
        startInactivityTimer();     // reinicia contador de inactividad
      }
    } catch (e) {
      console.error("Error al extender sesión", e);
      await logout(); // si falla, cierra sesión localmente
    }
  }

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
