"use server";

import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esAuditor, esStaff } from "@/lib/data";
import { excedeLimite, MENSAJE_ARCHIVO_GRANDE } from "./limite-subida";

// =============================================================================
// SUBIDA DIRECTA A STORAGE CON URL FIRMADA (decisión 1 del Paso 0; Paso 4).
//
// El archivo ya no pasa por la server action ni por el dyno:
//   1. `prepararSubidaEvidencia` comprueba quién sube, a qué solicitud y cuánto
//      pesa lo que dice que va a subir (25 MB), y firma UNA ruta de subida con
//      la sesión del usuario (Storage vuelve a aplicar su política al firmar).
//   2. El navegador sube el archivo a esa ruta con `uploadToSignedUrl`.
//   3. La acción de siempre (portal o panel) registra la fila de `evidencias`:
//      verifica que el objeto exista en la carpeta de esa solicitud y que pese
//      25 MB o menos (si no, lo retira y lo dice).
// El bucket tiene además su propio límite (migración 20261004160000), así que
// un archivo mayor no se guarda aunque alguien reutilizara la firma.
// El `bodySizeLimit` de 26 MB del hotfix v32 se queda como red.
// =============================================================================

export type SubidaFirmada =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim();
  return base.replace(/\s+/g, "_").slice(0, 120) || "archivo";
}

export async function prepararSubidaEvidencia(entrada: {
  solicitudId: string;
  nombre: string;
  bytes: number;
}): Promise<SubidaFirmada> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };
  if (esAuditor(perfil)) return { ok: false, error: "El auditor externo no puede realizar esta acción." };
  if (!Number.isFinite(entrada.bytes) || entrada.bytes <= 0) return { ok: false, error: "Selecciona o arrastra un archivo." };
  if (excedeLimite(entrada.bytes)) return { ok: false, error: MENSAJE_ARCHIVO_GRANDE };

  const db = await createClient();
  const { data: sol } = await db
    .from("solicitudes")
    .select("id, estado, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id, estado)")
    .eq("id", entrada.solicitudId)
    .single();
  const reporte = sol?.reporte as unknown as { tenant_id: string; estado: string } | null;
  if (!sol || !reporte) return { ok: false, error: "No se encontró la solicitud o no tienes acceso." };
  if (sol.estado === "congelado" || reporte.estado === "congelado") {
    return { ok: false, error: "El reporte está congelado; la carga está deshabilitada." };
  }
  if (esStaff(perfil)) {
    const { data: t } = await db.from("tenants").select("staff_puede_cargar").eq("id", reporte.tenant_id).single();
    if (!t?.staff_puede_cargar) return { ok: false, error: "La carga de evidencia corresponde al cliente." };
  }

  const path = `${reporte.tenant_id}/${sol.id}/${Date.now()}-${nombreSeguro(entrada.nombre)}`;
  const { data, error } = await db.storage.from("evidencias").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: `No se pudo preparar la subida: ${error?.message ?? "sin datos"}` };
  return { ok: true, path: data.path, token: data.token };
}
