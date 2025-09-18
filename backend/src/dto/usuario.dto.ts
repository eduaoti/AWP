export const toUsuarioPublic = (row: any) => ({
  id: row.id,
  nombre: row.nombre,
  email: row.email,
  rol: row.rol,
  creado_en: row.creado_en,
});
