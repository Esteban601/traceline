import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAuditor, type PerfilActual } from "@/lib/data";
import type { Database } from "@/lib/database.types";

export type TipoActividadAuditor =
  Database["public"]["Enums"]["tipo_actividad_auditor"];

/**
 * Registra una VISTA o una DESCARGA del rol auditor en `auditor_actividad`.
 *
 * Por qué existe una tabla aparte y no la bitácora: la bitácora registra lo que
 * CAMBIA el expediente y la escriben triggers. Esto registra LECTURA, que no
 * deja rastro en ninguna tabla de negocio y que en un aseguramiento es justo lo
 * que hay que poder reconstruir —qué se le mostró al despacho y qué se llevó—.
 *
 * Tres decisiones que conviene tener a la vista:
 *
 *   · Se escribe con service_role. La tabla tiene INSERT revocado a
 *     `authenticated` y una restrictiva con `false`: si el propio auditor
 *     pudiera escribir su registro de actividad, el registro no valdría nada.
 *
 *   · NO es no-op silencioso para otros roles por descuido, sino por diseño:
 *     la llamada se deja en la página sin condicional y la función decide. Así
 *     una pantalla nueva no tiene que acordarse de preguntar "¿es auditor?", que
 *     es el olvido que el encargo §6 anticipa.
 *
 *   · FALLA ABIERTO: si el insert no entra, se registra en consola y la página
 *     sigue. Es una elección, y la contraria también era defendible. Se toma así
 *     porque esto instrumenta LECTURAS: tumbar el panel de un auditor porque no
 *     se pudo anotar que miró la matriz cambia una laguna en el registro por una
 *     caída del servicio, y la laguna es el daño menor. Para los actos que sí
 *     cambian algo, la trazabilidad sigue siendo la bitácora, que escribe la base
 *     en la misma transacción y no puede quedarse a medias.
 */
export async function registrarActividadAuditor(
  perfil: Pick<PerfilActual, "id" | "rol" | "tenant_id"> | null,
  evento: {
    tipo: TipoActividadAuditor;
    objetoTipo?: string | null;
    objetoId?: string | null;
    /** Nombre del archivo servido. La ruta del bucket no se guarda. */
    archivo?: string | null;
  }
): Promise<void> {
  if (!perfil || !esAuditor(perfil) || perfil.tenant_id === null) return;

  try {
    const h = await headers();
    // La IP NO se registra (decisión del 01/10/2026, protección de datos a
    // petición del cliente; encargo rol auditor §7). La columna `ip` sigue en la
    // tabla por la regla de migraciones aditivas, y un CHECK (ip IS NULL) hace
    // que la base rechace cualquier valor: no añadirla aquí.
    const { error } = await createAdminClient().from("auditor_actividad").insert({
      tenant_id: perfil.tenant_id,
      auditor_id: perfil.id,
      tipo: evento.tipo,
      objeto_tipo: evento.objetoTipo ?? null,
      objeto_id: evento.objetoId ?? null,
      archivo: evento.archivo ?? null,
      navegador: h.get("user-agent")?.slice(0, 500) ?? null,
    });
    if (error) {
      console.error("[auditor_actividad] no se registró la vista:", error.message);
    }
  } catch (e) {
    console.error(
      "[auditor_actividad] no se registró la vista:",
      e instanceof Error ? e.message : String(e)
    );
  }
}
