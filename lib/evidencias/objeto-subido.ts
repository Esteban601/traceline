import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { excedeLimite, MENSAJE_ARCHIVO_GRANDE } from "./limite-subida";

// =============================================================================
// VERIFICACIÓN DEL ARCHIVO SUBIDO CON URL FIRMADA (Paso 4).
//
// Antes de registrar la fila de `evidencias`, la acción comprueba con la sesión
// del usuario que:
//   · la ruta es de la carpeta de ESA solicitud (`{tenant}/{solicitud}/…`): la
//     ruta llega del navegador y no se le cree;
//   · el objeto existe y tiene bytes (la misma comprobación que la descarga);
//   · pesa 25 MB o menos. Si pesa más, se retira con service_role —el usuario no
//     tiene DELETE en el bucket— y se dice con el mensaje propio.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

export type ObjetoSubido = { ok: true; bytes: number } | { ok: false; error: string };

export async function verificarObjetoSubido(db: Db, path: string, prefijo: string): Promise<ObjetoSubido> {
  if (!path || !path.startsWith(prefijo) || path.includes("..") || path.slice(prefijo.length).includes("/")) {
    return { ok: false, error: "La ruta del archivo no corresponde a esta solicitud." };
  }
  const corte = path.lastIndexOf("/");
  const carpeta = path.slice(0, corte);
  const archivo = path.slice(corte + 1);
  const { data, error } = await db.storage.from("evidencias").list(carpeta, { limit: 100, search: archivo });
  const objeto = data?.find((o) => o.name === archivo);
  const bytes = objeto?.metadata?.size;
  if (error || !objeto || typeof bytes !== "number" || bytes <= 0) {
    return { ok: false, error: "No encontramos el archivo subido; vuelve a intentarlo." };
  }
  if (excedeLimite(bytes)) {
    try {
      await createAdminClient().storage.from("evidencias").remove([path]);
    } catch (e) {
      console.error("[evidencia] no se pudo retirar el archivo que excede el límite:", e);
    }
    return { ok: false, error: MENSAJE_ARCHIVO_GRANDE };
  }
  return { ok: true, bytes };
}
