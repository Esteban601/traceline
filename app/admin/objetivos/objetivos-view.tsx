"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import type { Tono } from "@/lib/estados";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  crearObjetivo,
  editarObjetivo,
  cambiarActivoObjetivo,
  type ObjetivoState,
} from "./actions";

export type FichaObjetivo = {
  validacionTercero: string | null;
  procesosRevision: string | null;
  metricasSupervision: string | null;
  revisiones: string | null;
  resultados: string | null;
  analisisTendencias: string | null;
  gasesCubiertos: string | null;
  alcancesCubiertos: string | null;
  brutoNeto: string | null;
  enfoqueDescarbonizacion: string | null;
  notas: string | null;
};
export type ObjetivoFila = {
  id: string;
  reporteId: string;
  ambito: string;
  naturaleza: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  metrica: string | null;
  meta: string | null;
  parteEntidad: string | null;
  periodoAplicacion: string | null;
  periodoBase: string | null;
  hitoIntermedio: string | null;
  tipoObjetivo: string | null;
  alineacion: string | null;
  orden: number;
  activo: boolean;
  ficha: FichaObjetivo;
};
export type ReporteOpcion = { id: string; nombre: string; ejercicio: number };

const AMBITOS: { key: string; label: string; tono: Tono }[] = [
  { key: "climatico", label: "Objetivos climáticos", tono: "azul" },
  { key: "sostenibilidad", label: "Sostenibilidad general", tono: "verde" },
];
function limpiar(n: string): string {
  return n.replace(/\[DEMO\]\s*/i, "").trim();
}

const initialObj: ObjetivoState = { ok: false, error: null, mensaje: null, objetivoId: null };

const labelCls = "block text-sm font-medium text-ink";
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:opacity-60";
const areaCls =
  "mt-1.5 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface";

// -----------------------------------------------------------------------------
// Vista principal — agrupada por ámbito
// -----------------------------------------------------------------------------
export function ObjetivosView({
  objetivos,
  reportes,
}: {
  objetivos: ObjetivoFila[];
  reportes: ReporteOpcion[];
}) {
  const [abrirAlta, setAbrirAlta] = useState(false);

  const grupos = AMBITOS.map((a) => ({
    ...a,
    filas: objetivos.filter((o) => o.ambito === a.key),
  }));

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            Objetivos
            <span className="ml-2 text-sm font-normal text-muted">{objetivos.length}</span>
          </h2>
          <Button
            size="sm"
            onClick={() => setAbrirAlta((v) => !v)}
            disabled={reportes.length === 0}
          >
            {abrirAlta ? "Cerrar" : "Nuevo objetivo"}
          </Button>
        </div>

        {reportes.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface/60 px-4 py-4 text-sm text-muted">
            No hay reportes activos donde registrar objetivos.
          </p>
        ) : (
          abrirAlta && (
            <ObjetivoForm reportes={reportes} onDone={() => setAbrirAlta(false)} />
          )
        )}
      </section>

      {objetivos.length === 0 ? (
        <EmptyState
          glifo="◎"
          titulo="Aún no hay objetivos"
          descripcion="Da de alta el primer objetivo climático o de sostenibilidad con “Nuevo objetivo”."
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
                  Sin objetivos de este ámbito.
                </p>
              ) : (
                <ul className="space-y-3">
                  {g.filas.map((o) => (
                    <ObjetivoCard key={o.id} objetivo={o} reportes={reportes} />
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
// Tarjeta de objetivo
// -----------------------------------------------------------------------------
function tieneSup34(f: FichaObjetivo) {
  return !!(f.validacionTercero || f.procesosRevision || f.metricasSupervision || f.revisiones);
}
function tieneRes35(f: FichaObjetivo) {
  return !!(f.resultados || f.analisisTendencias);
}
function tieneCob36(f: FichaObjetivo) {
  return !!(f.gasesCubiertos || f.alcancesCubiertos || f.brutoNeto || f.enfoqueDescarbonizacion);
}

function ObjetivoCard({
  objetivo,
  reportes,
}: {
  objetivo: ObjetivoFila;
  reportes: ReporteOpcion[];
}) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [pendingActivo, startActivo] = useTransition();
  const esClimatico = objetivo.ambito === "climatico";

  const aplicarActivo = (activar: boolean) => {
    startActivo(async () => {
      const r = await cambiarActivoObjetivo(objetivo.id, activar);
      setConfirmar(false);
      if (r.ok) toast.success(r.mensaje ?? "Listo.");
      else toast.error(r.error ?? "No se pudo actualizar.");
    });
  };

  const dato = (etq: string, val: string | null) =>
    val ? (
      <div className="flex flex-col gap-0.5">
        <dt className="text-[11px] uppercase tracking-wide text-muted">{etq}</dt>
        <dd className="text-sm text-ink">{val}</dd>
      </div>
    ) : null;

  const secciones = [
    { label: "S2 34 · Supervisión", ok: tieneSup34(objetivo.ficha) },
    { label: "S2 35 · Resultados", ok: tieneRes35(objetivo.ficha) },
    { label: "S2 36 · Cobertura", ok: tieneCob36(objetivo.ficha) },
  ];

  return (
    <li
      className={cn(
        "rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6",
        !objetivo.activo && "bg-ink/[0.015]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "font-display text-base font-semibold",
                objetivo.activo ? "text-ink" : "text-muted"
              )}
            >
              {limpiar(objetivo.nombre)}
            </h3>
            <Chip tono={objetivo.naturaleza === "oportunidad" ? "verde" : "ambar"}>
              {objetivo.naturaleza === "oportunidad" ? "Oportunidad" : "Riesgo"}
            </Chip>
            {objetivo.tipoObjetivo && <Chip tono="gris">{objetivo.tipoObjetivo}</Chip>}
            {!objetivo.activo && <Chip tono="gris">Inactivo</Chip>}
          </div>
          {objetivo.descripcion && (
            <p className="mt-1 max-w-2xl text-sm text-muted">{objetivo.descripcion}</p>
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
          {objetivo.activo ? (
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

      {!editando && (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {dato("Tipo", objetivo.tipo)}
            {dato("Métrica", objetivo.metrica)}
            {dato("Meta", objetivo.meta)}
            {dato("Parte de la entidad", objetivo.parteEntidad)}
            {dato("Periodo de aplicación", objetivo.periodoAplicacion)}
            {dato("Periodo base", objetivo.periodoBase)}
            {dato("Hito intermedio", objetivo.hitoIntermedio)}
          </dl>

          {esClimatico && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <span className="text-[11px] uppercase tracking-wide text-muted">
                Fichas hermanas
              </span>
              {secciones.map((s) => (
                <span
                  key={s.label}
                  className={cn(
                    "rounded-pill px-2.5 py-0.5 text-xs font-medium",
                    s.ok
                      ? "bg-verde/10 text-verde"
                      : "bg-gris/10 text-gris"
                  )}
                >
                  {s.label}
                  {s.ok ? "" : " · pendiente"}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {editando && (
        <div className="mt-4 border-t border-line pt-4">
          <ObjetivoForm
            reportes={reportes}
            objetivo={objetivo}
            onDone={() => setEditando(false)}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmar}
        tono="danger"
        titulo="¿Desactivar este objetivo?"
        descripcion={`${limpiar(
          objetivo.nombre
        )} dejará de aparecer en el Excel de taxonomía (S1 51 y S2 33-36). No se elimina: su ficha e historia se conservan.`}
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
// Sección colapsable del formulario
// -----------------------------------------------------------------------------
function Seccion({
  titulo,
  norma,
  defaultOpen = false,
  children,
}: {
  titulo: string;
  norma?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line bg-crema/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">{titulo}</span>
          {norma && (
            <span className="text-[11px] uppercase tracking-wide text-gold">{norma}</span>
          )}
        </span>
        <span
          className={cn(
            "text-muted transition duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && <div className="space-y-4 border-t border-line px-4 py-4">{children}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Formulario compartido (alta / edición) — ficha completa por secciones
// -----------------------------------------------------------------------------
type Campos = {
  reporteId: string;
  ambito: string;
  naturaleza: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  metrica: string;
  meta: string;
  parteEntidad: string;
  periodoAplicacion: string;
  periodoBase: string;
  hitoIntermedio: string;
  tipoObjetivo: string;
  alineacion: string;
  validacionTercero: string;
  procesosRevision: string;
  metricasSupervision: string;
  revisiones: string;
  resultados: string;
  analisisTendencias: string;
  gasesCubiertos: string;
  alcancesCubiertos: string;
  brutoNeto: string;
  enfoqueDescarbonizacion: string;
  notas: string;
};

function desdeObjetivo(o: ObjetivoFila | undefined, reportes: ReporteOpcion[]): Campos {
  return {
    reporteId: o?.reporteId ?? (reportes.length === 1 ? reportes[0].id : ""),
    ambito: o?.ambito ?? "climatico",
    naturaleza: o?.naturaleza ?? "riesgo",
    nombre: o?.nombre ?? "",
    descripcion: o?.descripcion ?? "",
    tipo: o?.tipo ?? "",
    metrica: o?.metrica ?? "",
    meta: o?.meta ?? "",
    parteEntidad: o?.parteEntidad ?? "",
    periodoAplicacion: o?.periodoAplicacion ?? "",
    periodoBase: o?.periodoBase ?? "",
    hitoIntermedio: o?.hitoIntermedio ?? "",
    tipoObjetivo: o?.tipoObjetivo ?? "",
    alineacion: o?.alineacion ?? "",
    validacionTercero: o?.ficha.validacionTercero ?? "",
    procesosRevision: o?.ficha.procesosRevision ?? "",
    metricasSupervision: o?.ficha.metricasSupervision ?? "",
    revisiones: o?.ficha.revisiones ?? "",
    resultados: o?.ficha.resultados ?? "",
    analisisTendencias: o?.ficha.analisisTendencias ?? "",
    gasesCubiertos: o?.ficha.gasesCubiertos ?? "",
    alcancesCubiertos: o?.ficha.alcancesCubiertos ?? "",
    brutoNeto: o?.ficha.brutoNeto ?? "",
    enfoqueDescarbonizacion: o?.ficha.enfoqueDescarbonizacion ?? "",
    notas: o?.ficha.notas ?? "",
  };
}

function ObjetivoForm({
  reportes,
  objetivo,
  onDone,
}: {
  reportes: ReporteOpcion[];
  objetivo?: ObjetivoFila;
  onDone: () => void;
}) {
  const esEdicion = !!objetivo;
  const toast = useToast();
  const [state, dispatch, pending] = useActionState(
    esEdicion ? editarObjetivo : crearObjetivo,
    initialObj
  );
  const [c, setC] = useState<Campos>(() => desdeObjetivo(objetivo, reportes));
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) =>
    setC((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (state.ok) {
      toast.success(state.mensaje ?? "Guardado.");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!esEdicion && !c.reporteId) return toast.error("Selecciona el reporte.");
    if (!c.nombre.trim()) return toast.error("El nombre es obligatorio.");
    const fd = new FormData();
    if (esEdicion) fd.set("objetivo_id", objetivo!.id);
    else fd.set("reporte_id", c.reporteId);
    fd.set("ambito", c.ambito);
    fd.set("naturaleza", c.naturaleza);
    fd.set("nombre", c.nombre);
    fd.set("descripcion", c.descripcion);
    fd.set("tipo", c.tipo);
    fd.set("metrica", c.metrica);
    fd.set("meta", c.meta);
    fd.set("parte_entidad", c.parteEntidad);
    fd.set("periodo_aplicacion", c.periodoAplicacion);
    fd.set("periodo_base", c.periodoBase);
    fd.set("hito_intermedio", c.hitoIntermedio);
    fd.set("tipo_objetivo", c.tipoObjetivo);
    fd.set("alineacion_acuerdo_internacional", c.alineacion);
    fd.set("validacion_tercero", c.validacionTercero);
    fd.set("procesos_revision", c.procesosRevision);
    fd.set("metricas_supervision", c.metricasSupervision);
    fd.set("revisiones", c.revisiones);
    fd.set("resultados", c.resultados);
    fd.set("analisis_tendencias", c.analisisTendencias);
    fd.set("gases_cubiertos", c.gasesCubiertos);
    fd.set("alcances_cubiertos", c.alcancesCubiertos);
    fd.set("bruto_neto", c.brutoNeto);
    fd.set("enfoque_descarbonizacion", c.enfoqueDescarbonizacion);
    fd.set("notas", c.notas);
    startTransition(() => dispatch(fd));
  };

  const campoInput = (
    label: string,
    k: keyof Campos,
    placeholder?: string,
    opcional = true
  ) => (
    <div>
      <label className={labelCls}>
        {label}{" "}
        {opcional && <span className="font-normal text-muted">· opcional</span>}
      </label>
      <input
        value={c[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
  const campoArea = (label: string, k: keyof Campos, placeholder?: string, rows = 2) => (
    <div>
      <label className={labelCls}>
        {label} <span className="font-normal text-muted">· opcional</span>
      </label>
      <textarea
        value={c[k]}
        onChange={(e) => set(k, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={areaCls}
      />
    </div>
  );

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-5",
        !esEdicion && "rounded-card border border-line bg-surface p-6 shadow-soft"
      )}
    >
      {/* Definición ------------------------------------------------------- */}
      <Seccion titulo="Definición del objetivo" norma="S2 33 · S1 51" defaultOpen>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Ámbito</label>
            <select
              value={c.ambito}
              onChange={(e) => set("ambito", e.target.value)}
              className={inputCls}
            >
              <option value="climatico">Climático (S2)</option>
              <option value="sostenibilidad">Sostenibilidad general (S1)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Naturaleza</label>
            <select
              value={c.naturaleza}
              onChange={(e) => set("naturaleza", e.target.value)}
              className={inputCls}
            >
              <option value="riesgo">Gestiona un riesgo</option>
              <option value="oportunidad">Persigue una oportunidad</option>
            </select>
          </div>
          {!esEdicion && reportes.length > 1 && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Reporte</label>
              <select
                value={c.reporteId}
                onChange={(e) => set("reporteId", e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {reportes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} · {r.ejercicio}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Nombre</label>
          <input
            value={c.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            required
            placeholder="Nombre o descripción del objetivo"
            className={inputCls}
          />
        </div>
        {campoArea("Descripción", "descripcion", "Detalle del objetivo cuantitativo o cualitativo…")}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Tipo <span className="font-normal text-muted">· opcional</span>
            </label>
            <select
              value={c.tipo}
              onChange={(e) => set("tipo", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="Cuantitativo">Cuantitativo</option>
              <option value="Cualitativo">Cualitativo</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Tipo de objetivo <span className="font-normal text-muted">· opcional</span>
            </label>
            <select
              value={c.tipoObjetivo}
              onChange={(e) => set("tipoObjetivo", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="Absoluto">Absoluto</option>
              <option value="De intensidad">De intensidad</option>
            </select>
          </div>
          {campoInput("Métrica utilizada", "metrica", "p. ej. tCO2e absolutas")}
          {campoInput("Objetivo de la meta", "meta", "p. ej. Reducir 42% al 2030")}
          {campoInput("Parte de la entidad", "parteEntidad", "p. ej. Toda la entidad")}
          {campoInput("Periodo de aplicación", "periodoAplicacion", "p. ej. 2024–2030")}
          {campoInput("Periodo base", "periodoBase", "p. ej. 2023")}
          {campoInput("Hito u objetivo intermedio", "hitoIntermedio", "p. ej. 25% al 2027")}
        </div>
        {campoArea(
          "Alineación con el último acuerdo internacional",
          "alineacion",
          "Modo en que el Acuerdo de París influyó en el objetivo…"
        )}
      </Seccion>

      {/* Supervisión (S2 34) ---------------------------------------------- */}
      <Seccion titulo="Validación, supervisión y revisión" norma="S2 34">
        {campoArea(
          "Validación del objetivo y su metodología por un tercero",
          "validacionTercero"
        )}
        {campoArea("Procesos de la entidad para revisar el objetivo", "procesosRevision")}
        {campoArea(
          "Métricas para supervisar el progreso",
          "metricasSupervision"
        )}
        {campoArea("Información sobre las revisiones del objetivo", "revisiones")}
      </Seccion>

      {/* Resultados (S2 35) ----------------------------------------------- */}
      <Seccion titulo="Resultados y análisis de tendencias" norma="S2 35">
        {campoArea("Resultados en relación con el objetivo", "resultados")}
        {campoArea("Análisis de tendencias o cambios en los resultados", "analisisTendencias")}
      </Seccion>

      {/* Cobertura (S2 36) ------------------------------------------------ */}
      <Seccion titulo="Cobertura del objetivo" norma="S2 36 (a)-(d)">
        {campoInput("Gases de efecto invernadero cubiertos", "gasesCubiertos", "p. ej. CO2, CH4, N2O")}
        {campoInput("Alcances cubiertos (1 / 2 / 3)", "alcancesCubiertos", "p. ej. Alcance 1 y 2")}
        <div>
          <label className={labelCls}>
            Emisiones brutas o netas{" "}
            <span className="font-normal text-muted">· opcional</span>
          </label>
          <select
            value={c.brutoNeto}
            onChange={(e) => set("brutoNeto", e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="Emisiones brutas">Emisiones brutas</option>
            <option value="Emisiones netas">Emisiones netas</option>
          </select>
        </div>
        {campoArea(
          "Enfoque de descarbonización sectorial",
          "enfoqueDescarbonizacion"
        )}
        {campoArea("Notas / Brechas", "notas")}
      </Seccion>

      <div className="flex justify-end gap-2.5 border-t border-line pt-5">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
        >
          Cancelar
        </button>
        <Button type="submit" loading={pending}>
          {esEdicion ? "Guardar cambios" : "Crear objetivo"}
        </Button>
      </div>
    </form>
  );
}
