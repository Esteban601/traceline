import { cn } from "@/lib/cn";
import { ESTADO_META, TONO_CLASSES, type EstadoSolicitud, type Tono } from "@/lib/estados";

export function EstadoBadge({
  estado,
  className,
}: {
  estado: EstadoSolicitud;
  className?: string;
}) {
  const meta = ESTADO_META[estado];
  const c = TONO_CLASSES[meta.tono];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        c.text,
        c.bg,
        c.border,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function Chip({
  children,
  tono = "gris",
  className,
}: {
  children: React.ReactNode;
  tono?: Tono;
  className?: string;
}) {
  const c = TONO_CLASSES[tono];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        c.text,
        c.bg,
        c.border,
        className
      )}
    >
      {children}
    </span>
  );
}
