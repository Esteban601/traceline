"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Extrae el filename de la cabecera Content-Disposition, con respaldo. */
function nombreDesde(cd: string | null): string {
  if (cd) {
    const m = /filename="?([^"]+)"?/i.exec(cd);
    if (m) return m[1];
  }
  return "matriz-trazabilidad.xlsx";
}

export function ExportButton() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/admin/cobertura/export");
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
    } catch {
      setError("No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={exportar} loading={cargando} size="md">
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
        {cargando ? "Generando…" : "Exportar matriz de trazabilidad"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
