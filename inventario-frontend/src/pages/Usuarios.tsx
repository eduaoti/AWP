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

  const { user } = useAuth(); // 👤 Usuario actual desde contexto (ya no se pasa como prop)

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

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
    setPassword("");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 🔹 Navbar protegida (ya no recibe props) */}
      <PrivateNavbar />

      {/* 🔹 Contenido principal */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">
          Gestión de Usuarios
        </h1>

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
          className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border"
        >
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <TextField
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {!editId && (
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">
              Rol
            </span>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Usuario["rol"])}
              className="w-full rounded-lg border px-3 py-2 border-slate-300"
            >
              <option value="admin">Administrador</option>
              <option value="editor">Editor</option>
              <option value="lector">Lector</option>
              <option value="jefe_inventario">Jefe de inventario</option>
            </select>
          </label>

          <div className="md:col-span-2 lg:col-span-3 flex gap-2 mt-2">
            <Button className="bg-indigo-600 text-white px-6">
              {editId ? "Actualizar" : "Registrar"}
            </Button>
            {editId && (
              <Button
                type="button"
                className="bg-slate-500 text-white"
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
