"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { NOTA_ALCANCE_MAX } from "@/lib/gestion";
import { declararAlcance } from "./gestion-actions";

// =============================================================================
// Nota de ALCANCE sobre una solicitud YA VALIDADA. Vive junto a la asignación de
// rubro, en la pantalla de "no editable", por la misma razón: no es contenido de
// la solicitud ni cambia su valor: es la salvedad de perímetro con la que hay que
// leer su cifra en el entregable.
//
// El caso que la motiva es exactamente una solicitud validada — el Alcance 1 de
// GCARSO, que corresponde a la división Materiales y no a todo el grupo—, así que
// negarla aquí la volvería inútil.
// =============================================================================

export function DeclararAlcance({
  solicitudId,
  inicial,
}: {
  solicitudId: string;
  inicial: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [nota, setNota] = useState(inicial);
  const [pending, startTransition] = useTransition();

  const guardar = () => {
    startTransition(async () => {
      const r = await declararAlcance(solicitudId, nota.trim() || null);
      if (r.ok) {
        toast.success(r.mensaje ?? "Listo.");
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo guardar la nota de alcance.");
        setNota(inicial);
      }
    });
  };

  return (
    <div className="mt-8 border-t border-line pt-6 text-left">
      <label htmlFor="alcance-validada" className="block text-sm font-medium text-ink">
        Nota de alcance <span className="font-normal text-muted">· opcional</span>
      </label>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Qué comprende esta cifra y qué no, redactado para el entregable. Entra en la
        celda de <span className="font-medium text-ink">Notas/Brechas</span> del Excel
        de taxonomía, junto a lo que ya haya. Úsala cuando el perímetro del dato no
        sea el que un lector supondría —por ejemplo, si cubre una división y no todo
        el grupo—.
      </p>
      <textarea
        id="alcance-validada"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        disabled={pending}
        rows={3}
        maxLength={NOTA_ALCANCE_MAX}
        placeholder="Ej. La cifra corresponde al perímetro de la división Materiales (Elementia y Fortaleza); no comprende las demás divisiones."
        className="mt-3 w-full resize-y rounded-xl border border-line bg-crema/40 px-3.5 py-3 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface disabled:opacity-60"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs text-muted">
          {nota.trim().length}/{NOTA_ALCANCE_MAX} caracteres
        </span>
        <Button onClick={guardar} loading={pending} disabled={nota.trim() === inicial.trim()}>
          Guardar nota de alcance
        </Button>
      </div>
    </div>
  );
}
