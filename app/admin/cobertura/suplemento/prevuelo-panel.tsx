"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

// =============================================================================
// Pre-vuelo del documento (encargo suplemento-calidad, Paso 5.4): lo que está
// mal o falta en los insumos, dicho UNA vez antes de generar. Con el botón del
// libro de hechos, el staff lo arma o lo rehace cuando los insumos cambiaron.
// =============================================================================

export type AvisoVista = { nivel: "bloquea" | "aviso" | "info"; texto: string };

const PUNTO: Record<AvisoVista["nivel"], string> = { bloquea: "bg-rojo", aviso: "bg-ambar", info: "bg-gris" };

export function PrevueloPanel({ reporteId, avisos, puedeArmarLibro }: { reporteId: string; avisos: AvisoVista[]; puedeArmarLibro: boolean }) {
  const [armando, setArmando] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function armar() {
    setArmando(true);
    try {
      const r = await fetch(`/api/suplemento/${reporteId}/hechos`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const abierto = await r.json().catch(() => ({}));
      if (r.status !== 202) throw new Error(abierto.error ?? `HTTP ${r.status}`);
      const hasta = Date.now() + 20 * 60 * 1000;
      while (Date.now() < hasta) {
        await new Promise((res) => setTimeout(res, 5000));
        const g = await fetch(`/api/suplemento/${reporteId}/hechos`);
        if (!g.ok) continue;
        const d = await g.json();
        if (d.corrida?.id !== abierto.id || d.corrida.estado === "generando") continue;
        if (d.corrida.estado === "error") throw new Error(d.corrida.error ?? "El libro no se pudo armar.");
        toast.success(d.corrida.estado === "reutilizado" ? "Los insumos no cambiaron: el libro sigue al día." : `Libro de hechos listo: ${d.libro.resumen?.total ?? "—"} hechos.`);
        break;
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setArmando(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4" data-prevuelo>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Antes de generar</p>
        {puedeArmarLibro && (
          <Button size="sm" variant="secondary" onClick={armar} loading={armando} disabled={armando}>
            {armando ? "Armando el libro de hechos…" : "Armar o rehacer el libro de hechos"}
          </Button>
        )}
      </div>
      {avisos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sin observaciones en los insumos.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {avisos.map((a, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink" data-nivel={a.nivel}>
              <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", PUNTO[a.nivel])} />
              {a.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
