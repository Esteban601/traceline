"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// =============================================================================
// Botón «Formato electrónico NIIF» (encargo 2026-10-13-excel-respuestas-
// narrativas, Paso 5). Solo con documento aprobado: si no, deshabilitado con el
// motivo (el mismo que daría la ruta). El auditor no lo ve: la página no lo pone.
// =============================================================================

function nombreDesde(cd: string | null): string {
  const m = cd ? /filename="?([^"]+)"?/i.exec(cd) : null;
  return m ? m[1] : "Formato_electronico_NIIF.xlsx";
}

export function FormatoExportButton({ reporteId, motivo }: { reporteId: string; motivo: string | null }) {
  const [cargando, setCargando] = useState(false);
  const toast = useToast();

  async function exportar() {
    setCargando(true);
    try {
      const res = await fetch(`/admin/cobertura/export-formato?reporte=${encodeURIComponent(reporteId)}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreDesde(res.headers.get("Content-Disposition"));
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Formato electrónico generado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el Formato electrónico.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Button
      onClick={exportar}
      loading={cargando}
      disabled={!!motivo}
      title={motivo ?? "Genera el Formato electrónico NIIF S1/S2 de la BMV desde el suplemento aprobado"}
      variant="secondary"
      size="md"
    >
      {cargando ? "Generando…" : "Formato electrónico NIIF"}
    </Button>
  );
}
