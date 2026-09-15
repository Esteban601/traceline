"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { Tono } from "@/lib/estados";
import { cambiarEstado, guardarTexto, type EstadoAccion } from "./actions";

// =============================================================================
// La vista de revisión. Un bloque a la vez, con todo lo que hace falta para
// decidir si ese párrafo puede publicarse con la firma de la emisora.
// =============================================================================

export type BloqueRevision = {
  numero: number;
  titulo: string;
  seccion: string;
  estado: string;
  texto: string | null;
  fuentes: { tipo: string; id: string; detalle: string }[];
  pendientes: string[];
  notasRevision: string[];
  modelo: string | null;
  /**
   * Con qué versión del prompt se escribió ESTE texto. Se muestra porque un
   * documento puede mezclarlas: las reglas cambian, se regeneran unos bloques y
   * no otros, y sin este dato el revisor no sabe cuáles ya obedecen la regla
   * nueva y cuáles vienen de antes.
   */
  promptVersion: string | null;
  costoUsd: number;
  duracionMs: number | null;
  tokensSalida: number;
  editadoEn: string | null;
  editadoPor: string | null;
};

const VACIO: EstadoAccion = { ok: false, error: null, mensaje: null };

const META: Record<string, { label: string; tono: Tono }> = {
  generando: { label: "Generando…", tono: "azul" },
  borrador: { label: "Borrador", tono: "verde" },
  error: { label: "Error", tono: "rojo" },
  no_aplica: { label: "No aplica", tono: "gris" },
  pendiente_adjunto: { label: "Espera adjunto", tono: "ambar" },
  en_revision: { label: "En revisión", tono: "azul" },
  aprobado: { label: "Aprobado", tono: "verde" },
};

const fmt = new Intl.NumberFormat("es-MX");

export function RevisionView(p: {
  documentoId: string;
  version: number;
  estado: string;
  regimenLabel: string;
  emisora: string;
  reporte: string;
  costoUsd: number;
  tokensEntrada: number;
  tokensSalida: number;
  aprobadoEn: string | null;
  aprobadoPor: string | null;
  generadoPor: string | null;
  bloques: BloqueRevision[];
  puedeAprobar: boolean;
}) {
  const [sEstado, aEstado] = useActionState(cambiarEstado, VACIO);
  const toast = useToast();

  useEffect(() => {
    if (sEstado.mensaje) toast.success(sEstado.mensaje);
    else if (sEstado.error) toast.error(sEstado.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sEstado]);

  const cuentas = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of p.bloques) c[b.estado] = (c[b.estado] ?? 0) + 1;
    return c;
  }, [p.bloques]);

  // Lo que impide aprobar, calculado aquí para decirlo ANTES de que alguien lo
  // intente. El servidor lo vuelve a comprobar: esto es cortesía, no la barrera.
  const bloqueantes = useMemo(
    () =>
      p.bloques.filter(
        (b) =>
          b.estado !== "no_aplica" &&
          (b.pendientes.length > 0 || ["generando", "error", "pendiente_adjunto"].includes(b.estado))
      ),
    [p.bloques]
  );

  const secciones = useMemo(() => {
    const out: { nombre: string; items: BloqueRevision[] }[] = [];
    for (const b of p.bloques) {
      const ult = out[out.length - 1];
      if (ult && ult.nombre === b.seccion) ult.items.push(b);
      else out.push({ nombre: b.seccion, items: [b] });
    }
    return out;
  }, [p.bloques]);

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Taxonomía S1 / S2 · Suplemento
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Revisión del suplemento
        </h1>
        <p className="mt-2 text-sm text-muted">
          {p.emisora} · {p.reporte} · versión {p.version} · {p.regimenLabel}
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tono={META[p.estado]?.tono ?? "gris"}>{META[p.estado]?.label ?? p.estado}</Chip>
            {p.generadoPor && <span className="text-xs text-muted">generado por {p.generadoPor}</span>}
            {p.aprobadoEn && (
              <span className="text-xs text-muted">
                · aprobado por {p.aprobadoPor ?? "—"} el {new Date(p.aprobadoEn).toLocaleDateString("es-MX")}
              </span>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-ink">${p.costoUsd.toFixed(4)}</p>
            <p className="text-xs text-muted">
              {fmt.format(p.tokensEntrada)} tokens de entrada · {fmt.format(p.tokensSalida)} de salida
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(cuentas).map(([e, n]) => (
            <Chip key={e} tono={META[e]?.tono ?? "gris"}>
              {n} {META[e]?.label ?? e}
            </Chip>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {/* Desde borrador: el Word es como se lee el documento de corrido, y
              exigir la aprobación para verlo obligaría a aprobar antes de
              revisar. Mientras no esté aprobado sale con marca de agua. */}
          <DescargarWord documentoId={p.documentoId} estado={p.estado} />
          {p.estado === "borrador" && (
            <form action={aEstado}>
              <input type="hidden" name="documento_id" value={p.documentoId} />
              <input type="hidden" name="estado" value="en_revision" />
              <Button type="submit" variant="secondary" size="sm">
                Pasar a revisión
              </Button>
            </form>
          )}
          {p.estado !== "aprobado" && (
            <form action={aEstado}>
              <input type="hidden" name="documento_id" value={p.documentoId} />
              <input type="hidden" name="estado" value="aprobado" />
              <Button type="submit" size="sm" disabled={bloqueantes.length > 0} title={
                bloqueantes.length > 0 ? "Hay bloques con pendientes o sin generar" : "Aprobar el documento"
              }>
                Aprobar
              </Button>
            </form>
          )}
          {bloqueantes.length > 0 && (
            <span className="text-sm text-muted">
              No se puede aprobar: {bloqueantes.length} bloque(s) con pendientes o sin generar.
            </span>
          )}
        </div>

        {bloqueantes.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Qué falta ({bloqueantes.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {bloqueantes.map((b) => (
                <li key={b.numero} className="text-sm text-ink">
                  <span className="font-mono text-xs text-muted">{b.numero}</span> {b.titulo}
                  <span className="text-muted">
                    {" — "}
                    {b.pendientes.length ? `${b.pendientes.length} pendiente(s)` : META[b.estado]?.label ?? b.estado}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {secciones.map((sec) => (
        <section key={sec.nombre}>
          <h2 className="mb-2.5 font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            {sec.nombre}
          </h2>
          <div className="space-y-3">
            {sec.items.map((b) => (
              <BloqueCard
                key={b.numero}
                bloque={b}
                documentoId={p.documentoId}
                editable={p.estado !== "aprobado"}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * "Descargar Word". Va por fetch y no por un <a href> porque la ruta puede
 * responder 422 —documento sin bloques— o 500, y un enlace directo entregaría
 * un archivo de cero bytes con extensión .docx en vez de decir qué pasó.
 */
function DescargarWord({ documentoId, estado }: { documentoId: string; estado: string }) {
  const [bajando, setBajando] = useState(false);
  const toast = useToast();

  async function descargar() {
    setBajando(true);
    try {
      const res = await fetch(`/api/suplemento/${documentoId}/word`);
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new Error(cuerpo?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd ? /filename="?([^"]+)"?/i.exec(cd) : null;
      const nombre = m ? m[1] : "suplemento.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${nombre} descargado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el Word.");
    } finally {
      setBajando(false);
    }
  }

  return (
    <Button
      onClick={descargar}
      loading={bajando}
      variant="secondary"
      size="sm"
      title={
        estado === "aprobado"
          ? "Descargar el documento en Word"
          : "Descargar el documento en Word, con marca de agua de borrador"
      }
    >
      Descargar Word
    </Button>
  );
}

function BloqueCard({
  bloque,
  documentoId,
  editable,
}: {
  bloque: BloqueRevision;
  documentoId: string;
  editable: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  // `guardando` deshabilita el botón mientras la acción va en vuelo. Sin esto,
  // un clic impaciente de más dispara otra acción de servidor: es lo que dejó
  // tres entradas de bitácora para una sola edición del bloque 4.
  const [sTexto, aTexto, guardando] = useActionState(guardarTexto, VACIO);
  const toast = useToast();

  useEffect(() => {
    if (sTexto.mensaje) { toast.success(sTexto.mensaje); setEditando(false); }
    else if (sTexto.error) toast.error(sTexto.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sTexto]);

  /**
   * Tokens de salida por segundo. Se DERIVA, no se guarda: una columna con este
   * número podría contradecir a los dos de los que sale. Es lo que delata a un
   * bloque lento —el 21 escribió a 11.6 tok/s cuando los demás iban a 76— antes
   * de que el corte por tiempo lo tumbe.
   */
  function tokensPorSegundo(b: BloqueRevision): number | null {
    if (!b.duracionMs || b.duracionMs <= 0 || b.tokensSalida <= 0) return null;
    return b.tokensSalida / (b.duracionMs / 1000);
  }

  async function regenerar() {
    setRegenerando(true);
    try {
      const res = await fetch(`/api/suplemento/${documentoId}/bloque/${bloque.numero}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Regenerar a mano reinicia el contador de cortes: quien pulsa el botón
        // está empezando de nuevo, no reintentando la tanda anterior.
        body: JSON.stringify({ reiniciarIntentos: true }),
      });
      if (res.status !== 202) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      toast.success(`Bloque ${bloque.numero} regenerándose. Recarga en un momento.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenerando(false);
    }
  }

  const meta = META[bloque.estado] ?? { label: bloque.estado, tono: "gris" as Tono };

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink/[0.02]"
      >
        <span className="w-7 shrink-0 text-right font-mono text-xs text-muted">{bloque.numero}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{bloque.titulo}</span>
          <span className="block truncate text-xs text-muted">
            {bloque.texto ? `${bloque.texto.length.toLocaleString("es-MX")} caracteres` : "sin texto"}
            {bloque.modelo ? ` · ${bloque.modelo}` : ""}
            {bloque.promptVersion ? ` · ${bloque.promptVersion}` : ""}
            {bloque.costoUsd > 0 ? ` · $${bloque.costoUsd.toFixed(4)}` : ""}
            {tokensPorSegundo(bloque) !== null
              ? ` · ${bloque.duracionMs! / 1000 >= 100 ? Math.round(bloque.duracionMs! / 1000) : (bloque.duracionMs! / 1000).toFixed(1)} s a ${tokensPorSegundo(bloque)!.toFixed(1)} tok/s`
              : ""}
            {bloque.editadoEn ? ` · editado por ${bloque.editadoPor ?? "alguien"}` : ""}
          </span>
        </span>
        {bloque.pendientes.length > 0 && <Chip tono="ambar">{bloque.pendientes.length} pend.</Chip>}
        <Chip tono={meta.tono}>{meta.label}</Chip>
        <span aria-hidden className={cn("shrink-0 text-muted transition", abierto && "rotate-90")}>›</span>
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {bloque.texto ? (
            editando ? (
              <form action={aTexto} className="space-y-2">
                <input type="hidden" name="documento_id" value={documentoId} />
                <input type="hidden" name="numero" value={bloque.numero} />
                <textarea
                  name="texto"
                  defaultValue={bloque.texto}
                  rows={Math.min(30, Math.max(8, bloque.texto.split("\n").length + 2))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-xs leading-relaxed text-ink"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" loading={guardando}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditando(false)}
                    disabled={guardando}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <Texto texto={bloque.texto} />
            )
          ) : (
            <p className="text-sm text-muted">
              {bloque.estado === "no_aplica"
                ? "El régimen excluye este bloque; no se genera."
                : bloque.estado === "pendiente_adjunto"
                  ? "Se redactará desde el documento adjunto de su sección del Perfil (A5b)."
                  : "Sin texto todavía."}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {editable && bloque.texto && !editando && (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {editable && bloque.estado !== "no_aplica" && (
              <Button size="sm" variant="ghost" onClick={regenerar} loading={regenerando}>
                Regenerar
              </Button>
            )}
          </div>

          {bloque.fuentes.length > 0 && (
            <Lista titulo="Fuentes">
              {bloque.fuentes.map((f) => (
                <li key={f.id} className="text-sm">
                  <Enlace id={f.id} />
                  <span className="text-muted"> — {f.detalle}</span>
                </li>
              ))}
            </Lista>
          )}

          {bloque.pendientes.length > 0 && (
            <Lista titulo="Pendientes">
              {bloque.pendientes.map((x, i) => (
                <li key={i} className="text-sm text-ink">{x}</li>
              ))}
            </Lista>
          )}

          {bloque.notasRevision.length > 0 && (
            <Lista titulo="Notas para el revisor" ayuda="No se publican.">
              {bloque.notasRevision.map((x, i) => (
                <li key={i} className="text-sm leading-relaxed text-ink">{x}</li>
              ))}
            </Lista>
          )}
        </div>
      )}
    </Card>
  );
}

/** Un id de fuente enlaza a donde se arregla. `sol:` lleva a la solicitud. */
function Enlace({ id }: { id: string }) {
  const [tipo, resto] = id.split(":");
  const href =
    tipo === "sol" ? `/admin/solicitudes/${resto}`
    : tipo === "reg" ? "/admin/registros"
    : tipo === "obj" ? "/admin/objetivos"
    : tipo === "cue" ? "/admin/cuestionarios"
    : tipo === "perfil" ? "/admin/perfil"
    : null;
  if (!href) return <code className="text-xs text-muted">{id}</code>;
  return (
    <Link href={href} className="font-mono text-xs text-teal hover:underline">
      {id}
    </Link>
  );
}

function Texto({ texto }: { texto: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface px-5 py-4">
      {texto.split("\n\n").map((b, i) => {
        const lineas = b.split("\n");
        if (lineas.some((l) => l.trim().startsWith("|"))) {
          const filas = lineas.filter((l) => l.trim().startsWith("|") && !/^\|[\s|:-]+\|$/.test(l.trim()));
          const celdas = filas.map((f) => f.split("|").slice(1, -1).map((c) => c.trim()));
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {celdas.map((fila, j) => (
                    <tr key={j} className={cn(j === 0 && "border-b border-line")}>
                      {fila.map((c, k) => (
                        <td key={k} className={cn("px-2 py-1", j === 0 ? "font-medium text-muted" : "text-ink")}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const negrita = /^\*\*(.+)\*\*$/.exec(b.trim());
        if (negrita) return <p key={i} className="text-sm font-medium text-ink">{negrita[1]}</p>;
        return <p key={i} className="text-sm leading-relaxed text-ink">{b}</p>;
      })}
    </div>
  );
}

function Lista({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{titulo}</p>
      {ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}
      <ul className="mt-1.5 space-y-1.5">{children}</ul>
    </div>
  );
}
