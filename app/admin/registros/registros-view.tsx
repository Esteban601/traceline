"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import type { Tono } from "@/lib/estados";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { fmtFecha } from "@/lib/fechas";
import {
  crearRegistro,
  editarRegistro,
  cambiarActivoRegistro,
  capturarValores,
  type RegistroState,
  type ValorState,
} from "./actions";

export type ValorFila = {
  ejercicio: number;
  cantidad: number | null;
  pct: number | null;
  capital: number | null;
  notas: string | null;
  fecha: string;
  capturadoPor: string | null;
};
export type RegistroFila = {
  id: string;
  reporteId: string;
  tipo: string;
  nombre: string;
  descripcion: string | null;
  horizonte: string | null;
  orden: number;
  activo: boolean;
  valores: ValorFila[]; // historial desc por fecha
};
export type ReporteOpcion = { id: string; nombre: string; ejercicio: number };

const TIPOS: { key: string; label: string; tono: Tono }[] = [
  { key: "riesgo_fisico", label: "Riesgos físicos", tono: "azul" },
  { key: "riesgo_transicion", label: "Riesgos de transición", tono: "ambar" },
  { key: "oportunidad", label: "Oportunidades", tono: "verde" },
];
const TONO_DE = new Map(TIPOS.map((t) => [t.key, t.tono]));
const LABEL_DE = new Map(TIPOS.map((t) => [t.key, t.label]));
const EJERCICIOS = [2025, 2024];

const nf = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
function limpiar(n: string): string {
  return n.replace(/\[DEMO\]\s*/i, "").trim();
}

const initialReg: RegistroState = { ok: false, error: null, mensaje: null, registroId: null };
const initialVal: ValorState = { ok: false, error: null, mensaje: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:opacity-60";
const areaCls =
  "mt-1.5 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

export function RegistrosView({
  registros,
  reportes,
}: {
  registros: RegistroFila[];
  reportes: ReporteOpcion[];
}) {
  const [abrirAlta, setAbrirAlta] = useState(false);

  const grupos = TIPOS.map((t) => ({
    ...t,
    filas: registros.filter((r) => r.tipo === t.key),
  }));

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            Registros
            <span className="ml-2 text-sm font-normal text-muted">{registros.length}</span>
          </h2>
          <Button size="sm" onClick={() => setAbrirAlta((v) => !v)} disabled={reportes.length === 0}>
            {abrirAlta ? "Cerrar" : "Nuevo registro"}
          </Button>
        </div>

        {reportes.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface/60 px-4 py-4 text-sm text-muted">
            No hay reportes activos donde registrar riesgos u oportunidades.
          </p>
        ) : (
          abrirAlta && (
            <CrearRegistroForm reportes={reportes} onDone={() => setAbrirAlta(false)} />
          )
        )}
      </section>

      {registros.length === 0 ? (
        <EmptyState
          glifo="△"
          titulo="Aún no hay registros de clima"
          descripcion="Da de alta el primer riesgo u oportunidad con “Nuevo registro”."
        />
      ) : (
        <div className="space-y-8">
          {grupos.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <Chip tono={g.tono}>{g.label}</Chip>
                <span className="text-xs text-muted">{g.filas.length}</span>
              </div>
              {g.filas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-crema/20 px-3.5 py-3 text-sm text-muted">
                  Sin registros de este tipo.
                </p>
              ) : (
                <ul className="space-y-3">
                  {g.filas.map((r) => (
                    <RegistroCard key={r.id} registro={r} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Alta
// -----------------------------------------------------------------------------
function CrearRegistroForm({
  reportes,
  onDone,
}: {
  reportes: ReporteOpcion[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(crearRegistro, initialReg);
  const [reporteId, setReporteId] = useState(reportes.length === 1 ? reportes[0].id : "");
  const [tipo, setTipo] = useState("riesgo_fisico");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [horizonte, setHorizonte] = useState("");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Registro creado.");
      setNombre("");
      setDescripcion("");
      setHorizonte("");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporteId) return toast.error("Selecciona el reporte.");
    if (!nombre.trim()) return toast.error("El nombre es obligatorio.");
    const fd = new FormData();
    fd.set("reporte_id", reporteId);
    fd.set("tipo", tipo);
    fd.set("nombre", nombre);
    fd.set("descripcion", descripcion);
    fd.set("horizonte_temporal", horizonte);
    startTransition(() => dispatch(fd));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-card border border-line bg-surface p-6 shadow-soft"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="r-tipo" className={labelCls}>
            Tipo
          </label>
          <select
            id="r-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={inputCls}
          >
            {TIPOS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label.replace(/s$/, "")}
              </option>
            ))}
          </select>
        </div>
        {reportes.length > 1 && (
          <div>
            <label htmlFor="r-reporte" className={labelCls}>
              Reporte
            </label>
            <select
              id="r-reporte"
              value={reporteId}
              onChange={(e) => setReporteId(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {reportes.map((r) => (
                <option key={r.id} value={r.id}>
                  {limpiar(r.nombre)} · {r.ejercicio}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="r-nombre" className={labelCls}>
          Nombre
        </label>
        <input
          id="r-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Nombre del riesgo o la oportunidad"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="r-desc" className={labelCls}>
          Descripción <span className="font-normal text-muted">· opcional</span>
        </label>
        <textarea
          id="r-desc"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          placeholder="Detalle del riesgo u oportunidad…"
          className={areaCls}
        />
      </div>
      <div>
        <label htmlFor="r-horizonte" className={labelCls}>
          Horizonte temporal <span className="font-normal text-muted">· opcional</span>
        </label>
        <input
          id="r-horizonte"
          value={horizonte}
          onChange={(e) => setHorizonte(e.target.value)}
          placeholder="Corto / Mediano / Largo plazo"
          className={inputCls}
        />
      </div>
      <div className="flex justify-end gap-2.5 border-t border-line pt-6">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </button>
        <Button type="submit" loading={pending}>
          Crear registro
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Tarjeta de registro
// -----------------------------------------------------------------------------
function RegistroCard({ registro }: { registro: RegistroFila }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [pendingActivo, startActivo] = useTransition();

  const aplicarActivo = (activar: boolean) => {
    startActivo(async () => {
      const r = await cambiarActivoRegistro(registro.id, activar);
      setConfirmar(false);
      if (r.ok) toast.success(r.mensaje ?? "Listo.");
      else toast.error(r.error ?? "No se pudo actualizar.");
    });
  };

  const vigentePorAnio = new Map<number, ValorFila>();
  for (const v of registro.valores) if (!vigentePorAnio.has(v.ejercicio)) vigentePorAnio.set(v.ejercicio, v);

  return (
    <li
      className={cn(
        "rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6",
        !registro.activo && "bg-ink/[0.015]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "font-display text-base font-semibold",
                registro.activo ? "text-ink" : "text-muted"
              )}
            >
              {limpiar(registro.nombre)}
            </h3>
            {!registro.activo && <Chip tono="gris">Inactivo</Chip>}
          </div>
          {registro.descripcion && (
            <p className="mt-1 max-w-2xl text-sm text-muted">{registro.descripcion}</p>
          )}
          {registro.horizonte && (
            <p className="mt-1 text-xs text-muted">Horizonte: {registro.horizonte}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5"
          >
            {editando ? "Cerrar" : "Editar"}
          </button>
          {registro.activo ? (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              disabled={pendingActivo}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-rojo transition duration-150 hover:bg-rojo/5 disabled:opacity-50"
            >
              Desactivar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => aplicarActivo(true)}
              disabled={pendingActivo}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal transition duration-150 hover:bg-teal/5 disabled:opacity-50"
            >
              Reactivar
            </button>
          )}
        </div>
      </div>

      {editando && (
        <EditarRegistroForm registro={registro} onDone={() => setEditando(false)} />
      )}

      {/* Valores por ejercicio */}
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Valores por ejercicio
          </h4>
          {registro.activo && (
            <button
              type="button"
              onClick={() => setCapturando((v) => !v)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-teal transition duration-150 hover:bg-teal/5"
            >
              {capturando ? "Cerrar captura" : "Capturar valores"}
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {EJERCICIOS.map((anio) => {
            const v = vigentePorAnio.get(anio);
            const previas = registro.valores.filter((x) => x.ejercicio === anio).slice(1);
            return (
              <div
                key={anio}
                className="rounded-xl border border-line bg-crema/30 px-3.5 py-2.5"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink">{anio}</span>
                  {!v && <span className="text-xs text-muted">Sin datos</span>}
                </div>
                {v && (
                  <dl className="mt-1 space-y-0.5 text-xs text-muted">
                    <div className="flex justify-between gap-2">
                      <dt>Cantidad de activos</dt>
                      <dd className="tabular-nums text-ink">
                        {v.cantidad != null ? nf.format(v.cantidad) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Porcentaje</dt>
                      <dd className="tabular-nums text-ink">
                        {v.pct != null ? `${nf.format(v.pct)} %` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Capital desplegado</dt>
                      <dd className="tabular-nums text-ink">
                        {v.capital != null ? nf.format(v.capital) : "—"}
                      </dd>
                    </div>
                    {v.notas && <p className="pt-1 text-ink/80">{v.notas}</p>}
                    <p className="pt-1 text-[11px]">
                      {fmtFecha(v.fecha)}
                      {v.capturadoPor ? ` · ${v.capturadoPor}` : ""}
                      {previas.length > 0 && ` · ${previas.length} corrección(es) previa(s)`}
                    </p>
                  </dl>
                )}
              </div>
            );
          })}
        </div>

        {capturando && registro.activo && (
          <CapturarValoresForm registro={registro} onDone={() => setCapturando(false)} />
        )}
      </div>

      <ConfirmDialog
        open={confirmar}
        tono="danger"
        titulo="¿Desactivar este registro?"
        descripcion={`${limpiar(
          registro.nombre
        )} dejará de aparecer en el Excel de taxonomía. No se elimina: su historia y valores se conservan.`}
        confirmar="Sí, desactivar"
        cancelar="Cancelar"
        cargando={pendingActivo}
        onConfirm={() => aplicarActivo(false)}
        onCancel={() => setConfirmar(false)}
      />
    </li>
  );
}

// -----------------------------------------------------------------------------
// Editar
// -----------------------------------------------------------------------------
function EditarRegistroForm({
  registro,
  onDone,
}: {
  registro: RegistroFila;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(editarRegistro, initialReg);
  const [nombre, setNombre] = useState(registro.nombre);
  const [descripcion, setDescripcion] = useState(registro.descripcion ?? "");
  const [horizonte, setHorizonte] = useState(registro.horizonte ?? "");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Registro actualizado.");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("El nombre es obligatorio.");
    const fd = new FormData();
    fd.set("registro_id", registro.id);
    fd.set("nombre", nombre);
    fd.set("descripcion", descripcion);
    fd.set("horizonte_temporal", horizonte);
    startTransition(() => dispatch(fd));
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-xl border border-line bg-crema/20 p-4">
      <div>
        <label className={labelCls}>Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className={areaCls}
        />
      </div>
      <div>
        <label className={labelCls}>Horizonte temporal</label>
        <input
          value={horizonte}
          onChange={(e) => setHorizonte(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </button>
        <Button type="submit" size="sm" loading={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Capturar valores
// -----------------------------------------------------------------------------
function CapturarValoresForm({
  registro,
  onDone,
}: {
  registro: RegistroFila;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(capturarValores, initialVal);
  const [ejercicio, setEjercicio] = useState(String(EJERCICIOS[0]));
  const [cantidad, setCantidad] = useState("");
  const [pct, setPct] = useState("");
  const [capital, setCapital] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Valores registrados.");
      setCantidad("");
      setPct("");
      setCapital("");
      setNotas("");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cantidad.trim() && !pct.trim() && !capital.trim() && !notas.trim()) {
      return toast.error("Captura al menos un valor o una nota.");
    }
    const fd = new FormData();
    fd.set("registro_id", registro.id);
    fd.set("ejercicio", ejercicio);
    fd.set("cantidad_activos", cantidad);
    fd.set("porcentaje", pct);
    fd.set("capital_desplegado", capital);
    fd.set("notas", notas);
    startTransition(() => dispatch(fd));
  };

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
      <p className="text-xs text-muted">
        Cada captura es una fila nueva (APPEND ONLY). La vigente para el ejercicio
        es la última; las anteriores quedan como corrección.
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Ejercicio</label>
          <select
            value={ejercicio}
            onChange={(e) => setEjercicio(e.target.value)}
            className={inputCls}
          >
            {EJERCICIOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cantidad activos</label>
          <input
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Porcentaje</label>
          <input
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="%"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Capital desplegado</label>
          <input
            inputMode="decimal"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notas <span className="font-normal text-muted">· opcional</span></label>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
      </div>
      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </button>
        <Button type="submit" size="sm" loading={pending}>
          Registrar valores
        </Button>
      </div>
    </form>
  );
}
