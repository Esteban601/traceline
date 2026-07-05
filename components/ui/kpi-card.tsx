import { cn } from "@/lib/cn";
import { TONO_CLASSES, type Tono } from "@/lib/estados";

export function KpiCard({
  label,
  value,
  tono,
}: {
  label: string;
  value: number;
  tono: Tono;
}) {
  const c = TONO_CLASSES[tono];
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-soft transition duration-150 ease-out hover:shadow-card">
      {/* Barra de acento del bucket */}
      <span className={cn("absolute inset-x-0 top-0 h-1", c.dot)} aria-hidden />
      <div className={cn("font-display text-4xl font-semibold tabular-nums", c.text)}>
        {value.toLocaleString("es-MX")}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}
