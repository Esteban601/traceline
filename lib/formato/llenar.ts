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
//   · un datapoint que un alivio vigente deja fuera (C4) → «No revelado · alivio C4»;
//   · regla fija / regla del primer año → el valor de la regla;
//   · Perfil → el campo del Perfil o del reporte;
//   · text y text block con datapoint → la respuesta «formato» del datapoint;
//     las filas con el alivio E5 llevan su oración fija; un pendiente deja la
//     celda VACÍA (CLAUDE.md §5, 1.10);
//   · booleano con datapoint → «No» si la respuesta es «no aplica» o se apoya en
//     una declaración negativa; «Sí» si responde; vacío si está pendiente;
//   · tabla → texto por filas desde los datos (GEI, registros de clima); la de
//     riesgos y oportunidades va completa en la hoja «Tabla NIIF»;
//   · lo demás (enumeraciones sin lista en el formato, tablas por horizonte,
//     conceptos sin datapoint) → vacío y «por decidir» en la hoja de revisión.
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
  };
  /** Hay logotipo: la celda lleva la imagen (la inserta quien escribe). */
  hayLogo: boolean;
  respuestas: RespuestaLeida[];
  /** Emisiones del ejercicio por alcance, de capturas confirmadas: «Alcance 1» → «1,240 tCO2e». */
  gei: { alcance: string; valor: string }[];
  /** Registros de clima con su valor del ejercicio, por tipo. */
  registros: { tipo: string; nombre: string; cantidad: number | null; porcentaje: number | null; capital: string | null }[];
};

export type ValorFormato = { texto: string | null; origen: "respuesta" | "regla" | "perfil" | "alivio" | "datos" | "logo" | "por decidir" | "sin respuesta" | "fuera de alcance" | "pendiente" };

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const entreComillas = (t: string | null) => t?.match(/«([^»]+)»/)?.[1] ?? null;

export function llenarFormato(d: DatosFormato, conceptos: ConceptoMapeo[] = CONCEPTOS_FORMATO): Map<number, ValorFormato> {
  const out = new Map<number, ValorFormato>();
  const exentos = datapointsExentos(d.alivios);
  const resp = (destino: "taxonomia" | "formato", clave: string) => d.respuestas.find((r) => r.destino === destino && r.clave === clave) ?? null;

  for (const c of conceptos) {
    const v = valorDe(c);
    out.set(c.fila, v);
  }
  return out;

  function valorDe(c: ConceptoMapeo): ValorFormato {
    if (/^fuera de alcance/.test(c.clasificacion)) return { texto: "Métricas por industria: pendiente de catálogo SASB (Fase C).", origen: "fuera de alcance" };
    // Un encabezado narrativo con datapoint lleva texto (la referencia lo responde);
    // los demás encabezados y los subconceptos («se responde junto con la fila N»), no.
    const narrativo = c.clasificacion === "encabezado narrativo" && !!c.datapoint;
    if (c.clasificacion !== "concepto" && !narrativo) return { texto: null, origen: "sin respuesta" };
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
    // Sin tipo en el formato y con datapoint: se responde como texto.
    if ((/^text/.test(tipo) || !tipo || narrativo) && c.datapoint) {
      const r = resp("formato", c.datapoint) ?? resp("taxonomia", c.datapoint);
      if (!r || !r.texto) return { texto: null, origen: "por decidir" };
      if (r.estado === "pendiente") return { texto: null, origen: "pendiente" };
      const t = pendienteEnTextoPlano(r.destino === "taxonomia" ? sinRemision(r.texto) : r.texto);
      const conE5 = c.alivioE5 && d.alivios.E5 && !t.includes("párrafo E5") ? `${ORACION_E5} ${t}` : t;
      return { texto: conE5, origen: "respuesta" };
    }
    if (tipo === "booleano" && c.datapoint) {
      const r = resp("taxonomia", c.datapoint);
      if (!r || r.estado === "pendiente") return { texto: null, origen: "pendiente" };
      if (r.estado === "no_aplica") return r.texto?.includes("párrafo E5") ? { texto: null, origen: "por decidir" } : { texto: "No", origen: "respuesta" };
      return { texto: r.hechosNegativos ? "No" : "Sí", origen: "respuesta" };
    }
    if (tipo === "tabla") return tabla(c);
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
    if (/logo/.test(campo)) return d.hayLogo ? { texto: null, origen: "logo" } : { texto: null, origen: "pendiente" };
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
    if (dp === "NIIF S2 29 (a)(i)") {
      const lineas = d.gei.map((g) => `${g.alcance}: ${g.valor} (${d.ejercicio})`);
      if (d.alivios.C4) lineas.push("Alcance 3: No revelado · alivio C4");
      if (d.alivios.C3) lineas.push(`${d.ejercicio - 1}: No revelado · alivio C3`);
      return lineas.length ? { texto: lineas.join("\n"), origen: "datos" } : { texto: null, origen: "pendiente" };
    }
    if (dp === "NIIF S2 10(a), (b)y(c)") return { texto: "Ver hoja «Tabla NIIF».", origen: "datos" };
    const tipo = dp === "NIIF S2 29 (b)" ? "riesgo_transicion" : dp === "NIIF S2 29 (c)" ? "riesgo_fisico" : dp === "NIIF S2 29 (d)" ? "oportunidad" : null;
    if (tipo) {
      const filas = d.registros.filter((r) => r.tipo === tipo).map((r) =>
        [r.nombre, r.cantidad != null ? NUM.format(r.cantidad) : null, r.porcentaje != null ? `${NUM.format(r.porcentaje)} %` : null, r.capital].filter(Boolean).join(" · ")
      );
      return filas.length ? { texto: filas.join("\n"), origen: "datos" } : { texto: null, origen: "pendiente" };
    }
    return { texto: null, origen: "por decidir" };
  }
}
