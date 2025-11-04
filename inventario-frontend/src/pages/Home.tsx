import Navbar from "../components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col justify-center items-center text-center p-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">
          Bienvenido al Sistema de Inventario
        </h2>
        <p className="text-slate-600 max-w-lg">
          Administra tus productos, proveedores y movimientos con facilidad.
          Inicia sesión o regístrate para comenzar.
        </p>
      </div>
    </div>
  );
}
