import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { APP_NAME } from "@/lib/app";

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

  const [{ data: mapeo, error: mapErr }, { data: sols }, { data: caps }] =
    await Promise.all([
      supabase
        .from("mapeo_export")
        .select("hoja, celda, ejercicio, solicitud_id, etiqueta, celda_nota")
        .eq("activo", true),
      supabase.from("solicitudes").select("id, estado, reporte_id"),
      supabase
        .from("capturas_valor")
        .select("solicitud_id, valor, periodo, confirmado, created_at")
        .order("created_at", { ascending: true }),
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
  const primerSol = (mapeo as MapeoRow[]).find((m) => m.solicitud_id)?.solicitud_id;
  const reporteId = primerSol ? reporteSol.get(primerSol) : null;
  let slug = "reporte";
  let ejercicio = new Date().getFullYear();
  if (reporteId) {
    const { data: rep } = await supabase
      .from("reportes")
      .select("ejercicio, tenant:tenants!reportes_tenant_id_fkey(nombre, slug)")
      .eq("id", reporteId)
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
      `pendiente=${huecosPendiente} sin_evidencia=${huecosSin} archivo=${filename}`
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
