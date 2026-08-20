import { cn } from "@/lib/cn";
import { ESTADO_META, TONO_CLASSES } from "@/lib/estados";
import { fmtFechaHora } from "@/lib/fechas";
import type { Verificaciones } from "@/lib/verificaciones";

// =============================================================================
// LAS DOS MARCAS de una solicitud, juntas: visto bueno del área y validación
// final. Se pintan igual en el portal y en el panel a propósito — la doble
// verificación solo sirve si todos ven lo mismo.
//
// JERARQUÍA VISUAL. El estado se distingue VIENDO, no leyendo: la marca cumplida
// es un badge verde del sistema (los mismos tokens que el estado "Validado") con
// su ✓ y el nombre en tinta plena; la pendiente queda apagada —fondo neutro,
// contorno gris, texto gris—. Una junto a la otra, el peso no puede ser el mismo:
// eso es justo lo que la pantalla tiene que decir de un vistazo.
//
// Una marca ausente se DICE, no se esconde: "Sin visto bueno del área" es
// información (nadie del área lo respaldó todavía), y ocultarla dejaría la
// pantalla insinuando que la única verificación que existe es la que sí está.
// =============================================================================

const VERDE = TONO_CLASSES.verde;
const GRIS = TONO_CLASSES.gris;

/** ✓ para lo cumplido; círculo vacío para lo que falta. Mismo trazo que los estados. */
function IconoMarca({ cumplida }: { cumplida: boolean }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-[17px] shrink-0",
    "aria-hidden": true,
  };
  return cumplida ? (
    <svg {...common}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg {...common} strokeWidth={2}>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />
    </svg>
  );
}

function Marca({
  etiqueta,
  cumplida,
  principal,
  secundario,
}: {
  /** Lo que va DENTRO del badge: el nombre de la verificación. */
  etiqueta: string;
  cumplida: boolean;
  /** Quién (tinta plena si está cumplida). */
  principal: string | null;
  secundario?: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-4",
        cumplida ? cn(VERDE.border, "bg-verde/[0.06]") : "border-line bg-crema/40"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap rounded-pill border px-3 py-1 text-sm font-semibold",
          cumplida
            ? cn(VERDE.text, VERDE.bg, VERDE.border)
            : cn(GRIS.text, "border-line bg-surface")
        )}
      >
        <IconoMarca cumplida={cumplida} />
        {etiqueta}
      </span>
      {principal ? (
        <p
          className={cn(
            "mt-2.5 text-sm",
            cumplida ? "font-medium text-ink" : "text-muted"
          )}
        >
          {principal}
        </p>
      ) : null}
      {secundario ? <p className="mt-0.5 text-xs text-muted">{secundario}</p> : null}
    </div>
  );
}

export function MarcasVerificacion({
  verificaciones,
}: {
  verificaciones: Verificaciones;
}) {
  const { vb, validacion } = verificaciones;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Marca
        etiqueta={vb.firmado ? "Visto bueno del área" : "Sin visto bueno del área"}
        cumplida={vb.firmado}
        principal={vb.firmado ? (vb.quien ?? "Dado") : "Nadie del área lo ha respaldado todavía"}
        secundario={vb.firmado && vb.fecha ? fmtFechaHora(vb.fecha) : null}
      />
      <Marca
        etiqueta={validacion.validado ? "Validación" : "Validación pendiente"}
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
 * Indicador COMPACTO para la matriz: un punto por verificación, con el mismo
 * lenguaje que la tarjeta —verde lleno lo cumplido, contorno gris lo pendiente—.
 * En una tabla de 135 renglones no cabe la frase, pero sí la pregunta que se hace
 * quien la lee: ¿cuáles ya pasaron por las dos manos?
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
      aria-hidden
      className={cn(
        "size-2.5 rounded-full",
        on ? VERDE.dot : "border-[1.5px] border-gris/45 bg-transparent"
      )}
    />
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* El texto para lectores de pantalla dice las dos, en palabras: los puntos
          son un resumen visual, no la única forma de leer la fila. */}
      <span className="sr-only">
        {vbFirmado ? "Con visto bueno del área" : "Sin visto bueno del área"};{" "}
        {validado ? "validada" : "sin validar"}
      </span>
      {punto(vbFirmado, vbFirmado ? "Visto bueno del área dado" : "Sin visto bueno del área")}
      {punto(validado, validado ? "Validada" : "Sin validar")}
    </span>
  );
}
