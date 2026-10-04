import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BYTES_MAX, PAGINAS_MAX, clasificarArchivo } from "./tipos";
import { extraerContenido } from "./extraer";
import { generarSugerencia, obsoletarAnteriores } from "./sugerencias";
import { lecturasDelMes, mensajeTope } from "./tope";

// =============================================================================
// COLA DE LECTURA DE EVIDENCIAS (encargo captura sugerida, Paso 1).
//
// La fila de `evidencias_contenido` nace `pendiente` por trigger al insertar la
// evidencia. Aquí se procesa:
//   · con `after()` justo después de registrar la evidencia (portal y panel), y
//   · desde /api/evidencias/procesar (cron, CRON_SECRET) para lo que haya
//     quedado pendiente —un reinicio del dyno a media lectura, un error
//     transitorio—. Es el mismo patrón del generador (en_cola + intentos).
//
// Al quedar `extraido`, se genera la sugerencia (Paso 2, sugerencias.ts). Una
// versión nueva deja obsoletas las sugerencias de las anteriores en cuanto se
// toma, aunque su lectura falle: lo sugerido sobre un archivo ya reemplazado
// no se sigue mostrando.
//
// La bandera `lectura_evidencias_activa` y el tope `lecturas_mes_max` se
// vuelven a revisar AQUÍ, al procesar, no solo al encolar: pueden haber cambiado
// mientras la fila esperaba, y la cola es donde se aplica el tope (decisión 3).
// =============================================================================

/** Dos intentos: el segundo cubre un error transitorio; más, sería insistir. */
const INTENTOS_MAX = 2;
/** Una fila `procesando` más vieja que esto se da por abandonada (dyno reiniciado). */
const PROCESANDO_ABANDONADO_MS = 15 * 60 * 1000;

export type ResultadoCola = { id: string; estado: string; detalle?: string };

export async function procesarLectura(id: string): Promise<ResultadoCola> {
  const db = createAdminClient();

  const { data: fila } = await db
    .from("evidencias_contenido")
    .select("id, estado, intentos, tenant_id, solicitud_id, version, archivo_path, nombre_original, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!fila) return { id, estado: "inexistente" };
  const abandonada =
    fila.estado === "procesando" && Date.now() - new Date(fila.created_at).getTime() > PROCESANDO_ABANDONADO_MS;
  if (fila.estado !== "pendiente" && !abandonada) return { id, estado: fila.estado, detalle: "ya no estaba pendiente" };

  // Tomarla: solo si nadie la tomó entre el select y aquí.
  const intentos = fila.intentos + 1;
  const { data: tomada } = await db
    .from("evidencias_contenido")
    .update({ estado: "procesando", intentos })
    .eq("id", id)
    .eq("estado", fila.estado)
    .select("id")
    .maybeSingle();
  if (!tomada) return { id, estado: "ocupada", detalle: "otro proceso la tomó" };
  await obsoletarAnteriores(fila.solicitud_id, fila.version);

  const terminar = async (cambios: Record<string, unknown>, estado: string, detalle?: string) => {
    await db.from("evidencias_contenido").update({ ...cambios, procesado_en: new Date().toISOString() }).eq("id", id);
    return { id, estado, detalle };
  };

  const clase = clasificarArchivo(fila.nombre_original);
  if (!clase.soportado) {
    return terminar({ estado: "no_soportado", tipo: clase.tipo, mensaje: clase.mensaje }, "no_soportado", clase.mensaje);
  }

  // Bandera y tope del tenant, revisados al procesar.
  const { data: tenant } = await db
    .from("tenants")
    .select("lectura_evidencias_activa, lecturas_mes_max")
    .eq("id", fila.tenant_id)
    .single();
  if (!tenant?.lectura_evidencias_activa) {
    return terminar({ estado: "omitido", tipo: clase.tipo, mensaje: "La lectura de evidencias está apagada para esta emisora." }, "omitido");
  }
  if ((await lecturasDelMes(db, fila.tenant_id)) >= tenant.lecturas_mes_max) {
    const mensaje = mensajeTope(tenant.lecturas_mes_max);
    return terminar({ estado: "omitido", tipo: clase.tipo, mensaje }, "omitido", mensaje);
  }

  try {
    const { data: blob, error: errDescarga } = await db.storage.from("evidencias").download(fila.archivo_path);
    if (errDescarga || !blob) throw new Error(`no se pudo descargar el archivo: ${errDescarga?.message ?? "sin datos"}`);
    const archivo = Buffer.from(await blob.arrayBuffer());
    if (archivo.length > BYTES_MAX) {
      const mensaje = `El archivo pesa ${(archivo.length / 1024 / 1024).toFixed(1)} MB; el límite de lectura es 25 MB.`;
      return terminar({ estado: "omitido", tipo: clase.tipo, bytes: archivo.length, mensaje }, "omitido", mensaje);
    }

    const r = await extraerContenido(archivo, fila.nombre_original, clase);
    const leida = await terminar(
      {
        estado: "extraido",
        tipo: clase.tipo,
        contenido: r.contenido,
        paginas: r.paginas,
        hojas: r.hojas,
        truncado: r.truncado,
        bytes: archivo.length,
        modelo: r.modelo,
        tokens_entrada: r.tokensEntrada,
        tokens_salida: r.tokensSalida,
        costo_usd: r.costoUsd,
        error: null,
        mensaje: r.truncado ? `Se leyeron las primeras ${PAGINAS_MAX} páginas de ${r.paginas}.` : null,
      },
      "extraido"
    );
    // La sugerencia no cambia el estado de la lectura: si falla, la lectura ya
    // quedó guardada y /api/evidencias/sugerir la puede regenerar.
    try {
      const s = await generarSugerencia(id);
      return { ...leida, detalle: `sugerencia: ${s.estado}${s.detalle ? ` (${s.detalle})` : ""}` };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[sugerencia] ${fila.nombre_original}: ${error}`);
      return { ...leida, detalle: `sugerencia: error (${error})` };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const agotado = intentos >= INTENTOS_MAX;
    console.error(`[lectura] ${fila.nombre_original}: ${error}; intento ${intentos} → ${agotado ? "error" : "pendiente"}`);
    await db
      .from("evidencias_contenido")
      .update({ estado: agotado ? "error" : "pendiente", tipo: clase.tipo, error, ...(agotado ? { procesado_en: new Date().toISOString() } : {}) })
      .eq("id", id);
    return { id, estado: agotado ? "error" : "pendiente", detalle: error };
  }
}

/** Para `after()` en las acciones de subida: la fila se busca por la evidencia. */
export async function procesarLecturaDeEvidencia(evidenciaId: string): Promise<ResultadoCola | null> {
  const { data } = await createAdminClient()
    .from("evidencias_contenido")
    .select("id")
    .eq("evidencia_id", evidenciaId)
    .maybeSingle();
  return data ? procesarLectura(data.id) : null;
}

/** Barrido del cron: pendientes y procesando abandonadas, las más viejas primero. */
export async function procesarPendientes(maximo = 10): Promise<ResultadoCola[]> {
  const db = createAdminClient();
  const corte = new Date(Date.now() - PROCESANDO_ABANDONADO_MS).toISOString();
  const { data } = await db
    .from("evidencias_contenido")
    .select("id")
    .or(`estado.eq.pendiente,and(estado.eq.procesando,created_at.lt.${corte})`)
    .order("created_at", { ascending: true })
    .limit(maximo);
  const resultados: ResultadoCola[] = [];
  // En serie: una lectura por visión ya es una llamada larga, y en paralelo se
  // pisarían el tope mensual (dos procesos contando el mismo mes).
  for (const f of data ?? []) resultados.push(await procesarLectura(f.id));
  return resultados;
}
