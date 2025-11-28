import React, { useEffect, useState } from "react";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from "../api/usuarios";
import type { Usuario } from "../api/usuarios";

import Button from "../components/Button";
import TextField from "../components/TextField";
import Alert from "../components/Alert";
import PrivateNavbar from "../components/PrivateNavbar"; // ✅ Navbar protegida real
import { useAuth } from "../context/AuthContext"; // ✅ Para mostrar el nombre del usuario logueado

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Usuario["rol"]>("lector");
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Estado de errores
  const [errores, setErrores] = useState<any>({
    nombre: "",
    email: "",
    password: "",
  });

  // 👤 Usuario actual desde contexto
  const { user } = useAuth();

  const nombreRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  async function cargar() {
    try {
      const { data } = await listarUsuarios();
      setUsuarios(data.data);
    } catch (e: any) {
      setErr(e?.data?.mensaje || "Error al cargar usuarios");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // Validación de los campos (en tiempo real)
  const validarCampos = () => {
    const newErrores: any = {};

    // Validación nombre
    if (nombre.trim().length === 0) {
      newErrores.nombre = "¡El nombre es obligatorio!";
    } else if (nombre.trim().length < 3) {
      newErrores.nombre = "¡El nombre debe tener al menos 3 caracteres!";
    } else if (!nombreRegex.test(nombre)) {
      newErrores.nombre = "¡El nombre solo puede contener letras y espacios!";
    }

    // Validación email
    if (email.trim().length === 0) {
      newErrores.email = "¡El correo electrónico es obligatorio!";
    } else if (!emailRegex.test(email)) {
      newErrores.email = "¡El correo electrónico no es válido!";
    }

    // Validación contraseña (solo cuando se está creando un nuevo usuario)
    if (!editId && password.trim().length === 0) {
      newErrores.password = "¡La contraseña es obligatoria!";
    } else if (!editId && password.trim().length < 8) {
      newErrores.password = "¡La contraseña debe tener al menos 8 caracteres!";
    } else if (!editId && !passwordRegex.test(password)) {
      newErrores.password =
        "¡La contraseña debe tener al menos una mayúscula, un número y un carácter especial!";
    }

    setErrores(newErrores); // Actualizar errores en tiempo real
    return newErrores;
  };

  // Función para manejar los cambios de los campos
  const handleChange = (field: string, value: string) => {
    if (field === "nombre") setNombre(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);

    // Validar en tiempo real al cambiar el valor de los campos
    validarCampos();
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const validaciones = validarCampos();

    // Si hay errores, no enviar el formulario
    if (Object.keys(validaciones).length > 0) {
      return;
    }

    try {
      if (editId) {
        await actualizarUsuario(editId, nombre, email, rol);
        setMsg("Usuario actualizado correctamente ✅");
      } else {
        await crearUsuario(nombre, email, password, rol);
        setMsg("Usuario creado correctamente 🎉");
      }

      setNombre("");
      setEmail("");
      setPassword("");
      setRol("lector");
      setEditId(null);
      cargar();
    } catch (e: any) {
      setErr(e?.data?.mensaje || "Error al guardar usuario");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
      await eliminarUsuario(id);
      setMsg("Usuario eliminado 🗑️");
      cargar();
    } catch (e: any) {
      setErr(e?.data?.mensaje || "Error al eliminar usuario");
    }
  }

  function onEdit(u: Usuario) {
    setEditId(u.id);
    setNombre(u.nombre);
    setEmail(u.email);
    setRol(u.rol);
    setPassword(""); // Limpiar la contraseña al editar
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 🔹 Navbar protegida */}
      <PrivateNavbar />

      {/* 🔹 Contenido principal */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">
          Gestión de Usuarios
        </h1>

        {/* 👤 Info del usuario actual */}
        {user && (
          <p className="text-sm text-slate-600 mb-4">
            Sesión iniciada como{" "}
            <span className="font-semibold">{user.nombre}</span>{" "}
            (<span className="italic">{user.rol}</span>)
          </p>
        )}

        {/* Mensajes */}
        {msg && (
          <div className="mb-3">
            <Alert kind="success">{msg}</Alert>
          </div>
        )}
        {err && (
          <div className="mb-3">
            <Alert>{err}</Alert>
          </div>
        )}

        {/* Formulario de creación / edición */}
        <form
          onSubmit={onSubmit}
          className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-xl shadow-sm border"
        >
          <div className="flex flex-col">
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              required
              error={errores.nombre}
              className={`p-2 border ${errores.nombre ? "border-red-400" : "border-slate-300"}`}
            />
            {errores.nombre && (
              <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>
            )}
          </div>

          <div className="flex flex-col">
            <TextField
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
              error={errores.email}
              className={`p-2 border ${errores.email ? "border-red-400" : "border-slate-300"}`}
            />
            {errores.email && (
              <p className="text-xs text-red-600 mt-1">{errores.email}</p>
            )}
          </div>

          {!editId && (
            <div className="flex flex-col">
              <TextField
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
                error={errores.password}
                className={`p-2 border ${errores.password ? "border-red-400" : "border-slate-300"}`}
              />
              {errores.password && (
                <p className="text-xs text-red-600 mt-1">{errores.password}</p>
              )}
            </div>
          )}

          <div className="col-span-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                Rol
              </span>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as Usuario["rol"])}
                className="w-full p-2 border rounded-lg"
              >
                <option value="admin">Administrador</option>
                <option value="editor">Editor</option>
                <option value="lector">Lector</option>
                <option value="jefe_inventario">Jefe de inventario</option>
              </select>
            </label>
          </div>

          <div className="col-span-3 flex gap-4 justify-end mt-4">
            <Button
              className="bg-indigo-600 text-white px-6 py-2"
              disabled={Object.keys(errores).length > 0}
            >
              {editId ? "Actualizar" : "Registrar"}
            </Button>
            {editId && (
              <Button
                type="button"
                className="bg-slate-500 text-white px-6 py-2"
                onClick={() => {
                  setEditId(null);
                  setNombre("");
                  setEmail("");
                  setPassword("");
                  setRol("lector");
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>

        {/* Tabla de usuarios */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 font-medium">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Nombre</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Rol</th>
                <th className="p-2 border">Creado en</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  className="text-center hover:bg-slate-50 transition"
                >
                  <td className="border p-2">{u.id}</td>
                  <td className="border p-2">{u.nombre}</td>
                  <td className="border p-2">{u.email}</td>
                  <td className="border p-2 capitalize">{u.rol}</td>
                  <td className="border p-2">
                    {new Date(u.creado_en).toLocaleDateString()}
                  </td>
                  <td className="border p-2 space-x-2">
                    <Button
                      className="bg-amber-500 text-white px-3 py-1"
                      type="button"
                      onClick={() => onEdit(u)}
                    >
                      Editar
                    </Button>
                    <Button
                      className="bg-red-600 text-white px-3 py-1"
                      type="button"
                      onClick={() => onDelete(u.id)}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center p-4 text-slate-500 italic"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
