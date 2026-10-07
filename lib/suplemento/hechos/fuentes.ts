import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Contenido } from "@/lib/evidencias/extraer";
import { ensamblarReporte } from "@/lib/reporte/ensamblar";
import { evaluarCompletitud } from "@/lib/suplemento/completitud";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { puntuar, unidades } from "@/lib/suplemento/adjuntos-bloque";
import type { HechoNuevo, UnidadTexto } from "./tipos";

// =============================================================================
// FUENTES DEL LIBRO DE HECHOS (encargo suplemento-calidad, Paso 5).
//
// Dos salidas:
//   · HECHOS DIRECTOS, sin modelo: lo que ya es atómico y estructurado —las
//     capturas confirmadas, los campos estructurados del Perfil (denominación,
//     horizontes, niveles de la matriz, hitos, cadena de valor) y los registros
//     y objetivos que la emisora declara en la plataforma—. El extracto es el
//     valor tal como está guardado; se verifican por construcción.
//   · TRAMOS DE TEXTO que el modelo atomiza: respuestas de cuestionario,
//     extractos confirmados, campos de texto libre del Perfil y las partes de los
//     adjuntos que pasan la división por términos.
//
// QUÉ NO ES FUENTE: la descripción de una solicitud. Es la pregunta, no la
// respuesta (decisión de Esteban, 7 de octubre de 2026). Tampoco el contenido
// crudo de una evidencia: lo que de ahí vale es lo que una persona confirmó.
//
// Rango: validado (capturas confirmadas, extractos confirmados, respuestas de
// cuestionario) > perfil (Perfil, registros y objetivos de la emisora) >
// adjunto (documentos del Perfil, que nadie confirmó frase por frase).
// =============================================================================

type Db = SupabaseClient<Database>;

/** Partes de un adjunto que pasan a la extracción: las que más se parecen a lo que pide el documento. */
const PROPORCION_DEL_MAXIMO = 0.3;
const UNIDADES_POR_ADJUNTO_MAX = 14;

const bloque = (n: number) => BLOQUES.find((b) => b.numero === n)!;
const slug = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

/** Campos estructurados del Perfil: su bloque dueño y los que lo refieren. */
const DUENO_PERFIL: Record<string, { dueno: number; referencia: number[] }> = {
  denominacion_formal: { dueno: 2, referencia: [4] },
  nombre_corto: { dueno: 2, referencia: [] },
  forma_de_referencia: { dueno: 2, referencia: [] },
  carta_firmante: { dueno: 1, referencia: [] },
  carta_cargo: { dueno: 1, referencia: [] },
  horizontes: { dueno: 8, referencia: [20] },
  matriz_riesgos: { dueno: 9, referencia: [21, 27] },
  hitos_corporativos: { dueno: 11, referencia: [] },
  hitos_sostenibilidad: { dueno: 19, referencia: [] },
  cadena_valor: { dueno: 12, referencia: [13] },
};

/** Campos de texto libre del Perfil y los bloques que probablemente los usan. */
const TEXTO_PERFIL: Record<string, { etiqueta: string; sugeridos: number[] }> = {
  entidad_que_informa: { etiqueta: "Entidad que informa", sugeridos: [4] },
  perimetro: { etiqueta: "Perímetro del informe", sugeridos: [4] },
  carta_texto: { etiqueta: "Carta de la Dirección", sugeridos: [1] },
  proceso_materialidad: { etiqueta: "Proceso de materialidad", sugeridos: [7] },
  modelo_negocio: { etiqueta: "Modelo de negocio", sugeridos: [12, 13, 22] },
  gobierno_texto: { etiqueta: "Gobierno corporativo", sugeridos: [15, 16, 17, 18] },
};

/** Secciones del Perfil → bloques que suelen usar sus adjuntos. */
const BLOQUES_DE_SECCION: Record<string, number[]> = {
  identidad: [2, 4],
  matriz: [9, 21, 27],
  horizontes: [8, 20],
  carta: [1],
  historia: [11],
  trayectoria: [19],
  modelo: [12, 13, 22],
  gobierno: [15, 16, 17, 18, 27],
  materialidad: [7],
};

const normCodigo = (c: string) => c.replace(/^NIIF\s*/i, "").replace(/\s+/g, "").toLowerCase();

export type Recoleccion = {
  directos: HechoNuevo[];
  textos: UnidadTexto[];
  /** Lo que no entra al libro y por qué (nivel documento, para el pre-vuelo). */
  insumos: {
    adjuntos: { archivo: string; estado: string; unidades: number; enviadas: number; truncado: boolean; mensaje: string | null }[];
    solicitudesValidadasSinFuente: number;
  };
  /** Lo que cambia la huella: si no cambia, el libro se puede reutilizar. */
  material: unknown;
};

export async function recolectar(db: Db, reporteId: string, tenantId: string): Promise<Recoleccion> {
  const [ens, comp] = await Promise.all([ensamblarReporte(db, reporteId), evaluarCompletitud(db, reporteId)]);
  if (!ens.ok) throw new Error(`ensamblado: ${ens.causa}`);
  if (!comp.ok) throw new Error(`completitud: ${comp.causa}`);
  const ejercicio = ens.reporte.ejercicio;

  // Solicitud → bloques que la usan, en el orden del documento.
  const bloquesDeSolicitud = new Map<string, number[]>();
  for (const b of comp.bloques) {
    const n = BLOQUES.find((x) => x.clave === b.clave)!.numero;
    for (const s of b.solicitudes) bloquesDeSolicitud.set(s, [...(bloquesDeSolicitud.get(s) ?? []), n]);
  }
  /** Dueño: el primer bloque normativo que la usa; si no hay, el primero. Los demás la refieren. */
  const duenoDe = (ns: number[]): { dueno: number | null; referencia: number[] } => {
    const ordenados = [...new Set(ns)].sort((a, b) => a - b);
    const normativo = ordenados.find((n) => bloque(n).clase === "normativo");
    const dueno = normativo ?? ordenados[0] ?? null;
    return { dueno, referencia: ordenados.filter((n) => n !== dueno) };
  };

  const directos: HechoNuevo[] = [];
  const textos: UnidadTexto[] = [];
  const base = { verificado: true, estado: "vigente" as const };

  // --- 1. Capturas confirmadas (validado) -------------------------------------
  let validadasSinFuente = 0;
  for (const s of ens.solicitudes) {
    const e = ens.entregaPorSolicitud.get(s.id);
    if (e?.estado === "entregado" && e.valor == null) validadasSinFuente++;
    if (e?.valor == null) continue;
    const d = duenoDe(bloquesDeSolicitud.get(s.id) ?? []);
    directos.push({
      ...base,
      clave: `${slug(s.titulo)}.valor_${ejercicio}`,
      enunciado: `${s.titulo}: ${e.valor}${s.unidad_esperada ? ` ${s.unidad_esperada}` : ""} (ejercicio ${ejercicio}).`,
      tipo: "cifra",
      valor: Number(e.valor),
      unidad: s.unidad_esperada,
      periodo: String(ejercicio),
      rango_fuente: "validado",
      fuente_tipo: "captura",
      fuente_id: `sol:${s.id}`,
      fuente_detalle: `Captura confirmada de «${s.titulo}», ejercicio ${ejercicio}`,
      extracto: String(e.valor),
      verificacion: "registro: última captura confirmada de una solicitud validada",
      bloque_dueno: d.dueno,
      bloques_referencia: d.referencia,
    });
  }

  // --- 2. Extractos de texto confirmados (validado) ---------------------------
  const solIds = ens.solicitudes.map((s) => s.id);
  if (solIds.length) {
    const { data: ext } = await db
      .from("sugerencias_captura")
      .select("solicitud_id, extracto, extracto_final, estado, decidido_en")
      .in("solicitud_id", solIds)
      .eq("tipo", "texto")
      .in("estado", ["confirmada", "corregida"])
      .order("decidido_en", { ascending: false });
    const visto = new Set<string>();
    for (const x of ext ?? []) {
      if (visto.has(x.solicitud_id)) continue; // el más reciente por solicitud
      visto.add(x.solicitud_id);
      const texto = (x.estado === "corregida" && x.extracto_final ? x.extracto_final : x.extracto) ?? "";
      if (!texto.trim()) continue;
      const s = ens.solicitudes.find((y) => y.id === x.solicitud_id)!;
      textos.push({
        id: `sol:${s.id}`,
        rango: "validado",
        fuenteTipo: "extracto",
        detalle: `Extracto confirmado de «${s.titulo}»`,
        texto,
        sugeridos: bloquesDeSolicitud.get(s.id) ?? [],
      });
    }
  }

  // --- 3. Respuestas de cuestionario (validado) -------------------------------
  for (const c of ens.cuestionarios) {
    if (!(c.respuesta ?? "").trim()) continue;
    const hoja = normCodigo(c.hoja);
    const sugeridos = BLOQUES.filter((b) => b.datapoints.some((d) => normCodigo(d).startsWith(hoja) || hoja.startsWith(normCodigo(d)))).map((b) => b.numero);
    textos.push({
      id: `cue:${c.hoja}:${c.pregunta_orden}`,
      rango: "validado",
      fuenteTipo: "cuestionario",
      detalle: `Cuestionario ${c.hoja}, pregunta ${c.pregunta_orden}`,
      texto: c.respuesta!,
      sugeridos,
    });
  }

  // --- 4. Perfil del emisor (perfil) -------------------------------------------
  const { data: perfil } = await db.from("perfil_emisor").select("*").eq("tenant_id", tenantId).maybeSingle();
  const p = (perfil ?? {}) as Record<string, unknown>;
  const directoPerfil = (campo: string, h: Omit<HechoNuevo, keyof typeof base | "rango_fuente" | "fuente_tipo" | "fuente_id" | "bloque_dueno" | "bloques_referencia" | "verificacion">) => {
    const d = DUENO_PERFIL[campo];
    directos.push({
      ...base,
      ...h,
      rango_fuente: "perfil",
      fuente_tipo: "perfil",
      fuente_id: `perfil:${campo}`,
      verificacion: "registro: campo estructurado del Perfil",
      bloque_dueno: d.dueno,
      bloques_referencia: d.referencia,
    });
  };
  for (const campo of ["denominacion_formal", "nombre_corto", "forma_de_referencia", "carta_firmante", "carta_cargo"]) {
    const v = typeof p[campo] === "string" ? (p[campo] as string).trim() : "";
    if (!v) continue;
    directoPerfil(campo, {
      clave: `emisora.${campo}`, enunciado: `${campo.replace(/_/g, " ")}: «${v}».`, tipo: "nombre",
      valor: null, unidad: null, periodo: null, fuente_detalle: `Perfil del emisor, ${campo.replace(/_/g, " ")}`, extracto: v,
    });
  }
  for (const h of (Array.isArray(p.horizontes) ? p.horizontes : []) as { plazo?: string; definicion?: string; justificacion?: string }[]) {
    if (!h.plazo || !h.definicion) continue;
    directoPerfil("horizontes", {
      clave: `horizonte.${slug(h.plazo)}`, enunciado: `${h.plazo}: ${h.definicion}.${h.justificacion ? ` Justificación: ${h.justificacion}` : ""}`,
      tipo: "otro", valor: null, unidad: null, periodo: null, fuente_detalle: `Perfil del emisor, horizontes (${h.plazo})`, extracto: h.definicion,
    });
  }
  const matriz = p.matriz_riesgos as { niveles?: { nombre: string; min: number; max: number }[]; escala_max?: number } | null;
  for (const n of matriz?.niveles ?? []) {
    directoPerfil("matriz_riesgos", {
      clave: `matriz_riesgos.nivel_${slug(n.nombre)}`, enunciado: `Nivel «${n.nombre}» de la matriz de riesgos: severidad de ${n.min} a ${n.max}${matriz?.escala_max ? ` (escala máxima ${matriz.escala_max})` : ""}.`,
      tipo: "cifra", valor: null, unidad: null, periodo: null, fuente_detalle: "Perfil del emisor, matriz de riesgos", extracto: n.nombre,
    });
  }
  for (const [campo, etiqueta] of [["hitos_corporativos", "Hito corporativo"], ["hitos_sostenibilidad", "Hito de sostenibilidad"]] as const) {
    for (const h of (Array.isArray(p[campo]) ? p[campo] : []) as { anio?: string; texto?: string }[]) {
      if (!h.texto) continue;
      directoPerfil(campo, {
        clave: `${campo}.${h.anio ?? "s_f"}_${slug(h.texto).slice(0, 30)}`, enunciado: `${etiqueta}${h.anio ? ` (${h.anio})` : ""}: ${h.texto}`,
        tipo: "otro", valor: null, unidad: null, periodo: h.anio ?? null, fuente_detalle: `Perfil del emisor, ${etiqueta.toLowerCase()}${h.anio ? ` ${h.anio}` : ""}`, extracto: h.texto,
      });
    }
  }
  for (const e of (Array.isArray(p.cadena_valor) ? p.cadena_valor : []) as { etapa?: string; descripcion?: string }[]) {
    if (!e.etapa || !e.descripcion) continue;
    directoPerfil("cadena_valor", {
      clave: `cadena_valor.${slug(e.etapa)}`, enunciado: `Etapa «${e.etapa}» de la cadena de valor: ${e.descripcion}`,
      tipo: "proceso", valor: null, unidad: null, periodo: null, fuente_detalle: `Perfil del emisor, cadena de valor (${e.etapa})`, extracto: e.descripcion,
    });
  }
  for (const [campo, def] of Object.entries(TEXTO_PERFIL)) {
    const v = typeof p[campo] === "string" ? (p[campo] as string).trim() : "";
    if (!v) continue;
    textos.push({ id: `perfil:${campo}`, rango: "perfil", fuenteTipo: "perfil", detalle: `Perfil del emisor, ${def.etiqueta}`, texto: v, sugeridos: def.sugeridos });
  }

  // --- 5. Registros de clima y objetivos (perfil: los declara la emisora) ------
  for (const r of ens.registros) {
    const esRiesgo = r.tipo.startsWith("riesgo");
    const dueno = esRiesgo ? 21 : 24;
    const referencia = esRiesgo ? [13, r.tipo === "riesgo_fisico" ? 35 : 34] : [36];
    const comun = { ...base, rango_fuente: "perfil" as const, fuente_tipo: "registro" as const, fuente_id: `reg:${r.id}`, verificacion: "registro: registro de clima de la emisora", bloque_dueno: dueno, bloques_referencia: referencia, unidad: null, periodo: null };
    const k = `registro.${slug(r.nombre).slice(0, 40)}`;
    directos.push({
      ...comun, clave: `${k}.ficha`, tipo: "otro", valor: r.severidad,
      enunciado: `${esRiesgo ? "Riesgo" : "Oportunidad"} «${r.nombre}» (${r.tipo.replace(/_/g, " ")}; horizontes: ${(r.horizontes ?? []).join(", ") || "—"}${r.severidad != null ? `; probabilidad ${r.probabilidad}, impacto ${r.impacto}, severidad ${r.severidad}${r.nivel ? `, nivel ${r.nivel}` : ""}` : ""}).`,
      fuente_detalle: `Registro de clima «${r.nombre}»`, extracto: r.nombre,
    });
    for (const [campo, etiqueta] of [["descripcion", "descripción"], ["concentracion", "dónde se concentra"], ["impactos_potenciales", "impactos potenciales"], ["respuesta", "respuesta de la emisora"]] as const) {
      const v = (r[campo] ?? "").trim();
      if (!v) continue;
      directos.push({ ...comun, clave: `${k}.${campo}`, tipo: campo === "respuesta" ? "proceso" : "otro", valor: null, enunciado: `«${r.nombre}», ${etiqueta}: ${v}`, fuente_detalle: `Registro de clima «${r.nombre}», ${etiqueta}`, extracto: v });
    }
  }
  for (const o of ens.objetivos) {
    const gei = /emisi|gei|co2/i.test(`${o.tipo ?? ""} ${o.metrica ?? ""}`);
    directos.push({
      ...base, rango_fuente: "perfil", fuente_tipo: "objetivo", fuente_id: `obj:${o.id}`, verificacion: "registro: objetivo de la emisora",
      bloque_dueno: 38, bloques_referencia: gei ? [39, 40] : [39], valor: null, unidad: null, periodo: o.periodo_aplicacion,
      clave: `objetivo.${slug(o.nombre).slice(0, 40)}`, tipo: "cifra",
      enunciado: `Objetivo «${o.nombre}»: ${o.meta ?? "—"}${o.metrica ? `; métrica: ${o.metrica}` : ""}${o.periodo_base ? `; año base: ${o.periodo_base}` : ""}${o.hito_intermedio ? `; hito intermedio: ${o.hito_intermedio}` : ""}.`,
      fuente_detalle: `Objetivo «${o.nombre}»`, extracto: o.meta ?? o.nombre,
    });
  }

  // --- 6. Adjuntos del Perfil (adjunto), divididos por términos ---------------
  const consulta = BLOQUES.map((b) => b.titulo).join("\n") + "\n" + [...ens.descripcionesDatapoint.values()].join("\n");
  const { data: adjs } = await db
    .from("perfil_emisor_adjuntos_contenido")
    .select("adjunto_id, tenant_id, seccion, nombre_original, estado, contenido, truncado, mensaje")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  const insumosAdj: Recoleccion["insumos"]["adjuntos"] = [];
  for (const a of adjs ?? []) {
    if (a.tenant_id !== tenantId) continue;
    if (a.estado !== "extraido" || !a.contenido) {
      insumosAdj.push({ archivo: a.nombre_original, estado: a.estado, unidades: 0, enviadas: 0, truncado: false, mensaje: a.mensaje });
      continue;
    }
    const us = unidades(a.adjunto_id, a.nombre_original, a.contenido as unknown as Contenido).filter((u) => u.texto.trim());
    const puntos = puntuar(consulta, us);
    const max = Math.max(0, ...puntos);
    const elegidas = us
      .map((u, i) => ({ u, p: puntos[i] }))
      .filter((x) => us.length <= 3 || x.p >= max * PROPORCION_DEL_MAXIMO)
      .sort((x, y) => y.p - x.p)
      .slice(0, UNIDADES_POR_ADJUNTO_MAX)
      .sort((x, y) => x.u.orden - y.u.orden);
    for (const { u } of elegidas) {
      textos.push({ id: u.id, rango: "adjunto", fuenteTipo: "adjunto", detalle: u.detalle, texto: u.texto, sugeridos: BLOQUES_DE_SECCION[a.seccion] ?? [] });
    }
    insumosAdj.push({ archivo: a.nombre_original, estado: a.estado, unidades: us.length, enviadas: elegidas.length, truncado: a.truncado, mensaje: a.mensaje });
  }

  return {
    directos,
    textos,
    insumos: { adjuntos: insumosAdj, solicitudesValidadasSinFuente: validadasSinFuente },
    material: { directos: directos.map((d) => [d.fuente_id, d.extracto, d.enunciado]), textos: textos.map((t) => [t.id, t.texto]) },
  };
}
