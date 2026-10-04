import { createClient } from "@/lib/supabase/client";
import { MENSAJE_ARCHIVO_GRANDE } from "./limite-subida";
import { prepararSubidaEvidencia } from "./subida-firmada";

// =============================================================================
// Subida desde el NAVEGADOR con URL firmada (Paso 4). La usan el portal y el
// panel antes de llamar a su acción de registro: pide la firma (que ya valida
// quién, dónde y los 25 MB), sube el archivo directo a storage y devuelve la
// ruta que la acción va a verificar y registrar.
// =============================================================================

export type ArchivoSubido = { ok: true; path: string } | { ok: false; error: string };

export async function subirArchivoFirmado(solicitudId: string, file: File): Promise<ArchivoSubido> {
  const firma = await prepararSubidaEvidencia({ solicitudId, nombre: file.name, bytes: file.size });
  if (!firma.ok) return firma;
  const { error } = await createClient()
    .storage.from("evidencias")
    .uploadToSignedUrl(firma.path, firma.token, file, { contentType: file.type || "application/octet-stream" });
  if (error) {
    // El límite del bucket responde 413 / «maximum allowed size»: mismo mensaje propio.
    const grande = /maximum allowed size|payload too large|413/i.test(error.message);
    return { ok: false, error: grande ? MENSAJE_ARCHIVO_GRANDE : `No se pudo subir el archivo: ${error.message}` };
  }
  return { ok: true, path: firma.path };
}
