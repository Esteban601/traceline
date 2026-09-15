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
  return "matriz-trazabilidad.xlsx";
}

export function ExportButton({ tenantId = null }: { tenantId?: string | null }) {
  const [cargando, setCargando] = useState(false);
  const toast = useToast();

  async function exportar() {
    setCargando(true);
    try {
      // El libro sigue al selector de cliente: lo que se ve es lo que se exporta.
      const endpoint = tenantId
        ? `/admin/cobertura/export?tenant=${encodeURIComponent(tenantId)}`
        : "/admin/cobertura/export";
      const res = await fetch(endpoint);
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
      toast.success("Matriz de trazabilidad generada.");
    } catch {
      toast.error("No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    // Claro, como el PDF de cobertura y el Excel de taxonomía: los tres son
    // exportaciones de lo que ya está en pantalla. El oscuro queda para el
    // Suplemento, que es el entregable y no un volcado.
    <Button onClick={exportar} loading={cargando} variant="secondary" size="md">
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
          <path d="M12 4v12M6 10l6 6 6-6" />
          <path d="M4 20h16" />
        </svg>
      )}
      {cargando ? "Generando…" : "Matriz de trazabilidad"}
    </Button>
  );
}
