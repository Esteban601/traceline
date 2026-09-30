"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

/**
 * Filtros de la línea de tiempo: emisora, auditor y rango de fechas.
 *
 * Van por query string y no por estado local a propósito: así un filtro puesto
 * se puede pegar en un correo, el botón de atrás funciona, y el enlace de
 * "Exportar CSV" hereda exactamente lo que se está viendo sin duplicar la
 * lógica. Es el mismo patrón que ya usan el selector de emisora y el de reporte.
 */
export function FiltrosAuditoria({
  tenants,
  auditores,
  valores,
}: {
  tenants: { id: string; nombre: string }[];
  auditores: { id: string; nombre: string; tenantId: string }[];
  valores: { tenant: string; auditor: string; desde: string; hasta: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Elegida una emisora, la lista de auditores se acota a los suyos: ofrecer
  // auditores de otra emisora produciría combinaciones que siempre dan vacío.
  const auditoresVisibles = useMemo(
    () => (valores.tenant ? auditores.filter((a) => a.tenantId === valores.tenant) : auditores),
    [auditores, valores.tenant]
  );

  function mover(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    // Cambiar de emisora invalida el auditor elegido, que puede no ser suyo.
    if (clave === "tenant") p.delete("auditor");
    router.push(`/admin/auditoria${p.size ? `?${p}` : ""}`);
  }

  const campo =
    "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Emisora</span>
        <select
          className={campo}
          value={valores.tenant}
          onChange={(e) => mover("tenant", e.target.value)}
        >
          <option value="">Todas</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Auditor</span>
        <select
          className={campo}
          value={valores.auditor}
          onChange={(e) => mover("auditor", e.target.value)}
        >
          <option value="">Todos</option>
          {auditoresVisibles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Desde</span>
        <input
          type="date"
          className={campo}
          value={valores.desde}
          onChange={(e) => mover("desde", e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Hasta</span>
        <input
          type="date"
          className={campo}
          value={valores.hasta}
          onChange={(e) => mover("hasta", e.target.value)}
        />
      </label>

      {(valores.tenant || valores.auditor || valores.desde || valores.hasta) && (
        <button
          type="button"
          onClick={() => router.push("/admin/auditoria")}
          className="h-9 rounded-lg px-3 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
