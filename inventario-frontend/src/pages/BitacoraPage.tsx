// src/pages/BitacoraPage.tsx
import React, { useEffect, useState } from "react";
import {
  fetchBitacoraAccesos,
  fetchBitacoraMovimientos,
  fetchBitacoraSistema,
} from "../api/bitacora";
import type {
  BitacoraAcceso,
  BitacoraMovimiento,
  BitacoraSistema,
} from "../api/bitacora";

type TabId = "accesos" | "movimientos" | "sistema";

const BitacoraPage: React.FC = () => {
  const [tab, setTab] = useState<TabId>("accesos");

  // estado compartido de filtros básicos
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // filtros simples de ejemplo
  const [userId, setUserId] = useState<string>("");
  const [tipoMov, setTipoMov] = useState<"" | "entrada" | "salida">("");

  // data
  const [accData, setAccData] = useState<{
    total: number;
    rows: BitacoraAcceso[];
  }>({ total: 0, rows: [] });

  const [movData, setMovData] = useState<{
    total: number;
    rows: BitacoraMovimiento[];
  }>({ total: 0, rows: [] });

  const [sisData, setSisData] = useState<{
    total: number;
    rows: BitacoraSistema[];
  }>({ total: 0, rows: [] });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // carga según la pestaña
  async function load() {
    try {
      setLoading(true);
      setErrorMsg(null);

      if (tab === "accesos") {
        const data = await fetchBitacoraAccesos({
          page,
          pageSize,
          userId: userId ? Number(userId) : undefined,
        });
        setAccData({ total: data.total, rows: data.rows });
      } else if (tab === "movimientos") {
        const data = await fetchBitacoraMovimientos({
          page,
          pageSize,
          usuarioId: userId ? Number(userId) : undefined,
          tipo: tipoMov || undefined,
        });
        setMovData({ total: data.total, rows: data.rows });
      } else {
        const data = await fetchBitacoraSistema({
          page,
          pageSize,
          usuarioId: userId ? Number(userId) : undefined,
        });
        setSisData({ total: data.total, rows: data.rows });
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e?.response?.data?.mensaje ||
          "Ocurrió un error al cargar la bitácora."
      );
    } finally {
      setLoading(false);
    }
  }

  // recargar cuando cambie pestaña o paginación/filtros básicos
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, pageSize, userId, tipoMov]);

  // reset de página al cambiar filtros
  function handleSearch() {
    setPage(1);
    load();
  }

  const total =
    tab === "accesos"
      ? accData.total
      : tab === "movimientos"
      ? movData.total
      : sisData.total;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bitacora-page">
      <h1>Bitácoras</h1>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={tab === "accesos" ? "active" : ""}
          onClick={() => setTab("accesos")}
        >
          Accesos
        </button>
        <button
          className={tab === "movimientos" ? "active" : ""}
          onClick={() => setTab("movimientos")}
        >
          Movimientos
        </button>
        <button
          className={tab === "sistema" ? "active" : ""}
          onClick={() => setTab("sistema")}
        >
          Cambios de sistema
        </button>
      </div>

      {/* Filtros básicos */}
      <div className="filters">
        <label>
          Usuario (ID):
          <input
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="ej. 1"
          />
        </label>

        {tab === "movimientos" && (
          <label>
            Tipo:
            <select
              value={tipoMov}
              onChange={(e) => setTipoMov(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </label>
        )}

        <button onClick={handleSearch} disabled={loading}>
          Buscar
        </button>
      </div>

      {loading && <p>Cargando...</p>}
      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

      {/* Tabla según pestaña */}
      {tab === "accesos" && <TablaAccesos rows={accData.rows} />}
      {tab === "movimientos" && <TablaMovimientos rows={movData.rows} />}
      {tab === "sistema" && <TablaSistema rows={sisData.rows} />}

      {/* Paginación simple */}
      <div className="pagination">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ◀
        </button>
        <span>
          Página {page} de {totalPages} (total: {total})
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() =>
            setPage((p) => (p >= totalPages ? totalPages : p + 1))
          }
        >
          ▶
        </button>
      </div>
    </div>
  );
};

/* ================================
   Tablas
   ================================ */

const TablaAccesos: React.FC<{ rows: BitacoraAcceso[] }> = ({ rows }) => (
  <table className="table">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Usuario ID</th>
        <th>Método</th>
        <th>Éxito</th>
        <th>IP</th>
        <th>User Agent</th>
        <th>Detalle</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && (
        <tr>
          <td colSpan={7}>Sin registros</td>
        </tr>
      )}
      {rows.map((r) => (
        <tr key={r.id}>
          <td>{new Date(r.fecha).toLocaleString()}</td>
          <td>{r.user_id ?? "-"}</td>
          <td>{r.metodo}</td>
          <td style={{ color: r.exito ? "green" : "red" }}>
            {r.exito ? "✔" : "✖"}
          </td>
          <td>{r.ip ?? "-"}</td>
          <td>{r.user_agent?.slice(0, 40) ?? "-"}</td>
          <td>{r.detalle ?? "-"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TablaMovimientos: React.FC<{ rows: BitacoraMovimiento[] }> = ({
  rows,
}) => (
  <table className="table">
    <thead>
      <tr>
        <th>Fecha mov.</th>
        <th>Usuario ID</th>
        <th>Tipo</th>
        <th>Producto ID</th>
        <th>Cantidad</th>
        <th>Documento</th>
        <th>Responsable</th>
        <th>Proveedor</th>
        <th>Almacén</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && (
        <tr>
          <td colSpan={9}>Sin registros</td>
        </tr>
      )}
      {rows.map((r) => (
        <tr key={r.id}>
          <td>{new Date(r.fecha_mov).toLocaleString()}</td>
          <td>{r.usuario_id ?? "-"}</td>
          <td>{r.tipo}</td>
          <td>{r.producto_id}</td>
          <td>{r.cantidad}</td>
          <td>{r.documento ?? "-"}</td>
          <td>{r.responsable ?? "-"}</td>
          <td>{r.proveedor_id ?? "-"}</td>
          <td>{r.almacen_id ?? "-"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TablaSistema: React.FC<{ rows: BitacoraSistema[] }> = ({ rows }) => (
  <table className="table">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Usuario ID</th>
        <th>Tabla</th>
        <th>Registro ID</th>
        <th>Operación</th>
        <th>IP</th>
        <th>User Agent</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && (
        <tr>
          <td colSpan={7}>Sin registros</td>
        </tr>
      )}
      {rows.map((r) => (
        <tr key={r.id}>
          <td>{new Date(r.fecha).toLocaleString()}</td>
          <td>{r.usuario_id ?? "-"}</td>
          <td>{r.tabla}</td>
          <td>{r.registro_id ?? "-"}</td>
          <td>{r.operacion}</td>
          <td>{r.ip ?? "-"}</td>
          <td>{r.user_agent?.slice(0, 40) ?? "-"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default BitacoraPage;
