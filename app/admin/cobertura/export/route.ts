import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { coberturaDe, COBERTURA_META } from "@/lib/cobertura";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";

export const runtime = "nodejs";

const TEAL = "FF0E4F47";
const CREMA = "FFF7F3EA";
const GOLD = "FF8A6D1B";
const MARCA_DEMO =
  "FORMATO PRELIMINAR DEMO — mapeo a la plantilla oficial de taxonomía en Fase 3.";

const fmtFecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function limpiar(nombre?: string | null): string {
  return (nombre ?? "").replace(/\[DEMO\]\s*/i, "").trim();
}

type Col = { header: string; width: number };

/** Escribe la banda de marca (fila 1) y los encabezados teal (fila 2). */
function encabezar(ws: ExcelJS.Worksheet, cols: Col[]) {
  ws.columns = cols.map((c) => ({ width: c.width }));

  ws.mergeCells(1, 1, 1, cols.length);
  const banner = ws.getCell(1, 1);
  banner.value = MARCA_DEMO;
  banner.font = { italic: true, color: { argb: GOLD }, size: 10 };
  banner.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 22;

  const header = ws.getRow(2);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.font = { bold: true, color: { argb: CREMA }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: TEAL } } };
  });
  header.height = 26;

  // Congelar la banda de marca + los encabezados.
  ws.views = [{ state: "frozen", ySplit: 2 }];
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
    { data: dps, error: dpErr },
    { data: mapeo },
    { data: sols },
    { data: evs },
    { data: caps },
    { data: reps },
  ] = await Promise.all([
    supabase
      .from("datapoints_taxonomia")
      .select("id, codigo, norma, pilar, seccion_indice, descripcion, ods")
      .eq("version_taxonomia", "2025")
      .order("norma")
      .order("pilar")
      .order("codigo"),
    supabase.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id"),
    supabase.from("solicitudes").select("id, titulo, estado, area_asignada"),
    supabase
      .from("evidencias")
      .select(
        "solicitud_id, version, nombre_original, created_at, subio:perfiles_usuario!evidencias_subido_por_fkey(nombre)"
      )
      .order("version", { ascending: true }),
    supabase
      .from("capturas_valor")
      .select(
        "solicitud_id, valor, unidad, periodo, confirmado, created_at, evidencia:evidencias!capturas_valor_evidencia_id_fkey(version), capturado:perfiles_usuario!capturas_valor_capturado_por_fkey(nombre)"
      )
      .eq("confirmado", true)
      .order("created_at", { ascending: true }),
    supabase.from("reportes").select("tenant:tenants!reportes_tenant_id_fkey(slug)"),
  ]);

  if (dpErr) {
    return NextResponse.json(
      { error: "No se pudo leer el catálogo de datapoints." },
      { status: 500 }
    );
  }

  const datapoints = (dps ?? []) as {
    id: string;
    codigo: string;
    norma: string;
    pilar: string;
    seccion_indice: string | null;
    descripcion: string;
    ods: string | null;
  }[];

  // Índice de solicitudes.
  type Sol = { titulo: string; estado: EstadoSolicitud; area: string | null };
  const solById = new Map<string, Sol>();
  for (const s of sols ?? [])
    solById.set(s.id, {
      titulo: s.titulo,
      estado: s.estado as EstadoSolicitud,
      area: s.area_asignada,
    });

  // Última versión de evidencia por solicitud (las llegan ordenadas asc).
  type Ev = { version: number; archivo: string; fecha: string; quien: string };
  const ultimaEv = new Map<string, Ev>();
  for (const e of (evs ?? []) as unknown as {
    solicitud_id: string;
    version: number;
    nombre_original: string;
    created_at: string;
    subio: { nombre: string } | null;
  }[]) {
    ultimaEv.set(e.solicitud_id, {
      version: e.version,
      archivo: e.nombre_original,
      fecha: e.created_at,
      quien: limpiar(e.subio?.nombre),
    });
  }

  // datapoint -> solicitudes ligadas ; solicitud -> códigos de datapoint.
  const solsPorDp = new Map<string, string[]>();
  const codigosPorSol = new Map<string, string[]>();
  const codigoDeDp = new Map<string, string>(datapoints.map((d) => [d.id, d.codigo]));
  for (const m of mapeo ?? []) {
    const arr = solsPorDp.get(m.datapoint_id) ?? [];
    arr.push(m.solicitud_id);
    solsPorDp.set(m.datapoint_id, arr);

    const cod = codigoDeDp.get(m.datapoint_id);
    if (cod) {
      const carr = codigosPorSol.get(m.solicitud_id) ?? [];
      carr.push(cod);
      codigosPorSol.set(m.solicitud_id, carr);
    }
  }

  // ---------------------------------------------------------------------------
  // Workbook
  // ---------------------------------------------------------------------------
  const wb = new ExcelJS.Workbook();
  wb.creator = "IRStrat";
  wb.created = new Date();

  // --- Hoja 1: Trazabilidad ---
  const t = wb.addWorksheet("Trazabilidad");
  const colsT: Col[] = [
    { header: "Código", width: 22 },
    { header: "Norma", width: 8 },
    { header: "Pilar", width: 14 },
    { header: "Sección del índice", width: 30 },
    { header: "Descripción del datapoint", width: 60 },
    { header: "Solicitud", width: 40 },
    { header: "Estado", width: 16 },
    { header: "Área", width: 18 },
    { header: "Últ. versión", width: 12 },
    { header: "Archivo evidencia", width: 34 },
    { header: "Fecha evidencia", width: 18 },
    { header: "Cargó", width: 24 },
    { header: "Cobertura", width: 15 },
  ];
  encabezar(t, colsT);

  for (const d of datapoints) {
    const ligadas = (solsPorDp.get(d.id) ?? [])
      .map((sid) => ({ sid, sol: solById.get(sid) }))
      .filter((x): x is { sid: string; sol: Sol } => x.sol != null);
    const cobertura = coberturaDe(ligadas.map((x) => x.sol.estado));
    const coberturaLabel = COBERTURA_META[cobertura].label;

    if (ligadas.length === 0) {
      t.addRow([
        d.codigo,
        d.norma,
        d.pilar,
        d.seccion_indice ?? "",
        d.descripcion,
        "", // solicitud
        "",
        "",
        "",
        "",
        "",
        "",
        COBERTURA_META.sin_solicitud.label,
      ]);
      continue;
    }

    for (const { sid, sol } of ligadas) {
      const ev = ultimaEv.get(sid);
      t.addRow([
        d.codigo,
        d.norma,
        d.pilar,
        d.seccion_indice ?? "",
        d.descripcion,
        sol.titulo,
        ESTADO_META[sol.estado].label,
        sol.area ?? "",
        ev ? ev.version : "",
        ev ? ev.archivo : "",
        ev ? fmtFecha.format(new Date(ev.fecha)) : "",
        ev ? ev.quien : "",
        coberturaLabel,
      ]);
    }
  }

  // Ajuste de texto para columnas largas.
  [5, 6].forEach((ci) => {
    t.getColumn(ci).alignment = { wrapText: true, vertical: "top" };
  });

  // --- Hoja 2: Valores capturados ---
  const v = wb.addWorksheet("Valores capturados");
  const colsV: Col[] = [
    { header: "Datapoint(s)", width: 30 },
    { header: "Solicitud", width: 40 },
    { header: "Valor", width: 16 },
    { header: "Unidad", width: 12 },
    { header: "Periodo", width: 16 },
    { header: "Capturado por", width: 24 },
    { header: "Fecha", width: 18 },
    { header: "Versión soporte", width: 16 },
  ];
  encabezar(v, colsV);

  for (const c of (caps ?? []) as unknown as {
    solicitud_id: string;
    valor: number;
    unidad: string;
    periodo: string | null;
    created_at: string;
    evidencia: { version: number } | null;
    capturado: { nombre: string } | null;
  }[]) {
    const sol = solById.get(c.solicitud_id);
    const codigos = (codigosPorSol.get(c.solicitud_id) ?? []).join(", ");
    const fila = v.addRow([
      codigos,
      sol?.titulo ?? "",
      c.valor,
      c.unidad,
      c.periodo ?? "",
      limpiar(c.capturado?.nombre),
      fmtFecha.format(new Date(c.created_at)),
      c.evidencia ? `v${c.evidencia.version}` : "",
    ]);
    fila.getCell(3).numFmt = "#,##0.###";
  }

  // ---------------------------------------------------------------------------
  // Respuesta
  // ---------------------------------------------------------------------------
  const slug =
    ((reps ?? [])
      .map((r) => (r.tenant as unknown as { slug: string } | null)?.slug)
      .find((s): s is string => !!s)) ?? "reporte";
  const fecha = new Date().toISOString().slice(0, 10);
  const filename = `matriz-trazabilidad-${slug}-${fecha}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
