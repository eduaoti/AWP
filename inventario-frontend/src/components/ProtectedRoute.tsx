import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  readonly children: React.ReactElement;
  readonly roles?: string[]; // 🔹 roles permitidos opcionalmente
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthed, user } = useAuth();

  // 🧱 1. Verificar si el usuario está logueado
  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  // 🧱 2. Verificar roles (si se especificaron)
  if (roles && user && !roles.includes(user.rol)) {
    // Redirigir al inicio si el rol no tiene permiso
    return <Navigate to="/inicio" replace />;
  }

  // ✅ 3. Si pasa todas las validaciones
  return children;
}
