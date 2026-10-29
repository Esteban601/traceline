import { datapointsExentos } from "@/lib/suplemento/bloques";
import { filaExportada } from "@/lib/formato/objetivos";
import { CONCEPTOS_FORMATO_CON_ENFOQUE, HORIZONTES_TABLA, TABLAS_POR_HORIZONTE, pendienteEnTextoPlano, sinRemision, textoNoAplicaHeredado, type EstadoRespuesta } from "@/lib/suplemento/respuestas";
import { ORACION_E5, declaracionDeAlivios, noRevelado } from "@/lib/suplemento/alivios";
import type { Alivios } from "@/lib/perfil-emisor";
import type { InstanciaMetrica } from "@/lib/formato/instancias";
import { BOOLEANOS_FORMATO, clausulasDelTema, contradice, valorBooleano } from "@/lib/formato/booleanos";
import mapeoFormato from "@/docs/suplemento-s1s2/mapeo-formato-electronico.json" with { type: "json" };

// =============================================================================
// LLENADO DEL FORMATO ELECTRÓNICO NIIF S1/S2 (encargo 2026-10-13-excel-
// respuestas-narrativas, Paso 4). Función pura: recibe el mapeo concepto ↔
// datapoint, las respuestas del último documento aprobado y los datos del
// Perfil y del reporte, y devuelve el valor de la columna K (Respuesta) por
// fila, con su origen. No llama al modelo: las respuestas narrativas ya están
// en `respuestas_datapoint`; aquí solo se colocan por tipo de campo.
//
// POR TIPO (encargo §2.2; decisiones del Paso 0 y del 13 de octubre):
//   · encabezado, abstract, miembro de tabla, subconcepto → sin respuesta;
//   · ACTIVIDAD (revisión externa, punto 3): la selección de actividades
//     (339/340) y el sector SASB (446/447) salen del Perfil; las secciones de
//     emisiones financiadas de una actividad en la que la emisora no participa
//     dicen «No aplica por actividad», con la justificación del Perfil;
//   · un datapoint que un alivio vigente deja fuera (C4: cifras de Alcance 3)
//     → «No revelado · alivio C4»;
//   · regla fija / regla del primer año → el valor de la regla;
//   · Perfil → el campo del Perfil o del reporte;
//   · text y text block → la respuesta «formato» del datapoint, o la del
//     concepto (`fila:N`) si no tiene datapoint; las filas con el alivio E5
//     llevan su oración fija; un pendiente deja la celda VACÍA (CLAUDE.md §5);
//   · booleano → «No» si la respuesta es «no aplica»; si no, el «Sí» o «No» con
//     que abre su respuesta propia (`fila:N`, D1 del encargo formato-
//     afirmaciones-y-voz), si la celda narrativa vecina no lo contradice; vacío
//     si está pendiente o no hay respuesta validada;
//   · enumeraciones de objetivos → el atributo de cada objetivo climático;
//   · tablas → texto por filas con la estructura de la columna O de la revisión.
//   · lo demás → vacío y «por decidir», con la pregunta, en la hoja de revisión.
// =============================================================================

export type ConceptoMapeo = {
  fila: number;
  seccion: string;
  tipo: string | null;
  clasificacion: string;
  capa: string;
  datapoint: string | null;
  perfil?: string | null;
  bloque: number | null;
  regla: string | null;
  alivioE5: boolean;
  respondidaEnReferencia: boolean;
};

export const CONCEPTOS_FORMATO = (mapeoFormato as unknown as { conceptos: ConceptoMapeo[] }).conceptos;

export type RespuestaLeida = { destino: "taxonomia" | "formato"; clave: string; estado: EstadoRespuesta; texto: string | null };

export type ObjetivoFormato = {
  nombre: string; origen: string | null; tipo_objetivo: string | null; gases: string | null; alcances: string | null; bruto_neto: string | null;
  // Por inciso (encargo formato-respuesta-por-inciso, Fase 4): un bloque «Objetivo N» por objetivo.
  descripcion?: string | null; metrica?: string | null; parte_entidad?: string | null; periodo_aplicacion?: string | null; periodo_base?: string | null;
  hito_intermedio?: string | null; alineacion?: string | null; validacion_tercero?: string | null; procesos_revision?: string | null;
  metricas_supervision?: string | null; revisiones?: string | null; resultados?: string | null; analisis_tendencias?: string | null;
  enfoque_descarbonizacion?: string | null;
};

export type DatosFormato = {
  ejercicio: number;
  primerAnio: boolean;
  alivios: Alivios;
  perfil: {
    denominacion_formal: string | null;
    clave_cotizacion: string | null;
    tipo_instrumento: string | null;
    fiduciario: string | null;
    numero_fideicomiso: string | null;
    fideicomitente: string | null;
    administrador_patrimonio: string | null;
    hechos_posteriores: string | null;
    actividades_financieras: string[];
    sector_sasb: string[];
    metricas_industria: string | null;
  };
  /** Hay logotipo: la celda lleva la imagen (la inserta quien escribe). */
  hayLogo: boolean;
  respuestas: RespuestaLeida[];
  /** Emisiones del ejercicio por alcance, de capturas confirmadas: «Alcance 1» → «1,240 tCO2e». */
  gei: { alcance: string; valor: string }[];
  /** Registros de clima con su valor del ejercicio, por tipo. */
  registros: { tipo: string; nombre: string; horizontes: string; concentracion: string | null; descripcion: string | null; cantidad: number | null; porcentaje: number | null; capital: string | null }[];
  /** Objetivos climáticos con su detalle. */
  objetivos: ObjetivoFormato[];
  /** Respuestas de los cuestionarios, en el orden del catálogo. */
  cuestionarios: Record<string, (string | null)[]>;
  /** El bloque 2 aprobado declara la preparación de conformidad con NIIF S1 y S2. */
  declaraCumplimiento: boolean;
  /** El párrafo del bloque 2 aprobado que hace la declaración, tal cual. */
  declaracion: string | null;
  /** Cobertura del documento aprobado: requisitos «parcial» y pendientes (regla 1 de Esteban). */
  cumplimiento: { parciales: string[]; pendientes: number };

};

export type OrigenFormato = "iteración" | "respuesta" | "regla" | "perfil" | "alivio" | "actividad" | "datos" | "logo" | "por decidir" | "sin mapeo" | "sin respuesta" | "fuera de alcance" | "pendiente";
export type ValorFormato = {
  texto: string | null;
  origen: OrigenFormato;
  nota?: string;
  /** La oración del E5 la antepuso el llenado. */
  e5?: boolean;
  /** Booleano que quedó vacío porque la celda narrativa vecina contradice su valor (D1). */
  contradiccion?: { valor: "Sí" | "No"; oracion: string };
};

/**
 * Encabezados de la plantilla 2025 bajo los que hay conceptos con el alivio E5 (filas del mapeo; en el Formato,
 * K24, K27, K54, K83, K102, K121, K473 y K553). D4 de Esteban (encargo formato-afirmaciones-y-voz): la oración del
 * E5 va una vez por encabezado, en la primera celda que la lleva; las celdas «no aplica · E5», cuyo contenido es la
 * oración, la conservan.
 */
export const ENCABEZADOS_E5 = [24, 27, 54, 83, 102, 121, 194, 274];

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const entreComillas = (t: string | null) => t?.match(/«([^»]+)»/)?.[1] ?? null;

/** Secciones de emisiones financiadas por actividad (filas del formato 2025). */
export const SECCIONES_ACTIVIDAD = [
  { actividad: "Gestión de activos", desde: 452, hasta: 465 },
  { actividad: "Banca comercial", desde: 466, hasta: 486 },
  { actividad: "Seguros", desde: 487, hasta: 505 },
];
const FILAS_ACTIVIDAD = new Set([339, 340]);
/** NIIF S2 29A y 29B: 432 (limitaciones, 29A), 433 (¿limitó la categoría 15?), 435 (qué trató como derivado) y 437 (actividades excluidas). Sin código en el catálogo (modificación de 2025). */
const FILAS_29B = new Set([432, 433, 435, 437]);
/** «¿Por qué?» de un booleano (fila → fila del booleano): la explicación del «No». Fase 2 del encargo formato-afirmaciones-y-voz. */
/** Sección «Para: Fideicomisos» de la plantilla 2025: las filas cuya columna A lo dice (un e2e lo comprueba). */
export const FILAS_FIDEICOMISO = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21]);
/** Fila de la declaración de los alivios del reporte (K12). */
export const FILA_ALIVIOS = 12;
/**
 * Ramas de los booleanos de la plantilla 2025 (regla general, encargo formato-respuesta-por-inciso, Fase 1): la rama
 * «No» («¿Por qué?»; en la 315, «Explicar el método…») solo se despliega con «No» y da la razón; la rama «Sí» («¿Cómo…?»,
 * «¿De qué manera…?») solo con «Sí». Una rama que su booleano cierra queda vacía. Antes la lista tenía solo algunas
 * filas: K41 y K50 llevaban texto con la rama cerrada. `scripts/e2e-celdas-categoricas.mjs` comprueba contra la
 * columna D de la plantilla que no falta ninguna.
 */
export const RAMAS_BOOLEANO: Record<number, { booleano: number; rama: "No" | "Sí" }> = {
  39: { booleano: 38, rama: "No" }, 41: { booleano: 38, rama: "Sí" },
  45: { booleano: 44, rama: "No" }, 47: { booleano: 44, rama: "Sí" },
  50: { booleano: 49, rama: "No" }, 52: { booleano: 49, rama: "Sí" },
  135: { booleano: 134, rama: "No" }, 137: { booleano: 134, rama: "Sí" },
  257: { booleano: 256, rama: "No" },
  315: { booleano: 313, rama: "No" },
  418: { booleano: 417, rama: "No" }, 420: { booleano: 417, rama: "Sí" },
  426: { booleano: 425, rama: "No" }, 428: { booleano: 425, rama: "Sí" },
};
/**
 * La razón del «No» de 36(e) (fila 257, K576): la respuesta propia (`fila:257`, con el modelo, distinta de la de 36(e)(i));
 * sin ella, la regla (opción 1 de Esteban). Antes copiaba la respuesta de 36(e)(i).
 */
const RAZON_36E_REGLA = textoNoAplicaHeredado("NIIF S2 36 (e)").replace(/^No aplica\.\s*/, "");
/** El «No» de un booleano que se deduce de sus incisos: no hay uso previsto de créditos si (ii)–(iv) no aplican. */
const NO_POR_INCISOS: Record<number, string[]> = { 256: ["NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"] };
/** 29(e) por tipo (filas 350, 373 y 396): solo su respuesta propia; sin ella, vacía (nunca el párrafo). */
const FILAS_29E = new Set([350, 373, 396]);
/** Celdas por efecto (`porEfecto`): solo su respuesta propia; sin ella, vacías. */
const FILAS_POR_EFECTO = new Set(CONCEPTOS_FORMATO_CON_ENFOQUE.filter((c) => c.porEfecto).map((c) => c.fila));
/**
 * Filas de instrucción de la pregunta de arriba («Revelar información cuantitativa y cualitativa…», NIIF S2 16(a)):
 * con tipo en la plantilla, la parte cuantitativa del inciso; sin tipo (las tres de la plantilla 2025), vacías: la
 * pregunta de arriba ya la responde (encargo formato-respuesta-por-inciso, Fase 2). Antes repetían el párrafo completo.
 */
const FILAS_INSTRUCCION: Record<number, number> = { 86: 85, 88: 87, 90: 89 };
/** Fechas del periodo del análisis de escenarios (D5): 117 inicio, 119 fin. */
const FECHAS_22B_III: Record<number, "inicio" | "fin"> = { 117: "inicio", 119: "fin" };
const FILAS_SECTOR = new Set([446, 447]);
const CAMPOS_22B_I = ["Cómo y cuándo se llevó a cabo", "Escenarios usados y sus fuentes", "¿Rango diverso de escenarios?", "Riesgos asociados a los escenarios", "¿Escenario alineado con el último acuerdo internacional?", "Por qué los escenarios son pertinentes", "Horizontes temporales usados", "Alcance de las operaciones cubierto"];
const CAMPOS_22B_II = ["Políticas climáticas en las jurisdicciones", "Tendencias macroeconómicas", "Variables nacionales o regionales", "Uso y combinación de energías", "Desarrollos tecnológicos", "Otros supuestos"];

export function llenarFormato(d: DatosFormato, conceptos: ConceptoMapeo[] = CONCEPTOS_FORMATO): Map<number, ValorFormato> {
  const out = new Map<number, ValorFormato>();
  const exentos = datapointsExentos(d.alivios);
  const resp = (destino: "taxonomia" | "formato", clave: string) => d.respuestas.find((r) => r.destino === destino && r.clave === clave) ?? null;
  const textoDe = (clave: string): string | null => {
    const r = resp("formato", clave) ?? resp("taxonomia", clave);
    if (!r?.texto || r.estado === "pendiente") return null;
    return pendienteEnTextoPlano(r.destino === "taxonomia" ? sinRemision(r.texto) : r.texto);
  };
  const actividades = d.perfil.actividades_financieras;

  for (const c of conceptos) out.set(c.fila, valorDe(c));
  // Lo que depende del valor de un booleano, ya calculado: la rama que el booleano cierra queda vacía; la rama «No»
  // abierta da la razón (la respuesta propia del booleano sin el «No.» inicial, o el inciso que la da, sin un «No
  // aplica» delante); la rama «Sí» abierta conserva su respuesta.
  for (const [fila, { booleano, rama }] of Object.entries(RAMAS_BOOLEANO).map(([f, r]) => [Number(f), r] as const)) {
    if (!out.has(fila)) continue;
    if (out.get(booleano)?.texto !== rama) { out.set(fila, { texto: null, origen: "regla", nota: `rama «${rama}» cerrada: el booleano de la fila ${booleano} no es «${rama}»` }); continue; }
    if (rama === "Sí") continue;
    const propia = resp("formato", `fila:${booleano}`);
    const c = conceptos.find((x) => x.fila === booleano);
    if (fila === 257) {
      const r = resp("formato", "fila:257");
      out.set(fila, { texto: r?.estado === "respuesta" && r.texto ? r.texto : RAZON_36E_REGLA, origen: r?.estado === "respuesta" ? "respuesta" : "regla", nota: "razón del «No» de créditos de carbono" });
      continue;
    }
    const desde = c?.datapoint ?? null;
    const t = (propia?.texto ? propia.texto.replace(/^No\.\s*/, "") : desde ? textoDe(desde) : null)?.replace(/^No aplica[.:]\s*/i, "").trim() || null;
    out.set(fila, t ? { texto: t, origen: "respuesta", nota: `razón del «No» de la fila ${booleano}` } : { texto: null, origen: "pendiente" });
  }
  // Una celda de texto no abre con «Sí.»: el booleano vecino ya lo dice (revisión externa v5, K126/K135/K137). El
  // validador de respuestas ya lo rechaza; esto cubre las respuestas guardadas antes.
  for (const [fila, v] of out) {
    const tipo = conceptos.find((x) => x.fila === fila)?.tipo ?? "";
    if (v.texto && /^text/.test(tipo) && /^Sí\.\s+\S/.test(v.texto)) out.set(fila, { ...v, texto: v.texto.replace(/^Sí\.\s+/, "") });
  }
  // E5 una vez por encabezado: se queda en la primera celda (por fila) a la que el llenado se la antepuso.
  const vistos = new Set<number>();
  for (const [fila, v] of [...out.entries()].sort((a, b) => a[0] - b[0])) {
    if (!v.e5 || !v.texto) continue;
    const enc = ENCABEZADOS_E5.filter((e) => e <= fila).at(-1) ?? 0;
    if (!vistos.has(enc)) vistos.add(enc);
    else out.set(fila, { ...v, texto: v.texto.slice(ORACION_E5.length).trim(), e5: false });
  }
  // Los alivios del reporte, en K12 (la fila sin etiqueta tras el año de reporte): la hoja «Leyenda» ya no se entrega
  // (decisión de Esteban, Fase 5).
  out.set(FILA_ALIVIOS, { texto: declaracionDeAlivios(d.alivios), origen: "alivio" });
  return out;

  function valorDe(c: ConceptoMapeo): ValorFormato {
    // Métricas por industria (SASB) fuera de alcance: vacías. La nota interna que llevaban («pendiente de catálogo
    // SASB») no es voz de la emisora (revisión externa v5, K787/K788).
    if (/^fuera de alcance/.test(c.clasificacion)) return { texto: null, origen: "fuera de alcance" };
    // Sección «Para: Fideicomisos» (columna A de la plantilla): entera «No aplica» si la emisora no es fideicomiso
    // (revisión externa v5: K13, K17 y K19 llevaban la clave y la razón social de la emisora).
    if (FILAS_FIDEICOMISO.has(c.fila) && !/fideicomiso/i.test(d.perfil.tipo_instrumento ?? "")) return { texto: "No aplica", origen: "perfil" };
    // Un encabezado narrativo con datapoint lleva texto (la referencia lo responde);
    // los demás encabezados y los subconceptos («se responde junto con la fila N»), no.
    const narrativo = c.clasificacion === "encabezado narrativo" && !!c.datapoint;
    if (c.clasificacion !== "concepto" && !narrativo) return { texto: null, origen: "sin respuesta" };
    if (c.fila >= 145 && c.fila <= 185) {
      // Se repiten por métrica (metricasIteradas); el valor de la plantilla sirve de regla para las copias.
      const v = c.fila === 167 ? null : valorDeRegla(c);
      return { texto: v, origen: "iteración" as OrigenFormato, nota: "se repite por riesgo u oportunidad y métrica de NIIF S2 29" };
    }
    // NIIF S2 29B (433, 435, 437): con C4 no se revela nada de Alcance 3, categoría 15.
    if (FILAS_29B.has(c.fila) && d.alivios.C4) return { texto: noRevelado("C4"), origen: "alivio" };

    // Actividad y sector, desde el Perfil (antes que el alivio: C4 exime cifras, no la pregunta).
    if (FILAS_ACTIVIDAD.has(c.fila)) return actividades.length ? { texto: actividades.join("; "), origen: "perfil" } : { texto: null, origen: "pendiente" };
    if (FILAS_SECTOR.has(c.fila)) return d.perfil.sector_sasb.length ? { texto: d.perfil.sector_sasb.join("; "), origen: "perfil" } : { texto: null, origen: "pendiente" };
    // La sección de una actividad que la emisora no tiene no aplica, aunque el concepto no tenga datapoint (462).
    const seccion = SECCIONES_ACTIVIDAD.find((s) => c.fila >= s.desde && c.fila <= s.hasta);
    if (seccion && actividades.length && !actividades.includes(seccion.actividad)) {
      // D6: «declaradas por la emisora», no «del Perfil» (vocabulario de plataforma).
      return { texto: `No aplica por actividad: la Compañía no participa en ${seccion.actividad.toLowerCase()} (actividades financieras declaradas por la emisora: ${actividades.join(", ")}).`, origen: "actividad" };
    }
    if (c.capa === "sin candidato") return { texto: null, origen: "sin mapeo", nota: "código pedido sin datapoint en el catálogo (lista de ampliación del catálogo)" };
    if (c.datapoint && exentos.has(c.datapoint)) return { texto: noRevelado("C4"), origen: "alivio" };
    const regla = c.regla ?? "";

    if (c.capa === "regla fija") {
      if (c.fila === 5 || /\{reporte\.ejercicio\}/.test(regla)) return { texto: (entreComillas(regla) ?? "").replace("{reporte.ejercicio}", String(d.ejercicio)), origen: "regla" };
      const x = entreComillas(regla);
      if (x && /29\(x\)/.test(x)) return { texto: "NIIF S2 párrafo 29", origen: "regla" };
      return x ? { texto: x, origen: "regla" } : { texto: null, origen: "por decidir" };
    }
    if (c.capa === "regla primer año") {
      if (!d.primerAnio) return { texto: null, origen: "por decidir" };
      const x = entreComillas(regla);
      // «sin mapeo» el primer año (eje sin comparativos): «No aplica».
      if (x && /sin mapeo/.test(x)) return { texto: "No aplica", origen: "regla", nota: "primer año: sin comparativos" };
      return x ? { texto: x, origen: "regla" } : { texto: null, origen: "sin respuesta" };
    }
    if (c.capa === "Perfil") return deperfil(c);

    const tipo = c.tipo === "(sin tipo)" ? "" : c.tipo ?? "";
    const ponE5 = (t: string) => c.alivioE5 && !!d.alivios.E5 && !t.includes("párrafo E5");
    const conE5 = (t: string) => (ponE5(t) ? `${ORACION_E5} ${t}` : t);

    // Fila 62 (NIIF S2 13(b), dónde se concentran; la 63 pide zonas, instalaciones y tipos de activos): el texto del
    // modelo y, después, la concentración por código desde los registros de clima (encargo 2026-10-24; antes iba en la 64).
    if (c.fila === 62) {
      // Con la cifra cuando el registro la tiene: la oración de la descripción que lleva un número (capturada y validada).
      const conCifra = (t: string | null) => (t ?? "").split(/(?<=\.)\s+/).find((o) => /\d/.test(o))?.trim() ?? null;
      const lineas = d.registros
        .filter((r) => r.tipo !== "oportunidad" && ((r.concentracion ?? "").trim() || conCifra(r.descripcion)))
        .map((r) => `${r.nombre}: ${[conCifra(r.descripcion), (r.concentracion ?? "").trim() ? `Se concentra en: ${r.concentracion!.trim()}` : null].filter(Boolean).join(" ")}`);
      const modelo = c.datapoint ? textoDe(c.datapoint) : null;
      const texto = [modelo, lineas.join("\n")].filter(Boolean).join("\n");
      if (!texto) return { texto: null, origen: "pendiente" };
      return { texto: conE5(texto), origen: modelo ? "respuesta" : "datos", nota: lineas.length ? "texto del bloque 13 y registros de clima, campo concentración" : undefined, e5: ponE5(texto) };
    }
    // 117 y 119 (D5): fechas del ejercicio, solo si la respuesta de NIIF S2 22(b)(iii) sitúa el análisis en él.
    if (FECHAS_22B_III[c.fila]) {
      const t = c.datapoint ? textoDe(c.datapoint) : null;
      if (!t || !new RegExp(`(?<!\\d)${d.ejercicio}(?!\\d)`).test(t)) return { texto: null, origen: "pendiente", nota: "la respuesta de NIIF S2 22(b)(iii) no sitúa el análisis en el ejercicio" };
      return { texto: FECHAS_22B_III[c.fila] === "inicio" ? `01/01/${d.ejercicio}` : `31/12/${d.ejercicio}`, origen: "regla", nota: "el análisis se sitúa en el ejercicio del reporte (D5)" };
    }
    // Fila 285: la declaración de cumplimiento, del bloque 2 aprobado (plantilla, sin hechos).
    if (c.fila === 285) return d.declaracion ? { texto: conE5(d.declaracion), origen: "respuesta", nota: "párrafo del bloque 2 aprobado, tal cual", e5: ponE5(d.declaracion) } : { texto: null, origen: "pendiente" };
    // Fila 286: ¿cumple con todos los requerimientos, explícitamente y sin reservas?
    // Regla 1 de Esteban: «Sí» solo con cero pendientes y cero «parcial» en la cobertura aprobada; si no, «No» y qué falta.
    if (c.fila === 286) {
      const { parciales, pendientes } = d.cumplimiento;
      if (!parciales.length && !pendientes) return { texto: "Sí", origen: "regla", nota: "documento aprobado con cero pendientes y cero requisitos «parcial»" };
      const falta = [parciales.length ? `requisitos con información parcial: ${parciales.join(", ")}` : null, pendientes ? `${pendientes} pendiente(s) en el documento` : null].filter(Boolean).join("; ");
      return { texto: `No. Falta completar ${falta}.`, origen: "regla" };
    }

    if (tipo === "tabla") return tabla(c);
    if (/^enumeración/.test(tipo)) return enumeracion(c);

    // Con tipo en la plantilla, la parte cuantitativa propia (`fila:N`); sin tipo, vacía (ajuste 1 de Esteban, Fase 2).
    if (FILAS_INSTRUCCION[c.fila]) {
      const propia = /^text/.test(tipo) ? textoDe(`fila:${c.fila}`) : null;
      return propia ? { texto: propia, origen: "respuesta", nota: "parte cuantitativa del inciso" } : { texto: null, origen: "regla", nota: `instrucción sin tipo de la pregunta de la fila ${FILAS_INSTRUCCION[c.fila]}, que la responde` };
    }
    // Una fila sin tipo en la plantilla que sigue a otra con el mismo código es su detalle («Indicar el órgano…», «(por
    // ejemplo…)»): la de arriba ya la responde, así que va vacía en vez de repetirla (encargo formato-respuesta-por-inciso,
    // Fase 3; K26 repetía K25). Las ramas de los booleanos se resuelven después, con su propia regla.
    if (c.tipo === "(sin tipo)" && c.datapoint) {
      const anterior = [...conceptos].reverse().find((x) => x.fila < c.fila && x.clasificacion === "concepto");
      if (anterior?.datapoint === c.datapoint) return { texto: null, origen: "regla", nota: `detalle sin tipo de la fila ${anterior.fila}, que la responde` };
    }
    // Por efecto (16(a), 16(c), 16(d), 22(a)(iii), K36, K43): la respuesta propia o nada; el texto del código repetiría
    // lo que dicen las demás celdas del párrafo.
    if (FILAS_POR_EFECTO.has(c.fila)) {
      const r = resp("formato", `fila:${c.fila}`);
      return r?.texto && r.estado === "respuesta" ? { texto: conE5(r.texto), origen: "respuesta", e5: ponE5(r.texto) } : { texto: null, origen: "regla", nota: "sin respuesta propia de este efecto: lo responden las demás celdas del párrafo" };
    }
    // 29(e) por tipo: la respuesta propia de la celda o nada (el párrafo repetiría el total en los tres tipos).
    if (FILAS_29E.has(c.fila)) {
      const r = resp("formato", `fila:${c.fila}`);
      return r?.texto && r.estado === "respuesta" ? { texto: r.texto, origen: "respuesta" } : { texto: null, origen: "regla", nota: "sin despliegue de capital de este tipo en el libro" };
    }
    if (/^text/.test(tipo) || !tipo || narrativo) {
      // Una respuesta propia de la celda (`fila:N`: B65(c) por efecto, síntesis) manda sobre la del código.
      const clave = resp("formato", `fila:${c.fila}`) ? `fila:${c.fila}` : c.datapoint ?? `fila:${c.fila}`;
      const r = resp("formato", clave) ?? resp("taxonomia", clave);
      if (!r || !r.texto) return { texto: null, origen: c.datapoint ? "pendiente" : "por decidir" };
      if (r.estado === "pendiente") return { texto: null, origen: "pendiente" };
      const t = pendienteEnTextoPlano(r.destino === "taxonomia" ? sinRemision(r.texto) : r.texto);
      return { texto: conE5(t), origen: "respuesta", e5: ponE5(t) };
    }
    if (tipo === "booleano" && c.datapoint) {
      const r = resp("taxonomia", c.datapoint);
      const incisos = NO_POR_INCISOS[c.fila];
      if (incisos && incisos.every((x) => resp("taxonomia", x)?.estado === "no_aplica")) return { texto: "No", origen: "regla", nota: `${incisos.join(", ")} no aplican` };
      if (!r || r.estado === "pendiente") return { texto: null, origen: "pendiente" };
      // Regla 2: sin un hecho que lo responda (el E5 lo deja sin respuesta propia), vacío en el formato.
      if (r.estado === "no_aplica") return r.texto?.includes("párrafo E5") ? { texto: null, origen: "pendiente" } : { texto: "No", origen: "respuesta" };
      // D1: la respuesta propia de la fila abre con «Sí.» o «No.» (validada al generarla contra el hecho que contesta).
      // Aquí se vuelve a comprobar contra la celda narrativa vecina: si la contradice, no se escribe.
      const pregunta = BOOLEANOS_FORMATO.find((b) => b.fila === c.fila);
      const propia = resp("formato", `fila:${c.fila}`);
      const valor = pregunta && propia?.estado === "respuesta" ? valorBooleano(propia.texto) : null;
      if (!pregunta || !valor) return { texto: null, origen: "pendiente", nota: "sin respuesta de sí o no validada contra el hecho que contesta" };
      const vecina = textoDe(c.datapoint);
      if (contradice(valor, vecina, pregunta.tema)) {
        const oracion = clausulasDelTema(vecina ?? "", pregunta.tema)[0]?.texto ?? "";
        return { texto: null, origen: "pendiente", nota: `contradicción: valor propuesto «${valor}»; la respuesta de ${c.datapoint} dice «${oracion}»`, contradiccion: { valor, oracion } };
      }
      return { texto: valor, origen: "respuesta" };
    }
    // Regla 8: una cifra que no está en capturas no se deriva.
    if (tipo === "porcentaje") return { texto: null, origen: "pendiente", nota: "cifra sin captura" };
    return { texto: null, origen: "por decidir" };
  }

  function valorDeRegla(c: ConceptoMapeo): string | null {
    if (c.capa !== "regla fija") return null;
    const x = entreComillas(c.regla ?? "");
    return x && !/29\(x\)/.test(x) ? x : null;
  }

  function enumeracion(c: ConceptoMapeo): ValorFormato {
    const porObjetivo = (campo: keyof ObjetivoFormato): ValorFormato => {
      const filas = d.objetivos.filter((o) => (o[campo] ?? "").trim()).map((o) => `${o.nombre}: ${o[campo]}`);
      return filas.length ? { texto: filas.join("\n"), origen: "datos" } : { texto: null, origen: "pendiente" };
    };
    // Las opciones de estas listas no vienen en el formato: el valor es el atributo capturado de cada objetivo.
    if (c.fila === 233) return porObjetivo("tipo_objetivo");
    if (c.fila === 247) return porObjetivo("gases");
    if (c.fila === 249) return porObjetivo("alcances");
    if (c.fila === 251) return porObjetivo("bruto_neto");
    // Regla 3: sin captura del origen del objetivo (emisora o ley), pendiente.
    // Juicio de la emisora (decisión de Esteban): el campo del Perfil, igual en las tres filas.
    if (c.fila === 364 || c.fila === 387 || c.fila === 410) return d.perfil.metricas_industria ? { texto: d.perfil.metricas_industria, origen: "perfil" } : { texto: null, origen: "pendiente" };
    // Origen del objetivo (fijado por la emisora o por ley), de la captura de objetivos; sin captura, pendiente.
    if (c.fila === 200 || c.fila === 219) return porObjetivo("origen");
    if (c.fila === 263 || c.fila === 265) {
      // 36(e)(iii) en un solo estado: el de su inciso (el padre ya no dice «No aplica» si (i) responde).
      const r = resp("taxonomia", "NIIF S2 36 (e)(iii)");
      return r?.estado === "no_aplica" ? { texto: textoNoAplicaHeredado("NIIF S2 36 (e)"), origen: "regla" } : { texto: null, origen: "por decidir" };
    }
    return { texto: null, origen: "por decidir" };
  }

  function deperfil(c: ConceptoMapeo): ValorFormato {
    const campo = (c.perfil ?? c.regla ?? "").replace(/\s*\(nuevo\)/, "");
    const p = d.perfil;
    const esFideicomiso = /fideicomiso/i.test(p.tipo_instrumento ?? "");
    const v = (x: string | null | undefined): ValorFormato => (x && x.trim() ? { texto: x.trim(), origen: "perfil" } : { texto: null, origen: "pendiente" });
    if (/tipo_instrumento/.test(campo)) return v(p.tipo_instrumento);
    if (/clave_cotizacion/.test(campo)) return v(p.clave_cotizacion);
    if (/numero_fideicomiso/.test(campo)) return esFideicomiso ? v(p.numero_fideicomiso) : { texto: "No aplica", origen: "perfil" };
    if (/fideicomitente/.test(campo)) return v(p.fideicomitente);
    if (/administrador_patrimonio/.test(campo)) return v(p.administrador_patrimonio);
    if (/fiduciario/.test(campo)) return esFideicomiso ? v(p.fiduciario) : { texto: "No aplica", origen: "perfil" };
    if (/logo/.test(campo)) return d.hayLogo ? { texto: null, origen: "logo" } : { texto: null, origen: "pendiente", nota: "la emisora no tiene logotipo en la plataforma" };
    if (/denominacion_formal/.test(campo)) return v(p.denominacion_formal);
    if (/hechos_posteriores/.test(campo)) return v(p.hechos_posteriores);
    if (/reporte\.alivios/.test(campo)) return { texto: d.alivios.E5 ? "Sí" : "No", origen: "perfil" };
    // Selector de la sección de una actividad (468, 488): la actividad, si la emisora participa (si no, la sección ya
    // dijo «No aplica por actividad»).
    const selector = campo.match(/selector: ([^)]+)\)/)?.[1];
    if (selector) return d.perfil.actividades_financieras.includes(selector) ? { texto: selector, origen: "perfil" } : { texto: null, origen: "pendiente" };
    // K723 (D3): ¿considerará las métricas por industria? «Sí» si el juicio del Perfil es «Sí, totalmente» o «Sí, parcialmente».
    if (/metricas_industria/.test(campo)) return /^Sí/.test(p.metricas_industria ?? "") ? { texto: "Sí", origen: "perfil" } : { texto: null, origen: "regla", nota: "metricas_industria en «No» o sin capturar (D3)" };
    if (/reporte\.ejercicio \(fechas\)/.test(campo) || /fechas/.test(c.regla ?? "")) {
      return /inicio/.test(c.regla ?? "") ? { texto: `01/01/${d.ejercicio}`, origen: "perfil" } : { texto: `31/12/${d.ejercicio}`, origen: "perfil" };
    }
    if (/reporte\.ejercicio/.test(campo)) return c.tipo === "booleano" ? { texto: "No", origen: "regla" } : { texto: String(d.ejercicio), origen: "perfil" };
    return { texto: null, origen: "por decidir" };
  }

  function tabla(c: ConceptoMapeo): ValorFormato {
    const dp = c.datapoint ?? "";
    const anterior = d.alivios.C3 ? `${d.ejercicio - 1}: ${noRevelado("C3")}` : null;
    const conAnterior = (lineas: string[]) => (anterior ? [...lineas, anterior] : lineas);
    if (dp === "NIIF S2 29 (a)(i)") {
      const lineas = d.gei.map((g) => `${g.alcance}: ${g.valor} (${d.ejercicio})`);
      if (d.alivios.C4) lineas.push(`Alcance 3: ${noRevelado("C4")}`);
      return lineas.length ? { texto: conAnterior(lineas).join("\n"), origen: "datos" } : { texto: null, origen: "pendiente" };
    }
    if (dp === "NIIF S2 29 (a)(iv) EI5") {
      const t = textoDe(dp) ?? "";
      const alcances = d.gei.map((g) => `${g.alcance} ${g.valor}`).join("; ");
      if (!alcances) return { texto: null, origen: "pendiente" };
      const otras = /no existen participadas|no hay participadas|ninguna participada/i.test(t) ? "Otras participadas: no existen participadas fuera de la consolidación con emisiones relevantes" : null;
      return { texto: conAnterior([`Grupo contable consolidado: ${alcances}`, ...(otras ? [otras] : []), `Total revelado: ${alcances}`]).join("\n"), origen: "datos" };
    }
    // Tablas por plazo (95 16(c), 97 y 99 16(d), 111 22(a)(iii)): una línea por plazo, solo los plazos con respuesta propia
    // desde los hechos que caen en él (`fila:97:corto`…); sin ninguno, vacía (Fase 2 y regla de Esteban antes de la Fase
    // 4). Antes, el mismo texto en los tres plazos.
    if (TABLAS_POR_HORIZONTE.some((t) => t.fila === c.fila)) {
      // Sin repetir el plazo que ya nombra la línea («Mediano plazo: En el mediano plazo, …»).
      const sinPlazo = (n: string, t: string) => t.replace(new RegExp(`^(en|durante|para) el ${n.toLowerCase()},?\\s*`, "i"), "").replace(/^\p{Ll}/u, (x) => x.toUpperCase());
      const lineas = HORIZONTES_TABLA.map((h) => [h.nombre, textoDe(`fila:${c.fila}:${h.clave}`)] as const).filter(([, t]) => !!t).map(([n, t]) => `${n}: ${sinPlazo(n, t!)}`);
      return lineas.length ? { texto: lineas.join("\n"), origen: "datos", nota: "por plazo, con los hechos que caen en él" } : { texto: null, origen: "regla", nota: "ningún hecho del código cae en un plazo declarado, o no hay plazos declarados en 10(d)" };
    }
    if (dp === "NIIF S2 22(b)(i)" || dp === "NIIF S2 22(b)(ii)") {
      const hoja = dp === "NIIF S2 22(b)(i)" ? "S2 22(b)(i)" : "S2 22(b)(ii)";
      const campos = dp === "NIIF S2 22(b)(i)" ? CAMPOS_22B_I : CAMPOS_22B_II;
      const resp = d.cuestionarios[hoja] ?? [];
      const lineas = campos.map((k, i) => (resp[i] ? `${k}: ${resp[i]}` : null)).filter((x): x is string => !!x);
      const faltan = campos.filter((_, i) => !resp[i]);
      return lineas.length ? { texto: lineas.join("\n"), origen: "datos", nota: faltan.length ? `sin respuesta en el cuestionario: ${faltan.join(", ")}` : undefined } : { texto: null, origen: "pendiente" };
    }
    if (dp === "NIIF S2 10(a), (b)y(c)") return { texto: "Ver hoja «Tabla NIIF».", origen: "datos" };
    const tipo = dp === "NIIF S2 29 (b)" ? "riesgo_transicion" : dp === "NIIF S2 29 (c)" ? "riesgo_fisico" : dp === "NIIF S2 29 (d)" ? "oportunidad" : null;
    if (tipo) {
      const filas = d.registros.filter((r) => r.tipo === tipo).map((r) =>
        [r.nombre, r.horizontes || null, r.cantidad != null ? NUM.format(r.cantidad) : null, r.porcentaje != null ? `${NUM.format(r.porcentaje)} %` : null, r.capital].filter(Boolean).join(" · ")
      );
      return filas.length ? { texto: conAnterior(filas).join("\n"), origen: "datos" } : { texto: null, origen: "pendiente" };
    }
    return { texto: null, origen: "por decidir" };
  }
}

/**
 * Fila del mapeo → celda K del Formato exportado: las filas > 185 se desplazan 279 por las métricas iteradas del demo, y
 * las de después de 270 además por los bloques «Objetivo N» (`objetivos`, Fase 4 de respuesta por inciso); las del
 * bloque, en la copia del primer objetivo.
 */
export const celdaK = (fila: number, objetivos = 0) => `K${filaExportada(fila, { objetivos, deltaMetricas: 279 })}`;

/**
 * Booleanos que quedaron vacíos porque la respuesta narrativa de su código los contradice: fila, celda, valor
 * propuesto y la oración que lo contradijo. Para el informe del validador (hoja de revisión y log de la descarga).
 */
export function booleanosVaciosPorContradiccion(valores: Map<number, ValorFormato>, objetivos = 0): { fila: number; celda: string; valor: "Sí" | "No"; oracion: string }[] {
  return [...valores.entries()]
    .filter(([, v]) => v.contradiccion)
    .map(([fila, v]) => ({ fila, celda: celdaK(fila, objetivos), valor: v.contradiccion!.valor, oracion: v.contradiccion!.oracion }));
}

/**
 * Avisos de coherencia para la hoja de revisión de IRStrat (no se entregan a la emisora). D2 de Esteban (encargo
 * formato-afirmaciones-y-voz): el Perfil dice que las métricas por industria NO podrían satisfacer los requerimientos
 * (filas 364, 387 y 410) y, a la vez, la emisora tiene sector SASB capturado: es un juicio de la emisora, pero se
 * revisa antes de presentar.
 */
export function avisosDeCoherencia(d: DatosFormato): string[] {
  const avisos: string[] = [];
  if (d.perfil.metricas_industria === "No" && d.perfil.sector_sasb.length) {
    avisos.push(`Métricas por industria en «No» (filas 364, 387 y 410) con sector SASB capturado (${d.perfil.sector_sasb.join("; ")}): confirmar el juicio de la emisora en el Perfil.`);
  }
  return avisos;
}

// =============================================================================
// MÉTRICAS NIIF S1 46–50 ITERADAS (filas 145–185; ver lib/formato/metricas.ts y
// lib/formato/instancias.ts). El bloque de cada instancia sale de las reglas del
// mapeo (148, 151–152, 161–163) y de la instancia: nombre (149, 157), párrafo
// (153), descripción del catálogo (155, 159), tipo de medida (166), verificación
// (167: «No» salvo la GEI con su verificador) y método con los datos de su
// riesgo (169).
// =============================================================================

export function bloquesIterados(valores: Map<number, ValorFormato>, inst: { riesgos: InstanciaMetrica[]; oportunidades: InstanciaMetrica[] }) {
  const regla = (fila: number) => valores.get(fila)?.texto ?? "";
  const bloque = (m: InstanciaMetrica) =>
    new Map<number, string>([
      [148, regla(148)],
      [149, m.nombre],
      [151, regla(151)],
      [152, regla(152)],
      [153, `NIIF S2 párrafo ${m.parrafo}`],
      [155, m.descripcion],
      [157, m.nombre],
      [159, m.descripcion],
      [161, regla(161)],
      [162, regla(162)],
      [163, regla(163)],
      [166, m.tipoMedida],
      [167, m.verificacion],
      [169, m.metodo],
    ]);
  const agrupar = (lista: InstanciaMetrica[]) => {
    const orden: string[] = [];
    const por = new Map<string, InstanciaMetrica[]>();
    for (const m of lista) {
      if (!por.has(m.riesgo)) orden.push(m.riesgo);
      por.set(m.riesgo, [...(por.get(m.riesgo) ?? []), m]);
    }
    return orden.map((nombre) => ({ nombre, metricas: por.get(nombre)!.map((m) => ({ nombre: m.nombre, valores: bloque(m) })) }));
  };
  return { riesgos: agrupar(inst.riesgos), oportunidades: agrupar(inst.oportunidades) };
}
