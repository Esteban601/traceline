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

// -----------------------------------------------------------------------------
// DOS ORÍGENES, UNA COLA (encargo suplemento-calidad, Paso 2).
//
// Las evidencias (bucket `evidencias`) y los adjuntos del Perfil del emisor
// (bucket `documentos`) se leen igual: misma extracción, mismos estados, misma
// bandera y mismo tope del tenant. Lo único que cambia es la tabla donde vive
// la fila, el bucket del archivo y lo que pasa alrededor: una evidencia nueva
// deja obsoletas las sugerencias de la versión anterior y, leída, genera la
// suya; un adjunto no tiene nada de eso.
// -----------------------------------------------------------------------------
type Tabla = "evidencias_contenido" | "perfil_emisor_adjuntos_contenido";

type Fila = {
  id: string;
  estado: string;
  intentos: number;
  tenant_id: string;
  archivo_path: string;
  nombre_original: string;
  created_at: string;
  solicitud_id?: string;
  version?: number;
};

type Origen = {
  tabla: Tabla;
  bucket: "evidencias" | "documentos";
  /** Prefijo del log. */
  etiqueta: string;
  /** Mensaje de `omitido` con la bandera apagada (el mismo que pone el trigger). */
  apagada: string;
  alTomar?: (fila: Fila) => Promise<void>;
  /** Después de guardar el contenido; devuelve el detalle que se agrega al resultado. */
  alExtraer?: (id: string, fila: Fila) => Promise<string>;
};

const EVIDENCIA: Origen = {
  tabla: "evidencias_contenido",
  bucket: "evidencias",
  etiqueta: "lectura",
  apagada: "La lectura de evidencias está apagada para esta emisora.",
  alTomar: async (fila) => {
    await obsoletarAnteriores(fila.solicitud_id!, fila.version!);
  },
  // La sugerencia no cambia el estado de la lectura: si falla, la lectura ya
  // quedó guardada y /api/evidencias/sugerir la puede regenerar.
  alExtraer: async (id, fila) => {
    try {
      const s = await generarSugerencia(id);
      return `sugerencia: ${s.estado}${s.detalle ? ` (${s.detalle})` : ""}`;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[sugerencia] ${fila.nombre_original}: ${error}`);
      return `sugerencia: error (${error})`;
    }
  },
};

const ADJUNTO: Origen = {
  tabla: "perfil_emisor_adjuntos_contenido",
  bucket: "documentos",
  etiqueta: "lectura-adjunto",
  apagada: "La lectura de documentos está apagada para esta emisora.",
};

export async function procesarLectura(id: string): Promise<ResultadoCola> {
  return procesar(EVIDENCIA, id);
}

export async function procesarLecturaAdjunto(id: string): Promise<ResultadoCola> {
  return procesar(ADJUNTO, id);
}

async function procesar(origen: Origen, id: string): Promise<ResultadoCola> {
  const db = createAdminClient();
  // Las dos tablas tienen las columnas que se tocan aquí; el tipo de una sirve
  // para las dos.
  const tabla = () => db.from(origen.tabla as "evidencias_contenido");

  const { data } = await tabla().select("*").eq("id", id).maybeSingle();
  const fila = data as unknown as Fila | null;
  if (!fila) return { id, estado: "inexistente" };
  const abandonada =
    fila.estado === "procesando" && Date.now() - new Date(fila.created_at).getTime() > PROCESANDO_ABANDONADO_MS;
  if (fila.estado !== "pendiente" && !abandonada) return { id, estado: fila.estado, detalle: "ya no estaba pendiente" };

  // Tomarla: solo si nadie la tomó entre el select y aquí.
  const intentos = fila.intentos + 1;
  const { data: tomada } = await tabla()
    .update({ estado: "procesando", intentos })
    .eq("id", id)
    .eq("estado", fila.estado as "pendiente")
    .select("id")
    .maybeSingle();
  if (!tomada) return { id, estado: "ocupada", detalle: "otro proceso la tomó" };
  await origen.alTomar?.(fila);

  const terminar = async (cambios: Record<string, unknown>, estado: string, detalle?: string) => {
    await tabla().update({ ...cambios, procesado_en: new Date().toISOString() }).eq("id", id);
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
    return terminar({ estado: "omitido", tipo: clase.tipo, mensaje: origen.apagada }, "omitido");
  }
  if ((await lecturasDelMes(db, fila.tenant_id)) >= tenant.lecturas_mes_max) {
    const mensaje = mensajeTope(tenant.lecturas_mes_max);
    return terminar({ estado: "omitido", tipo: clase.tipo, mensaje }, "omitido", mensaje);
  }

  try {
    const { data: blob, error: errDescarga } = await db.storage.from(origen.bucket).download(fila.archivo_path);
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
    if (!origen.alExtraer) return leida;
    return { ...leida, detalle: await origen.alExtraer(id, fila) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const agotado = intentos >= INTENTOS_MAX;
    console.error(`[${origen.etiqueta}] ${fila.nombre_original}: ${error}; intento ${intentos} → ${agotado ? "error" : "pendiente"}`);
    await tabla()
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

/** Para `after()` al subir un adjunto del Perfil: la fila se busca por el adjunto. */
export async function procesarLecturaDeAdjunto(adjuntoId: string): Promise<ResultadoCola | null> {
  const { data } = await createAdminClient()
    .from("perfil_emisor_adjuntos_contenido")
    .select("id")
    .eq("adjunto_id", adjuntoId)
    .maybeSingle();
  return data ? procesarLecturaAdjunto(data.id) : null;
}

/**
 * Barrido del cron: pendientes y procesando abandonadas, las más viejas primero,
 * de las dos tablas. El máximo es por corrida, no por tabla: primero las
 * evidencias (las espera una persona en la pantalla de captura), luego los
 * adjuntos con lo que quede.
 */
export async function procesarPendientes(maximo = 10): Promise<ResultadoCola[]> {
  const db = createAdminClient();
  const corte = new Date(Date.now() - PROCESANDO_ABANDONADO_MS).toISOString();
  const resultados: ResultadoCola[] = [];
  for (const origen of [EVIDENCIA, ADJUNTO]) {
    const restante = maximo - resultados.length;
    if (restante <= 0) break;
    const { data } = await db
      .from(origen.tabla as "evidencias_contenido")
      .select("id")
      .or(`estado.eq.pendiente,and(estado.eq.procesando,created_at.lt.${corte})`)
      .order("created_at", { ascending: true })
      .limit(restante);
    // En serie: una lectura por visión ya es una llamada larga, y en paralelo se
    // pisarían el tope mensual (dos procesos contando el mismo mes).
    for (const f of data ?? []) resultados.push(await procesar(origen, f.id));
  }
  return resultados;
}
