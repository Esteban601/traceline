"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DatapointSelector, type DatapointOpcion } from "./datapoint-selector";
import type { GestionState } from "./gestion-actions";

const initial: GestionState = { ok: false, error: null, mensaje: null, solicitudId: null };

export type ReporteOpcion = {
  id: string;
  nombre: string;
  ejercicio: number;
  tenant_id: string;
};
export type UsuarioOpcion = {
  id: string;
  nombre: string;
  tenant_id: string | null;
  area: string | null;
};
export type StaffOpcion = { id: string; nombre: string };

export type ValoresIniciales = {
  solicitudId: string;
  reporteId: string;
  titulo: string;
  descripcion: string;
  area_asignada: string;
  es_cuantitativa: boolean;
  unidad_esperada: string;
  fecha_limite: string;
  responsable_cliente_id: string;
  responsable_irstrat_id: string;
  orden: string;
  datapointIds: string[];
};

function limpiar(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";
const areaCls =
  "mt-1.5 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60";

export function SolicitudForm({
  modo,
  action,
  reportes,
  usuariosCliente,
  staff,
  areas,
  datapoints,
  inicial,
  enunciadoBloqueado = false,
}: {
  modo: "crear" | "editar";
  action: (prev: GestionState, fd: FormData) => Promise<GestionState>;
  reportes: ReporteOpcion[];
  usuariosCliente: UsuarioOpcion[];
  staff: StaffOpcion[];
  areas: { tenant_id: string; area: string }[];
  datapoints: DatapointOpcion[];
  inicial?: ValoresIniciales;
  enunciadoBloqueado?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(action, initial);

  const [reporteId, setReporteId] = useState(
    inicial?.reporteId ?? (reportes.length === 1 ? reportes[0].id : "")
  );
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [area, setArea] = useState(inicial?.area_asignada ?? "");
  const [esCuant, setEsCuant] = useState(inicial?.es_cuantitativa ?? false);
  const [unidad, setUnidad] = useState(inicial?.unidad_esperada ?? "");
  const [fechaLimite, setFechaLimite] = useState(inicial?.fecha_limite ?? "");
  const [respCliente, setRespCliente] = useState(inicial?.responsable_cliente_id ?? "");
  const [respIrstrat, setRespIrstrat] = useState(inicial?.responsable_irstrat_id ?? "");
  const [orden, setOrden] = useState(inicial?.orden ?? "");
  const [datapointIds, setDatapointIds] = useState<string[]>(inicial?.datapointIds ?? []);

  const reporte = useMemo(
    () => reportes.find((r) => r.id === reporteId) ?? null,
    [reportes, reporteId]
  );
  const tenantId = reporte?.tenant_id ?? null;

  // Responsables y áreas se acotan al tenant del reporte seleccionado.
  const responsablesCliente = useMemo(
    () => usuariosCliente.filter((u) => u.tenant_id === tenantId),
    [usuariosCliente, tenantId]
  );
  const areasTenant = useMemo(() => {
    const set = new Set<string>();
    for (const a of areas) if (a.tenant_id === tenantId && a.area) set.add(a.area);
    for (const u of responsablesCliente) if (u.area) set.add(u.area);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [areas, tenantId, responsablesCliente]);

  // Si cambia el tenant y el responsable cliente ya no pertenece, se limpia.
  useEffect(() => {
    if (respCliente && !responsablesCliente.some((u) => u.id === respCliente)) {
      setRespCliente("");
    }
  }, [responsablesCliente, respCliente]);

  useEffect(() => {
    if (state.ok) {
      if (state.mensaje) toast.success(state.mensaje);
      const destino = state.solicitudId
        ? `/admin/solicitudes/${state.solicitudId}`
        : "/admin";
      router.push(destino);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporteId) {
      toast.error("Selecciona el reporte.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    const fd = new FormData();
    if (modo === "editar" && inicial) fd.set("solicitud_id", inicial.solicitudId);
    fd.set("reporte_id", reporteId);
    fd.set("titulo", titulo);
    fd.set("descripcion", descripcion);
    fd.set("area_asignada", area);
    if (esCuant) fd.set("es_cuantitativa", "on");
    fd.set("unidad_esperada", unidad);
    fd.set("fecha_limite", fechaLimite);
    fd.set("responsable_cliente_id", respCliente);
    fd.set("responsable_irstrat_id", respIrstrat);
    fd.set("orden", orden);
    for (const id of datapointIds) fd.append("datapoint_ids", id);
    startTransition(() => dispatch(fd));
  };

  const cancelar = inicial ? `/admin/solicitudes/${inicial.solicitudId}` : "/admin";

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Reporte */}
      <div>
        <label htmlFor="reporte_id" className={labelCls}>
          Reporte
        </label>
        {modo === "editar" || reportes.length <= 1 ? (
          <p className="mt-1.5 rounded-xl border border-line bg-crema/30 px-3.5 py-3 text-sm text-ink">
            {reporte
              ? `${limpiar(reporte.nombre)} · ${reporte.ejercicio}`
              : "Sin reportes disponibles"}
          </p>
        ) : (
          <select
            id="reporte_id"
            value={reporteId}
            onChange={(e) => setReporteId(e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Selecciona un reporte…
            </option>
            {reportes.map((r) => (
              <option key={r.id} value={r.id}>
                {limpiar(r.nombre)} · {r.ejercicio}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Título */}
      <div>
        <label htmlFor="titulo" className={labelCls}>
          Título{" "}
          {enunciadoBloqueado && (
            <span className="font-normal text-muted">· bloqueado (tiene evidencia)</span>
          )}
        </label>
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={enunciadoBloqueado}
          required
          placeholder="Enunciado en lenguaje cliente…"
          className={inputCls}
        />
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="descripcion" className={labelCls}>
          Descripción{" "}
          {enunciadoBloqueado && (
            <span className="font-normal text-muted">· bloqueada (tiene evidencia)</span>
          )}
        </label>
        <textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={enunciadoBloqueado}
          rows={3}
          placeholder="Detalle de lo que se solicita…"
          className={areaCls}
        />
      </div>

      {enunciadoBloqueado && (
        <p className="-mt-4 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          El título y la descripción no pueden cambiar: el cliente ya respondió a
          este enunciado con evidencia. El resto de los campos sí es editable.
        </p>
      )}

      {/* Área + orden */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="area_asignada" className={labelCls}>
            Área asignada
          </label>
          <input
            id="area_asignada"
            list="areas-tenant"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="RH, Operaciones, Finanzas…"
            className={inputCls}
          />
          <datalist id="areas-tenant">
            {areasTenant.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="orden" className={labelCls}>
            Orden{" "}
            <span className="font-normal text-muted">· opcional</span>
          </label>
          <input
            id="orden"
            type="number"
            min={0}
            step={10}
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            placeholder="Auto (al final)"
            className={inputCls}
          />
        </div>
      </div>

      {/* Cuantitativa + unidad */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Tipo</span>
          <label className="mt-1.5 flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-crema/40 px-3.5">
            <input
              type="checkbox"
              checked={esCuant}
              onChange={(e) => setEsCuant(e.target.checked)}
              className="size-4 accent-teal"
            />
            <span className="text-sm text-ink">Es cuantitativa (espera un valor)</span>
          </label>
        </div>
        <div>
          <label htmlFor="unidad_esperada" className={labelCls}>
            Unidad esperada
          </label>
          <input
            id="unidad_esperada"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            disabled={!esCuant}
            placeholder={esCuant ? "kWh, tCO2e, %…" : "Solo si es cuantitativa"}
            className={inputCls}
          />
        </div>
      </div>

      {/* Fecha límite */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha_limite" className={labelCls}>
            Fecha límite
          </label>
          <input
            id="fecha_limite"
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Responsables */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="responsable_cliente_id" className={labelCls}>
            Responsable cliente
          </label>
          <select
            id="responsable_cliente_id"
            value={respCliente}
            onChange={(e) => setRespCliente(e.target.value)}
            className={inputCls}
          >
            <option value="">Sin asignar</option>
            {responsablesCliente.map((u) => (
              <option key={u.id} value={u.id}>
                {limpiar(u.nombre)}
                {u.area ? ` · ${u.area}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="responsable_irstrat_id" className={labelCls}>
            Responsable IRStrat
          </label>
          <select
            id="responsable_irstrat_id"
            value={respIrstrat}
            onChange={(e) => setRespIrstrat(e.target.value)}
            className={inputCls}
          >
            <option value="">Sin asignar</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {limpiar(s.nombre)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Datapoints */}
      <div>
        <span className={labelCls}>Mapeo a datapoints (NIIF S1/S2)</span>
        <p className="mb-2 mt-0.5 text-xs text-muted">
          Interno de IRStrat. Busca por código o descripción y liga los datapoints
          que alimenta esta solicitud.
        </p>
        <DatapointSelector
          todos={datapoints}
          seleccionados={datapointIds}
          onChange={setDatapointIds}
        />
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2.5 border-t border-line pt-6">
        <Link
          href={cancelar}
          className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </Link>
        <Button type="submit" loading={pending}>
          {modo === "crear" ? "Crear solicitud" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
