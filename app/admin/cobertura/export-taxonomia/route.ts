import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { APP_NAME } from "@/lib/app";
import { CUESTIONARIOS } from "@/lib/cuestionarios";

export const runtime = "nodejs";

// Plantilla oficial de la firma. Round-trip de exceljs verificado: conserva
// hojas, merges, estilos e imágenes; solo pierde metadata no visible (etiqueta
// de sensibilidad y web-extensions). Ver reporte de fidelidad en el PR de Fase 3.
const PLANTILLA = path.join(process.cwd(), "assets", "taxonomia-base.xlsx");

const NOTA_PENDIENTE = "Pendiente de validación en plataforma";
const NOTA_SIN = "Sin evidencia";
const GOLD = "FF8A6D1B";

const fmtFecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type MapeoRow = {
  hoja: string;
  celda: string;
  ejercicio: number | null;
  solicitud_id: string | null;
  etiqueta: string | null;
  celda_nota: string | null;
};
type CapRow = {
  solicitud_id: string;
  valor: number;
  periodo: string | null;
  confirmado: boolean;
  created_at: string;
};
type RegRow = {
  id: string;
  reporte_id: string;
  tipo: string;
  nombre: string;
  descripcion: string | null;
  horizonte_temporal: string | null;
  orden: number;
};
type RegValRow = {
  registro_id: string;
  ejercicio: number;
  cantidad_activos: number | null;
  porcentaje: number | null;
  capital_desplegado: number | null;
  created_at: string;
};

const NOTA_SIN_DATOS = "Sin datos del ejercicio";
const TIPO_LABEL: Record<string, string> = {
  riesgo_fisico: "Físico",
  riesgo_transicion: "Transición",
  oportunidad: "Oportunidad",
};

// Layout POSICIONAL de las 4 hojas de registros. A diferencia de las hojas GEI
// (mapeo fijo celda↔dato en mapeo_export), aquí el nº de registros es dinámico y
// se escriben secuencialmente en los slots de cada sección; por eso NO viven en
// mapeo_export. Ver justificación en el commit.
type GrupoAnio = { cantidad: string; pct: string; capital: string };
type RegSeccion = {
  hoja: string;
  tipos: string[];
  filaInicio: number;
  filaFin: number;
  descriptivo: boolean; // S2 10: nombre/desc/tipo/horizonte, sin valores
  cols: {
    nombre: string;
    descripcion?: string;
    tipo?: string;
    horizonte: string;
    v2025?: GrupoAnio;
    v2024?: GrupoAnio;
  };
};

const G2025: GrupoAnio = { cantidad: "C", pct: "D", capital: "E" };
const G2024: GrupoAnio = { cantidad: "H", pct: "I", capital: "J" };

const REG_SECCIONES: RegSeccion[] = [
  // NIIF S2 10 — dos secciones en una hoja (Riesgos rows 4-11, Oportunidades 13-17).
  {
    hoja: "NIIF S2 10",
    tipos: ["riesgo_fisico", "riesgo_transicion"],
    filaInicio: 4,
    filaFin: 11,
    descriptivo: true,
    cols: { nombre: "A", descripcion: "B", tipo: "C", horizonte: "D" },
  },
  {
    hoja: "NIIF S2 10",
    tipos: ["oportunidad"],
    filaInicio: 13,
    filaFin: 17,
    descriptivo: true,
    cols: { nombre: "A", descripcion: "B", tipo: "C", horizonte: "D" },
  },
  // Hojas de valores (datos 2025 en C/D/E, 2024 en H/I/J).
  {
    hoja: "NIIF S2 29(b)",
    tipos: ["riesgo_fisico"],
    filaInicio: 5,
    filaFin: 20,
    descriptivo: false,
    cols: { nombre: "A", horizonte: "B", v2025: G2025, v2024: G2024 },
  },
  {
    hoja: "NIIF S2 30",
    tipos: ["riesgo_transicion"],
    filaInicio: 5,
    filaFin: 14,
    descriptivo: false,
    cols: { nombre: "A", horizonte: "B", v2025: G2025, v2024: G2024 },
  },
  {
    hoja: "NIIF S2 29(d)",
    tipos: ["oportunidad"],
    filaInicio: 5,
    filaFin: 20,
    descriptivo: false,
    cols: { nombre: "A", horizonte: "B", v2025: G2025, v2024: G2024 },
  },
];

function limpiarNombre(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

/**
 * Escribe los registros de clima en sus 4 hojas por posición (secuencial dentro
 * de cada sección). Registros activos únicamente. Devuelve nº de filas escritas.
 * Marca `hojasTocadas` para el pie [DEMO] (footer bajo el último slot de la hoja).
 */
function escribirRegistros(
  wb: ExcelJS.Workbook,
  registros: RegRow[],
  vigentePorReg: Map<string, Map<number, RegValRow>>,
  hojasTocadas: Map<string, { ws: ExcelJS.Worksheet; ultimaFila: number }>
): number {
  let escritas = 0;
  for (const sec of REG_SECCIONES) {
    const ws = wb.getWorksheet(sec.hoja);
    if (!ws) continue;
    const lista = registros
      .filter((r) => sec.tipos.includes(r.tipo))
      .sort((a, b) => a.orden - b.orden);
    const slots = sec.filaFin - sec.filaInicio + 1;
    const visibles = lista.slice(0, slots);

    let ultimaFilaUsada = sec.filaInicio - 1;
    visibles.forEach((r, i) => {
      const fila = sec.filaInicio + i;
      ws.getCell(`${sec.cols.nombre}${fila}`).value = limpiarNombre(r.nombre);
      ws.getCell(`${sec.cols.horizonte}${fila}`).value = r.horizonte_temporal ?? "";

      if (sec.descriptivo) {
        if (sec.cols.descripcion)
          ws.getCell(`${sec.cols.descripcion}${fila}`).value = r.descripcion ?? "";
        if (sec.cols.tipo)
          ws.getCell(`${sec.cols.tipo}${fila}`).value = TIPO_LABEL[r.tipo] ?? r.tipo;
      } else {
        const vig = vigentePorReg.get(r.id);
        for (const [anio, grupo] of [
          [2025, sec.cols.v2025] as const,
          [2024, sec.cols.v2024] as const,
        ]) {
          if (!grupo) continue;
          const v = vig?.get(anio);
          const tieneDato =
            v &&
            (v.cantidad_activos != null ||
              v.porcentaje != null ||
              v.capital_desplegado != null);
          if (tieneDato) {
            if (v!.cantidad_activos != null) {
              const c = ws.getCell(`${grupo.cantidad}${fila}`);
              c.value = v!.cantidad_activos;
              c.numFmt = "#,##0.###";
            }
            if (v!.porcentaje != null) {
              const c = ws.getCell(`${grupo.pct}${fila}`);
              c.value = v!.porcentaje;
              c.numFmt = "#,##0.0";
            }
            if (v!.capital_desplegado != null) {
              const c = ws.getCell(`${grupo.capital}${fila}`);
              c.value = v!.capital_desplegado;
              c.numFmt = "#,##0.###";
            }
          } else {
            // Sin valores del ejercicio: brecha en la primera celda del grupo.
            ws.getCell(`${grupo.cantidad}${fila}`).value = NOTA_SIN_DATOS;
          }
        }
      }
      ultimaFilaUsada = fila;
      escritas++;
    });

    // Overflow: más registros que slots → nota en la última fila usada.
    const extras = lista.length - visibles.length;
    if (extras > 0 && visibles.length > 0) {
      const cell = ws.getCell(`${sec.cols.nombre}${ultimaFilaUsada}`);
      cell.value = `${limpiarNombre(
        visibles[visibles.length - 1].nombre
      )}  (+${extras} registros adicionales en plataforma)`;
    }

    // Pie: bajo el último slot de la hoja (no en medio de una sección).
    const prev = hojasTocadas.get(sec.hoja) ?? { ws, ultimaFila: 0 };
    prev.ultimaFila = Math.max(prev.ultimaFila, sec.filaFin);
    hojasTocadas.set(sec.hoja, prev);
  }
  return escritas;
}

// -----------------------------------------------------------------------------
// Objetivos (Sprint 3) — llenado posicional de 5 hojas.
//   · S2 33/34/35/36(a-d): SOLO climáticos, en el MISMO orden de filas en las 4
//     hojas (el lector sigue un objetivo a través de ellas: objetivo #i → fila 3+i).
//   · S1 51: TODOS los objetivos (ambos ámbitos), en secciones Riesgos (filas
//     4-12) y Oportunidades (14-18) según `naturaleza`.
// Campos vacíos → nota en Notas/Brechas de la fila (las hojas S2 tienen esa
// columna; S1 51 no la tiene, así que las celdas ausentes quedan en blanco).
// -----------------------------------------------------------------------------
const NOTA_SECCION = "Sección pendiente en plataforma";

type ObjRow = {
  id: string;
  reporte_id: string;
  ambito: string;
  naturaleza: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  metrica: string | null;
  meta: string | null;
  parte_entidad: string | null;
  periodo_aplicacion: string | null;
  periodo_base: string | null;
  hito_intermedio: string | null;
  tipo_objetivo: string | null;
  alineacion_acuerdo_internacional: string | null;
  orden: number;
};
type ObjDetRow = {
  objetivo_id: string;
  validacion_tercero: string | null;
  procesos_revision: string | null;
  metricas_supervision: string | null;
  revisiones: string | null;
  resultados: string | null;
  analisis_tendencias: string | null;
  gases_cubiertos: string | null;
  alcances_cubiertos: string | null;
  bruto_neto: string | null;
  enfoque_descarbonizacion: string | null;
  notas: string | null;
};

function escribirObjetivos(
  wb: ExcelJS.Workbook,
  objetivos: ObjRow[], // activos, ordenados por `orden`
  detallePorObj: Map<string, ObjDetRow>,
  hojasTocadas: Map<string, { ws: ExcelJS.Worksheet; ultimaFila: number }>
): number {
  let escritas = 0;
  const put = (
    ws: ExcelJS.Worksheet,
    addr: string,
    val: string | null | undefined
  ) => {
    if (val != null && String(val).trim() !== "") ws.getCell(addr).value = val;
  };
  const marcar = (hoja: string, ws: ExcelJS.Worksheet, fila: number) => {
    const prev = hojasTocadas.get(hoja) ?? { ws, ultimaFila: 0 };
    prev.ultimaFila = Math.max(prev.ultimaFila, fila);
    hojasTocadas.set(hoja, prev);
  };

  // --- S2 33/34/35/36 — climáticos, mismo orden de filas (3..10) ---
  const S2_INICIO = 3;
  const S2_FIN = 10;
  const climaticos = objetivos.filter((o) => o.ambito === "climatico");
  const s33 = wb.getWorksheet("NIIF S2 33");
  const s34 = wb.getWorksheet("NIIF S2 34");
  const s35 = wb.getWorksheet("NIIF S2 35");
  const s36 = wb.getWorksheet("NIIF S2 36(a)-(d)");
  const visClim = climaticos.slice(0, S2_FIN - S2_INICIO + 1);

  // Marca las 4 hojas para el pie [DEMO] aunque no haya climáticos (consistente
  // con las hojas de registros, que se marcan incondicionalmente).
  if (s33) marcar("NIIF S2 33", s33, S2_FIN);
  if (s34) marcar("NIIF S2 34", s34, S2_FIN);
  if (s35) marcar("NIIF S2 35", s35, S2_FIN);
  if (s36) marcar("NIIF S2 36(a)-(d)", s36, S2_FIN);

  visClim.forEach((o, i) => {
    const fila = S2_INICIO + i;
    const nombre = limpiarNombre(o.nombre);
    const d = detallePorObj.get(o.id);

    if (s33) {
      put(s33, `A${fila}`, nombre);
      put(s33, `B${fila}`, o.tipo);
      put(s33, `C${fila}`, o.metrica);
      put(s33, `D${fila}`, o.meta);
      put(s33, `E${fila}`, o.parte_entidad);
      put(s33, `F${fila}`, o.periodo_aplicacion);
      put(s33, `G${fila}`, o.periodo_base);
      put(s33, `H${fila}`, o.hito_intermedio);
      put(s33, `I${fila}`, o.tipo_objetivo);
      put(s33, `J${fila}`, o.alineacion_acuerdo_internacional);
      const defVacia = !(
        o.tipo ||
        o.metrica ||
        o.meta ||
        o.parte_entidad ||
        o.periodo_aplicacion ||
        o.periodo_base ||
        o.hito_intermedio ||
        o.tipo_objetivo ||
        o.alineacion_acuerdo_internacional
      );
      // Notas/Brechas (col K): la nota de sección pendiente si la definición está
      // vacía; en caso contrario, la nota libre de la ficha (si la hay).
      if (defVacia) s33.getCell(`K${fila}`).value = NOTA_SECCION;
      else put(s33, `K${fila}`, d?.notas);
    }
    if (s34) {
      put(s34, `A${fila}`, nombre);
      put(s34, `B${fila}`, d?.validacion_tercero);
      put(s34, `C${fila}`, d?.procesos_revision);
      put(s34, `D${fila}`, d?.metricas_supervision);
      put(s34, `E${fila}`, d?.revisiones);
      const vacia = !(
        d &&
        (d.validacion_tercero ||
          d.procesos_revision ||
          d.metricas_supervision ||
          d.revisiones)
      );
      if (vacia) s34.getCell(`F${fila}`).value = NOTA_SECCION;
    }
    if (s35) {
      put(s35, `A${fila}`, nombre);
      put(s35, `B${fila}`, d?.resultados);
      put(s35, `C${fila}`, d?.analisis_tendencias);
      const vacia = !(d && (d.resultados || d.analisis_tendencias));
      if (vacia) s35.getCell(`D${fila}`).value = NOTA_SECCION;
    }
    if (s36) {
      put(s36, `A${fila}`, nombre);
      put(s36, `B${fila}`, d?.gases_cubiertos);
      put(s36, `C${fila}`, d?.alcances_cubiertos);
      put(s36, `D${fila}`, d?.bruto_neto);
      put(s36, `E${fila}`, d?.enfoque_descarbonizacion);
      const vacia = !(
        d &&
        (d.gases_cubiertos ||
          d.alcances_cubiertos ||
          d.bruto_neto ||
          d.enfoque_descarbonizacion)
      );
      if (vacia) s36.getCell(`F${fila}`).value = NOTA_SECCION;
    }
    escritas++;
  });

  // Overflow climáticos: nota '+N' en la última fila (col nombre) de las 4 hojas.
  const extrasClim = climaticos.length - visClim.length;
  if (extrasClim > 0 && visClim.length > 0) {
    const filaUlt = S2_INICIO + visClim.length - 1;
    const ultNombre = limpiarNombre(visClim[visClim.length - 1].nombre);
    for (const ws of [s33, s34, s35, s36]) {
      if (ws)
        ws.getCell(`A${filaUlt}`).value =
          `${ultNombre}  (+${extrasClim} objetivos adicionales en plataforma)`;
    }
  }

  // --- S1 51 — TODOS los objetivos, secciones Riesgos / Oportunidades ---
  const s51 = wb.getWorksheet("NIIF S1 51");
  if (s51) {
    const seccion = (naturaleza: string, inicio: number, fin: number) => {
      const lista = objetivos.filter((o) => o.naturaleza === naturaleza);
      const vis = lista.slice(0, fin - inicio + 1);
      vis.forEach((o, i) => {
        const fila = inicio + i;
        const d = detallePorObj.get(o.id);
        put(s51, `A${fila}`, limpiarNombre(o.nombre));
        put(s51, `B${fila}`, o.tipo);
        put(s51, `C${fila}`, o.metrica);
        put(s51, `D${fila}`, o.descripcion);
        put(s51, `E${fila}`, o.periodo_aplicacion);
        put(s51, `F${fila}`, o.periodo_base);
        put(s51, `G${fila}`, o.hito_intermedio);
        // H: resultados + análisis de tendencias (columna combinada de la plantilla).
        const resultado = [d?.resultados, d?.analisis_tendencias]
          .filter(Boolean)
          .join(" — ");
        put(s51, `H${fila}`, resultado);
        put(s51, `I${fila}`, d?.revisiones);
        escritas++;
      });
      const extras = lista.length - vis.length;
      if (extras > 0 && vis.length > 0) {
        const filaUlt = inicio + vis.length - 1;
        s51.getCell(`A${filaUlt}`).value =
          `${limpiarNombre(vis[vis.length - 1].nombre)}  (+${extras} adicionales en plataforma)`;
      }
    };
    seccion("riesgo", 4, 12);
    seccion("oportunidad", 14, 18);
    marcar("NIIF S1 51", s51, 18);
  }

  return escritas;
}

// -----------------------------------------------------------------------------
// Cuestionarios narrativos (Sprint 4) — llenado de 3 hojas (rejilla pregunta/
// respuesta). Cada hoja: encabezados en fila 2, datos desde la fila 3.
//   A = pregunta (se escribe solo si la celda está vacía; preserva las preguntas
//       ya impresas en la plantilla, p. ej. 36(e)).
//   B = respuesta · C = tipo de dato · D = Notas/Brechas.
// Pregunta sin respuesta → nota de brecha en Notas (col D). El catálogo de
// preguntas es fijo y vive en lib/cuestionarios.ts.
// -----------------------------------------------------------------------------
const NOTA_CUEST_PENDIENTE = "Pendiente en plataforma";
const CUEST_FILA_INICIO = 3;

type CuestRow = {
  reporte_id: string;
  hoja: string;
  pregunta_orden: number;
  respuesta: string | null;
  tipo_dato: string | null;
  notas: string | null;
};

function escribirCuestionarios(
  wb: ExcelJS.Workbook,
  respuestas: CuestRow[], // ya acotadas al reporte objetivo
  hojasTocadas: Map<string, { ws: ExcelJS.Worksheet; ultimaFila: number }>
): number {
  let escritas = 0;
  // Índice respuesta por (hoja, orden).
  const porClave = new Map<string, CuestRow>();
  for (const r of respuestas) porClave.set(`${r.hoja}#${r.pregunta_orden}`, r);

  for (const sec of CUESTIONARIOS) {
    const ws = wb.getWorksheet(sec.hojaExcel);
    if (!ws) continue;

    let ultimaFila = CUEST_FILA_INICIO - 1;
    sec.preguntas.forEach((p, i) => {
      const fila = CUEST_FILA_INICIO + i;
      // A: pregunta — solo si la plantilla no la trae ya impresa.
      const celdaA = ws.getCell(`A${fila}`);
      const aActual = celdaA.value;
      if (aActual == null || String(aActual).trim() === "") celdaA.value = p.texto;

      const r = porClave.get(`${sec.hoja}#${p.orden}`);
      const respuesta = r?.respuesta?.trim() || null;
      const tipoDato = r?.tipo_dato?.trim() || null;
      const notas = r?.notas?.trim() || null;

      if (respuesta) {
        ws.getCell(`B${fila}`).value = respuesta;
        escritas++;
      }
      if (tipoDato) ws.getCell(`C${fila}`).value = tipoDato;
      // Notas/Brechas: la nota libre si la hay; si no hay respuesta, la brecha.
      const notaCelda = notas ?? (respuesta ? null : NOTA_CUEST_PENDIENTE);
      if (notaCelda) ws.getCell(`D${fila}`).value = notaCelda;

      ultimaFila = fila;
    });

    // Marca la hoja para el pie [DEMO] (incondicional, como registros/objetivos).
    const prev = hojasTocadas.get(sec.hojaExcel) ?? { ws, ultimaFila: 0 };
    prev.ultimaFila = Math.max(prev.ultimaFila, ultimaFila);
    hojasTocadas.set(sec.hojaExcel, prev);
  }
  return escritas;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return NextResponse.json(
      { error: "Acceso reservado al equipo de IRStrat." },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const [
    { data: mapeo, error: mapErr },
    { data: sols },
    { data: caps },
    { data: registros },
    { data: regValores },
    { data: objetivos },
    { data: objDetalle },
    { data: cuestionarios },
  ] = await Promise.all([
    supabase
      .from("mapeo_export")
      .select("hoja, celda, ejercicio, solicitud_id, etiqueta, celda_nota")
      .eq("activo", true),
    supabase.from("solicitudes").select("id, estado, reporte_id"),
    supabase
      .from("capturas_valor")
      .select("solicitud_id, valor, periodo, confirmado, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("registros_clima")
      .select("id, reporte_id, tipo, nombre, descripcion, horizonte_temporal, orden")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("registros_clima_valores")
      .select(
        "registro_id, ejercicio, cantidad_activos, porcentaje, capital_desplegado, created_at"
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("objetivos")
      .select(
        "id, reporte_id, ambito, naturaleza, nombre, descripcion, tipo, metrica, meta, parte_entidad, periodo_aplicacion, periodo_base, hito_intermedio, tipo_objetivo, alineacion_acuerdo_internacional, orden"
      )
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("objetivos_detalle")
      .select(
        "objetivo_id, validacion_tercero, procesos_revision, metricas_supervision, revisiones, resultados, analisis_tendencias, gases_cubiertos, alcances_cubiertos, bruto_neto, enfoque_descarbonizacion, notas"
      ),
    supabase
      .from("cuestionarios_respuestas")
      .select("reporte_id, hoja, pregunta_orden, respuesta, tipo_dato, notas"),
  ]);

  if (mapErr || !mapeo) {
    return NextResponse.json(
      { error: "No se pudo leer el mapeo de export." },
      { status: 500 }
    );
  }
  if (mapeo.length === 0) {
    return NextResponse.json(
      { error: "No hay celdas mapeadas para llenar la plantilla." },
      { status: 422 }
    );
  }

  // Índices auxiliares.
  const estadoSol = new Map<string, string>();
  const reporteSol = new Map<string, string>();
  for (const s of sols ?? []) {
    estadoSol.set(s.id, s.estado);
    if (s.reporte_id) reporteSol.set(s.id, s.reporte_id);
  }

  // Reporte objetivo del export: el de la primera solicitud mapeada. Acota los
  // registros de clima y objetivos a ESE reporte (evita mezclar reportes/tenants
  // en un mismo entregable). Si no se puede determinar, no se filtra (compat).
  const primerSolId = (mapeo as MapeoRow[]).find((m) => m.solicitud_id)?.solicitud_id;
  const targetReporteId = primerSolId ? reporteSol.get(primerSolId) ?? null : null;
  const enReporte = <T extends { reporte_id: string }>(filas: T[]): T[] =>
    targetReporteId ? filas.filter((f) => f.reporte_id === targetReporteId) : filas;

  // Capturas por solicitud (llegan asc → la última confirmada por periodo gana).
  const capsPorSol = new Map<string, CapRow[]>();
  for (const c of (caps ?? []) as CapRow[]) {
    const arr = capsPorSol.get(c.solicitud_id) ?? [];
    arr.push(c);
    capsPorSol.set(c.solicitud_id, arr);
  }
  const ultimaConfirmada = (solId: string, ejercicio: number): number | null => {
    const arr = capsPorSol.get(solId);
    if (!arr) return null;
    let v: number | null = null;
    for (const c of arr) {
      if (c.confirmado && c.periodo === String(ejercicio)) v = c.valor; // asc → última gana
    }
    return v;
  };

  // Valor vigente por (registro, ejercicio): la última fila insertada gana
  // (valores llegan asc por created_at → APPEND ONLY, corrección = fila nueva).
  const vigentePorReg = new Map<string, Map<number, RegValRow>>();
  for (const v of (regValores ?? []) as RegValRow[]) {
    const porAnio = vigentePorReg.get(v.registro_id) ?? new Map<number, RegValRow>();
    porAnio.set(v.ejercicio, v);
    vigentePorReg.set(v.registro_id, porAnio);
  }

  // ---------------------------------------------------------------------------
  // Cargar la plantilla oficial y escribir solo las celdas mapeadas.
  // ---------------------------------------------------------------------------
  try {
  const buf = await fs.readFile(PLANTILLA);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);

  let llenadas = 0;
  let huecosPendiente = 0;
  let huecosSin = 0;
  let etiquetas = 0;

  const notas = new Map<string, { hoja: string; celda: string; texto: string }>();
  const hojasTocadas = new Map<string, { ws: ExcelJS.Worksheet; ultimaFila: number }>();

  const filaDe = (celda: string): number => parseInt(celda.replace(/[^0-9]/g, ""), 10);

  for (const m of mapeo as MapeoRow[]) {
    const ws = wb.getWorksheet(m.hoja);
    if (!ws) continue; // hoja ausente en la plantilla: se ignora con seguridad
    const tocada = hojasTocadas.get(m.hoja) ?? { ws, ultimaFila: 0 };
    tocada.ultimaFila = Math.max(tocada.ultimaFila, filaDe(m.celda));
    hojasTocadas.set(m.hoja, tocada);

    // Celda de etiqueta: texto literal (categoría verbatim / unidad).
    if (m.etiqueta != null) {
      ws.getCell(m.celda).value = m.etiqueta;
      etiquetas++;
      continue;
    }

    // Celda de valor.
    if (!m.solicitud_id || m.ejercicio == null) continue;
    const estado = estadoSol.get(m.solicitud_id);
    const valor =
      estado === "validado" ? ultimaConfirmada(m.solicitud_id, m.ejercicio) : null;

    if (valor != null) {
      const cell = ws.getCell(m.celda);
      cell.value = valor;
      cell.numFmt = "#,##0.###";
      llenadas++;
    } else if (m.celda_nota) {
      // Regla dura: valor no validado NO entra. Se anota la brecha en la fila.
      const tieneCaptura = (capsPorSol.get(m.solicitud_id)?.length ?? 0) > 0;
      const texto = tieneCaptura ? NOTA_PENDIENTE : NOTA_SIN;
      // Una nota por celda de nota (dedupe por hoja+celda); 'pendiente' prevalece
      // sobre 'sin evidencia' si conviven en la misma fila.
      const key = `${m.hoja}!${m.celda_nota}`;
      const prev = notas.get(key);
      if (!prev || (texto === NOTA_PENDIENTE && prev.texto === NOTA_SIN)) {
        notas.set(key, { hoja: m.hoja, celda: m.celda_nota, texto });
      }
    }
  }

  // Escribir las notas/brechas y contarlas.
  for (const n of notas.values()) {
    const ws = wb.getWorksheet(n.hoja);
    if (!ws) continue;
    ws.getCell(n.celda).value = n.texto;
    if (n.texto === NOTA_PENDIENTE) huecosPendiente++;
    else huecosSin++;
  }

  // Registros de riesgos/oportunidades (escritura posicional en 4 hojas).
  const registrosEscritos = escribirRegistros(
    wb,
    enReporte((registros ?? []) as RegRow[]),
    vigentePorReg,
    hojasTocadas
  );

  // Objetivos climáticos y de sostenibilidad (5 hojas: S1 51 + S2 33/34/35/36).
  const detallePorObj = new Map<string, ObjDetRow>();
  for (const d of (objDetalle ?? []) as ObjDetRow[]) detallePorObj.set(d.objetivo_id, d);
  const objetivosEscritos = escribirObjetivos(
    wb,
    enReporte((objetivos ?? []) as ObjRow[]),
    detallePorObj,
    hojasTocadas
  );

  // Cuestionarios narrativos (3 hojas: S2 22(b)(i)/(ii) y 36(e)).
  const cuestionariosEscritos = escribirCuestionarios(
    wb,
    enReporte((cuestionarios ?? []) as CuestRow[]),
    hojasTocadas
  );

  // Pie discreto en cada hoja llenada.
  const fechaHoy = fmtFecha.format(new Date());
  const pie = `Generado por ${APP_NAME} — ${fechaHoy} — [DEMO]`;
  for (const { ws, ultimaFila } of hojasTocadas.values()) {
    const cell = ws.getCell(`A${ultimaFila + 2}`);
    cell.value = pie;
    cell.font = { italic: true, size: 9, color: { argb: GOLD } };
  }

  // ---------------------------------------------------------------------------
  // Nombre de archivo: taxonomia-{slug-tenant}-{ejercicio}-{fecha}.
  // ---------------------------------------------------------------------------
  let slug = "reporte";
  let ejercicio = new Date().getFullYear();
  if (targetReporteId) {
    const { data: rep } = await supabase
      .from("reportes")
      .select("ejercicio, tenant:tenants!reportes_tenant_id_fkey(nombre, slug)")
      .eq("id", targetReporteId)
      .single();
    if (rep) {
      ejercicio = rep.ejercicio;
      const tenant = rep.tenant as unknown as { nombre: string; slug: string | null } | null;
      slug = tenant?.slug ?? (tenant?.nombre ? slugify(tenant.nombre) : "reporte");
    }
  }
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const filename = `taxonomia-${slug}-${ejercicio}-${fechaArchivo}.xlsx`;

  const salida = await wb.xlsx.writeBuffer();

  console.log(
    `[export-taxonomia] etiquetas=${etiquetas} llenadas=${llenadas} ` +
      `pendiente=${huecosPendiente} sin_evidencia=${huecosSin} ` +
      `registros=${registrosEscritos} objetivos=${objetivosEscritos} ` +
      `cuestionarios=${cuestionariosEscritos} archivo=${filename}`
  );

  return new NextResponse(salida as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
  } catch (err) {
    console.error("[export-taxonomia] fallo al construir la plantilla:", err);
    return NextResponse.json(
      { error: "No se pudo construir la plantilla de taxonomía." },
      { status: 500 }
    );
  }
}
