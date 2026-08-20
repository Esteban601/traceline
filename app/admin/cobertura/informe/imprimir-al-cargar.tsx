"use client";

import { useEffect } from "react";

/**
 * Dispara el diálogo de impresión al cargar, cuando se llegó con `?imprimir=1`
 * (es decir, desde el botón "Exportar PDF"). Si alguien entra a la vista por su
 * cuenta, no se le abre nada: puede leerla en pantalla y usar el botón de la
 * propia vista cuando quiera.
 *
 * El `requestAnimationFrame` doble espera a que el navegador haya pintado: sin
 * eso, Chrome llega a abrir el diálogo con la hoja a medio maquetar y el PDF sale
 * con los anillos sin trazo.
 */
export function ImprimirAlCargar() {
  useEffect(() => {
    let cancelado = false;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!cancelado) window.print();
      })
    );
    return () => {
      cancelado = true;
      cancelAnimationFrame(id);
    };
  }, []);
  return null;
}

/** Botón de impresión de la propia vista (se oculta al imprimir). */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal px-4 text-sm font-medium text-crema shadow-soft transition duration-150 hover:bg-teal-dark"
    >
      Imprimir o guardar como PDF
    </button>
  );
}
