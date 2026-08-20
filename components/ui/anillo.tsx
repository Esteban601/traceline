import { cn } from "@/lib/cn";

// =============================================================================
// Anillo de progreso (SVG, trazo fino, editorial). Presentacional puro: lo usa el
// tablero de cobertura y el informe para imprimir, y de que sean EL MISMO anillo
// depende que el PDF no dibuje un avance distinto del de la pantalla.
//
// Dibuja sin JS —el arco sale en SSR con su `strokeDashoffset` final— y la
// animación es un keyframe CSS opcional: en el informe se apaga, porque una
// animación en una hoja que se va a imprimir no existe.
// =============================================================================

const R = 32;
const C = 2 * Math.PI * R;

/** Keyframe compartido. Se monta UNA vez por vista (lo hace `AnillosStyle`). */
export const ANILLO_STYLE = `
  @keyframes dibujar-anillo { from { stroke-dashoffset: ${C.toFixed(3)}px; } }
  .anillo-arco { animation: dibujar-anillo 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) { .anillo-arco { animation: none; } }
`;

export function AnillosStyle() {
  return <style>{ANILLO_STYLE}</style>;
}

export function Anillo({
  cubierto,
  total,
  label,
  animado = true,
  tamano = 80,
}: {
  cubierto: number;
  total: number;
  label: string;
  /** false en impresión: una animación no llega al papel. */
  animado?: boolean;
  tamano?: number;
}) {
  const porcentaje = total === 0 ? 0 : Math.round((cubierto / total) * 100);
  const objetivo = C * (1 - porcentaje / 100);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: tamano, height: tamano }}>
        <svg
          viewBox="0 0 80 80"
          width={tamano}
          height={tamano}
          role="img"
          aria-label={`${label}: ${porcentaje}% cubierto`}
        >
          <g transform="rotate(-90 40 40)">
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              strokeWidth="6"
              style={{ stroke: "var(--color-line)" }}
            />
            {porcentaje > 0 && (
              <circle
                className={cn(animado && "anillo-arco")}
                cx="40"
                cy="40"
                r={R}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={objetivo}
                style={{ stroke: "var(--color-teal)" }}
              />
            )}
          </g>
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-base font-semibold tabular-nums text-ink">
          {porcentaje}%
        </span>
      </div>
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="text-xs tabular-nums text-muted/70">
        {cubierto}/{total}
      </span>
    </div>
  );
}
