import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

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
import Inicio from "./pages/Inicio";        // Página principal tras login
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import Movimientos from "./pages/Movimientos";
import Productos from "./pages/Productos";  // ✅ Nueva página de productos
import Categorias from "./pages/Categorias"; // ✅ Nueva página de categorías

export default function App() {
  return (
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

        {/* ✅ Nueva ruta protegida: Productos */}
        <Route
          path="/productos"
          element={
            <ProtectedRoute>
              <Productos />
            </ProtectedRoute>
          }
        />

        {/* ✅ Nueva ruta protegida: Categorías */}
        <Route
          path="/categorias"
          element={
            <ProtectedRoute>
              <Categorias />
            </ProtectedRoute>
          }
        />

        {/* ==== Fallback ==== */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
