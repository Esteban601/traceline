"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { decidirSugerencia, type DecisionState } from "@/lib/evidencias/acciones-sugerencia";
import type { BloqueSugerencia, FuenteVista, LecturaVista } from "@/lib/evidencias/sugerencia-vista";
import type { Tono } from "@/lib/estados";

// =============================================================================
// BLOQUE «VALOR SUGERIDO» / «EXTRACTO SUGERIDO» — captura sugerida, Paso 4.
//
// Va bajo la evidencia más reciente, en el panel y en el portal. Muestra la
// cifra con unidad y periodo (o el extracto), la confianza en palabras, la
// fuente como enlace que abre la evidencia en su página (o dice hoja y celda),
// la conversión con su factor y los candidatos desplegables. Con
// `sin_hallazgo` dice que la evidencia no trae la cifra o no cubre el requisito.
//
// Los botones solo aparecen si `puedeDecidir` (la regla de la base: quien
// captura decide; el auditor nunca). Aunque alguien forzara el formulario, la
// base lo rechaza.
// =============================================================================

const fmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 6 });
const fmtFecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const CONFIANZA: Record<"alta" | "media" | "baja", { texto: string; tono: Tono }> = {
  alta: { texto: "Confianza alta", tono: "verde" },
  media: { texto: "Confianza media", tono: "ambar" },
  baja: { texto: "Confianza baja", tono: "rojo" },
};

const inicial: DecisionState = { ok: false, mensaje: null, error: null };

function hrefFuente(evidenciaId: string, f: FuenteVista | null): string {
  const base = `/portal/descargar/${evidenciaId}?ver=1`;
  return f?.tipo === "pagina" && f.pagina ? `${base}#page=${f.pagina}` : base;
}

function etiquetaFuente(f: FuenteVista | null): string {
  if (!f) return "Sin fuente";
  switch (f.tipo) {
    case "celda": return `Hoja «${f.hoja}», celda ${f.celda}`;
    case "pagina": return `Página ${f.pagina}`;
    case "parrafo": return `Párrafo ${f.parrafo}`;
    case "tabla": return `Tabla ${f.tabla}, fila ${f.fila}, columna ${f.columna}`;
    case "imagen": return "Imagen";
  }
}

function Fuente({ evidenciaId, fuente }: { evidenciaId: string; fuente: FuenteVista | null }) {
  return (
    <a
      href={hrefFuente(evidenciaId, fuente)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-teal underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
    >
      {etiquetaFuente(fuente)}
    </a>
  );
}

/** Lo que se muestra (y se confirma): la conversión si la hay. */
function mostrada(l: LecturaVista): { valor: number; unidad: string } {
  return l.conversion ? { valor: l.conversion.valor, unidad: l.conversion.unidad } : { valor: l.valor, unidad: l.unidad };
}

export function SugerenciaBloque({ bloque, solicitudId }: { bloque: BloqueSugerencia; solicitudId: string }) {
  const s = bloque.sugerencia;
  const toast = useToast();
  const [estado, accion, pendiente] = useActionState(decidirSugerencia, inicial);
  const [modo, setModo] = useState<null | "corregir" | "rechazar">(null);
  const [precarga, setPrecarga] = useState<{ valor: string; unidad: string; periodo: string; extracto: string }>({
    valor: "", unidad: "", periodo: "", extracto: "",
  });

  // Cada resultado se anuncia una sola vez, aunque el componente se vuelva a pintar.
  const atendido = useRef<DecisionState>(inicial);
  useEffect(() => {
    if (estado === atendido.current) return;
    atendido.current = estado;
    if (estado.ok && estado.mensaje) {
      toast.success(estado.mensaje);
      setModo(null);
    } else if (estado.error) {
      toast.error(estado.error);
    }
  }, [estado, toast]);

  if (!s) return null;
  const esTexto = s.tipo === "texto";
  const titulo = esTexto ? "Extracto sugerido" : "Valor sugerido";
  const decidible = bloque.puedeDecidir && s.estado === "sugerida";

  const abrirCorreccion = (l: LecturaVista | null) => {
    if (esTexto) {
      setPrecarga({ valor: "", unidad: "", periodo: "", extracto: s.extracto ?? "" });
    } else if (l) {
      const m = mostrada(l);
      setPrecarga({ valor: String(m.valor), unidad: m.unidad, periodo: l.periodo ?? "", extracto: "" });
    }
    setModo("corregir");
  };

  const ocultos = (
    <>
      <input type="hidden" name="sugerencia_id" value={s.id} />
      <input type="hidden" name="solicitud_id" value={solicitudId} />
      <input type="hidden" name="tipo" value={s.tipo} />
    </>
  );

  return (
    <section
      aria-label={titulo}
      className="rounded-card border border-teal/25 bg-teal/[0.03] p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold text-ink">{titulo}</h3>
        <Chip tono="teal">Propuesto por la plataforma</Chip>
        {s.confianza && s.estado !== "sin_hallazgo" ? (
          <Chip tono={CONFIANZA[s.confianza].tono}>{CONFIANZA[s.confianza].texto}</Chip>
        ) : null}
        <span className="text-xs text-muted">sobre la versión {s.evidenciaVersion}</span>
      </div>

      {/* ---------- Sin hallazgo ---------- */}
      {s.estado === "sin_hallazgo" ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-sm font-medium text-ink">
            {esTexto ? "Esta evidencia no cubre el requisito." : "No se encontró la cifra en esta evidencia."}
          </p>
          {s.cobertura ? <p className="text-sm text-muted">{s.cobertura}</p> : null}
          {!esTexto && s.motivo ? <p className="text-sm text-muted">{s.motivo}</p> : null}
        </div>
      ) : null}

      {/* ---------- Numérica ---------- */}
      {!esTexto && s.principal && s.estado !== "sin_hallazgo" ? (
        <div className="mt-3 space-y-2">
          <p className="text-ink">
            <span className="font-display text-2xl font-semibold tabular-nums">{fmt.format(mostrada(s.principal).valor)}</span>{" "}
            <span className="text-base">{mostrada(s.principal).unidad}</span>
            {s.principal.periodo ? <span className="text-sm text-muted"> · periodo {s.principal.periodo}</span> : null}
          </p>
          {s.principal.conversion ? (
            <p className="text-sm text-ink">
              <span className="text-muted">Conversión propuesta: </span>
              el documento dice {fmt.format(s.principal.valor)} {s.principal.unidad}; {s.principal.conversion.explicacion}
              {s.principal.conversion.origen === "modelo" ? (
                <span className="text-ambar"> (factor propuesto por el modelo; revísalo)</span>
              ) : null}
              .
            </p>
          ) : null}
          <p className="text-sm text-muted">
            Fuente: <Fuente evidenciaId={s.evidenciaId} fuente={s.principal.fuente} />
            {s.principal.cita ? <> · «{s.principal.cita}»</> : null}
          </p>
          {s.candidatos.length ? (
            <details className="group rounded-xl border border-line bg-surface px-3.5 py-2.5">
              <summary className="cursor-pointer text-sm font-medium text-ink">
                Otras cifras posibles ({s.candidatos.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {s.candidatos.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="text-ink">
                      <span className="font-semibold tabular-nums">{fmt.format(mostrada(c).valor)}</span> {mostrada(c).unidad}
                      {c.periodo ? <span className="text-muted"> · {c.periodo}</span> : null}
                      {c.conversion ? (
                        <span className="text-muted"> (documento: {fmt.format(c.valor)} {c.unidad})</span>
                      ) : null}
                      <span className="text-muted"> · </span>
                      <Fuente evidenciaId={s.evidenciaId} fuente={c.fuente} />
                      {c.origen === "segunda_opinion" ? <span className="text-muted"> · segunda lectura</span> : null}
                    </span>
                    {decidible ? (
                      <button
                        type="button"
                        onClick={() => abrirCorreccion(c)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-teal transition duration-150 hover:bg-teal/10"
                      >
                        Usar esta cifra
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {/* ---------- Texto ---------- */}
      {esTexto && s.estado !== "sin_hallazgo" && s.fragmentos.length ? (
        <div className="mt-3 space-y-2.5">
          {s.fragmentos.map((f, i) => (
            <blockquote key={i} className="border-l-2 border-teal/40 pl-3 text-sm leading-relaxed text-ink">
              «{f.texto}{f.recortado ? "…" : ""}»
              <span className="mt-0.5 block text-xs text-muted">
                <Fuente evidenciaId={s.evidenciaId} fuente={f.fuente} />
              </span>
            </blockquote>
          ))}
          {s.cobertura ? <p className="text-sm text-muted">{s.cobertura}</p> : null}
        </div>
      ) : null}

      {/* ---------- Decisión tomada ---------- */}
      {s.decision ? (
        <p className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink">
          {s.estado === "confirmada" ? "Confirmada" : s.estado === "corregida" ? "Corregida" : "Rechazada"}
          {s.decision.quien ? ` por ${s.decision.quien}` : ""} el {fmtFecha.format(new Date(s.decision.cuando))}
          {s.estado === "corregida" && s.decision.valorFinal !== null
            ? ` · quedó ${fmt.format(s.decision.valorFinal)} ${s.decision.unidadFinal ?? ""}`
            : ""}
          {s.estado === "corregida" && s.decision.extractoFinal ? " · con el texto corregido" : ""}
          {s.decision.motivoRechazo ? ` · motivo: ${s.decision.motivoRechazo}` : ""}
        </p>
      ) : null}

      {/* ---------- Botones (solo quien decide) ---------- */}
      {decidible ? (
        <div className="mt-4 space-y-3">
          {modo === null ? (
            <div className="flex flex-wrap gap-2">
              <form action={accion}>
                {ocultos}
                <input type="hidden" name="accion" value="confirmar" />
                <Button type="submit" size="sm" loading={pendiente}>
                  Confirmar
                </Button>
              </form>
              <Button type="button" size="sm" variant="secondary" onClick={() => abrirCorreccion(s.principal)}>
                Corregir
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setModo("rechazar")}>
                Rechazar
              </Button>
            </div>
          ) : null}

          {modo === "corregir" ? (
            <form action={accion} className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
              {ocultos}
              <input type="hidden" name="accion" value="corregir" />
              {esTexto ? (
                <label className="block text-sm text-ink">
                  Texto
                  <textarea
                    name="extracto"
                    rows={5}
                    defaultValue={precarga.extracto}
                    className="mt-1 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-teal/40"
                  />
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm text-ink">
                    Valor
                    <input
                      name="valor"
                      inputMode="decimal"
                      defaultValue={precarga.valor}
                      key={`v-${precarga.valor}`}
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm tabular-nums text-ink outline-none focus:border-teal/40"
                    />
                  </label>
                  <label className="block text-sm text-ink">
                    Unidad
                    <input
                      name="unidad"
                      defaultValue={precarga.unidad}
                      key={`u-${precarga.unidad}`}
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal/40"
                    />
                  </label>
                  <label className="block text-sm text-ink">
                    Periodo
                    <input
                      name="periodo"
                      defaultValue={precarga.periodo}
                      key={`p-${precarga.periodo}`}
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal/40"
                    />
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setModo(null)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" loading={pendiente}>
                  Guardar corrección
                </Button>
              </div>
            </form>
          ) : null}

          {modo === "rechazar" ? (
            <form action={accion} className="space-y-3 rounded-xl border border-rojo/25 bg-rojo/[0.04] p-3.5">
              {ocultos}
              <input type="hidden" name="accion" value="rechazar" />
              <label className="block text-sm text-ink">
                Motivo <span className="text-muted">(opcional)</span>
                <input
                  name="motivo"
                  className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rojo/40"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setModo(null)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" variant="danger" loading={pendiente}>
                  Rechazar sugerencia
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
