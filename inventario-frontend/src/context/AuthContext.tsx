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
import { decodeExp, msUntilExp } from "../utils/jwt";

/* ===========================================================
   🧩 Tipos
   =========================================================== */
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
}

interface AuthCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  isAuthed: boolean;
  expMsLeft?: number;
  logout: () => Promise<void>;
  user: Usuario | null;
  setUser: (u: Usuario | null) => void;
}

/* ===========================================================
   🧱 Contexto
   =========================================================== */
const Ctx = createContext<AuthCtx>({
  token: null,
  setToken: () => {},
  isAuthed: false,
  logout: async () => {},
  user: null,
  setUser: () => {},
});

export const useAuth = () => useContext(Ctx);

/* ===========================================================
   🔐 Provider
   =========================================================== */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Token
  const [token, setTok] = useState<string | null>(
    () => loadAuth()?.token ?? null
  );

  // Usuario
  const [user, setUser] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem("usuario");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Tiempo restante del token
  const [expMsLeft, setExpLeft] = useState<number | undefined>(() =>
    msUntilExp(decodeExp(token))
  );

  const timer = useRef<number | null>(null);

  /* ===========================================================
     🔄 Guardar y limpiar token
     =========================================================== */
  const setToken = useCallback((t: string | null) => {
    setTok(t);
    if (t) saveAuth(t);
    else clearAuth();
  }, []);

  /* ===========================================================
     ⏱️ Programar auto-logout al expirar el token
     =========================================================== */
  const schedule = useCallback(
    (t: string | null) => {
      if (timer.current) window.clearTimeout(timer.current);
      const exp = decodeExp(t);
      const ms = msUntilExp(exp);
      setExpLeft(ms);
      if (ms && ms > 0) {
        timer.current = window.setTimeout(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem("usuario");
        }, ms);
      }
    },
    [setToken]
  );

  /* ===========================================================
     🔁 Efectos iniciales
     =========================================================== */
  useEffect(() => {
    bindTokenGetter(() => token);
    schedule(token);
  }, [token, schedule]);

  /* ===========================================================
     🚪 Logout manual
     =========================================================== */
  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("usuario");
  }, [setToken]);

  /* ===========================================================
     📦 Valor del contexto
     =========================================================== */
  const v = useMemo(
    () => ({
      token,
      setToken,
      isAuthed: !!token,
      expMsLeft,
      logout,
      user,
      setUser,
    }),
    [token, expMsLeft, logout, user]
  );

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
};
