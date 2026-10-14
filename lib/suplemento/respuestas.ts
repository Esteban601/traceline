import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES, datapointsExentos } from "@/lib/suplemento/bloques";
import { PADRE_DE, noAplicaHeredado } from "@/lib/suplemento/catalogo-incisos";
import { aplicarGlosario, leerGlosario, type EntradaGlosario } from "@/lib/suplemento/glosario";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { vocabularioProhibidoEn } from "@/lib/suplemento/prompt";
import { oracionesDe } from "@/lib/suplemento/hechos/oraciones";
import { NEGACION } from "@/lib/suplemento/hechos/tipos";
import { numerosDe } from "@/lib/evidencias/fuente";
import { numeracionConsecutiva } from "@/lib/suplemento/numeracion";
import { leerAlivios, type Alivios } from "@/lib/perfil-emisor";
import { ensamblarReporte } from "@/lib/reporte/ensamblar";
import mapeoFormato from "@/docs/suplemento-s1s2/mapeo-formato-electronico.json" with { type: "json" };

// =============================================================================
// RESPUESTAS POR DATAPOINT (encargo 2026-10-13-excel-respuestas-narrativas,
// Paso 2). Al aprobar un documento del Suplemento, cada código del catálogo
// recibe una respuesta para el Excel de taxonomía y, si alimenta conceptos text
// o text block del Formato electrónico, otra para el formato. Se guardan en
// `respuestas_datapoint`; los dos Excel las leen de ahí.
//
// EL MODELO NUNCA DECIDE QUÉ SE RESPONDE (Paso 0). El código decide, en orden:
//   1. «No aplica» por un alivio vigente (C4) o heredado del catálogo (36(c),
//      36(e)) — regla;
//   2. el padre de incisos (25(a), 36(a)–(d), 36(e)) se responde con los hechos
//      de sus hijos, o «no aplica» si todos sus hijos lo son;
//   3. con bloque dueño en el documento aprobado y cobertura con hechos — el
//      modelo resume ese bloque (agrupado por bloque: una llamada por bloque);
//   4. NIIF S1 sin bloque dueño con el alivio E5 vigente — «no aplica», con la
//      remisión a su par de NIIF S2 cuando el mapeo del formato lo tiene;
//   5. sin bloque dueño, con captura confirmada — la respuesta sale de la
//      captura, sin modelo (decisión de Esteban del 13 de octubre de 2026);
//   6. lo demás — «Pendiente», con el marcador del Word.
//
// LONGITUD (decisión de Esteban del 13 de octubre de 2026): taxonomía, hasta
// cuatro oraciones; formato, hasta seis oraciones y 900 caracteres.
//
// VALIDADORES, sin modelo, sobre cada respuesta: cifras solo de la sección
// aprobada o de los hechos del requisito; hechos citados entre los entregados;
// la declaración negativa del requisito presente; longitud; sin vocabulario de
// plataforma ni marcadores; glosario aplicado (sustituye y anota). Lo que no
// pasa vuelve una vez al modelo con el motivo; si vuelve a fallar, la respuesta
// son las oraciones del bloque aprobado ancladas a los hechos del requisito
// (origen «bloque»), que ya pasaron los validadores del generador.
// =============================================================================

type Db = SupabaseClient<Database>;
export type Destino = "taxonomia" | "formato";
export type EstadoRespuesta = "respuesta" | "pendiente" | "no_aplica";
export type OrigenRespuesta = "modelo" | "captura" | "bloque" | "regla";

export const MODELO_RESPUESTAS = "claude-sonnet-5-5" as const;
export const PROMPT_RESPUESTAS = "respuestas-v1-20261013";
export const LIMITES: Record<Destino, { oraciones: number; caracteres: number | null }> = {
  taxonomia: { oraciones: 4, caracteres: null },
  formato: { oraciones: 6, caracteres: 900 },
};

/** Oración fija del alivio E5 (redacción de la casa; no reproduce la norma). */
export const ORACION_E5 =
  "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E5 de la NIIF S1 y revela únicamente información sobre los riesgos y oportunidades relacionados con el clima.";

/**
 * «No aplica» heredado, en voz de la emisora. El motivo de noAplicaHeredado es
 * para el revisor (nombra el cuestionario y dice «la emisora»); el Excel publica.
 */
export function textoNoAplicaHeredado(codigo: string): string {
  if (codigo === "NIIF S2 36 (c)") return "No aplica. Ningún objetivo de emisiones de la Compañía es neto, por lo que no hay un objetivo bruto asociado que revelar por separado.";
  if (codigo.startsWith("NIIF S2 36 (e)")) return "No aplica. La Compañía no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones.";
  return "No aplica. El requisito no aplica a la Compañía en este periodo.";
}

const TITULO_ALIVIO: Record<string, string> = {
  C4: "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo C4 de la NIIF S2 y no revela sus emisiones de Alcance 3.",
};

export type FilaRespuesta = {
  destino: Destino;
  clave: string;
  tipo_campo: string;
  estado: EstadoRespuesta;
  origen: OrigenRespuesta;
  texto: string | null;
  valor: Record<string, unknown> | null;
  bloque: number | null;
  bloque_version: number | null;
  hechos: string[];
  notas: string[];
  modelo: string | null;
  prompt_version: string | null;
  uso: Uso;
  costo_usd: number;
};

const sinCodigoNorma = (c: string) => c.replace(/\s+/g, "").toLowerCase();
const marcador = (falta: string, donde: string) => `[Pendiente: ${falta} — ${donde}]`;
const USO_CERO: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };

// -----------------------------------------------------------------------------
// Mapeo del formato: qué datapoints alimentan conceptos text / text block, y el
// par NIIF S2 de cada párrafo de NIIF S1 (regla S1→S2 de la revisión de Esteban).
// -----------------------------------------------------------------------------
type ConceptoMapeo = { fila?: number; tipo?: string | null; clasificacion?: string; datapoint?: string | null; bloque?: number | null; parrafos?: string[]; alivioE5?: boolean };
const CONCEPTOS = (mapeoFormato as { conceptos: ConceptoMapeo[] }).conceptos;

export const DATAPOINTS_FORMATO_TEXTO: Set<string> = new Set(
  CONCEPTOS.filter((c) => /^text/.test(c.tipo ?? "") && c.datapoint).map((c) => c.datapoint as string)
);

/**
 * Conceptos de texto del formato con bloque dueño y sin datapoint en el catálogo
 * (declaración de cumplimiento, juicios, S2 13, S2 22…): se responden desde su
 * bloque con la clave `fila:N`, solo para el formato (revisión externa, punto 4).
 */
export const CONCEPTOS_FORMATO_SIN_DATAPOINT: { fila: number; bloque: number; parrafos: string[] }[] = CONCEPTOS.filter(
  (c) => c.clasificacion === "concepto" && !c.datapoint && c.bloque != null && /^text|\(sin tipo\)/.test(c.tipo ?? "(sin tipo)")
).map((c) => ({ fila: c.fila!, bloque: c.bloque!, parrafos: c.parrafos ?? [] }));

/** NIIF S1 (sin espacios) → código NIIF S2 del catálogo que lo responde en el formato. */
export const PAR_S2_DE_S1: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of CONCEPTOS) {
    if (!c.alivioE5 || !c.datapoint?.startsWith("NIIF S2")) continue;
    for (const p of c.parrafos ?? []) if (/^NIIF S1/.test(p) && !m.has(sinCodigoNorma(p))) m.set(sinCodigoNorma(p), c.datapoint);
  }
  return m;
})();

// -----------------------------------------------------------------------------
// Validadores (exportados para la prueba)
// -----------------------------------------------------------------------------
const NIEGA = /(?<!\p{L})(?:no|ningun[oa]?|ningún|nul[oa]s?|sin|tampoco|ni|nunca)(?!\p{L})/iu;

export type HechoDeRequisito = { id: string; local: string; tipo: string; enunciado: string; extracto: string; valor: number | null; unidad: string | null };

export function validarRespuesta(
  texto: string,
  destino: Destino,
  ctx: { codigo: string; textoBloque: string; hechos: HechoDeRequisito[]; citados: string[] }
): string[] {
  const errores: string[] = [];
  const t = texto.trim();
  if (!t) return ["respuesta vacía"];
  const lim = LIMITES[destino];
  const n = oracionesDe(t).length;
  if (n > lim.oraciones) errores.push(`tiene ${n} oraciones; el máximo para ${destino} es ${lim.oraciones}`);
  if (lim.caracteres && t.length > lim.caracteres) errores.push(`tiene ${t.length} caracteres; el máximo para ${destino} es ${lim.caracteres}`);
  if (/\[Pendiente/i.test(t)) errores.push("lleva un marcador [Pendiente: …]; el documento está aprobado y el requisito tiene hechos");
  const prohibidas = vocabularioProhibidoEn(t);
  if (prohibidas.length) errores.push(`usa vocabulario de proceso interno: ${prohibidas.join(", ")}`);
  const permitidos = numerosDe([ctx.textoBloque, ctx.codigo, ...ctx.hechos.flatMap((h) => [h.enunciado, h.extracto, h.valor != null ? String(h.valor) : ""])].join("\n"));
  const fuera = numerosDe(t).filter((x) => !permitidos.some((p) => Math.abs(p - x) <= Math.abs(x) * 1e-9 + 1e-9));
  if (fuera.length) errores.push(`cifras que no están en la sección ni en los hechos: ${fuera.join(", ")}`);
  const locales = new Set(ctx.hechos.map((h) => h.local));
  const ajenos = ctx.citados.filter((c) => !locales.has(c));
  if (ajenos.length) errores.push(`cita hechos que no se entregaron para este requisito: ${ajenos.join(", ")}`);
  if (ctx.hechos.length && !ctx.citados.length) errores.push("no cita ningún hecho");
  // La negación del hecho se detecta con NEGACION en la fuente; en la respuesta
  // el modelo la parafrasea («no identificó», «sin efectos»), así que basta una
  // marca de negación del español.
  if (ctx.hechos.some((h) => h.tipo === "declaracion_negativa") && !NEGACION.test(t) && !NIEGA.test(t)) {
    errores.push("omite la declaración negativa del requisito (la emisora declara una ausencia que el requisito pide)");
  }
  return errores;
}

/** Oraciones del bloque aprobado ancladas a los hechos del requisito (respaldo sin modelo). */
export function oracionesAncladas(anclas: Ancla[], hechos: string[], max: number): string {
  const ids = new Set(hechos);
  const out: string[] = [];
  for (const a of anclas) {
    if (out.length >= max) break;
    if (a.hechos.some((h) => h.hecho && ids.has(h.hecho)) && !out.includes(a.oracion)) out.push(a.oracion);
  }
  return out.join(" ");
}

/** «1,240 tCO2e (ejercicio 2025), según captura validada.» */
export function respuestaDeCaptura(valor: number, unidad: string | null, periodo: string | number): string {
  const v = valor.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return `${v}${unidad ? ` ${unidad}` : ""} (ejercicio ${periodo}), según captura validada.`;
}

/**
 * «Ver sección N · título», con N la numeración consecutiva del Word
 * (especificación 0.41): `numeracion` sale de numeracionConsecutiva sobre los
 * bloques que van en el documento. Sin ella, el número del bloque.
 */
export const remision = (numero: number, numeracion?: Map<number, number>) => {
  const b = BLOQUES.find((x) => x.numero === numero);
  return b ? `Ver sección ${numeracion?.get(numero) ?? numero} · ${b.titulo}` : null;
};

/** El texto sin la remisión que añade el código (para reutilizarlo con la numeración vigente). */
export const sinRemision = (t: string) => t.replace(/\s*Ver sección \d+ · [^.]*\.?\s*$/u, "").trim();

/**
 * Una respuesta como va en un Excel exportado (CLAUDE.md §5, 1.10): la base
 * guarda `[Pendiente: … — …]`; el Excel de taxonomía lo escribe en texto plano.
 * Ninguna celda exportada empieza con «[».
 */
export function pendienteEnTextoPlano(texto: string): string {
  // Un código de lista del formato («[815200] Finanzas - …») es el valor literal de la opción y conserva su «[»
  // (decisión de Esteban); el validador de entrega lo acepta solo si coincide con una opción del formato.
  return texto.replace(/\[Pendiente:\s*([^\]]*)\]/g, "Pendiente: $1").replace(/^\[+(?!\d{6}\])\s*/, "").trim();
}

/** Para el Formato electrónico: un pendiente deja la celda vacía. */
export function paraFormatoElectronico(estado: EstadoRespuesta, texto: string | null): string | null {
  return estado === "pendiente" || !texto ? null : pendienteEnTextoPlano(texto);
}

/** «No aplica · E5»: no hay sección en el suplemento; se remite al párrafo de NIIF S2 que lo responde. */
export function textoNoAplicaE5(parS2: string | null): string {
  return `No aplica. ${ORACION_E5} Sin sección en el suplemento${parS2 ? `; ver ${parS2}` : ""}.`;
}

// -----------------------------------------------------------------------------
// Insumos del documento aprobado
// -----------------------------------------------------------------------------
type Cobertura = { codigo: string; estado: string; bloque: number | null; hechos: string[]; comentario?: string };
type Ancla = { oracion: string; hechos: { id: string; hecho: string | null }[] };
type VersionAprobada = { numero: number; version: number; texto: string; cobertura: Cobertura[]; anclas: Ancla[]; libro_id: string | null };
type HechoLibro = { id: string; tipo: string; enunciado: string; extracto: string; valor: number | null; unidad: string | null; estado: string };
type Previa = {
  destino: Destino; clave: string; texto: string | null; bloque: number | null; bloque_version: number | null; prompt_version: string | null;
  hechos: string[]; notas: string[]; costo_usd: number; tokens_entrada: number; tokens_cache_escritura: number; tokens_cache_lectura: number; tokens_salida: number;
};

type Plan =
  | { codigo: string; via: "regla"; estado: "no_aplica" | "pendiente"; texto: string; notas?: string[] }
  | { codigo: string; via: "captura"; texto: string; valor: Record<string, unknown> }
  | { codigo: string; via: "bloque"; bloque: number; hechos: string[] };

export type ResultadoRespuestas = { filas: FilaRespuesta[]; costo: number; uso: Uso; porOrigen: Record<string, number>; porEstado: Record<string, number> };

/**
 * Arma las respuestas de un documento APROBADO sin escribir nada. `db` lee con
 * la sesión de quien la llama (staff); la escritura la hace guardarRespuestas.
 */
export async function generarRespuestas(db: Db, documentoId: string, opciones: { apiKey?: string; latido?: () => Promise<boolean> } = {}): Promise<ResultadoRespuestas> {
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id, reporte_id, version, estado, alivios, regimen, versiones_aprobadas")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) throw new Error("El documento no existe o no es visible.");
  if (doc.estado !== "aprobado") throw new Error("Las respuestas solo se generan desde un documento aprobado.");
  const aprobadas = (doc.versiones_aprobadas ?? {}) as Record<string, { id: string; version: number }>;
  const ids = Object.values(aprobadas).map((v) => v.id);

  const [{ data: versiones }, { data: previas }, { data: catalogo }, { data: perfil }, { data: enlaces }] = await Promise.all([
    db.from("documentos_bloques_versiones").select("id, numero, version, texto, respaldo, libro_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    // Respuestas del modelo ya generadas para este documento: si su bloque sigue
    // en la misma versión aprobada y con la misma versión de prompt, se reutilizan
    // (sin llamada) — solo cambia lo que el código añade, como la remisión.
    db.from("respuestas_datapoint").select("destino, clave, origen, texto, bloque, bloque_version, prompt_version, hechos, notas, costo_usd, tokens_entrada, tokens_cache_escritura, tokens_cache_lectura, tokens_salida").eq("documento_id", documentoId).eq("origen", "modelo"),
    db.from("datapoints_taxonomia").select("id, codigo, descripcion").eq("activo", true),
    db.from("perfil_emisor").select("glosario").eq("tenant_id", doc.tenant_id).maybeSingle(),
    db.from("mapeo_solicitud_datapoint").select("datapoint_id, solicitud:solicitudes!inner(id, reporte_id, titulo)").eq("solicitud.reporte_id", doc.reporte_id),
  ]);

  const porBloque = new Map<number, VersionAprobada>();
  for (const v of versiones ?? []) {
    const r = (v.respaldo ?? {}) as { cobertura?: Cobertura[]; anclas?: Ancla[] };
    porBloque.set(v.numero, { numero: v.numero, version: v.version, texto: v.texto, cobertura: r.cobertura ?? [], anclas: r.anclas ?? [], libro_id: v.libro_id });
  }
  const numeracion = numeracionConsecutiva(porBloque.keys());
  const previaDe = new Map(((previas ?? []) as Previa[]).map((p) => [`${p.destino}|${p.clave}`, p]));
  const libros = [...new Set([...porBloque.values()].map((v) => v.libro_id).filter((x): x is string => !!x))];
  const hechos = new Map<string, HechoLibro>();
  for (const l of libros) {
    const { data } = await db.from("hechos").select("id, tipo, enunciado, extracto, valor, unidad, estado").eq("libro_id", l);
    for (const h of data ?? []) hechos.set(h.id, h as HechoLibro);
  }
  const glosario: EntradaGlosario[] = leerGlosario(perfil?.glosario);
  const alivios: Alivios = doc.regimen === "primer_anio" ? leerAlivios(doc.alivios) : {};
  const exentos = datapointsExentos(alivios);
  // Capturas y «no aplica» heredado: la misma resolución del Excel y del
  // generador (ensamblador), con la misma construcción que generar-bloque.
  const ens = await ensamblarReporte(db, doc.reporte_id);
  if (!ens.ok) throw new Error(`No se pudo ensamblar el reporte (${ens.causa}).`);
  const heredados = noAplicaHeredado({
    brutoNeto: ens.objetivos
      .filter((o) => o.ambito === "climatico" && /emisi|gei|co2/i.test(`${o.tipo_objetivo ?? ""} ${o.metrica ?? ""} ${o.nombre}`))
      .map((o) => ens.detallePorObjetivo.get(o.id)?.bruto_neto ?? null),
    respuestasCreditos: ens.cuestionarios
      .filter((q) => q.hoja === "S2 36(e)")
      .sort((a, b) => a.pregunta_orden - b.pregunta_orden)
      .map((q) => q.respuesta),
  });
  const solsPorDatapoint = new Map<string, { id: string; titulo: string }[]>();
  for (const e of (enlaces ?? []) as unknown as { datapoint_id: string; solicitud: { id: string; titulo: string } }[]) {
    solsPorDatapoint.set(e.datapoint_id, [...(solsPorDatapoint.get(e.datapoint_id) ?? []), e.solicitud]);
  }

  const codigos = ((catalogo ?? []) as { id: string; codigo: string; descripcion: string }[]).filter((c) => c.codigo.startsWith("NIIF"));
  const descripcion = new Map(codigos.map((c) => [c.codigo, c.descripcion]));
  const hijosDe = new Map<string, string[]>();
  for (const [hijo, padre] of Object.entries(PADRE_DE)) hijosDe.set(padre, [...(hijosDe.get(padre) ?? []), hijo]);

  /** La cobertura del código en el documento: bloque que lo responde y sus hechos (sigue los «asignado»). */
  const coberturaDe = (codigo: string): { bloque: number; estado: string; hechos: string[] } | null => {
    for (const b of BLOQUES.filter((x) => x.datapoints.includes(codigo))) {
      const v = porBloque.get(b.numero);
      if (!v) continue;
      const c = v.cobertura.find((x) => x.codigo === codigo);
      if (c?.estado === "asignado" && c.bloque != null) {
        const destino = porBloque.get(c.bloque)?.cobertura.find((x) => x.codigo === codigo);
        if (destino) return { bloque: c.bloque, estado: destino.estado, hechos: destino.hechos };
      }
      if (c) return { bloque: b.numero, estado: c.estado, hechos: c.hechos };
      return { bloque: b.numero, estado: "sin_cobertura", hechos: [] };
    }
    return null;
  };

  const planDe = (codigo: string): Plan => {
    if (exentos.has(codigo)) {
      const alivio = Object.keys(alivios).find((k) => TITULO_ALIVIO[k]) ?? "C4";
      return { codigo, via: "regla", estado: "no_aplica", texto: `No aplica. ${TITULO_ALIVIO[alivio]}` };
    }
    const h = heredados.get(codigo);
    if (h?.estado === "no_aplica") return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaHeredado(codigo), notas: [h.motivo] };
    const hijos = hijosDe.get(codigo);
    if (hijos) {
      const planes = hijos.map(planDe);
      if (planes.every((p) => p.via === "regla" && p.estado === "no_aplica")) {
        return { codigo, via: "regla", estado: "no_aplica", texto: (planes[0] as { texto: string }).texto };
      }
      const conBloque = planes.filter((p): p is Extract<Plan, { via: "bloque" }> => p.via === "bloque");
      if (conBloque.length) {
        return { codigo, via: "bloque", bloque: conBloque[0].bloque, hechos: [...new Set(conBloque.flatMap((p) => p.hechos))] };
      }
    }
    const cob = coberturaDe(codigo);
    if (cob && cob.estado === "no_aplica") {
      return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaHeredado(codigo), notas: h?.motivo ? [h.motivo] : [] };
    }
    if (cob && (cob.estado === "cubierto" || cob.estado === "parcial") && cob.hechos.length) {
      return { codigo, via: "bloque", bloque: cob.bloque, hechos: cob.hechos };
    }
    if (cob) {
      const b = BLOQUES.find((x) => x.numero === cob.bloque);
      return { codigo, via: "regla", estado: "pendiente", texto: marcador(`respuesta del requisito ${codigo} en la sección aprobada`, `sección ${cob.bloque} · ${b?.titulo ?? ""}`) };
    }
    const sinBloque = !BLOQUES.some((x) => x.datapoints.includes(codigo));
    if (sinBloque && codigo.startsWith("NIIF S1") && alivios.E5) {
      const par = PAR_S2_DE_S1.get(sinCodigoNorma(codigo));
      return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaE5(par ?? null) };
    }
    const catId = codigos.find((c) => c.codigo === codigo)?.id;
    const sols = catId ? solsPorDatapoint.get(catId) ?? [] : [];
    for (const s of sols) {
      const e = ens.entregaPorSolicitud.get(s.id);
      const sol = ens.solicitudes.find((x) => x.id === s.id);
      if (e?.estado === "entregado" && e.valor != null && sol?.es_cuantitativa) {
        return {
          codigo,
          via: "captura",
          texto: respuestaDeCaptura(e.valor, sol.unidad_esperada, ens.reporte.ejercicio),
          valor: { valor: e.valor, unidad: sol.unidad_esperada, periodo: ens.reporte.ejercicio, solicitud: sol.titulo },
        };
      }
    }
    if (h?.estado === "pendiente") return { codigo, via: "regla", estado: "pendiente", texto: `[Pendiente: ${h.motivo}]` };
    return {
      codigo,
      via: "regla",
      estado: "pendiente",
      texto: sols.length
        ? marcador(`captura confirmada o sección del suplemento que responda ${codigo}`, `solicitud ${sols[0].titulo}`)
        : marcador(`información que responda ${codigo}`, "sin solicitud en el reporte ni sección del suplemento"),
    };
  };

  const planes = codigos.map((c) => planDe(c.codigo));
  // Conceptos del formato sin datapoint: desde su bloque aprobado, con todos los hechos de su cobertura.
  for (const c of CONCEPTOS_FORMATO_SIN_DATAPOINT) {
    const v = porBloque.get(c.bloque);
    const hs = v ? [...new Set(v.cobertura.flatMap((x) => x.hechos))] : [];
    if (!hs.length) continue;
    const clave = `fila:${c.fila}`;
    const de = codigos.filter((x) => c.parrafos.some((p) => sinCodigoNorma(x.codigo).startsWith(sinCodigoNorma(p)))).map((x) => `${x.codigo}: ${x.descripcion}`);
    descripcion.set(clave, `Concepto del Formato electrónico (fila ${c.fila}), párrafos ${c.parrafos.join(", ")}.${de.length ? ` ${de.join(" ")}` : ""}`);
    planes.push({ codigo: clave, via: "bloque", bloque: c.bloque, hechos: hs });
  }
  const filas: FilaRespuesta[] = [];
  const destinosDe = (codigo: string): Destino[] =>
    codigo.startsWith("fila:") ? ["formato"] : DATAPOINTS_FORMATO_TEXTO.has(codigo) ? ["taxonomia", "formato"] : ["taxonomia"];
  const base = (destino: Destino, clave: string): Omit<FilaRespuesta, "estado" | "origen" | "texto"> => ({
    destino, clave, tipo_campo: destino === "formato" ? "text block" : "text", valor: null, bloque: null, bloque_version: null,
    hechos: [], notas: [], modelo: null, prompt_version: null, uso: USO_CERO, costo_usd: 0,
  });

  for (const p of planes) {
    if (p.via === "bloque") continue;
    for (const d of destinosDe(p.codigo)) {
      if (p.via === "regla") filas.push({ ...base(d, p.codigo), estado: p.estado, origen: "regla", texto: p.texto, notas: p.notas ?? [] });
      else filas.push({ ...base(d, p.codigo), estado: "respuesta", origen: "captura", texto: p.texto, valor: p.valor, tipo_campo: d === "formato" ? "text block" : "valor" });
    }
  }

  // --- Modelo, agrupado por bloque -----------------------------------------------------
  const porBloqueModelo = new Map<number, Extract<Plan, { via: "bloque" }>[]>();
  for (const p of planes) if (p.via === "bloque") porBloqueModelo.set(p.bloque, [...(porBloqueModelo.get(p.bloque) ?? []), p]);
  let uso: Uso = { ...USO_CERO };
  const apiKey = opciones.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const trabajos = [...porBloqueModelo.entries()].map(([numero, ps]) => async () => {
    if (opciones.latido && !(await opciones.latido())) throw new Error("La reserva de las respuestas pasó a otra corrida.");
    const v = porBloque.get(numero)!;
    const r = await responderBloque(v, ps, { hechos, descripcion, glosario, destinosDe, apiKey, numeracion, previaDe });
    uso = sumar(uso, r.uso);
    filas.push(...r.filas);
  });
  await enParalelo(trabajos, 4);

  const costo = costoUsd(MODELO_RESPUESTAS, uso);
  const cuenta = (k: "origen" | "estado") => filas.reduce<Record<string, number>>((a, f) => ((a[`${f.destino}:${f[k]}`] = (a[`${f.destino}:${f[k]}`] ?? 0) + 1), a), {});
  return { filas, costo, uso, porOrigen: cuenta("origen"), porEstado: cuenta("estado") };
}

const sumar = (a: Uso, b: Uso): Uso => ({ entrada: a.entrada + b.entrada, cacheEscritura: a.cacheEscritura + b.cacheEscritura, cacheLectura: a.cacheLectura + b.cacheLectura, salida: a.salida + b.salida });

async function enParalelo(trabajos: (() => Promise<void>)[], n: number): Promise<void> {
  let i = 0;
  const hilo = async () => {
    while (i < trabajos.length) await trabajos[i++]();
  };
  await Promise.all(Array.from({ length: Math.min(n, trabajos.length) }, hilo));
}

// -----------------------------------------------------------------------------
// Una llamada por bloque
// -----------------------------------------------------------------------------
const SISTEMA = `Redactas respuestas breves a requisitos de revelación de las Normas NIIF S1 y S2 para el Excel de taxonomía y el Formato electrónico que presenta una emisora. Cada respuesta resume fielmente lo que ya dice una sección APROBADA del informe de la emisora; no redactas desde cero.

Reglas:
1. Es la voz de la emisora, en tercera persona («la Compañía»), en español formal. Responde exactamente el requisito indicado; no repitas la pregunta ni la cites.
2. Usa solo lo que dicen la sección aprobada y los hechos entregados para ese requisito. Cifras, fechas, porcentajes y nombres, idénticos a como aparecen ahí. No calcules, no redondees, no agregues contexto propio.
3. Longitud: destino «taxonomia», de dos a cuatro oraciones; destino «formato», hasta seis oraciones y no más de 900 caracteres. Si los hechos son pocos, una o dos oraciones bastan.
4. Si entre los hechos del requisito hay uno de tipo declaracion_negativa (la emisora declara una ausencia: «no usa», «ninguna»), la respuesta la incluye con su negación.
5. Prohibido el vocabulario del proceso interno: solicitud, evidencia, validado, captura, plataforma, bloque, IRStrat, ids, «la sección aprobada». No escribas remisiones a otras secciones: el sistema añade la remisión.
6. Nombres de órganos, comités y áreas: los canónicos del glosario de la emisora.
7. En «hechos», los ids (h1, h2…) de los hechos en que se apoya cada respuesta; al menos uno.

Devuelve JSON con una respuesta por cada requisito y destino pedidos.`;

const ESQUEMA = {
  type: "object",
  properties: {
    respuestas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codigo: { type: "string" },
          destino: { type: "string", enum: ["taxonomia", "formato"] },
          texto: { type: "string" },
          hechos: { type: "array", items: { type: "string" } },
        },
        required: ["codigo", "destino", "texto", "hechos"],
        additionalProperties: false,
      },
    },
  },
  required: ["respuestas"],
  additionalProperties: false,
};

type Pedido = { codigo: string; destino: Destino; hechos: HechoDeRequisito[]; uuids: string[] };
type Salida = { codigo: string; destino: Destino; texto: string; hechos: string[] };

async function responderBloque(
  v: VersionAprobada,
  planes: Extract<Plan, { via: "bloque" }>[],
  ctx: {
    hechos: Map<string, HechoLibro>;
    descripcion: Map<string, string>;
    glosario: EntradaGlosario[];
    destinosDe: (c: string) => Destino[];
    apiKey?: string;
    numeracion?: Map<number, number>;
    previaDe?: Map<string, Previa>;
  }
): Promise<{ filas: FilaRespuesta[]; uso: Uso }> {
  // Ids locales por bloque: h1, h2… en el orden en que aparecen.
  const local = new Map<string, string>();
  const pedidos: Pedido[] = [];
  for (const p of planes) {
    const hs: HechoDeRequisito[] = [];
    for (const id of p.hechos) {
      const h = ctx.hechos.get(id);
      if (!h || h.estado === "descartado") continue;
      if (!local.has(id)) local.set(id, `h${local.size + 1}`);
      hs.push({ id, local: local.get(id)!, tipo: h.tipo, enunciado: h.enunciado, extracto: h.extracto, valor: h.valor, unidad: h.unidad });
    }
    for (const d of ctx.destinosDe(p.codigo)) pedidos.push({ codigo: p.codigo, destino: d, hechos: hs, uuids: hs.map((h) => h.id) });
  }
  const titulo = BLOQUES.find((b) => b.numero === v.numero)?.titulo ?? `Sección ${v.numero}`;
  let uso: Uso = { ...USO_CERO };
  const finales = new Map<string, { texto: string; citados: string[]; origen: OrigenRespuesta; notas: string[] }>();
  const clave = (p: { codigo: string; destino: Destino }) => `${p.destino}|${p.codigo}`;

  // Reutilizables: misma versión aprobada del bloque y misma versión de prompt.
  const reutilizadas = new Map<string, Previa>();
  for (const p of pedidos) {
    const prev = ctx.previaDe?.get(clave(p));
    if (prev?.texto && prev.bloque === v.numero && prev.bloque_version === v.version && prev.prompt_version === PROMPT_RESPUESTAS) reutilizadas.set(clave(p), prev);
  }
  const llamados = pedidos.filter((p) => !reutilizadas.has(clave(p)));
  let pendientes = llamados;
  const motivos = new Map<string, string[]>();
  for (let intento = 1; intento <= 2 && pendientes.length && ctx.apiKey; intento++) {
    let salida: Salida[] = [];
    try {
      const r = await llamar(v, titulo, pendientes, ctx, motivos, ctx.apiKey);
      uso = sumar(uso, r.uso);
      salida = r.respuestas;
    } catch (e) {
      for (const p of pendientes) motivos.set(clave(p), [`falló la llamada: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`]);
      continue;
    }
    const siguientes: Pedido[] = [];
    for (const p of pendientes) {
      const s = salida.find((x) => x.codigo === p.codigo && x.destino === p.destino);
      if (!s) {
        motivos.set(clave(p), ["faltó la respuesta de este requisito"]);
        siguientes.push(p);
        continue;
      }
      const g = aplicarGlosario(s.texto.trim(), ctx.glosario);
      const errores = validarRespuesta(g.texto, p.destino, { codigo: p.codigo, textoBloque: v.texto, hechos: p.hechos, citados: s.hechos });
      if (errores.length) {
        motivos.set(clave(p), errores);
        siguientes.push(p);
        continue;
      }
      const notas = g.cambios.map((c) => `Glosario: «${c.variante}» → «${c.canonico}» (${c.veces}).`);
      if (intento > 1) notas.push(`Aceptada en el reintento; el primer intento falló: ${(motivos.get(clave(p)) ?? []).join("; ")}`);
      finales.set(clave(p), { texto: g.texto, citados: s.hechos, origen: "modelo", notas });
    }
    pendientes = siguientes;
  }

  const filas: FilaRespuesta[] = [];
  const porRespuesta = llamados.length ? costoUsd(MODELO_RESPUESTAS, uso) / llamados.length : 0;
  const rem = remision(v.numero, ctx.numeracion);
  for (const p of pedidos) {
    const prev = reutilizadas.get(clave(p));
    if (prev) {
      filas.push({
        destino: p.destino,
        clave: p.codigo,
        tipo_campo: p.destino === "formato" ? "text block" : "text",
        estado: "respuesta",
        origen: "modelo",
        texto: p.destino === "taxonomia" && rem ? `${sinRemision(prev.texto!)} ${rem}.` : prev.texto,
        valor: null,
        bloque: v.numero,
        bloque_version: v.version,
        hechos: prev.hechos,
        notas: prev.notas,
        modelo: MODELO_RESPUESTAS,
        prompt_version: PROMPT_RESPUESTAS,
        uso: { entrada: prev.tokens_entrada, cacheEscritura: prev.tokens_cache_escritura, cacheLectura: prev.tokens_cache_lectura, salida: prev.tokens_salida },
        costo_usd: Number(prev.costo_usd),
      });
      continue;
    }
    let f = finales.get(clave(p));
    if (!f) {
      // Respaldo sin modelo: las oraciones del bloque aprobado ancladas a estos hechos.
      const max = LIMITES[p.destino].oraciones;
      let texto = oracionesAncladas(v.anclas, p.uuids, max);
      if (!texto) texto = oracionesDe(v.texto.split(/\n+/)[0] ?? "").slice(0, Math.min(2, max)).join(" ");
      if (LIMITES[p.destino].caracteres && texto.length > LIMITES[p.destino].caracteres!) texto = oracionesDe(texto).slice(0, 2).join(" ");
      f = { texto, citados: [], origen: "bloque", notas: [`Respaldo con oraciones del bloque aprobado; el modelo no pasó los validadores: ${(motivos.get(clave(p)) ?? ["sin llave del modelo"]).join("; ")}`] };
    }
    const porLocal = new Map(p.hechos.map((h) => [h.local, h.id]));
    const hechosCitados = f.origen === "modelo" ? f.citados.map((c) => porLocal.get(c)).filter((x): x is string => !!x) : p.uuids;
    filas.push({
      destino: p.destino,
      clave: p.codigo,
      tipo_campo: p.destino === "formato" ? "text block" : "text",
      estado: "respuesta",
      origen: f.origen,
      texto: p.destino === "taxonomia" && rem ? `${f.texto} ${rem}.` : f.texto,
      valor: null,
      bloque: v.numero,
      bloque_version: v.version,
      hechos: hechosCitados,
      notas: f.notas,
      modelo: f.origen === "modelo" ? MODELO_RESPUESTAS : null,
      prompt_version: f.origen === "modelo" ? PROMPT_RESPUESTAS : null,
      uso: { entrada: Math.round(uso.entrada / llamados.length), cacheEscritura: Math.round(uso.cacheEscritura / llamados.length), cacheLectura: Math.round(uso.cacheLectura / llamados.length), salida: Math.round(uso.salida / llamados.length) },
      costo_usd: Math.round(porRespuesta * 10_000) / 10_000,
    });
  }
  return { filas, uso };
}

async function llamar(
  v: VersionAprobada,
  titulo: string,
  pedidos: Pedido[],
  ctx: { descripcion: Map<string, string>; glosario: EntradaGlosario[] },
  motivos: Map<string, string[]>,
  apiKey: string
): Promise<{ respuestas: Salida[]; uso: Uso }> {
  const glosario = ctx.glosario.length ? `\n\nGlosario de la emisora (canónico = variantes):\n${ctx.glosario.map((e) => `- ${e.canonico}${e.variantes.length ? ` = ${e.variantes.join("; ")}` : ""}`).join("\n")}` : "";
  const requisitos = [...new Set(pedidos.map((p) => p.codigo))].map((codigo) => {
    const ps = pedidos.filter((p) => p.codigo === codigo);
    const hs = ps[0].hechos;
    const previos = ps.flatMap((p) => (motivos.get(`${p.destino}|${p.codigo}`) ?? []).map((m) => `  - (${p.destino}) ${m}`));
    return [
      `## ${codigo} — destinos: ${ps.map((p) => p.destino).join(", ")}`,
      `Requisito: ${ctx.descripcion.get(codigo) ?? codigo}`,
      "Hechos:",
      ...hs.map((h) => `- ${h.local} [${h.tipo}] ${h.enunciado}${h.valor != null ? ` (valor: ${h.valor}${h.unidad ? ` ${h.unidad}` : ""})` : ""} — «${h.extracto}»`),
      ...(previos.length ? ["Tu respuesta anterior se rechazó por:", ...previos] : []),
    ].join("\n");
  });
  const client = new Anthropic({ apiKey });
  const m = await client.messages
    .stream(
      {
        model: MODELO_RESPUESTAS,
        max_tokens: 8000,
        system: [{ type: "text", text: SISTEMA + glosario, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `# Sección ${v.numero} · ${titulo} (texto aprobado)\n\n${v.texto}\n\n# Requisitos\n\n${requisitos.join("\n\n")}`,
          },
        ],
        output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      },
      { timeout: 180_000, maxRetries: 1 }
    )
    .finalMessage();
  const uso: Uso = {
    entrada: m.usage.input_tokens ?? 0,
    cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
    cacheLectura: m.usage.cache_read_input_tokens ?? 0,
    salida: m.usage.output_tokens ?? 0,
  };
  const r = JSON.parse(m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("")) as { respuestas: Salida[] };
  return { respuestas: r.respuestas ?? [], uso };
}

// -----------------------------------------------------------------------------
// Guardado y reserva (molde del cierre)
// -----------------------------------------------------------------------------
export const RESPUESTAS_ABANDONADAS_MS = 20 * 60 * 1000;

/** Reserva la generación de respuestas del documento; null si ya hay una viva. */
export async function reclamarRespuestas(db: Db, documentoId: string): Promise<string | null> {
  const corte = new Date(Date.now() - RESPUESTAS_ABANDONADAS_MS).toISOString();
  const reserva = crypto.randomUUID();
  const { data } = await db
    .from("documentos_generados")
    .update({ respuestas_estado: "en_cola", respuestas_resultado: { reserva }, respuestas_actualizado_en: new Date().toISOString() })
    .eq("id", documentoId)
    .eq("estado", "aprobado")
    .or(`respuestas_estado.is.null,respuestas_estado.in.(listo,error),respuestas_actualizado_en.lt.${corte}`)
    .select("id");
  return data?.length ? reserva : null;
}

/**
 * Escribe las filas con service role: upsert de las de este documento, borra las
 * que ya no salen y las de documentos anteriores del mismo reporte (los Excel
 * leen siempre el último aprobado).
 */
export async function guardarRespuestas(admin: Db, documentoId: string, filas: FilaRespuesta[]): Promise<void> {
  const { data: doc } = await admin.from("documentos_generados").select("tenant_id, reporte_id, version").eq("id", documentoId).single();
  if (!doc) throw new Error("documento");
  const registros = filas.map((f) => ({
    tenant_id: doc.tenant_id,
    reporte_id: doc.reporte_id,
    documento_id: documentoId,
    version_documento: doc.version,
    destino: f.destino,
    clave: f.clave,
    tipo_campo: f.tipo_campo,
    estado: f.estado,
    origen: f.origen,
    texto: f.texto,
    valor: f.valor as never,
    bloque: f.bloque,
    bloque_version: f.bloque_version,
    hechos: f.hechos as never,
    notas: f.notas as never,
    modelo: f.modelo,
    prompt_version: f.prompt_version,
    tokens_entrada: f.uso.entrada,
    tokens_cache_escritura: f.uso.cacheEscritura,
    tokens_cache_lectura: f.uso.cacheLectura,
    tokens_salida: f.uso.salida,
    costo_usd: f.costo_usd,
  }));
  for (let i = 0; i < registros.length; i += 200) {
    const { error } = await admin.from("respuestas_datapoint").upsert(registros.slice(i, i + 200), { onConflict: "documento_id,destino,clave" });
    if (error) throw new Error(`guardar respuestas: ${error.message}`);
  }
  for (const destino of ["taxonomia", "formato"] as const) {
    const claves = registros.filter((r) => r.destino === destino).map((r) => r.clave);
    const { data: viejas } = await admin.from("respuestas_datapoint").select("id, clave").eq("documento_id", documentoId).eq("destino", destino);
    const sobran = (viejas ?? []).filter((x) => !claves.includes(x.clave)).map((x) => x.id);
    if (sobran.length) await admin.from("respuestas_datapoint").delete().in("id", sobran);
  }
  const { error } = await admin.from("respuestas_datapoint").delete().eq("reporte_id", doc.reporte_id).neq("documento_id", documentoId);
  if (error) throw new Error(`reemplazar respuestas anteriores: ${error.message}`);
}

/**
 * Corre una generación reservada y deja su estado. `db` es la sesión del staff
 * (lee y marca el estado); `admin` escribe las filas. No lanza: un fallo queda
 * en «error».
 */
export async function completarRespuestas(db: Db, admin: Db, documentoId: string, reserva: string): Promise<ResultadoRespuestas | null> {
  const marcar = async (respuestas_estado: "ejecutando" | "listo" | "error", resultado: Record<string, unknown> = {}) => {
    const { data } = await db
      .from("documentos_generados")
      .update({ respuestas_estado, respuestas_resultado: { ...resultado, reserva } as never, respuestas_actualizado_en: new Date().toISOString() })
      .eq("id", documentoId)
      .eq("respuestas_resultado->>reserva", reserva)
      .select("id");
    return !!data?.length;
  };
  if (!(await marcar("ejecutando"))) return null;
  try {
    const r = await generarRespuestas(db, documentoId, { latido: () => marcar("ejecutando") });
    if (!(await marcar("ejecutando"))) return null;
    await guardarRespuestas(admin, documentoId, r.filas);
    await marcar("listo", { costo_usd: r.costo, por_origen: r.porOrigen, por_estado: r.porEstado, filas: r.filas.length });
    return r;
  } catch (e) {
    await marcar("error", { error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
    return null;
  }
}
