"use client";

import { useState } from "react";
import {
  DIAS_ANTES_MAX,
  MAX_RECORDATORIOS,
  PRESETS_RECORDATORIO,
  errorDiasAntes,
  etiquetaDias,
  fechaDisparo,
} from "@/lib/recordatorios-plan";
import { fmtDiaLargo } from "@/lib/fechas";

// =============================================================================
// Sección "Recordatorios automáticos" del formulario de solicitud.
//
// Vive dentro del formulario y no como pantalla aparte porque la decisión se toma
// junto con la fecha límite: el plazo y el aviso del plazo son el mismo acto.
//
// El estado es una lista de días ACTIVOS. Los presets desmarcados y los
// personalizados que alguien quitó siguen existiendo en la base con
// `activo = false` —para distinguir "no lo quisieron" de "nunca lo configuraron"—,
// pero aquí eso se ve como lo que es: una casilla sin marcar.
// =============================================================================

export function RecordatoriosSeccion({
  fechaLimite,
  dias,
  onChange,
  disabled = false,
}: {
  /** La del formulario, en vivo: sin ella la sección explica por qué no aplica. */
  fechaLimite: string;
  dias: number[];
  onChange: (dias: number[]) => void;
  disabled?: boolean;
}) {
  const [personalizado, setPersonalizado] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activos = new Set(dias);
  const personalizados = [...dias]
    .filter((d) => !PRESETS_RECORDATORIO.includes(d as (typeof PRESETS_RECORDATORIO)[number]))
    .sort((a, b) => b - a);

  const alternar = (d: number) => {
    const siguiente = new Set(activos);
    if (siguiente.has(d)) siguiente.delete(d);
    else {
      if (siguiente.size >= MAX_RECORDATORIOS) {
        setError(`Máximo ${MAX_RECORDATORIOS} recordatorios por solicitud.`);
        return;
      }
      siguiente.add(d);
    }
    setError(null);
    onChange([...siguiente].sort((a, b) => b - a));
  };

  const agregar = () => {
    const n = Number(personalizado.trim());
    const err = errorDiasAntes(n);
    if (err) {
      setError(err);
      return;
    }
    if (activos.has(n)) {
      setError(`Ya tienes un recordatorio ${etiquetaDias(n)}.`);
      return;
    }
    if (activos.size >= MAX_RECORDATORIOS) {
      setError(`Máximo ${MAX_RECORDATORIOS} recordatorios por solicitud.`);
      return;
    }
    setError(null);
    setPersonalizado("");
    onChange([...activos, n].sort((a, b) => b - a));
  };

  const cuando = (d: number) => {
    if (!fechaLimite) return null;
    const f = fechaDisparo(fechaLimite, d);
    return f ? fmtDiaLargo(f) : null;
  };

  return (
    <fieldset className="rounded-card border border-line bg-crema/20 p-5" disabled={disabled}>
      <legend className="px-1 text-sm font-medium text-ink">Recordatorios automáticos</legend>

      {fechaLimite ? (
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Se avisa por correo a los usuarios del área responsable, los días que marques
          antes de la fecha límite. No se manda nada si la solicitud ya está validada:
          recordar lo cumplido es ruido.
        </p>
      ) : (
        <p className="mt-1 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">Requieren fecha límite.</span> Un
          recordatorio se calcula desde el plazo (7 días antes de <em>qué</em>), así que
          sin fecha no hay cuándo. Puedes dejarlos configurados: empiezan a contar en
          cuanto pongas la fecha.
        </p>
      )}

      {/* Presets */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {PRESETS_RECORDATORIO.map((d) => {
          const on = activos.has(d);
          return (
            <label
              key={d}
              htmlFor={`recordatorio-preset-${d}`}
              className={[
                "inline-flex cursor-pointer items-center gap-2 rounded-pill border px-3.5 py-2 text-sm transition duration-150",
                on
                  ? "border-teal/40 bg-teal/10 text-teal"
                  : "border-line bg-surface text-muted hover:border-teal/30 hover:text-ink",
                disabled ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              {/* id estable: es lo que hace que una prueba pueda marcar EL preset
                  que quiere en vez de contar casillas del formulario. */}
              <input
                id={`recordatorio-preset-${d}`}
                type="checkbox"
                checked={on}
                onChange={() => alternar(d)}
                disabled={disabled}
                className="size-4 accent-teal"
              />
              <span className="font-medium">{etiquetaDias(d)}</span>
            </label>
          );
        })}
      </div>

      {/* Personalizados ya agregados */}
      {personalizados.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {personalizados.map((d) => (
            <li key={d}>
              <span className="inline-flex items-center gap-2 rounded-pill border border-gold/35 bg-gold/10 px-3.5 py-2 text-sm text-gold-dark">
                <span className="font-medium">{etiquetaDias(d)}</span>
                <button
                  type="button"
                  onClick={() => alternar(d)}
                  disabled={disabled}
                  aria-label={`Quitar el recordatorio de ${etiquetaDias(d)}`}
                  className="text-gold-dark/70 transition hover:text-rojo disabled:opacity-50"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Agregar personalizado */}
      <div className="mt-4 flex flex-wrap items-end gap-2.5">
        <div>
          <label htmlFor="recordatorio-personalizado" className="block text-xs text-muted">
            Agregar otro (días antes)
          </label>
          <input
            id="recordatorio-personalizado"
            type="number"
            min={1}
            max={DIAS_ANTES_MAX}
            inputMode="numeric"
            value={personalizado}
            onChange={(e) => setPersonalizado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Sin esto, Enter en este campo enviaría el formulario completo.
                e.preventDefault();
                agregar();
              }
            }}
            placeholder="14"
            className="mt-1 h-10 w-24 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50 disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={agregar}
          disabled={disabled || personalizado.trim() === ""}
          className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2.5 text-sm text-rojo">
          {error}
        </p>
      )}

      {/* Cuándo caerían, con la fecha del formulario. Es la comprobación que una
          persona necesita: "7 días antes" no dice nada; "el 12 de marzo", sí. */}
      {fechaLimite && dias.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-muted">
          {[...dias]
            .sort((a, b) => b - a)
            .map((d) => (
              <li key={d}>
                <span className="text-ink">{etiquetaDias(d)}</span> — se enviaría el{" "}
                {cuando(d) ?? "—"}
              </li>
            ))}
        </ul>
      )}

      {fechaLimite && dias.length === 0 && (
        <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
          Sin recordatorios: esta solicitud no generará avisos automáticos.
        </p>
      )}

      {/* Nota: los campos que lee la server action (`recordatorios_presentes` y
          `recordatorio_dias`) los arma el formulario en su onSubmit, que construye
          el FormData a mano. Duplicarlos aquí como inputs ocultos daría la falsa
          impresión de que este componente es el que los envía. */}
    </fieldset>
  );
}
