import Link from "next/link";
import { cn } from "@/lib/cn";
import { TONO_CLASSES } from "@/lib/estados";
import { fmtFechaHora } from "@/lib/fechas";
import { ESTADO_GRUPO_META, type EstadoEnGrupo } from "@/lib/difusion";
import { DesactivarCopias } from "./desactivar-copias";

// =============================================================================
// VISTA DE GRUPO — para quien difundió. La pregunta que resuelve es una sola:
// «¿quién de todas las áreas tenía esta información?».
//
// Por eso la tabla no repite el estado de la máquina de estados: traduce la
// RESPUESTA de cada área (entregó / en proceso / declinó / sin respuesta), que es
// lo que decide el siguiente movimiento. El estado interno sigue estando en el
// detalle de cada copia, a un clic.
// =============================================================================

export type CopiaDelGrupo = {
  id: string;
  area: string | null;
  estadoGrupo: EstadoEnGrupo;
  evidencias: number;
  declinada: boolean;
  desactivada: boolean;
  /** Última declaración del área, si la hubo (del comentario que se publicó). */
  notaDeclinada: string | null;
  declinadaEn: string | null;
  esEsta: boolean;
};

export function GrupoDifusion({
  copias,
  puedeDesactivar,
}: {
  copias: CopiaDelGrupo[];
  /** Quien difundió (por la regla de origen) puede retirar copias. */
  puedeDesactivar: boolean;
}) {
  const activas = copias.filter((c) => !c.desactivada);
  const entregaron = copias.filter((c) => c.estadoGrupo === "entrego");
  const declinaron = copias.filter((c) => c.declinada && !c.desactivada);
  // Candidatas a retirar: las que ya dijeron que no les corresponde, o las que
  // siguen sin responder cuando alguien más ya entregó. Nunca las que entregaron.
  const retirables = copias.filter(
    (c) =>
      !c.desactivada &&
      c.evidencias === 0 &&
      (c.declinada || (entregaron.length > 0 && c.estadoGrupo === "sin_respuesta"))
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-semibold text-ink">
          Difusión a {copias.length} áreas
          <span className="ml-2 text-sm font-normal text-muted">
            {entregaron.length} entregó · {declinaron.length} declinó ·{" "}
            {activas.length - entregaron.length - declinaron.length} sin respuesta
          </span>
        </h2>
        {puedeDesactivar && retirables.length > 0 && (
          <DesactivarCopias
            copias={retirables.map((c) => ({
              id: c.id,
              area: c.area,
              declinada: c.declinada,
            }))}
          />
        )}
      </div>

      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        La misma pregunta se hizo a varias áreas porque no se sabía cuál tiene el
        dato. Cada copia es una solicitud completa —su evidencia, su visto bueno y su
        validación son suyos—; esto es solo el hilo que las une.
      </p>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Área</th>
              <th className="px-4 py-3 font-medium">Respuesta</th>
              <th className="px-4 py-3 text-center font-medium">Versiones</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {copias.map((c) => {
              const meta = ESTADO_GRUPO_META[c.estadoGrupo];
              const t = TONO_CLASSES[meta.tono];
              return (
                <tr
                  key={c.id}
                  className={cn(
                    "border-b border-line/70 last:border-0",
                    c.esEsta && "bg-teal/[0.04]",
                    c.desactivada && "opacity-60"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {c.area ?? "—"}
                    {c.esEsta && (
                      <span className="ml-2 rounded-pill bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal">
                        esta
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium",
                        t.text,
                        t.bg,
                        t.border
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />
                      {meta.label}
                    </span>
                    {c.notaDeclinada && (
                      // La nota del área es la pista de dónde SÍ está el dato: es lo
                      // que ahorra la siguiente vuelta de correos, así que se lee
                      // aquí y no escondida en la conversación de esa copia.
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                        “{c.notaDeclinada}”
                        {c.declinadaEn ? (
                          <span className="text-muted/70"> · {fmtFechaHora(c.declinadaEn)}</span>
                        ) : null}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-ink">
                    {c.evidencias > 0 ? c.evidencias : <span className="text-muted/60">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.esEsta ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Link
                        href={`/admin/solicitudes/${c.id}`}
                        className="font-medium text-teal underline decoration-teal/30 underline-offset-4 transition hover:decoration-teal"
                      >
                        Abrir
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
