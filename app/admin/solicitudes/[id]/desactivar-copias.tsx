"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { desactivarCopias } from "./difusion-panel-actions";

// =============================================================================
// "Desactivar copias" — el cierre de una difusión: ya se sabe qué área tenía la
// información, y las demás copias sobran.
//
// No borra nada. Cada copia conserva su expediente y su conversación —incluida la
// declaración del área—; lo que hace es retirarlas del juego: dejan de pedir
// evidencia, de contar como brecha y de recordar. El botón ofrece de entrada las
// que ya declinaron o siguen sin responder, y NUNCA las que entregaron algo.
// =============================================================================

export function DesactivarCopias({
  copias,
}: {
  copias: { id: string; area: string | null; declinada: boolean }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [pending, setPending] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(copias.map((c) => c.id)));

  const alternar = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ejecutar = () => {
    setPending(true);
    startTransition(async () => {
      const r = await desactivarCopias([...sel]);
      setPending(false);
      setAbierto(false);
      if (r.ok) {
        toast.success(r.mensaje ?? "Copias retiradas.");
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudieron retirar las copias.");
      }
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
        Desactivar copias ({copias.length})
      </Button>

      <ConfirmDialog
        open={abierto}
        titulo="¿Retirar estas copias de la difusión?"
        descripcion="Dejan de pedir evidencia, de contar como brecha y de recordar. Su expediente y su conversación se conservan; nada se borra."
        confirmar={`Retirar ${sel.size}`}
        tono="danger"
        cargando={pending}
        onConfirm={ejecutar}
        onCancel={() => setAbierto(false)}
      >
        <ul className="space-y-1.5">
          {copias.map((c) => (
            <li key={c.id}>
              <label
                htmlFor={`copia-${c.id}`}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-ink"
              >
                <input
                  id={`copia-${c.id}`}
                  type="checkbox"
                  checked={sel.has(c.id)}
                  onChange={() => alternar(c.id)}
                  disabled={pending}
                  className="size-4 accent-teal"
                />
                <span className="font-medium">{c.area ?? "—"}</span>
                <span className="text-xs text-muted">
                  {c.declinada ? "declinó" : "sin respuesta"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  );
}
