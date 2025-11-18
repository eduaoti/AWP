// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import SessionExpiredModal from "./components/SessionExpiredModal";

// ==== Páginas públicas ====
import Home from "./pages/Home";
import Login from "./pages/Login";
import RegistroUsuario from "./pages/RegistroUsuario";
import OtpVerify from "./pages/OtpVerify";
import OfflinePin from "./pages/OfflinePin";
import OtpSetup from "./pages/OtpSetup";
import RecoveryRequest from "./pages/RecoveryRequest";
import RecoveryConfirm from "./pages/RecoveryConfirm";

// ==== Páginas protegidas ====
import Inicio from "./pages/Inicio";
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import Movimientos from "./pages/Movimientos";
import Productos from "./pages/Productos";
import Categorias from "./pages/Categorias";
import Almacenes from "./pages/Almacenes";
import Proveedores from "./pages/Proveedores"; // ⬅️ NUEVO
import ReportesMovimientosProducto from "./pages/ReportesMovimientosProducto";

// ✅ Bitácoras (vistas individuales)
import BitacoraAccesos from "./pages/BitacoraAccesos";
import BitacoraMovimientos from "./pages/BitacoraMovimientos";
import BitacoraSistema from "./pages/BitacoraSistema";

// ✅ Vista general con tabs (archivo: src/pages/Bitacora.tsx)
import Bitacora from "./pages/Bitacora";

export default function App() {
  const { secondsLeft, showExpireModal, logout, extendSession } = useAuth();

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* ==== RUTAS PÚBLICAS ==== */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<RegistroUsuario />} />
          <Route path="/otp-verify" element={<OtpVerify />} />
          <Route path="/offline-pin" element={<OfflinePin />} />
          <Route path="/otp-setup" element={<OtpSetup />} />
          <Route path="/recovery" element={<RecoveryRequest />} />
          <Route path="/reset" element={<RecoveryConfirm />} />

          {/* ==== RUTAS PROTEGIDAS ==== */}
          <Route
            path="/inicio"
            element={
              <ProtectedRoute>
                <Inicio />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <Usuarios />
              </ProtectedRoute>
            }
          />

          <Route
            path="/movimientos"
            element={
              <ProtectedRoute>
                <Movimientos />
              </ProtectedRoute>
            }
          />

          <Route
            path="/productos"
            element={
              <ProtectedRoute>
                <Productos />
              </ProtectedRoute>
            }
          />

          <Route
            path="/categorias"
            element={
              <ProtectedRoute>
                <Categorias />
              </ProtectedRoute>
            }
          />

          <Route
            path="/almacenes"
            element={
              <ProtectedRoute>
                <Almacenes />
              </ProtectedRoute>
            }
          />

          {/* ⬅️ NUEVA RUTA PROTEGIDA PARA PROVEEDORES */}
          <Route
            path="/proveedores"
            element={
              <ProtectedRoute>
                <Proveedores />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reportes/movimientos-producto"
            element={
              <ProtectedRoute>
                <ReportesMovimientosProducto />
              </ProtectedRoute>
            }
          />

          {/* ✅ Vista general de bitácoras con tabs */}
          <Route
            path="/bitacora"
            element={
              <ProtectedRoute>
                <Bitacora />
              </ProtectedRoute>
            }
          />

          {/* ✅ Vistas detalladas (si quieres ir directo a cada una) */}
          <Route
            path="/bitacora/accesos"
            element={
              <ProtectedRoute>
                <BitacoraAccesos />
              </ProtectedRoute>
            }
          />

          <Route
            path="/bitacora/movimientos"
            element={
              <ProtectedRoute>
                <BitacoraMovimientos />
              </ProtectedRoute>
            }
          />

          <Route
            path="/bitacora/sistema"
            element={
              <ProtectedRoute>
                <BitacoraSistema />
              </ProtectedRoute>
            }
          />

          {/* ==== Fallback ==== */}
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>

      {/* 🔥 Modal de inactividad global */}
      <SessionExpiredModal
        visible={showExpireModal}
        secondsLeft={secondsLeft}
        onLogout={logout}
        onExtend={extendSession}
      />
    </>
  );
}
