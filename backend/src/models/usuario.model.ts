// src/models/usuario.model.ts
import { pool } from "../db";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
  creado_en: Date;
}

export const UsuarioModel = {
  async create(nombre: string, email: string, password: string, rol: string) {
    const sql = `
      INSERT INTO usuarios (nombre, email, password, rol)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nombre, email, rol, creado_en
    `;
    const { rows } = await pool.query(sql, [nombre, email, password, rol]);
    return rows[0];
  },

  async findAll() {
    const sql = `SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY id DESC`;
    const { rows } = await pool.query(sql);
    return rows;
  },

  async findById(id: number) {
    const sql = `SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id=$1`;
    const { rows } = await pool.query(sql, [id]);
    return rows[0];
  },

  async findByEmail(email: string) {
    const sql = `SELECT id, nombre, email, rol, password, creado_en FROM usuarios WHERE email=$1`;
    const { rows } = await pool.query(sql, [email]);
    return rows[0];
  },

  async update(id: number, nombre: string, email: string, rol: string) {
    const sql = `
      UPDATE usuarios
      SET nombre=$1, email=$2, rol=$3
      WHERE id=$4
      RETURNING id, nombre, email, rol, creado_en
    `;
    const { rows } = await pool.query(sql, [nombre, email, rol, id]);
    return rows[0];
  },

  async remove(id: number) {
    const sql = `DELETE FROM usuarios WHERE id=$1 RETURNING id`;
    const { rows } = await pool.query(sql, [id]);
    return rows[0];
  },

  async setOtpSecret(userId: number, secretBase32: string) {
    const sql = `
      UPDATE usuarios
      SET otp_secret=$1, otp_enabled=true
      WHERE id=$2
      RETURNING id, email, nombre, rol, creado_en
    `;
    const { rows } = await pool.query(sql, [secretBase32, userId]);
    return rows[0];
  },

  async getOtpInfoById(id: number) {
    const sql = `SELECT id, email, otp_enabled, otp_secret FROM usuarios WHERE id=$1`;
    const { rows } = await pool.query(sql, [id]);
    return rows[0];
  },

  async getOtpInfoByEmail(email: string) {
    const sql = `SELECT id, email, otp_enabled, otp_secret FROM usuarios WHERE email=$1`;
    const { rows } = await pool.query(sql, [email]);
    return rows[0];
  },

  /** 📬 Email del jefe de inventario (si existe) */
  async findInventoryChiefEmail(): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT email FROM usuarios WHERE rol = 'jefe_inventario' ORDER BY id ASC LIMIT 1`
    );
    return rows[0]?.email ?? null;
  },
};
