import { ESTADO_META } from "@/lib/estados";
import { fmtFechaHora } from "@/lib/fechas";
import type { Verificaciones } from "@/lib/verificaciones";

// =============================================================================
// LAS DOS MARCAS de una solicitud, juntas: visto bueno del área y validación
// final. Se pintan igual en el portal y en el panel a propósito — la doble
// verificación solo sirve si todos ven lo mismo.
//
// Una marca ausente se DICE, no se esconde: "Sin visto bueno del área" en gris
// es información (nadie del área lo respaldó todavía), y ocultarla dejaría la
// pantalla insinuando que la única verificación que existe es la que sí está.
// =============================================================================

function Marca({
  titulo,
  cumplida,
  principal,
  secundario,
}: {
  titulo: string;
  cumplida: boolean;
  principal: string;
  secundario?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={[
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
          cumplida ? "bg-verde/15 text-verde" : "bg-gris/15 text-gris",
        ].join(" ")}
      >
        {cumplida ? "✓" : "–"}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
        <p className={"text-sm " + (cumplida ? "text-ink" : "text-muted")}>{principal}</p>
        {secundario ? <p className="text-xs text-muted">{secundario}</p> : null}
      </div>
    </div>
  );
}

export function MarcasVerificacion({
  verificaciones,
  compacto = false,
}: {
  verificaciones: Verificaciones;
  compacto?: boolean;
}) {
  const { vb, validacion } = verificaciones;

  return (
    <div
      className={[
        "grid gap-4 rounded-card border border-line bg-crema/20 p-4 sm:grid-cols-2",
        compacto ? "" : "sm:p-5",
      ].join(" ")}
    >
      <Marca
        titulo="Visto bueno del área"
        cumplida={vb.firmado}
        principal={vb.firmado ? (vb.quien ?? "Dado") : "Sin visto bueno del área"}
        secundario={vb.firmado && vb.fecha ? fmtFechaHora(vb.fecha) : null}
      />
      <Marca
        titulo="Validación"
        cumplida={validacion.validado}
        principal={
          validacion.validado
            ? (validacion.quien ?? validacion.etiqueta)
            : ESTADO_META[validacion.estado].label
        }
        secundario={
          validacion.validado
            ? [validacion.etiqueta, validacion.fecha ? fmtFechaHora(validacion.fecha) : null]
                .filter(Boolean)
                .join(" · ")
            : "Pendiente de validación"
        }
      />
    </div>
  );
}

/**
 * Indicador COMPACTO para la matriz: dos puntos, uno por verificación. En una
 * tabla de 135 renglones no cabe la frase, pero sí la pregunta que se hace quien
 * la lee: ¿cuáles ya pasaron por las dos manos?
 */
export function MarcasCompactas({
  vbFirmado,
  validado,
}: {
  vbFirmado: boolean;
  validado: boolean;
}) {
  const punto = (on: boolean, etiqueta: string) => (
    <span
      title={etiqueta}
      className={[
        "inline-grid size-4 place-items-center rounded-full text-[9px] font-bold",
        on ? "bg-verde/15 text-verde" : "bg-gris/12 text-gris/70",
      ].join(" ")}
    >
      {on ? "✓" : "–"}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">
        {vbFirmado ? "Con visto bueno del área" : "Sin visto bueno del área"};{" "}
        {validado ? "validada" : "sin validar"}
      </span>
      {punto(vbFirmado, vbFirmado ? "Visto bueno del área" : "Sin visto bueno del área")}
      {punto(validado, validado ? "Validada" : "Sin validar")}
    </span>
  );
}
