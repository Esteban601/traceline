"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { fmtFecha } from "@/lib/fechas";
import {
  guardarComoPlantilla,
  crearReporteDesdePlantilla,
  type PlantillaState,
} from "./actions";

export type PlantillaFila = {
  id: string;
  nombre: string;
  descripcion: string | null;
  createdAt: string;
  solicitudes: number;
};
export type ReporteOpc = { id: string; nombre: string; ejercicio: number };
export type TenantOpc = { id: string; nombre: string };

function limpiar(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

const initial: PlantillaState = { ok: false, error: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:opacity-60";

export function PlantillasView({
  plantillas,
  reportes,
  tenants,
  tenantInicial = null,
}: {
  plantillas: PlantillaFila[];
  reportes: ReporteOpc[];
  tenants: TenantOpc[];
  /** Cliente preseleccionado (llega del alta como ?tenant=<id>). */
  tenantInicial?: string | null;
}) {
  return (
    <div className="space-y-10">
      <GuardarPlantilla reportes={reportes} />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink">
          Plantillas
          <span className="ml-2 text-sm font-normal text-muted">{plantillas.length}</span>
        </h2>

        {plantillas.length === 0 ? (
          <EmptyState
            glifo="▤"
            titulo="Aún no hay plantillas"
            descripcion="Guarda el set de solicitudes de un reporte para reutilizarlo en nuevos clientes."
          />
        ) : (
          <ul className="space-y-3">
            {plantillas.map((p) => (
              <PlantillaCard
                key={p.id}
                plantilla={p}
                tenants={tenants}
                tenantInicial={tenantInicial}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GuardarPlantilla({ reportes }: { reportes: ReporteOpc[] }) {
  const toast = useToast();
  const [abrir, setAbrir] = useState(false);
  const [state, dispatch, pending] = useActionState(guardarComoPlantilla, initial);
  const [reporteId, setReporteId] = useState(reportes.length === 1 ? reportes[0].id : "");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Plantilla creada.");
      setNombre("");
      setDescripcion("");
      setAbrir(false);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporteId) return toast.error("Selecciona el reporte de origen.");
    if (!nombre.trim()) return toast.error("Ponle nombre a la plantilla.");
    const fd = new FormData();
    fd.set("reporte_id", reporteId);
    fd.set("nombre", nombre);
    fd.set("descripcion", descripcion);
    startTransition(() => dispatch(fd));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Guardar como plantilla
        </h2>
        <Button size="sm" onClick={() => setAbrir((v) => !v)} disabled={reportes.length === 0}>
          {abrir ? "Cerrar" : "Guardar desde un reporte"}
        </Button>
      </div>

      {reportes.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface/60 px-4 py-4 text-sm text-muted">
          No hay reportes de los cuales guardar una plantilla.
        </p>
      ) : (
        abrir && (
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-card border border-line bg-surface p-6 shadow-soft"
          >
            <div>
              <label htmlFor="p-reporte" className={labelCls}>
                Reporte de origen
              </label>
              <select
                id="p-reporte"
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
            </div>
            <div>
              <label htmlFor="p-nombre" className={labelCls}>
                Nombre de la plantilla
              </label>
              <input
                id="p-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Checklist base NIIF S1/S2"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="p-desc" className={labelCls}>
                Descripción <span className="font-normal text-muted">· opcional</span>
              </label>
              <input
                id="p-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Para qué sirve esta plantilla…"
                className={inputCls}
              />
            </div>
            <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              Se copian título, descripción, área, tipo, unidad, el mapeo a
              datapoints y el rubro de taxonomía (lo que hace que el Excel oficial
              del cliente nuevo salga lleno). No se copian estados, responsables
              ni evidencia.
            </p>
            <div className="flex justify-end gap-2.5 border-t border-line pt-6">
              <button
                type="button"
                onClick={() => setAbrir(false)}
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
              >
                Cancelar
              </button>
              <Button type="submit" loading={pending}>
                Guardar plantilla
              </Button>
            </div>
          </form>
        )
      )}
    </section>
  );
}

function PlantillaCard({
  plantilla,
  tenants,
  tenantInicial,
}: {
  plantilla: PlantillaFila;
  tenants: TenantOpc[];
  tenantInicial: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [abrir, setAbrir] = useState(false);
  const [state, dispatch, pending] = useActionState(crearReporteDesdePlantilla, initial);
  const [tenantId, setTenantId] = useState(
    tenantInicial ?? (tenants.length === 1 ? tenants[0].id : "")
  );
  const [nombre, setNombre] = useState("");
  const [ejercicio, setEjercicio] = useState("");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Reporte creado.");
      setAbrir(false);
      setNombre("");
      setEjercicio("");
      if (state.reporteId) router.push("/admin");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return toast.error("Selecciona el cliente.");
    if (!nombre.trim()) return toast.error("Ponle nombre al reporte.");
    if (!/^\d{4}$/.test(ejercicio.trim())) return toast.error("Ejercicio: un año de 4 dígitos.");
    const fd = new FormData();
    fd.set("plantilla_id", plantilla.id);
    fd.set("tenant_id", tenantId);
    fd.set("nombre", nombre);
    fd.set("ejercicio", ejercicio);
    startTransition(() => dispatch(fd));
  };

  return (
    <li className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink">
            {limpiar(plantilla.nombre)}
          </h3>
          {plantilla.descripcion && (
            <p className="mt-1 max-w-2xl text-sm text-muted">{plantilla.descripcion}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="font-medium text-ink">
              {plantilla.solicitudes}{" "}
              {plantilla.solicitudes === 1 ? "solicitud" : "solicitudes"}
            </span>
            <span>Creada {fmtFecha(plantilla.createdAt)}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={abrir ? "secondary" : "primary"}
          onClick={() => setAbrir((v) => !v)}
          disabled={tenants.length === 0 || plantilla.solicitudes === 0}
        >
          {abrir ? "Cerrar" : "Crear reporte"}
        </Button>
      </div>

      {abrir && (
        <form
          onSubmit={onSubmit}
          className="mt-5 space-y-6 border-t border-line pt-5"
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label htmlFor={`t-${plantilla.id}`} className={labelCls}>
                Cliente
              </label>
              {tenants.length <= 1 ? (
                <p className="mt-1.5 rounded-xl border border-line bg-crema/30 px-3.5 py-3 text-sm text-ink">
                  {tenants[0] ? limpiar(tenants[0].nombre) : "Sin clientes"}
                </p>
              ) : (
                <select
                  id={`t-${plantilla.id}`}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {limpiar(t.nombre)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label htmlFor={`n-${plantilla.id}`} className={labelCls}>
                Nombre del reporte
              </label>
              <input
                id={`n-${plantilla.id}`}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Informe Anual Sustentable"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor={`e-${plantilla.id}`} className={labelCls}>
                Ejercicio
              </label>
              <input
                id={`e-${plantilla.id}`}
                type="number"
                min={2000}
                max={2100}
                value={ejercicio}
                onChange={(e) => setEjercicio(e.target.value)}
                required
                placeholder="2025"
                className={inputCls}
              />
            </div>
          </div>
          <p className="rounded-xl border border-dashed border-line bg-crema/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            Se clonan las {plantilla.solicitudes} solicitudes en estado{" "}
            <span className="font-medium">Pendiente</span>, sin responsables (se
            asignan después).
          </p>
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              Crear reporte desde plantilla
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
