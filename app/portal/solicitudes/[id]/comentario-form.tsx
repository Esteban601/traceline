"use client";

import { useActionState, useEffect, useRef } from "react";
import { agregarComentario, type ComentarioState } from "./actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const initial: ComentarioState = { ok: false, error: null };

export function ComentarioForm({ solicitudId }: { solicitudId: string }) {
  const [state, formAction, pending] = useActionState(agregarComentario, initial);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (ref.current) ref.current.value = "";
      toast.success("Comentario publicado.");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="solicitud_id" value={solicitudId} />
      <textarea
        ref={ref}
        name="contenido"
        required
        rows={3}
        placeholder="Escribe una respuesta o aclaración…"
        className="w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          Tu comentario será visible para el equipo de IRStrat.
        </span>
        <Button type="submit" size="sm" loading={pending}>
          Publicar
        </Button>
      </div>
    </form>
  );
}
