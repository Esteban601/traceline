"use client";

import { cn } from "@/lib/cn";
import { TODAS_LAS_AREAS } from "@/lib/difusion";

// =============================================================================
// Selector de ÁREAS del formulario de solicitud. Una sola → la solicitud de
// siempre. Dos o más → DIFUSIÓN: una copia idéntica por área, y las que no
// aplican lo declaran desde su portal.
//
// Es multi-selección con casillas y no un `multiple` nativo a propósito: el select
// múltiple del navegador exige Cmd/Ctrl para sumar, se colapsa a dos renglones y
// no admite un atajo de "todas". Aquí lo que se pide es justo lo contrario —ver de
// un golpe a quién se le va a preguntar— y eso el nativo no lo da.
// =============================================================================

export function AreasSelector({
  areas,
  seleccionadas,
  onChange,
  libre,
  onLibreChange,
  disabled = false,
  /** Con catálogo vacío (clientes heredados) se escribe el área a mano. */
  permitirLibre = true,
}: {
  areas: string[];
  seleccionadas: string[];
  onChange: (areas: string[]) => void;
  /**
   * Área escrita a mano y TODAVÍA sin agregar. La gobierna el formulario, no este
   * componente: si se quedara aquí, quien la escribe y pulsa "Crear solicitud" sin
   * pulsar antes "Agregar" perdería el área en silencio — y el enunciado se
   * guardaría sin destinatario. Pasó en una prueba antes de pasarle a alguien.
   */
  libre: string;
  onLibreChange: (v: string) => void;
  disabled?: boolean;
  permitirLibre?: boolean;
}) {
  const set = new Set(seleccionadas);
  const todas = areas.length > 0 && areas.every((a) => set.has(a));

  const alternar = (a: string) => {
    const next = new Set(set);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    onChange([...next]);
  };

  const agregarLibre = () => {
    const a = libre.trim();
    if (!a || set.has(a)) return;
    onLibreChange("");
    onChange([...set, a]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="block text-sm font-medium text-ink">
          Áreas
          <span className="ml-1.5 font-normal text-muted">
            {seleccionadas.length > 1 ? `· difusión a ${seleccionadas.length}` : "· una o varias"}
          </span>
        </span>
        {areas.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(todas ? [] : [...areas])}
            className="text-xs font-medium text-teal transition duration-150 hover:text-teal-dark disabled:opacity-50"
          >
            {todas ? "Ninguna" : "Todas las áreas"}
          </button>
        )}
      </div>

      {areas.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {areas.map((a) => {
            const on = set.has(a);
            return (
              <label
                key={a}
                htmlFor={`area-${a}`}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-pill border px-3 py-1.5 text-sm transition duration-150",
                  on
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-line bg-surface text-muted hover:border-teal/30 hover:text-ink",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  id={`area-${a}`}
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={() => alternar(a)}
                  className="size-4 accent-teal"
                />
                <span className="font-medium">{a}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Este cliente todavía no tiene catálogo de áreas: escríbela abajo.
        </p>
      )}

      {/* Área fuera del catálogo (clientes heredados) */}
      {permitirLibre && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            id="area_asignada"
            value={libre}
            onChange={(e) => onLibreChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Enter aquí agrega el área, no envía el formulario completo.
                e.preventDefault();
                agregarLibre();
              }
            }}
            disabled={disabled}
            placeholder="Otra área…"
            className="h-9 w-44 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={agregarLibre}
            disabled={disabled || libre.trim() === ""}
            className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      )}

      {/* Las que están fuera del catálogo se listan para poder quitarlas */}
      {seleccionadas.filter((a) => !areas.includes(a)).length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {seleccionadas
            .filter((a) => !areas.includes(a))
            .map((a) => (
              <li key={a}>
                <span className="inline-flex items-center gap-2 rounded-pill border border-gold/35 bg-gold/10 px-3 py-1.5 text-sm text-gold-dark">
                  {a}
                  <button
                    type="button"
                    onClick={() => alternar(a)}
                    disabled={disabled}
                    aria-label={`Quitar ${a}`}
                    className="text-gold-dark/70 transition hover:text-rojo disabled:opacity-50"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      {seleccionadas.length > 1 && (
        <p className="mt-3 rounded-xl border border-dashed border-teal/30 bg-teal/[0.04] px-3.5 py-2.5 text-xs leading-relaxed text-ink">
          <span className="font-semibold">Difusión a {seleccionadas.length} áreas.</span> Se
          creará una copia idéntica para cada una —mismo enunciado, fecha límite y
          recordatorios— y las que no tengan la información podrán declararlo desde su
          portal. Cuando sepas quién la tenía, podrás retirar las copias que sobren.
        </p>
      )}

      {/* Marcador para la server action: distingue "sin áreas" de "sin sección". */}
      <input type="hidden" name="areas_presentes" value="1" />
    </div>
  );
}

/** Etiqueta del atajo, exportada para las pruebas. */
export { TODAS_LAS_AREAS };
