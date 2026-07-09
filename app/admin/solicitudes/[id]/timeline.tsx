import { cn } from "@/lib/cn";
import { TONO_CLASSES } from "@/lib/estados";
import { fmtFechaHora } from "@/lib/fechas";
import { accionMeta, resumenBitacora, justificacionDe } from "@/lib/bitacora-vista";
import { EmptyState } from "@/components/ui/empty-state";

export type EventoBitacora = {
  id: string;
  createdAt: string;
  accion: string;
  detalle: Record<string, unknown> | null;
  usuario: string | null;
};

function limpiar(v: string | null): string {
  return (v ?? "").replace(/\[DEMO\]\s*/i, "").trim();
}

/** Timeline cronológico de la bitácora de una solicitud (más reciente arriba). */
export function Timeline({ eventos }: { eventos: EventoBitacora[] }) {
  if (eventos.length === 0) {
    return (
      <EmptyState compacto glifo="·" titulo="Sin actividad registrada todavía." />
    );
  }
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
      {eventos.map((e) => {
        const meta = accionMeta(e.accion);
        const c = TONO_CLASSES[meta.tono];
        const resumen = resumenBitacora(e.accion, e.detalle);
        const justificacion = justificacionDe(e.detalle);
        return (
          <li key={e.id} className="relative pl-6">
            <span
              className={cn(
                "absolute left-0 top-1 size-[11px] rounded-full ring-4 ring-surface",
                c.dot
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm font-medium text-ink">{meta.label}</span>
              <time className="text-xs text-muted" dateTime={e.createdAt}>
                {fmtFechaHora(e.createdAt)}
              </time>
            </div>
            {resumen && <p className="mt-0.5 text-sm text-muted">{resumen}</p>}
            <p className="mt-0.5 text-xs text-muted">
              {e.usuario ? limpiar(e.usuario) : "Sistema"}
            </p>
            {justificacion && (
              <p className="mt-1.5 rounded-lg border border-gold/25 bg-gold/5 px-2.5 py-1.5 text-xs leading-relaxed text-ink/90">
                <span className="font-medium text-gold">Justificación: </span>
                {justificacion}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
