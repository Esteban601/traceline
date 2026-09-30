"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  comentarComoAuditor,
  responderComentarioAuditor,
  type ComentarioState,
} from "@/app/admin/comentarios-auditor/actions";
import type { ComentarioAuditor, ObjetoAuditado } from "@/lib/comentarios-auditor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fmtFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/cn";

const inicial: ComentarioState = { ok: false, error: null };

/**
 * Bloque "Comentarios del auditor" — el canal propio del auditor externo sobre
 * una solicitud, un registro de clima, un objetivo o una respuesta de
 * cuestionario.
 *
 * Va aparte del hilo de `comentarios` (IRStrat ↔ cliente) porque son
 * conversaciones distintas con reglas distintas: aquí el auditor pregunta y una
 * sola respuesta cierra el punto. Por eso cada comentario lleva su ESTADO DE
 * ATENCIÓN a la vista —"sin responder" o "respondido por X el Y"—: en una
 * auditoría, lo que no se contestó es justo lo que hay que encontrar sin
 * buscarlo.
 *
 * Quién ve qué:
 *   · el auditor escribe y lee las respuestas, pero NO ve el contador de
 *     pendientes: lo que falta por responder es asunto de quien responde;
 *   · staff y administrador del cliente responden, cualquiera de los dos;
 *   · el usuario de área no ve nada — RLS le devuelve cero filas y este
 *     componente ni se monta.
 */
export function ComentariosAuditor({
  objetoTipo,
  objetoId,
  comentarios,
  puedeComentar,
  puedeResponder,
  titulo = "Comentarios del auditor",
  compacto = false,
}: {
  objetoTipo: ObjetoAuditado;
  objetoId: string;
  comentarios: ComentarioAuditor[];
  /** true solo para el auditor externo. */
  puedeComentar: boolean;
  /** true para staff y administrador del cliente. */
  puedeResponder: boolean;
  titulo?: string;
  /** Variante para listas (clima, objetivos, cuestionarios): plegada por defecto. */
  compacto?: boolean;
}) {
  const sinResponder = comentarios.filter((c) => !c.respondidoEn).length;
  // Plegado por defecto en listas, salvo que haya algo pendiente: un contador
  // que hay que desplegar para ver no sirve de recordatorio.
  const [abierto, setAbierto] = useState(!compacto || sinResponder > 0);

  if (!puedeComentar && comentarios.length === 0) return null;

  const cuerpo = (
    <div className={cn("space-y-3", compacto ? "mt-3" : "mt-4")}>
      {comentarios.length === 0 ? (
        <p className="text-sm text-muted">
          {puedeComentar
            ? "Todavía no has dejado comentarios aquí."
            : "El auditor no ha comentado este punto."}
        </p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-line bg-crema/30 px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-ink">{c.autor}</span>
                <span className="text-xs text-muted">{fmtFechaHora(c.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink/90">{c.texto}</p>

              {c.respondidoEn ? (
                <div className="mt-3 border-t border-line/70 pt-3">
                  <p className="text-xs font-medium text-verde">
                    Respondido por {c.respondidoPor ?? "—"} el{" "}
                    {fmtFechaHora(c.respondidoEn)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink/90">
                    {c.respuesta}
                  </p>
                </div>
              ) : (
                <div className="mt-3 border-t border-line/70 pt-3">
                  <p className="text-xs font-medium text-gold">Sin responder</p>
                  {puedeResponder && <FormRespuesta comentarioId={c.id} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeComentar && (
        <FormComentario objetoTipo={objetoTipo} objetoId={objetoId} />
      )}
    </div>
  );

  if (!compacto) {
    return (
      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">{titulo}</h2>
          {/* El contador NO se le muestra al auditor: `puedeResponder` es falso
              para él, y es la misma condición que decide quién debe actuar. */}
          {puedeResponder && sinResponder > 0 && <ChipPendientes n={sinResponder} />}
        </div>
        {cuerpo}
      </section>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {titulo}
          <span className="ml-2 font-normal normal-case tracking-normal">
            {comentarios.length}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {puedeResponder && sinResponder > 0 && <ChipPendientes n={sinResponder} />}
          <span
            className={cn("text-muted transition duration-150", abierto && "rotate-180")}
            aria-hidden
          >
            ▾
          </span>
        </span>
      </button>
      {abierto && cuerpo}
    </div>
  );
}

function ChipPendientes({ n }: { n: number }) {
  return (
    <span className="rounded-pill bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
      {n} sin responder
    </span>
  );
}

function FormComentario({
  objetoTipo,
  objetoId,
}: {
  objetoTipo: ObjetoAuditado;
  objetoId: string;
}) {
  const [state, action, pending] = useActionState(comentarComoAuditor, inicial);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (ref.current) ref.current.value = "";
      toast.success("Comentario enviado.");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="space-y-2.5 border-t border-line/70 pt-3">
      <input type="hidden" name="objeto_tipo" value={objetoTipo} />
      <input type="hidden" name="objeto_id" value={objetoId} />
      <textarea
        ref={ref}
        name="texto"
        required
        rows={3}
        placeholder="Anota una observación o pide una aclaración…"
        className="w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">
          Lo verán IRStrat y el administrador de la emisora. No podrás editarlo
          después.
        </span>
        <Button type="submit" size="sm" loading={pending}>
          Comentar
        </Button>
      </div>
    </form>
  );
}

function FormRespuesta({ comentarioId }: { comentarioId: string }) {
  const [state, action, pending] = useActionState(responderComentarioAuditor, inicial);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (ref.current) ref.current.value = "";
      toast.success("Respuesta registrada.");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="mt-2.5 space-y-2">
      <input type="hidden" name="comentario_id" value={comentarioId} />
      <textarea
        ref={ref}
        name="respuesta"
        required
        rows={2}
        placeholder="Responde al auditor…"
        className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Responder
        </Button>
      </div>
    </form>
  );
}
