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
import Link from "next/link";
import {
  matrizVacia,
  nivelDeSeveridad,
  severidadEfectiva,
  type MatrizRiesgos,
} from "@/lib/perfil-emisor";
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
  gasto: number | null;
  financiacion: number | null;
  inversion: number | null;
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
  horizontes: string[];
  probabilidad: number | null;
  impacto: number | null;
  severidad: number | null;
  /** Matriz de la emisora de ESTE registro. null = no la ha definido. */
  matriz: MatrizRiesgos | null;
  emisora: string | null;
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

// Horizonte temporal ahora es MULTI-ENUM (v2): un registro puede cubrir varios
// plazos. Checkboxes con las opciones canónicas; un valor libre preexistente se
// conserva como opción adicional (preserva-ajeno).
const HORIZONTES = ["Corto plazo", "Mediano plazo", "Largo plazo"];

function opcionesHorizonte(seleccionados: string[]): string[] {
  const ajenos = seleccionados.filter((h) => !HORIZONTES.includes(h));
  return [...HORIZONTES, ...ajenos];
}

function CheckboxHorizontes({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (op: string) => {
    const has = value.includes(op);
    const opciones = opcionesHorizonte(value);
    onChange(opciones.filter((o) => (o === op ? !has : value.includes(o))));
  };
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
      {opcionesHorizonte(value).map((op) => (
        <label key={op} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={value.includes(op)}
            onChange={() => toggle(op)}
            className="size-4 rounded border-line text-teal focus:ring-2 focus:ring-teal/40"
          />
          {op}
          {!HORIZONTES.includes(op) && (
            <span className="text-xs text-muted">(valor previo)</span>
          )}
        </label>
      ))}
    </div>
  );
}

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
      <AvisoSinMatriz registros={registros} />

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
            <CrearRegistroForm reportes={reportes} registros={registros} onDone={() => setAbrirAlta(false)} />
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
  registros,
  onDone,
}: {
  reportes: ReporteOpcion[];
  /** Para deducir la matriz del reporte elegido, sin otra consulta. */
  registros: RegistroFila[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(crearRegistro, initialReg);
  const [reporteId, setReporteId] = useState(reportes.length === 1 ? reportes[0].id : "");
  const [tipo, setTipo] = useState("riesgo_fisico");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [horizontes, setHorizontes] = useState<string[]>([]);
  const [prob, setProb] = useState("");
  const [imp, setImp] = useState("");
  const [sev, setSev] = useState("");
  // Matriz de la emisora del reporte elegido: se deduce de cualquier registro
  // suyo ya cargado. Si el reporte aún no tiene registros, no hay de dónde, y la
  // priorización se captura igual — el nivel se resuelve al guardar y recargar.
  const matriz = registros.find((r) => r.reporteId === reporteId)?.matriz ?? null;

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Registro creado.");
      setNombre("");
      setDescripcion("");
      setHorizontes([]);
      setProb("");
      setImp("");
      setSev("");
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
    horizontes.forEach((h) => fd.append("horizontes", h));
    fd.set("probabilidad", prob);
    fd.set("impacto", imp);
    fd.set("severidad", sev);
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
        <span className={labelCls}>
          Horizontes temporales <span className="font-normal text-muted">· opcional</span>
        </span>
        <CheckboxHorizontes value={horizontes} onChange={setHorizontes} />
      </div>
      <Priorizacion
        prob={prob}
        imp={imp}
        sev={sev}
        setProb={setProb}
        setImp={setImp}
        setSev={setSev}
        matriz={matriz}
      />
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
          <Severidad registro={registro} />
          {registro.horizontes.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Horizontes: {registro.horizontes.join(" · ")}
            </p>
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
                    <div className="pt-0.5 text-[11px] uppercase tracking-wide text-muted/80">
                      Despliegue de capital
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>· Gasto</dt>
                      <dd className="tabular-nums text-ink">
                        {v.gasto != null ? nf.format(v.gasto) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>· Financiación</dt>
                      <dd className="tabular-nums text-ink">
                        {v.financiacion != null ? nf.format(v.financiacion) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>· Inversión</dt>
                      <dd className="tabular-nums text-ink">
                        {v.inversion != null ? nf.format(v.inversion) : "—"}
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
  const [horizontes, setHorizontes] = useState<string[]>(registro.horizontes);

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
    horizontes.forEach((h) => fd.append("horizontes", h));
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
        <span className={labelCls}>Horizontes temporales</span>
        <CheckboxHorizontes value={horizontes} onChange={setHorizontes} />
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
  const [gasto, setGasto] = useState("");
  const [financiacion, setFinanciacion] = useState("");
  const [inversion, setInversion] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Valores registrados.");
      setCantidad("");
      setPct("");
      setGasto("");
      setFinanciacion("");
      setInversion("");
      setNotas("");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !cantidad.trim() &&
      !pct.trim() &&
      !gasto.trim() &&
      !financiacion.trim() &&
      !inversion.trim() &&
      !notas.trim()
    ) {
      return toast.error("Captura al menos un valor o una nota.");
    }
    const fd = new FormData();
    fd.set("registro_id", registro.id);
    fd.set("ejercicio", ejercicio);
    fd.set("cantidad_activos", cantidad);
    fd.set("porcentaje", pct);
    fd.set("capital_gasto", gasto);
    fd.set("capital_financiacion", financiacion);
    fd.set("capital_inversion", inversion);
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
      </div>
      <fieldset className="rounded-xl border border-line bg-crema/20 p-3.5">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Despliegue de capital
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Gasto de capital</label>
            <input
              inputMode="decimal"
              value={gasto}
              onChange={(e) => setGasto(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Financiación</label>
            <input
              inputMode="decimal"
              value={financiacion}
              onChange={(e) => setFinanciacion(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Inversión</label>
            <input
              inputMode="decimal"
              value={inversion}
              onChange={(e) => setInversion(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
        </div>
      </fieldset>
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

// -----------------------------------------------------------------------------
// Priorización
// -----------------------------------------------------------------------------

/**
 * Captura de probabilidad, impacto y severidad.
 *
 * Con los dos factores, la severidad es su producto y el campo se muestra en
 * solo lectura: dejar escribir un total que no cuadra con sus partes es invitar
 * a que la tabla de priorización del suplemento se contradiga sola. Sin ellos,
 * se captura el puntaje a mano, que es como lo entregan varios clientes.
 */
function Priorizacion({
  prob,
  imp,
  sev,
  setProb,
  setImp,
  setSev,
  matriz,
}: {
  prob: string;
  imp: string;
  sev: string;
  setProb: (v: string) => void;
  setImp: (v: string) => void;
  setSev: (v: string) => void;
  matriz: MatrizRiesgos | null;
}) {
  const p = prob === "" ? null : Number(prob);
  const i = imp === "" ? null : Number(imp);
  const calculada = p != null && i != null;
  const efectiva = severidadEfectiva(p, i, sev === "" ? null : Number(sev));
  const nivel = nivelDeSeveridad(efectiva, matriz);

  return (
    <div className="rounded-xl border border-line bg-crema/30 p-4">
      <span className={labelCls}>
        Priorización <span className="font-normal text-muted">· opcional</span>
      </span>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs text-muted">Probabilidad</span>
          <input
            inputMode="decimal"
            value={prob}
            onChange={(e) => setProb(e.target.value.replace(/[^0-9.]/g, ""))}
            className="mt-1 h-11 w-24 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal/50"
          />
        </label>
        <span className="pb-3 text-muted">×</span>
        <label className="block">
          <span className="block text-xs text-muted">Impacto</span>
          <input
            inputMode="decimal"
            value={imp}
            onChange={(e) => setImp(e.target.value.replace(/[^0-9.]/g, ""))}
            className="mt-1 h-11 w-24 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal/50"
          />
        </label>
        <span className="pb-3 text-muted">=</span>
        <label className="block">
          <span className="block text-xs text-muted">
            Severidad {calculada && <span className="text-teal">· calculada</span>}
          </span>
          <input
            inputMode="decimal"
            value={calculada ? String(efectiva ?? "") : sev}
            onChange={(e) => setSev(e.target.value.replace(/[^0-9.]/g, ""))}
            readOnly={calculada}
            className={cn(
              "mt-1 h-11 w-28 rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-teal/50",
              calculada ? "bg-crema/60 text-muted" : "bg-surface"
            )}
          />
        </label>
        {efectiva != null && (
          <div className="pb-2">
            {nivel ? (
              <Chip tono="ambar">{nivel}</Chip>
            ) : (
              <span className="text-xs text-muted">
                {matrizVacia(matriz) ? "Sin matriz definida" : "Fuera de los rangos"}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Con probabilidad e impacto, la severidad se calcula sola. Si solo tienes el
        puntaje, escríbelo directo.
      </p>
    </div>
  );
}

/** Severidad y nivel de un registro ya guardado. */
function Severidad({ registro }: { registro: RegistroFila }) {
  const matriz = registro.matriz;
  const efectiva = severidadEfectiva(
    registro.probabilidad,
    registro.impacto,
    registro.severidad
  );
  // Los registros dados de alta antes de A2 no tienen priorización: no se les
  // pinta nada, en vez de un "—" que parecería un dato ausente por descuido.
  if (efectiva == null) return null;
  const nivel = nivelDeSeveridad(efectiva, matriz);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>
        Severidad <span className="font-medium text-ink">{efectiva}</span>
        {registro.probabilidad != null && registro.impacto != null && (
          <span> ({registro.probabilidad} × {registro.impacto})</span>
        )}
      </span>
      {nivel ? (
        <Chip tono="ambar">{nivel}</Chip>
      ) : (
        <span>
          {matrizVacia(matriz)
            ? `sin matriz de ${registro.emisora ?? "la emisora"} para calcular el nivel`
            : "fuera de los rangos"}
        </span>
      )}
    </p>
  );
}

/**
 * Aviso por EMISORA sin matriz definida. Se agrupa por emisora y no por registro
 * para no repetir la misma línea diez veces en la misma pantalla; el nivel de
 * cada registro sí se resuelve con la matriz de la suya.
 */
function AvisoSinMatriz({ registros }: { registros: RegistroFila[] }) {
  const sinMatriz = [
    ...new Set(
      registros
        .filter((r) => matrizVacia(r.matriz))
        .map((r) => r.emisora ?? "una emisora sin nombre")
    ),
  ];
  if (sinMatriz.length === 0) return null;
  return (
    <p className="rounded-card border border-dorado/40 bg-dorado/10 px-4 py-3 text-sm text-ink">
      <span className="font-medium">
        Sin matriz de riesgos: {sinMatriz.join(", ")}.
      </span>{" "}
      La severidad se guarda, pero no se traduce a un nivel mientras no exista la
      escala de esa emisora. Se define en{" "}
      <Link href="/admin/perfil" className="text-teal underline-offset-2 hover:underline">
        Perfil del emisor → Matriz de riesgos
      </Link>
      .
    </p>
  );
}
