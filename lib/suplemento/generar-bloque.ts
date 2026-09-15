import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ensamblarReporte, type EntregaSolicitud, type SolRow } from "@/lib/reporte/ensamblar";
import { evaluarCompletitud, type BloqueEvaluado } from "@/lib/suplemento/completitud";
import {
  BLOQUES,
  datapointsExentos,
  rubroExento,
  type Bloque,
} from "@/lib/suplemento/bloques";
import { leerAlivios, regimenDe, ALIVIOS, type Alivios, type Regimen } from "@/lib/perfil-emisor";
import {
  MODELOS,
  MODELO_POR_DEFECTO,
  costoUsd,
  esfuerzoDeTipo,
  modeloDeTipo,
  type ClaveModelo,
  type Esfuerzo,
  type Uso,
} from "@/lib/suplemento/modelos";
import {
  ESQUEMA_SALIDA,
  PROMPT_VERSION,
  capaEstable,
  capaVolatil,
  marcadoresMalFormados,
  normalizarDenominacion,
  vocabularioProhibidoEn,
  type FuenteEntregada,
  type RequisitoNiif,
} from "@/lib/suplemento/prompt";
import { fronteraDe } from "@/lib/suplemento/fronteras";
import { TABLAS } from "@/lib/suplemento/tablas";
import { extensionDe as extensionDeBloque, viaDe, type Via } from "@/lib/suplemento/vias";
import { PLANTILLAS } from "@/lib/suplemento/plantillas";
import { ETIQUETA_CAMPO, SECCION_DE_CAMPO } from "@/lib/suplemento/completitud";

// =============================================================================
// GENERACIÓN DE UN BLOQUE DEL SUPLEMENTO.
//
// Recibe un documento y un bloque, arma el prompt con los datos REALES de ese
// reporte y persiste lo que el modelo devuelve, con su costo y su procedencia.
//
// TRES COSAS QUE ESTE ARCHIVO HACE Y NO SE PUEDEN QUITAR:
//
//  1. COMPRUEBA EL AISLAMIENTO ANTES DE ARMAR NADA. El reporte tiene que
//     pertenecer al tenant del documento. Es una consulta de dos columnas y va
//     primero: armar un prompt con datos de otra emisora y luego descubrirlo ya
//     habría mandado esos datos al modelo.
//
//  2. VERIFICA LAS FUENTES CITADAS. El modelo devuelve `fuentes_usadas`; si
//     contiene un id que no se le entregó, la respuesta se rechaza. Un id
//     inventado es la señal más barata de que el texto también lo es. Se
//     reintenta UNA vez explicándole el error concreto.
//
//  3. GUARDA EL COSTO CON SU DESGLOSE. Entrada sin cachear, escritura al caché y
//     lectura del caché se cobran a precios distintos; un solo total no permite
//     reconstruir ni auditar la factura.
//
// NO DECIDE si el bloque "está completo": eso lo dice `evaluarCompletitud`, que
// es la misma función que pinta el semáforo. Aquí solo se consume.
// =============================================================================

type Cliente = SupabaseClient<Database>;

export type MotivoFallo =
  | "sin_api_key"
  | "documento_no_existe"
  | "bloque_no_existe"
  | "reporte_ajeno"
  | "reporte_ilegible"
  | "fuentes_invalidas"
  | "voz_incorrecta"
  | "pendiente_adjunto"
  | "no_aplica"
  | "respuesta_ilegible"
  | "api_error"
  | "corte_tiempo"
  | "sin_saldo";

export type ResultadoGeneracion =
  | {
      ok: true;
      texto: string;
      fuentesUsadas: string[];
      pendientes: string[];
      /** Juicios para el revisor. NO se publican. */
      notasRevision: string[];
      /** La tabla que arma el código y va delante del texto, si el bloque lleva. */
      tabla: string | null;
      modelo: ClaveModelo;
      uso: Uso;
      costo: number;
      duracionMs: number;
      /** Cuántos intentos hicieron falta. 2 = el primero fue rechazado. */
      intentos: number;
      correccionesGrafia: number;
      /** Por dónde se produjo: plantilla, perfil o datos. */
      via: Via;
      /** false cuando el bloque se resolvió sin llamar al modelo. */
      conModelo: boolean;
      bloque: BloqueEvaluado;
    }
  | { ok: false; motivo: MotivoFallo; detalle: string };

export type OpcionesGeneracion = {
  modelo?: ClaveModelo;
  /** Sobrescribe el esfuerzo del tipo de bloque. Para barridos de medición. */
  esfuerzo?: Esfuerzo;
  /** Instrucción de extensión. Por bloque, porque no todos piden lo mismo. */
  extension?: string;
  /** Solo para pruebas: no escribe en documentos_bloques. */
  sinPersistir?: boolean;
};


/** Corte de la llamada al modelo. Por debajo del vencimiento de 3 minutos del
 *  bloque, para que el error llegue antes que el síntoma. */
const LIMITE_LLAMADA_MS = 150_000;

export async function generarBloque(
  supabase: Cliente,
  documentoId: string,
  bloqueId: number | string,
  opciones: OpcionesGeneracion = {}
): Promise<ResultadoGeneracion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Sin modo de respaldo a propósito: un suplemento a medias que parece
    // completo es peor que uno que no se generó.
    return {
      ok: false,
      motivo: "sin_api_key",
      detalle: "Falta ANTHROPIC_API_KEY. El generador no tiene modo de respaldo.",
    };
  }

  const bloque = resolverBloque(bloqueId);
  if (!bloque) {
    return { ok: false, motivo: "bloque_no_existe", detalle: `No hay bloque ${bloqueId}.` };
  }

  // --- 1. Documento, y el aislamiento ANTES de cualquier otra consulta --------
  const { data: doc } = await supabase
    .from("documentos_generados")
    .select("id, tenant_id, reporte_id, idioma")
    .eq("id", documentoId)
    .maybeSingle();

  if (!doc) {
    return { ok: false, motivo: "documento_no_existe", detalle: "El documento no existe o no es visible." };
  }

  const { data: rep } = await supabase
    .from("reportes")
    .select("id, tenant_id, anio_adopcion, alivios")
    .eq("id", doc.reporte_id)
    .maybeSingle();

  if (!rep) {
    return { ok: false, motivo: "reporte_ilegible", detalle: "No se pudo leer el reporte del documento." };
  }
  if (rep.tenant_id !== doc.tenant_id) {
    // No debería poder pasar —la FK y la RLS lo impiden— pero es la barrera que
    // decide si los datos de una emisora salen hacia el modelo. Se comprueba.
    return {
      ok: false,
      motivo: "reporte_ajeno",
      detalle: "El reporte no pertenece al tenant del documento.",
    };
  }

  // --- 2. Datos -------------------------------------------------------------
  const ens = await ensamblarReporte(supabase, doc.reporte_id);
  if (!ens.ok) {
    return { ok: false, motivo: "reporte_ilegible", detalle: `Ensamblado: ${ens.causa}.` };
  }

  const comp = await evaluarCompletitud(supabase, doc.reporte_id);
  if (!comp.ok) {
    return { ok: false, motivo: "reporte_ilegible", detalle: `Completitud: ${comp.causa}.` };
  }
  const evaluado = comp.bloques.find((b) => b.clave === bloque.clave)!;

  const { data: perfil } = await supabase
    .from("perfil_emisor")
    .select("*")
    .eq("tenant_id", doc.tenant_id)
    .maybeSingle();

  const regimen = regimenDe(ens.reporte.ejercicio, rep.anio_adopcion);
  const alivios = leerAlivios(rep.alivios);
  const vigentes = regimen === "primer_anio" ? alivios : {};
  const aliviosActivos = ALIVIOS.filter((a) => alivios[a.clave]).map((a) => a.titulo);

  // Lo que un alivio exime no llega al prompt. Dárselo y pedirle que lo ignore
  // es invitarlo a explicar por qué lo ignora, que es lo que hacía antes.
  const exentos = datapointsExentos(vigentes);
  const requisitos = await leerRequisitos(
    supabase,
    bloque.datapoints.filter((d) => !exentos.has(d))
  );

  const { fuentes, datos } = armarDatos(bloque, ens, evaluado, perfil, requisitos);

  // --- 3. ¿Hace falta el modelo? --------------------------------------------
  const via = viaDe(bloque.numero);
  const prefs = {
    denominacionFormal: (perfil?.denominacion_formal as string | null) ?? null,
    nombreCorto: (perfil?.nombre_corto as string | null) ?? null,
    formaDeReferencia: (perfil?.forma_de_referencia as string | null) ?? null,
  };

  // Un bloque que el régimen excluye no se genera: se marca y ya. Gastar una
  // llamada en redactar algo que no va al documento es tirar el dinero.
  if (evaluado.estado === "no_aplica") {
    if (!opciones.sinPersistir) {
      await persistirEstado(supabase, documentoId, bloque, doc.idioma, "no_aplica", [
        { campo: "regimen", motivo: evaluado.motivoNoAplica ?? "El régimen excluye este bloque." },
      ]);
    }
    return { ok: false, motivo: "no_aplica", detalle: evaluado.motivoNoAplica ?? "El régimen excluye este bloque." };
  }

  if (via === "plantilla") {
    return await resolverPlantilla(supabase, documentoId, bloque, doc.idioma, {
      prefs,
      ejercicio: ens.reporte.ejercicio,
      regimen,
      anioAdopcion: rep.anio_adopcion,
      alivios,
      nombreReporte: ens.reporte.nombre,
      sinPersistir: !!opciones.sinPersistir,
      evaluado,
    });
  }

  if (via === "perfil") {
    const { data: adj } = await supabase
      .from("perfil_emisor_adjuntos")
      .select("seccion")
      .eq("tenant_id", doc.tenant_id);
    const espera = esperaAdjunto(bloque, perfil, new Set((adj ?? []).map((a) => a.seccion)));
    if (espera) {
      if (!opciones.sinPersistir) {
        await persistirEstado(supabase, documentoId, bloque, doc.idioma, "pendiente_adjunto", espera);
      }
      return { ok: false, motivo: "pendiente_adjunto", detalle: espera.map((e) => e.motivo).join(" ") };
    }
  }

  // --- 4. Prompt ------------------------------------------------------------
  const modelo = opciones.modelo ?? modeloDeTipo(bloque.tipo);
  const constructor = TABLAS[bloque.numero];
  const tabla = constructor ? constructor({ ens, evaluado, perfil, alivios: vigentes, fuentes }) : null;
  // Después de la tabla: lo que ella cite también es fuente válida.
  const idsValidos = new Set(fuentes.map((f) => f.id));
  const estables = capaEstable(bloque, prefs, requisitos);

  const volatil = capaVolatil({
    bloque,
    regimen,
    anioAdopcion: rep.anio_adopcion,
    aliviosActivos,
    ejercicio: ens.reporte.ejercicio,
    fuentes,
    datos,
    tabla,
    fronteras: fronteraDe(bloque.numero),
    extension: opciones.extension ?? extensionDeBloque(bloque.numero),
  });

  // La marca de caché va en el ÚLTIMO bloque estable: el caché cubre todo el
  // prefijo hasta ese punto, así que marcar el último marca los tres.
  const system = estables.map((b, i) => ({
    type: "text" as const,
    text: b.texto,
    ...(i === estables.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  // --- 4. Llamada, con un reintento si cita una fuente inexistente -----------
  const client = new Anthropic({ apiKey });
  const mensajes: Anthropic.MessageParam[] = [{ role: "user", content: volatil }];
  const inicio = Date.now();
  let uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  let salida: SalidaModelo | null = null;
  let ultimoError = "";

  for (let intento = 1; intento <= 2; intento++) {
    let respuesta: Anthropic.Message;
    // RELOJ PROPIO. El `timeout` del SDK cubre el establecimiento de la
    // respuesta, no la duración del stream: el bloque 21 tardó 305 s con un
    // `timeout` de 150 s y no abortó nunca. El AbortController mide tiempo de
    // pared sobre el consumo completo del stream, que es lo que realmente se
    // nos va de las manos. Va FUERA del try porque el catch tiene que poder
    // preguntarle si el fallo fue suyo.
    const reloj = new AbortController();
    const alarma = setTimeout(() => reloj.abort(), LIMITE_LLAMADA_MS);
    try {
      const stream = client.messages.stream(
        {
        model: modelo,
        max_tokens: 16000,
        system,
        messages: mensajes,
        output_config: {
          // `high` es el valor por defecto del API; pasarlo explícito es idéntico
          // a omitirlo, y deja el barrido de esfuerzo a un cambio de una línea
          // en ESFUERZO_POR_TIPO.
          effort: opciones.esfuerzo ?? esfuerzoDeTipo(bloque.tipo),
          format: { type: "json_schema", schema: ESQUEMA_SALIDA },
        },
        },
        // LÍMITE DURO. Sin él, un stream que se atasca deja la petición colgada
        // para siempre: el bloque se queda en 'generando', el cliente consulta
        // hasta que el vencimiento de tres minutos lo marca «tiempo excedido», y
        // la tarea sigue viva en el servidor consumiendo una conexión. Se corta
        // por debajo de ese vencimiento para que el fallo llegue con su motivo
        // en vez de con el síntoma.
        // maxRetries en 0: el SDK reintenta ANTES de rendirse, así que con 1 el
        // corte efectivo eran 300 s, por encima del vencimiento del bloque. El
        // reintento que sí queremos es el nuestro, que además explica el error.
        { timeout: LIMITE_LLAMADA_MS, maxRetries: 0, signal: reloj.signal }
      );
      // finalMessage() consume el stream entero, así que el aborto lo alcanza a
      // mitad de camino y no solo en la cabecera.
      respuesta = await stream.finalMessage();
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      // CORTE POR TIEMPO. No es un fallo del prompt ni del API: el bloque
      // sencillamente no cupo en la ventana. Vuelve a la cola y cuenta un
      // intento; al segundo corte sí es error, porque entonces ya no es mala
      // suerte.
      if (reloj.signal.aborted) {
        return {
          ok: false,
          motivo: "corte_tiempo",
          detalle: `corte por tiempo (${LIMITE_LLAMADA_MS / 1000} s)`,
        };
      }
      // SALDO AGOTADO ES DEFINITIVO. No es un fallo del bloque ni del prompt: no
      // hay reintento que lo arregle, y seguir con los otros treinta y nueve
      // produce treinta y nueve errores idénticos que tapan la causa. Se
      // distingue para que quien orquesta pueda parar y dejar el resto EN COLA,
      // que es donde debe esperar a que haya saldo.
      if (/credit balance is too low/i.test(detalle)) {
        return { ok: false, motivo: "sin_saldo", detalle };
      }
      return { ok: false, motivo: "api_error", detalle };
    } finally {
      clearTimeout(alarma);
    }

    // El uso se ACUMULA entre intentos: el reintento también se paga.
    uso = sumarUso(uso, leerUso(respuesta.usage));

    const parseada = leerSalida(respuesta);
    if (!parseada) {
      ultimoError = "La respuesta no vino en el esquema pedido.";
      if (intento === 2) break;
      mensajes.push(
        { role: "assistant", content: textoDe(respuesta) },
        { role: "user", content: `La respuesta anterior no se pudo leer con el esquema pedido. Devuélvela exactamente con las tres claves: texto, fuentes_usadas, pendientes.` }
      );
      continue;
    }

    // Dos rechazos, en orden de gravedad. El primero dice que el texto puede
    // estar inventado; el segundo, que no es publicable.
    const inventadas = parseada.fuentes_usadas.filter((f) => !idsValidos.has(f));
    const prohibidas = vocabularioProhibidoEn(parseada.texto);
    const marcadores = marcadoresMalFormados(parseada.texto);

    if (inventadas.length === 0 && prohibidas.length === 0 && marcadores.length === 0) {
      salida = parseada;
      break;
    }

    const reproches: string[] = [];
    if (inventadas.length) {
      // Un id que no se entregó es la señal más barata de que el texto también
      // se inventó. Se le dice CUÁL, no "hubo un error": un reintento sin el
      // detalle concreto repite el mismo fallo.
      reproches.push(
        `Estos ids de \`fuentes_usadas\` no existen en la lista entregada: ${inventadas.join(", ")}.\n` +
          `Los únicos válidos son:\n${[...idsValidos].map((i) => `- ${i}`).join("\n")}\n` +
          `Cita solo esos. Si una afirmación no tiene fuente que la respalde, quítala o conviértela en un marcador de pendiente.`
      );
    }
    if (prohibidas.length) {
      reproches.push(
        `El texto usa vocabulario de proceso interno, que no puede aparecer en un informe publicado: ${prohibidas.join(", ")}.\n` +
          `Reescríbelo en voz de la emisora. En vez de "según el inventario entregado y validado, las emisiones fueron X", escribe "las emisiones fueron X". ` +
          `Lo que falte va en el marcador [Pendiente: … — …], que es el único sitio donde puedes nombrar una solicitud o un campo.`
      );
    }
    if (marcadores.length) {
      reproches.push(
        `Estos marcadores no llevan el formato pedido \`[Pendiente: <qué falta> — <de qué solicitud o campo>]\`, con raya larga: ${marcadores.join(" ")}.`
      );
    }

    ultimoError = inventadas.length
      ? `Citó fuentes que no se le entregaron: ${inventadas.join(", ")}.`
      : prohibidas.length
        ? `El texto usa vocabulario de proceso interno: ${prohibidas.join(", ")}.`
        : `Marcadores mal formados: ${marcadores.join(" ")}.`;

    if (intento === 2) break;
    mensajes.push(
      { role: "assistant", content: JSON.stringify(parseada) },
      { role: "user", content: reproches.join("\n\n") }
    );
  }

  const duracionMs = Date.now() - inicio;
  const costo = costoUsd(modelo, uso);

  if (!salida) {
    if (!opciones.sinPersistir) {
      await persistirFallo(supabase, documentoId, bloque, doc.idioma, {
        modelo,
        uso,
        costo,
        duracionMs,
        motivo: ultimoError,
      });
    }
    return {
      ok: false,
      motivo: ultimoError.startsWith("Citó")
        ? "fuentes_invalidas"
        : ultimoError.startsWith("El texto usa") || ultimoError.startsWith("Marcadores")
          ? "voz_incorrecta"
          : "respuesta_ilegible",
      detalle: ultimoError,
    };
  }

  // Grafía de la denominación: se corrige aquí, sin reintento. Es un carácter y
  // no justifica pagar otra llamada.
  const normalizado = normalizarDenominacion(salida.texto, prefs);
  salida.texto = normalizado.texto;

  if (!opciones.sinPersistir) {
    await persistirBloque(supabase, documentoId, bloque, doc.idioma, {
      texto: salida.texto,
      fuentes: salida.fuentes_usadas.map((id) => {
        const f = fuentes.find((x) => x.id === id)!;
        return { tipo: f.tipo, id: f.id, detalle: f.detalle };
      }),
      pendientes: salida.pendientes.map((p) => ({ campo: "bloque", motivo: p })),
      notasRevision: salida.notas_revision,
      tabla,
      modelo,
      uso,
      costo,
      duracionMs,
    });
  }

  return {
    ok: true,
    texto: salida.texto,
    fuentesUsadas: salida.fuentes_usadas,
    pendientes: salida.pendientes,
    notasRevision: salida.notas_revision,
    tabla,
    modelo,
    uso,
    costo,
    duracionMs,
    intentos: mensajes.length > 1 ? 2 : 1,
    /** Cuántas grafías de la denominación hubo que corregir tras recibir el texto. */
    correccionesGrafia: normalizado.cambios,
    via,
    conModelo: true,
    bloque: evaluado,
  };
}

// -----------------------------------------------------------------------------
// Piezas
// -----------------------------------------------------------------------------

type SalidaModelo = {
  texto: string;
  fuentes_usadas: string[];
  pendientes: string[];
  notas_revision: string[];
};

function resolverBloque(id: number | string): Bloque | null {
  const n = typeof id === "number" ? id : Number(id);
  if (Number.isFinite(n)) return BLOQUES.find((b) => b.numero === n) ?? null;
  return BLOQUES.find((b) => b.clave === id) ?? null;
}

function textoDe(m: Anthropic.Message): string {
  return m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function leerSalida(m: Anthropic.Message): SalidaModelo | null {
  const crudo = textoDe(m).trim();
  if (!crudo) return null;
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    if (typeof o.texto !== "string") return null;
    const lista = (v: unknown) =>
      Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
    return {
      texto: o.texto,
      fuentes_usadas: lista(o.fuentes_usadas),
      pendientes: lista(o.pendientes),
      notas_revision: lista(o.notas_revision),
    };
  } catch {
    return null;
  }
}

function leerUso(u: Anthropic.Usage): Uso {
  return {
    entrada: u.input_tokens ?? 0,
    cacheEscritura: u.cache_creation_input_tokens ?? 0,
    cacheLectura: u.cache_read_input_tokens ?? 0,
    salida: u.output_tokens ?? 0,
  };
}

const sumarUso = (a: Uso, b: Uso): Uso => ({
  entrada: a.entrada + b.entrada,
  cacheEscritura: a.cacheEscritura + b.cacheEscritura,
  cacheLectura: a.cacheLectura + b.cacheLectura,
  salida: a.salida + b.salida,
});

async function leerRequisitos(supabase: Cliente, codigos: string[]): Promise<RequisitoNiif[]> {
  if (codigos.length === 0) return [];
  const { data } = await supabase
    .from("datapoints_taxonomia")
    .select("codigo, descripcion")
    .in("codigo", codigos);
  // Se respeta el orden de bloques.ts, no el que devuelva la base.
  const porCodigo = new Map((data ?? []).map((d) => [d.codigo, d.descripcion]));
  return codigos
    .filter((c) => porCodigo.has(c))
    .map((c) => ({ codigo: c, descripcion: porCodigo.get(c)! }));
}

// -----------------------------------------------------------------------------
// Los datos del bloque, con un id por fuente.
//
// El id es lo que el modelo puede citar y lo que después se verifica. Lleva
// prefijo por tipo (`sol:`, `reg:`, `obj:`, `cue:`, `perfil:`) para que un id
// citado se pueda rastrear sin consultar la base.
// -----------------------------------------------------------------------------
type Ensamblado = Extract<Awaited<ReturnType<typeof ensamblarReporte>>, { ok: true }>;

function armarDatos(
  bloque: Bloque,
  ens: Ensamblado,
  evaluado: BloqueEvaluado,
  perfil: Record<string, unknown> | null,
  requisitos: RequisitoNiif[]
): { fuentes: FuenteEntregada[]; datos: unknown } {
  const fuentes: FuenteEntregada[] = [];
  const porId = new Map(ens.solicitudes.map((s) => [s.id, s]));

  // --- Datapoints: requisito → solicitud que lo cubre → qué entregó ----------
  // El puente datapoint → solicitud lo resolvió `evaluarCompletitud` contra
  // `mapeo_solicitud_datapoint`, y de ahí viene esta lista. Incluye tanto las
  // que entregaron como las que no: las primeras son las cifras que el bloque
  // puede citar, las segundas son sus [Pendiente].
  const solicitudesDelBloque = new Set<string>(evaluado.solicitudes);

  const datapoints = requisitos.map((r) => ({
    codigo: r.codigo,
    requisito: r.descripcion,
    estado: estadoDeRequisito(evaluado, r.codigo),
  }));

  const solicitudes = [...solicitudesDelBloque]
    .map((id) => porId.get(id))
    .filter((s): s is SolRow => !!s)
    .map((s) => {
      const e: EntregaSolicitud = ens.entregaPorSolicitud.get(s.id) ?? {
        estado: "sin_evidencia",
        valor: null,
      };
      const fid = `sol:${s.id}`;
      fuentes.push({
        id: fid,
        tipo: "solicitud",
        detalle: `${s.titulo} — ${etiquetaEntrega(e.estado)}${e.valor != null ? `, valor ${e.valor}${s.unidad_esperada ? " " + s.unidad_esperada : ""}` : ""}`,
      });
      return {
        id: fid,
        titulo: s.titulo,
        descripcion: s.descripcion,
        unidad: s.unidad_esperada,
        ejercicio: ens.reporte.ejercicio,
        estado_entrega: e.estado,
        valor: e.valor,
        validada_por: s.origen === "cliente" ? "el propio cliente" : "IRStrat",
        nota_de_alcance: s.nota_alcance,
      };
    });

  // --- Tablas ---------------------------------------------------------------
  const registros = bloque.tablas.includes("registros_clima")
    ? ens.registros.map((r) => {
        const fid = `reg:${r.id}`;
        fuentes.push({ id: fid, tipo: "registro", detalle: `Registro de clima: ${r.nombre} (${r.tipo})` });
        const v = ens.vigentePorRegistro.get(r.id)?.get(ens.reporte.ejercicio) ?? null;
        return {
          id: fid,
          nombre: r.nombre,
          tipo: r.tipo,
          descripcion: r.descripcion,
          horizontes: r.horizontes,
          metricas_del_ejercicio: v
            ? {
                cantidad_activos: v.cantidad_activos,
                porcentaje: v.porcentaje,
                capital_gasto: v.capital_gasto,
                capital_financiacion: v.capital_financiacion,
                capital_inversion: v.capital_inversion,
              }
            : null,
        };
      })
    : [];

  const objetivos = bloque.tablas.includes("objetivos") || bloque.tablas.includes("objetivos_detalle")
    ? ens.objetivos.map((o) => {
        const fid = `obj:${o.id}`;
        fuentes.push({ id: fid, tipo: "objetivo", detalle: `Objetivo: ${o.nombre}` });
        return { id: fid, ...sinIds(o), detalle: ens.detallePorObjetivo.get(o.id) ?? null };
      })
    : [];

  const cuestionarios = bloque.tablas.includes("cuestionarios_respuestas")
    ? ens.cuestionarios.map((c) => {
        const fid = `cue:${c.hoja}:${c.pregunta_orden}`;
        fuentes.push({ id: fid, tipo: "cuestionario", detalle: `Cuestionario ${c.hoja}, pregunta ${c.pregunta_orden}` });
        return { id: fid, hoja: c.hoja, orden: c.pregunta_orden, respuesta: c.respuesta, notas: c.notas };
      })
    : [];

  // --- Perfil del emisor ----------------------------------------------------
  const campos: Record<string, unknown> = {};
  for (const campo of bloque.perfil) {
    const valor = perfil?.[campo] ?? null;
    const fid = `perfil:${campo}`;
    fuentes.push({ id: fid, tipo: "perfil", detalle: `Perfil del emisor, campo ${campo}` });
    campos[fid] = valor;
  }

  // --- Reporte --------------------------------------------------------------
  fuentes.push({
    id: `reporte:${ens.reporte.id}`,
    tipo: "reporte",
    detalle: `Reporte ${ens.reporte.nombre}, ejercicio ${ens.reporte.ejercicio}`,
  });

  return {
    fuentes,
    datos: {
      bloque: { numero: bloque.numero, titulo: bloque.titulo, tipo: bloque.tipo },
      estado_de_completitud: {
        estado: evaluado.estado,
        cumplidos: evaluado.cumplidos,
        exigidos: evaluado.exigidos,
        faltantes: evaluado.faltantes.map((f) => ({
          que: f.etiqueta,
          causa: f.causa,
          detalle: f.detalle,
        })),
      },
      // Requisitos que ya contesta otro bloque del documento. No se repiten: se
      // remite. Un suplemento que define los horizontes dos veces con palabras
      // distintas es un suplemento que se contradice a sí mismo.
      remitir_a_otro_bloque: evaluado.remisiones.map((r) => ({
        requisito: r.codigo,
        bloque: r.bloque,
        instruccion: `Este requisito se desarrolla en el bloque ${r.bloque}. NO lo repitas: remite ahí en una frase.`,
      })),
      datapoints,
      solicitudes,
      registros_clima: registros,
      objetivos,
      cuestionarios,
      perfil_emisor: campos,
      reporte: {
        id: `reporte:${ens.reporte.id}`,
        nombre: ens.reporte.nombre,
        ejercicio: ens.reporte.ejercicio,
      },
    },
  };
}

function estadoDeRequisito(ev: BloqueEvaluado, codigo: string): string {
  const f = ev.faltantes.find((x) => x.etiqueta === codigo);
  return f ? f.causa : "cubierto";
}

const etiquetaEntrega = (e: string) =>
  e === "entregado" ? "entregada y validada" : e === "pendiente_validacion" ? "entregada, sin validar" : "sin evidencia";

/** Quita los ids crudos: el modelo cita por el id con prefijo, no por el uuid. */
function sinIds<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const resto: Record<string, unknown> = { ...o };
  delete resto.id;
  delete resto.reporte_id;
  return resto;
}

// -----------------------------------------------------------------------------
// Las dos vías que NO llaman al modelo
// -----------------------------------------------------------------------------

/**
 * Bloque de plantilla: texto fijo con variables del reporte y del emisor.
 *
 * No pasa por el modelo. Su contenido no depende de la evidencia del cliente, y
 * una llamada para rellenar tres huecos es gasto y riesgo —un modelo puede
 * reescribir la frase que la firma acordó— sin ganancia. Cuesta cero.
 */
async function resolverPlantilla(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  c: {
    prefs: { denominacionFormal: string | null; nombreCorto: string | null; formaDeReferencia: string | null };
    ejercicio: number;
    regimen: Regimen;
    anioAdopcion: number | null;
    alivios: Alivios;
    nombreReporte: string;
    sinPersistir: boolean;
    evaluado: BloqueEvaluado;
  }
): Promise<ResultadoGeneracion> {
  const armar = PLANTILLAS[bloque.numero];
  if (!armar) {
    return { ok: false, motivo: "bloque_no_existe", detalle: `El bloque ${bloque.numero} no tiene plantilla.` };
  }
  const r = armar({
    denominacionFormal: c.prefs.denominacionFormal ?? "",
    formaDeReferencia: c.prefs.formaDeReferencia ?? "la Entidad",
    ejercicio: c.ejercicio,
    regimen: c.regimen,
    anioAdopcion: c.anioAdopcion,
    alivios: c.alivios,
    nombreReporte: c.nombreReporte,
  });

  const uso: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  if (!c.sinPersistir) {
    await persistirBloque(supabase, documentoId, bloque, idioma, {
      texto: r.texto,
      fuentes: [
        { tipo: "reporte", id: "plantilla", detalle: "Texto de plantilla con variables del reporte y del emisor" },
      ],
      pendientes: r.pendientes.map((x) => ({ campo: "bloque", motivo: x })),
      notasRevision: [],
      tabla: null,
      modelo: MODELO_POR_DEFECTO,
      uso,
      costo: 0,
      duracionMs: 0,
    });
  }
  return {
    ok: true,
    texto: r.texto,
    fuentesUsadas: ["plantilla"],
    pendientes: r.pendientes,
    notasRevision: [],
    tabla: null,
    modelo: MODELO_POR_DEFECTO,
    uso,
    costo: 0,
    duracionMs: 0,
    intentos: 0,
    correccionesGrafia: 0,
    via: "plantilla",
    conModelo: false,
    bloque: c.evaluado,
  };
}

/**
 * ¿Este bloque del Perfil espera a que el generador sepa leer adjuntos?
 *
 * Solo si TODOS sus campos están vacíos y alguno tiene archivo en su sección. Si
 * hay al menos un campo con texto, el bloque se redacta con lo que hay y el
 * resto va como pendiente: media revelación es mejor que ninguna, y el revisor
 * ve qué falta.
 */
function esperaAdjunto(
  bloque: Bloque,
  perfil: Record<string, unknown> | null,
  seccionesConAdjunto: Set<string>
): { campo: string; motivo: string }[] | null {
  if (bloque.perfil.length === 0) return null;
  const conTexto = (v: unknown) =>
    typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v != null;

  const vacios = bloque.perfil.filter((campo) => !conTexto(perfil?.[campo]));
  if (vacios.length < bloque.perfil.length) return null;

  const conArchivo = vacios.filter((campo) => seccionesConAdjunto.has(SECCION_DE_CAMPO[campo] ?? ""));
  if (conArchivo.length === 0) return null;

  return conArchivo.map((campo) => ({
    campo,
    motivo: `${ETIQUETA_CAMPO[campo] ?? campo}: vacío en el Perfil, pero su sección tiene un documento del que se derivará en A5b.`,
  }));
}

/** Guarda un bloque que no produce texto: no aplica, o espera un adjunto. */
async function persistirEstado(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  estado: "no_aplica" | "pendiente_adjunto",
  pendientes: { campo: string; motivo: string }[]
): Promise<void> {
  await supabase.from("documentos_bloques").upsert(
    {
      documento_id: documentoId,
      numero: bloque.numero,
      clave: bloque.clave,
      titulo: bloque.titulo,
      seccion: bloque.seccion,
      idioma,
      estado,
      texto: null,
      fuentes: [],
      pendientes,
      modelo: null,
      // Nulo a propósito: aquí no corrió ningún prompt. `prompt_version` dice
      // con qué versión se escribió el texto guardado, y no hay texto.
      prompt_version: null,
      tokens_entrada: 0,
      tokens_entrada_cache_escritura: 0,
      tokens_entrada_cache_lectura: 0,
      tokens_salida: 0,
      costo_usd: 0,
      duracion_ms: 0,
      generado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "documento_id,numero" }
  );
}

// -----------------------------------------------------------------------------
// Persistencia. Un bloque por documento (UNIQUE documento_id, numero):
// regenerar REEMPLAZA, no acumula, que es lo que dice el esquema.
// -----------------------------------------------------------------------------
type Metricas = { modelo: ClaveModelo; uso: Uso; costo: number; duracionMs: number };

async function persistirBloque(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  d: Metricas & {
    texto: string;
    fuentes: { tipo: string; id: string; detalle: string }[];
    pendientes: { campo: string; motivo: string }[];
    notasRevision: string[];
    tabla: string | null;
  }
): Promise<void> {
  await supabase.from("documentos_bloques").upsert(
    {
      documento_id: documentoId,
      numero: bloque.numero,
      clave: bloque.clave,
      titulo: bloque.titulo,
      seccion: bloque.seccion,
      idioma,
      estado: "borrador",
      // Salió bien: la racha de cortes se acaba aquí. Si el bloque vuelve a
      // generarse mañana, empieza con sus dos intentos enteros.
      intentos: 0,
      // La tabla la armó el código y va DELANTE del texto en el documento: se
      // guarda junto, para que el bloque persistido sea lo que se va a publicar
      // y no una mitad que hay que recomponer al exportar.
      texto: d.tabla ? `${d.tabla}\n\n${d.texto}` : d.texto,
      fuentes: d.fuentes,
      // Los huecos y las notas al revisor viven en el mismo arreglo, separados
      // por `campo`: el esquema tiene una sola columna jsonb para esto y
      // distinguirlos por clave es más barato que una columna nueva.
      pendientes: [
        ...d.pendientes,
        ...d.notasRevision.map((n) => ({ campo: "nota_revision", motivo: n })),
      ],
      modelo: d.modelo,
      prompt_version: PROMPT_VERSION,
      tokens_entrada: d.uso.entrada,
      tokens_entrada_cache_escritura: d.uso.cacheEscritura,
      tokens_entrada_cache_lectura: d.uso.cacheLectura,
      tokens_salida: d.uso.salida,
      costo_usd: d.costo,
      duracion_ms: d.duracionMs,
      generado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "documento_id,numero" }
  );

  await recalcularDocumento(supabase, documentoId);
}

/**
 * Un intento fallido también se guarda: el texto queda nulo y el motivo en
 * `pendientes`. Y también se paga —el reintento consumió tokens— así que el
 * costo entra igual. Un fallo que no cuesta nada en los registros es un fallo
 * que nadie va a ir a mirar.
 */
async function persistirFallo(
  supabase: Cliente,
  documentoId: string,
  bloque: Bloque,
  idioma: string,
  d: Metricas & { motivo: string }
): Promise<void> {
  const fila = {
    documento_id: documentoId,
    numero: bloque.numero,
    clave: bloque.clave,
    titulo: bloque.titulo,
    seccion: bloque.seccion,
    idioma,
    texto: null,
    fuentes: [],
    pendientes: [{ campo: "generacion", motivo: d.motivo }],
    modelo: d.modelo,
    prompt_version: PROMPT_VERSION,
    tokens_entrada: d.uso.entrada,
    tokens_entrada_cache_escritura: d.uso.cacheEscritura,
    tokens_entrada_cache_lectura: d.uso.cacheLectura,
    tokens_salida: d.uso.salida,
    costo_usd: d.costo,
    duracion_ms: d.duracionMs,
    generado_en: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // `estado` tiene un CHECK con tres valores y 'error' no está entre ellos. Se
  // intenta igual —es lo que el bloque ES— y si la base lo rechaza se guarda
  // como borrador sin texto, con el motivo en `pendientes`, que es donde un
  // revisor lo va a buscar. En cuanto la migración añada 'error' al CHECK, el
  // primer intento pasa y este respaldo deja de usarse.
  const conError = await supabase
    .from("documentos_bloques")
    .upsert({ ...fila, estado: "error" } as never, { onConflict: "documento_id,numero" });

  if (conError.error) {
    await supabase
      .from("documentos_bloques")
      .upsert({ ...fila, estado: "borrador" }, { onConflict: "documento_id,numero" });
  }

  await recalcularDocumento(supabase, documentoId);
}

/** Los acumulados del documento se recalculan desde sus bloques, no se suman a mano. */
async function recalcularDocumento(supabase: Cliente, documentoId: string): Promise<void> {
  const { data } = await supabase
    .from("documentos_bloques")
    .select("tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, costo_usd")
    .eq("documento_id", documentoId);

  if (!data) return;
  const tot = data.reduce(
    (a, b) => ({
      entrada:
        a.entrada + b.tokens_entrada + b.tokens_entrada_cache_escritura + b.tokens_entrada_cache_lectura,
      salida: a.salida + b.tokens_salida,
      costo: a.costo + Number(b.costo_usd),
    }),
    { entrada: 0, salida: 0, costo: 0 }
  );

  await supabase
    .from("documentos_generados")
    .update({
      tokens_entrada: tot.entrada,
      tokens_salida: tot.salida,
      costo_usd: Math.round(tot.costo * 10_000) / 10_000,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentoId);
}

export { MODELOS, MODELO_POR_DEFECTO };
export type { Regimen };
