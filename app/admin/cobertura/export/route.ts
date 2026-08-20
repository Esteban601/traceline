import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, puedeEntrarPanel } from "@/lib/data";
import { coberturaDe, COBERTURA_META } from "@/lib/cobertura";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { ORIGEN_META, type OrigenSolicitud } from "@/lib/origen";
import { fmtFechaHora } from "@/lib/fechas";

export const runtime = "nodejs";

const TEAL = "FF0E4F47";
const CREMA = "FFF7F3EA";
const GOLD = "FF8A6D1B";
const MARCA_DEMO =
  "FORMATO PRELIMINAR DEMO — mapeo a la plantilla oficial de taxonomía en Fase 3.";

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

export async function GET(request: Request) {
  // El administrador del cliente también genera SU Excel. Lo que le entrega es
  // suyo y solo suyo: RLS acota cada consulta de abajo a su tenant, así que un
  // ?tenant= o ?reporte= ajeno devuelve vacío o 404, no los datos de otro.
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return NextResponse.json(
      { error: "Acceso reservado al panel de seguimiento." },
      { status: 403 }
    );
  }

  // El export sigue al selector de cliente de /admin/cobertura: sin ?tenant es
  // el agregado de la firma; con él, SOLO ese cliente. Un libro que ignorara el
  // filtro entregaría la evidencia de todas las emisoras bajo el nombre de una.
  const tenantParam = new URL(request.url).searchParams.get("tenant");

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
      .select("id, codigo, norma, marco, pilar, seccion_indice, descripcion, ods")
      .eq("version_taxonomia", "2025")
      .order("norma")
      .order("pilar")
      .order("codigo"),
    supabase.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id"),
    supabase
      .from("solicitudes")
      .select(
        "id, titulo, estado, origen, area_asignada, vb_area_por, vb_area_fecha, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id), vb:perfiles_usuario!solicitudes_vb_area_por_fkey(nombre)"
      ),
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
    supabase
      .from("reportes")
      .select("tenant_id, tenant:tenants!reportes_tenant_id_fkey(slug)"),
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
    marco: string;
    pilar: string;
    seccion_indice: string | null;
    descripcion: string;
    ods: string | null;
  }[];

  // Índice de solicitudes, acotado al cliente seleccionado si lo hay. Todo lo
  // que se escribe después pasa por este índice, así que filtrar aquí acota el
  // libro completo.
  type Sol = {
    titulo: string;
    estado: EstadoSolicitud;
    origen: OrigenSolicitud;
    area: string | null;
    /** Visto bueno del área, ya redactado para la celda ("Ana Ruiz · 12 mar 2026"). */
    vistoBueno: string;
  };
  const solById = new Map<string, Sol>();
  for (const s of (sols ?? []) as unknown as {
    id: string;
    titulo: string;
    estado: string;
    origen: string;
    area_asignada: string | null;
    vb_area_por: string | null;
    vb_area_fecha: string | null;
    vb: { nombre: string } | null;
    reporte: { tenant_id: string } | null;
  }[]) {
    if (tenantParam && s.reporte?.tenant_id !== tenantParam) continue;
    solById.set(s.id, {
      titulo: s.titulo,
      estado: s.estado as EstadoSolicitud,
      origen: s.origen as OrigenSolicitud,
      area: s.area_asignada,
      // Se dice explícitamente cuando NO lo hay: una celda vacía en un entregable
      // de trazabilidad se lee como "no aplica", y aquí sí aplica y no se dio.
      vistoBueno:
        s.vb_area_por && s.vb_area_fecha
          ? `${limpiar(s.vb?.nombre) || "Jefe de área"} · ${fmtFechaHora(s.vb_area_fecha)}`
          : "Sin visto bueno del área",
    });
  }

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
    // La columna Marco evita que los datapoints propios de la firma se lean
    // como requerimientos de NIIF: en un entregable de auditoría, atribuirle a
    // la norma algo que no dice es un error de fondo, no de forma.
    { header: "Marco", width: 10 },
    { header: "Norma", width: 8 },
    { header: "Pilar", width: 14 },
    { header: "Sección del índice", width: 30 },
    { header: "Descripción del datapoint", width: 60 },
    { header: "Solicitud", width: 40 },
    { header: "Estado", width: 16 },
    // Fuente de la validación: quién pidió el dato y, si ya está validado, quién
    // lo validó. En un entregable de trazabilidad eso no puede quedar implícito.
    { header: "Origen / validación", width: 30 },
    // La SEGUNDA verificación, la del área. Va junto a la validación final porque
    // es lo que un revisor compara: quién respaldó el dato adentro y quién lo
    // aceptó. Este libro es el de trazabilidad; el oficial no cambia — ahí solo
    // entra lo validado, y el visto bueno no es una validación.
    { header: "Visto bueno del área", width: 30 },
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
        d.marco === "GRI" ? "Extensión GRI" : "NIIF",
        // La norma solo aplica a los NIIF: rotular "S1" un datapoint de GRI le
        // atribuiría a la taxonomía oficial algo que no dice.
        d.marco === "GRI" ? "GRI" : d.norma,
        d.pilar,
        d.seccion_indice ?? "",
        d.descripcion,
        "", // solicitud
        "",
        "", // origen / validación
        "", // visto bueno del área
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
        d.marco === "GRI" ? "Extensión GRI" : "NIIF",
        // La norma solo aplica a los NIIF: rotular "S1" un datapoint de GRI le
        // atribuiría a la taxonomía oficial algo que no dice.
        d.marco === "GRI" ? "GRI" : d.norma,
        d.pilar,
        d.seccion_indice ?? "",
        d.descripcion,
        sol.titulo,
        ESTADO_META[sol.estado].label,
        sol.estado === "validado" || sol.estado === "congelado"
          ? ORIGEN_META[sol.origen].validacion
          : ORIGEN_META[sol.origen].label,
        sol.vistoBueno,
        sol.area ?? "",
        ev ? ev.version : "",
        ev ? ev.archivo : "",
        ev ? fmtFechaHora(ev.fecha) : "",
        ev ? ev.quien : "",
        coberturaLabel,
      ]);
    }
  }

  // Ajuste de texto para columnas largas.
  [6, 7].forEach((ci) => {
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
    // Una captura cuya solicitud no está en el índice es de otro cliente (o
    // quedó fuera del filtro): no se escribe, ni siquiera con el título vacío.
    const sol = solById.get(c.solicitud_id);
    if (!sol) continue;
    const codigos = (codigosPorSol.get(c.solicitud_id) ?? []).join(", ");
    const fila = v.addRow([
      codigos,
      sol?.titulo ?? "",
      c.valor,
      c.unidad,
      c.periodo ?? "",
      limpiar(c.capturado?.nombre),
      fmtFechaHora(c.created_at),
      c.evidencia ? `v${c.evidencia.version}` : "",
    ]);
    fila.getCell(3).numFmt = "#,##0.###";
  }

  // ---------------------------------------------------------------------------
  // Respuesta
  // ---------------------------------------------------------------------------
  const reportes = (reps ?? []) as unknown as {
    tenant_id: string;
    tenant: { slug: string } | null;
  }[];
  const slug =
    reportes
      .filter((r) => !tenantParam || r.tenant_id === tenantParam)
      .map((r) => r.tenant?.slug)
      .find((s): s is string => !!s) ?? "reporte";
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
