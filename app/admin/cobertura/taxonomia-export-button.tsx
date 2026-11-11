"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Extrae el filename de la cabecera Content-Disposition, con respaldo. */
function nombreDesde(cd: string | null): string {
  if (cd) {
    const m = /filename="?([^"]+)"?/i.exec(cd);
    if (m) return m[1];
  }
  return "taxonomia.xlsx";
}

/** Los dos libros por reporte: la plantilla oficial NIIF y el libro aparte de GRI y SASB. */
const LIBROS = {
  taxonomia: {
    ruta: "export-taxonomia",
    etiqueta: "Excel de taxonomía",
    hecho: "Excel de taxonomía generado.",
    titulo: "Genera la plantilla oficial llena con los datos validados del reporte",
  },
  "gri-sasb": {
    ruta: "export-gri-sasb",
    etiqueta: "Libro GRI/SASB",
    hecho: "Libro GRI/SASB generado.",
    titulo: "Genera el libro de contenidos GRI y métricas SASB del reporte, aparte de la plantilla oficial",
  },
} as const;

export function TaxonomiaExportButton({
  reporteId,
  libro = "taxonomia",
}: {
  reporteId: string | null;
  libro?: keyof typeof LIBROS;
}) {
  const L = LIBROS[libro];
  const [cargando, setCargando] = useState(false);
  const toast = useToast();

  async function exportar() {
    if (!reporteId) return;
    setCargando(true);
    try {
      // El libro es SIEMPRE de un reporte concreto: sin él, el endpoint responde
      // 400 en vez de adivinar (adivinar fue el bug que entregaba libros ajenos).
      const res = await fetch(
        `/admin/cobertura/${L.ruta}?reporte=${encodeURIComponent(reporteId)}`
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const nombre = nombreDesde(res.headers.get("Content-Disposition"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(L.hecho);
    } catch {
      toast.error("No se pudo generar la plantilla. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Button
      onClick={exportar}
      loading={cargando}
      disabled={!reporteId}
      title={
        reporteId
          ? L.titulo
          : `Elige un reporte para generar su ${L.etiqueta}`
      }
      variant="secondary"
      size="md"
    >
      {!cargando && (
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
          <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M14 4v5h5M8 13h8M8 17h5" />
        </svg>
      )}
      {cargando ? "Generando…" : L.etiqueta}
    </Button>
  );
}
