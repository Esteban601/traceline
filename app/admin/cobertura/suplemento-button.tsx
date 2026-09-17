"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// =============================================================================
// "Suplemento S1 y S2" — las dos formas del mismo entregable.
//
// El diálogo existe porque son DOS archivos distintos del mismo documento y
// elegir cuál se descarga no es una confirmación: el contenido en Word es el que
// se edita y se comenta, y el informe con diseño es el que se enseña. Un menú
// desplegable escondería esa diferencia detrás de una flecha.
//
// La descarga va por fetch y no por un enlace directo para poder distinguir el
// fallo —sin permiso, archivo ausente en el ambiente— de un archivo vacío, que
// es lo que un <a download> entrega cuando la ruta responde con un error.
// =============================================================================

type Formato = "docx" | "pdf";

/** Extrae el filename de la cabecera Content-Disposition, con respaldo. */
function nombreDesde(cd: string | null, ext: string): string {
  if (cd) {
    const m = /filename="?([^"]+)"?/i.exec(cd);
    if (m) return m[1];
  }
  return `suplemento-s1-s2.${ext}`;
}

export function SuplementoButton({
  reporteId,
  ejercicio,
  pdfDisponible,
}: {
  reporteId: string;
  ejercicio: number;
  /**
   * Si `assets/vitrina/suplemento-demo.pdf` está en el servidor. Lo decide el
   * servidor, no este componente: un cliente no puede mirar el disco, y hacerlo
   * con una petición de tanteo enseñaría la opción durante un instante antes de
   * apagarla.
   */
  pdfDisponible: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [bajando, setBajando] = useState<Formato | null>(null);
  const toast = useToast();
  const titleId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !bajando) setAbierto(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto, bajando]);

  async function descargar(formato: Formato) {
    setBajando(formato);
    try {
      const res = await fetch(
        `/admin/cobertura/suplemento-demo?reporte=${encodeURIComponent(reporteId)}&formato=${formato}`
      );
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new Error(cuerpo?.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const nombre = nombreDesde(res.headers.get("Content-Disposition"), formato);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${nombre} descargado.`);
      setAbierto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setBajando(null);
    }
  }

  return (
    <>
      <Button onClick={() => setAbierto(true)} size="md">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M14 4v5h5M8 13h8M8 17h6" />
        </svg>
        Suplemento S1 y S2
      </Button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            aria-label="Cerrar"
            tabIndex={-1}
            onClick={() => !bajando && setAbierto(false)}
            className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[1px]"
          />
          <div className="toast-enter relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-lift">
            <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
              Suplemento NIIF S1 y S2 · ejercicio {ejercicio}
            </h2>

            <div className="mt-5 space-y-2.5">
              <Opcion
                titulo="Contenido en Word"
                detalle="Generado a partir de la información de la plataforma, con el nombre de tu emisora."
                cargando={bajando === "docx"}
                deshabilitado={bajando !== null}
                onClick={() => descargar("docx")}
              />
              <Opcion
                titulo="Informe con diseño (PDF)"
                // EL PDF NO SE PERSONALIZA, y el diálogo lo dice antes de que
                // alguien lo descubra. Sustituir texto dentro de un PDF exige
                // re-tipografiar la línea, así que se sirve tal cual: lleva el
                // contenido de Empresa Demo para todas las emisoras. Decirlo
                // aquí cuesta dos renglones; que un prospecto abra el informe y
                // encuentre el nombre de otra emisora cuesta la reunión.
                detalle={
                  pdfDisponible
                    ? "Muestra de la maquetación sobre el contenido de una emisora de ejemplo (Empresa Demo). El informe de tu emisora se producirá con su propia identidad al generar el suplemento."
                    : "Todavía no está listo; se activará en cuanto el archivo esté."
                }
                etiqueta={pdfDisponible ? null : "En preparación"}
                cargando={bajando === "pdf"}
                deshabilitado={!pdfDisponible || bajando !== null}
                onClick={() => descargar("pdf")}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAbierto(false)}
                disabled={bajando !== null}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Opcion({
  titulo,
  detalle,
  etiqueta,
  cargando,
  deshabilitado,
  onClick,
}: {
  titulo: string;
  detalle: string;
  /** Distintivo junto al título, para decir POR QUÉ está apagada la opción. */
  etiqueta?: string | null;
  cargando: boolean;
  deshabilitado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-crema/40 px-4 py-3 text-left transition duration-150 hover:border-teal/40 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{titulo}</span>
          {etiqueta && (
            <span className="rounded-pill border border-line bg-surface px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {etiqueta}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{detalle}</span>
      </span>
      {cargando ? (
        <span
          aria-hidden
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-teal border-t-transparent"
        />
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4v12M6 10l6 6 6-6" />
          <path d="M4 20h16" />
        </svg>
      )}
    </button>
  );
}
