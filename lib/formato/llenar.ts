import { datapointsExentos } from "@/lib/suplemento/bloques";
import { ORACION_E5, pendienteEnTextoPlano, sinRemision, type EstadoRespuesta } from "@/lib/suplemento/respuestas";
import type { Alivios } from "@/lib/perfil-emisor";
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
//   · booleano → «No» si la respuesta es «no aplica» o se apoya en una
//     declaración negativa; «Sí» si responde; vacío si está pendiente;
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

export type RespuestaLeida = { destino: "taxonomia" | "formato"; clave: string; estado: EstadoRespuesta; texto: string | null; hechosNegativos: boolean };

export type ObjetivoFormato = { nombre: string; tipo_objetivo: string | null; gases: string | null; alcances: string | null; bruto_neto: string | null };

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
    hechos_posteriores: string | null;
    actividades_financieras: string[];
    sector_sasb: string[];
  };
  /** Hay logotipo: la celda lleva la imagen (la inserta quien escribe). */
  hayLogo: boolean;
  respuestas: RespuestaLeida[];
  /** Emisiones del ejercicio por alcance, de capturas confirmadas: «Alcance 1» → «1,240 tCO2e». */
  gei: { alcance: string; valor: string }[];
  /** Registros de clima con su valor del ejercicio, por tipo. */
  registros: { tipo: string; nombre: string; horizontes: string; cantidad: number | null; porcentaje: number | null; capital: string | null }[];
  /** Objetivos climáticos con su detalle. */
  objetivos: ObjetivoFormato[];
  /** Respuestas de los cuestionarios, en el orden del catálogo. */
  cuestionarios: Record<string, (string | null)[]>;
  /** El bloque 2 aprobado declara la preparación de conformidad con NIIF S1 y S2. */
  declaraCumplimiento: boolean;
  /** El párrafo del bloque 2 aprobado que hace la declaración, tal cual. */
  declaracion: string | null;
  /** Hay un hecho vigente que dice que el inventario GEI está verificado por un tercero. */
  verificacionTercero: boolean;
};

export type OrigenFormato = "respuesta" | "regla" | "perfil" | "alivio" | "actividad" | "datos" | "logo" | "por decidir" | "sin mapeo" | "sin respuesta" | "fuera de alcance" | "pendiente";
export type ValorFormato = { texto: string | null; origen: OrigenFormato; nota?: string };

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const entreComillas = (t: string | null) => t?.match(/«([^»]+)»/)?.[1] ?? null;

/** Secciones de emisiones financiadas por actividad (filas del formato 2025). */
export const SECCIONES_ACTIVIDAD = [
  { actividad: "Gestión de activos", desde: 452, hasta: 465 },
  { actividad: "Banca comercial", desde: 466, hasta: 486 },
  { actividad: "Seguros", desde: 487, hasta: 505 },
];
const FILAS_ACTIVIDAD = new Set([339, 340]);
const FILAS_SECTOR = new Set([446, 447]);
const HORIZONTES = ["Corto plazo", "Mediano plazo", "Largo plazo"];
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
  return out;

  function valorDe(c: ConceptoMapeo): ValorFormato {
    if (/^fuera de alcance/.test(c.clasificacion)) return { texto: "Métricas por industria: pendiente de catálogo SASB (Fase C).", origen: "fuera de alcance" };
    // Un encabezado narrativo con datapoint lleva texto (la referencia lo responde);
    // los demás encabezados y los subconceptos («se responde junto con la fila N»), no.
    const narrativo = c.clasificacion === "encabezado narrativo" && !!c.datapoint;
    if (c.clasificacion !== "concepto" && !narrativo) return { texto: null, origen: "sin respuesta" };
    if (c.capa === "sin candidato") return { texto: null, origen: "sin mapeo", nota: "código pedido sin datapoint en el catálogo (lista de ampliación del catálogo)" };

    // Actividad y sector, desde el Perfil (antes que el alivio: C4 exime cifras, no la pregunta).
    if (FILAS_ACTIVIDAD.has(c.fila)) return actividades.length ? { texto: actividades.join("; "), origen: "perfil" } : { texto: null, origen: "pendiente" };
    if (FILAS_SECTOR.has(c.fila)) return d.perfil.sector_sasb.length ? { texto: d.perfil.sector_sasb.join("; "), origen: "perfil" } : { texto: null, origen: "pendiente" };
    const seccion = SECCIONES_ACTIVIDAD.find((s) => c.fila >= s.desde && c.fila <= s.hasta);
    if (seccion && actividades.length && !actividades.includes(seccion.actividad)) {
      return { texto: `No aplica por actividad: la Compañía no participa en ${seccion.actividad.toLowerCase()} (actividades financieras del Perfil: ${actividades.join(", ")}).`, origen: "actividad" };
    }
    if (c.datapoint && exentos.has(c.datapoint)) return { texto: "No revelado · alivio C4", origen: "alivio" };
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
      return x && !/sin mapeo/.test(x) ? { texto: x, origen: "regla" } : { texto: null, origen: "sin respuesta" };
    }
    if (c.capa === "Perfil") return deperfil(c);

    const tipo = c.tipo === "(sin tipo)" ? "" : c.tipo ?? "";
    const conE5 = (t: string) => (c.alivioE5 && d.alivios.E5 && !t.includes("párrafo E5") ? `${ORACION_E5} ${t}` : t);

    // Fila 167: verificación externa del inventario GEI, con el hecho tal cual y lo que falta.
    if (c.fila === 167) {
      return d.verificacionTercero
        ? { texto: "Sí, el inventario de emisiones de gases de efecto invernadero está verificado por un tercero. Pendiente: nombre del verificador y nivel de aseguramiento — solicitud «Enfoque de medición de emisiones y datos de entrada».", origen: "respuesta" }
        : { texto: null, origen: "pendiente" };
    }
    // Fila 285: la declaración de cumplimiento, del bloque 2 aprobado (plantilla, sin hechos).
    if (c.fila === 285) return d.declaracion ? { texto: conE5(d.declaracion), origen: "respuesta", nota: "párrafo del bloque 2 aprobado, tal cual" } : { texto: null, origen: "pendiente" };
    // Fila 286: ¿cumple con todos los requerimientos, explícitamente y sin reservas?
    if (c.fila === 286) return d.declaraCumplimiento ? { texto: "Sí", origen: "respuesta", nota: "el bloque 2 aprobado declara la preparación de conformidad con las Normas NIIF S1 y S2" } : { texto: null, origen: "pendiente" };

    if (tipo === "tabla") return tabla(c);
    if (/^enumeración/.test(tipo)) return enumeracion(c);

    if (/^text/.test(tipo) || !tipo || narrativo) {
      const clave = c.datapoint ?? `fila:${c.fila}`;
      const r = resp("formato", clave) ?? resp("taxonomia", clave);
      if (!r || !r.texto) return { texto: null, origen: c.datapoint ? "pendiente" : "por decidir" };
      if (r.estado === "pendiente") return { texto: null, origen: "pendiente" };
      return { texto: conE5(pendienteEnTextoPlano(r.destino === "taxonomia" ? sinRemision(r.texto) : r.texto)), origen: "respuesta" };
    }
    if (tipo === "booleano" && c.datapoint) {
      const r = resp("taxonomia", c.datapoint);
      if (!r || r.estado === "pendiente") return { texto: null, origen: "pendiente" };
      if (r.estado === "no_aplica") return r.texto?.includes("párrafo E5") ? { texto: null, origen: "por decidir" } : { texto: "No", origen: "respuesta" };
      return { texto: r.hechosNegativos ? "No" : "Sí", origen: "respuesta" };
    }
    if (tipo === "porcentaje") return { texto: null, origen: "por decidir" };
    return { texto: null, origen: "por decidir" };
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
    if (c.fila === 263 || c.fila === 265) {
      const r = resp("taxonomia", "NIIF S2 36 (e)(i)a(iv)");
      return r?.estado === "no_aplica" ? { texto: "No aplica: la Compañía no prevé usar créditos de carbono para alcanzar sus objetivos.", origen: "regla" } : { texto: null, origen: "por decidir" };
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
    if (/fiduciario/.test(campo)) return esFideicomiso ? v(p.fiduciario) : { texto: "No aplica", origen: "perfil" };
    if (/logo/.test(campo)) return d.hayLogo ? { texto: null, origen: "logo" } : { texto: null, origen: "pendiente", nota: "la emisora no tiene logotipo en la plataforma" };
    if (/denominacion_formal/.test(campo)) return v(p.denominacion_formal);
    if (/hechos_posteriores/.test(campo)) return v(p.hechos_posteriores);
    if (/reporte\.alivios/.test(campo)) return { texto: d.alivios.E5 ? "Sí" : "No", origen: "perfil" };
    if (/reporte\.ejercicio \(fechas\)/.test(campo) || /fechas/.test(c.regla ?? "")) {
      return /inicio/.test(c.regla ?? "") ? { texto: `01/01/${d.ejercicio}`, origen: "perfil" } : { texto: `31/12/${d.ejercicio}`, origen: "perfil" };
    }
    if (/reporte\.ejercicio/.test(campo)) return c.tipo === "booleano" ? { texto: "No", origen: "regla" } : { texto: String(d.ejercicio), origen: "perfil" };
    return { texto: null, origen: "por decidir" };
  }

  function tabla(c: ConceptoMapeo): ValorFormato {
    const dp = c.datapoint ?? "";
    const anterior = d.alivios.C3 ? `${d.ejercicio - 1}: No revelado · alivio C3` : null;
    const conAnterior = (lineas: string[]) => (anterior ? [...lineas, anterior] : lineas);
    const porHorizonte = (clave: string): ValorFormato => {
      const t = textoDe(clave);
      // Regla del mapeo: sin hechos por horizonte, el mismo texto en las tres filas.
      return t ? { texto: HORIZONTES.map((h) => `${h}: ${t}`).join("\n"), origen: "datos", nota: "sin hechos por horizonte: el mismo texto en los tres" } : { texto: null, origen: "pendiente" };
    };
    if (dp === "NIIF S2 29 (a)(i)") {
      const lineas = d.gei.map((g) => `${g.alcance}: ${g.valor} (${d.ejercicio})`);
      if (d.alivios.C4) lineas.push("Alcance 3: No revelado · alivio C4");
      return lineas.length ? { texto: conAnterior(lineas).join("\n"), origen: "datos" } : { texto: null, origen: "pendiente" };
    }
    if (dp === "NIIF S2 29 (a)(iv) EI5") {
      const t = textoDe(dp) ?? "";
      const alcances = d.gei.map((g) => `${g.alcance} ${g.valor}`).join("; ");
      if (!alcances) return { texto: null, origen: "pendiente" };
      const otras = /no existen participadas|no hay participadas|ninguna participada/i.test(t) ? "Otras participadas: no existen participadas fuera de la consolidación con emisiones relevantes" : null;
      return { texto: conAnterior([`Grupo contable consolidado: ${alcances}`, ...(otras ? [otras] : []), `Total revelado: ${alcances}`]).join("\n"), origen: "datos" };
    }
    if (dp === "NIIF S2 16(c)(i)(ii)" || dp === "NIIF S2 16(d)" || dp === "NIIF S2 22(a)(iii)") return porHorizonte(dp);
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
