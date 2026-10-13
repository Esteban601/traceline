import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { llenarFormato, CONCEPTOS_FORMATO } from "@/lib/formato/llenar";
import { insumosDelFormato } from "@/lib/formato/datos";
import { RUTA_PLANTILLA_FORMATO, HOJA_ESTRUCTURA } from "@/lib/formato/plantilla";
import { pendienteEnTextoPlano } from "@/lib/suplemento/respuestas";

export const runtime = "nodejs";

// =============================================================================
// /admin/cobertura/export-formato?reporte=<id> — el Formato electrónico NIIF
// S1/S2 de la BMV, lleno por tipo de campo (encargo 2026-10-13, Paso 4).
//
// QUIÉN: staff y administrador del cliente (RLS acota al suyo). El AUDITOR NO:
// descarga el Excel de taxonomía, no el formato que presenta la emisora.
// CUÁNDO: solo con el generador encendido para la emisora y con respuestas del
// último documento APROBADO; si no, 409 con el motivo (la pantalla deshabilita
// el botón con el mismo texto).
// LA PLANTILLA no está en git (trae los textos de la norma): vive en Storage,
// bucket `documentos`, y se lee con service role.
// =============================================================================

const TIPO_LABEL: Record<string, string> = { riesgo_fisico: "Físico", riesgo_transicion: "Transición", oportunidad: "Oportunidad" };
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export async function GET(request: Request) {
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) {
    return NextResponse.json({ error: "El Formato electrónico lo descargan el equipo de IRStrat y el administrador de la emisora." }, { status: 403 });
  }
  const reporteId = new URL(request.url).searchParams.get("reporte");
  if (!reporteId) return NextResponse.json({ error: "Falta el reporte: /admin/cobertura/export-formato?reporte=<id>." }, { status: 400 });

  const db = await createClient();
  const ins = await insumosDelFormato(db, reporteId);
  if (!ins.ok) return NextResponse.json({ error: ins.error }, { status: ins.status });
  const { tenant, ens, datos } = ins;
  const ejercicio = datos.ejercicio;
  const valores = llenarFormato(datos);

  try {
    const { data: blob, error } = await createAdminClient().storage.from("documentos").download(RUTA_PLANTILLA_FORMATO);
    if (error || !blob) {
      console.error("[export-formato] sin plantilla en Storage:", error?.message);
      return NextResponse.json({ error: "Falta la plantilla del Formato electrónico en la plataforma." }, { status: 500 });
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await blob.arrayBuffer()) as ArrayBuffer);
    const ws = wb.getWorksheet(HOJA_ESTRUCTURA);
    if (!ws) return NextResponse.json({ error: "La plantilla no trae la hoja de estructura." }, { status: 500 });

    let escritas = 0;
    let logo: Buffer | null = null;
    if (tenant.logo_url && CONCEPTOS_FORMATO.some((c) => valores.get(c.fila)?.origen === "logo")) {
      try {
        const r = await fetch(tenant.logo_url);
        if (r.ok) logo = Buffer.from(await r.arrayBuffer());
      } catch {
        logo = null;
      }
    }
    for (const [fila, v] of valores) {
      const celda = ws.getCell(`K${fila}`);
      if (v.origen === "logo" && logo) {
        const ext = /\.jpe?g($|\?)/i.test(tenant.logo_url ?? "") ? "jpeg" : "png";
        const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: ext });
        ws.addImage(id, { tl: { col: 10, row: fila - 1 }, ext: { width: 120, height: 48 } });
        escritas++;
        continue;
      }
      if (!v.texto) continue;
      // Ninguna celda exportada empieza con «[» (CLAUDE.md §5, 1.10).
      celda.value = pendienteEnTextoPlano(v.texto);
      celda.alignment = { wrapText: true, vertical: "top" };
      escritas++;
    }

    // Hoja «Tabla NIIF»: riesgos y oportunidades desde los registros de clima.
    const tn = wb.getWorksheet("Tabla NIIF");
    if (tn) {
      const filaDe = (r: (typeof ens.registros)[number], n: number) => {
        const row = tn.getRow(n);
        row.getCell(1).value = r.nombre.replace(/\[DEMO\]\s*/i, "").trim();
        row.getCell(2).value = r.descripcion ?? "";
        row.getCell(3).value = "Sí";
        row.getCell(4).value = TIPO_LABEL[r.tipo] ?? r.tipo;
        row.getCell(5).value = (r.horizontes ?? []).join(", ");
        row.getCell(6).value = r.impactos_potenciales ?? "";
        row.getCell(7).value = r.concentracion ?? "";
        row.eachCell((c) => (c.alignment = { wrapText: true, vertical: "top" }));
      };
      let n = 3;
      for (const r of ens.registros.filter((x) => x.tipo !== "oportunidad")) filaDe(r, n++);
      const opps = ens.registros.filter((x) => x.tipo === "oportunidad");
      if (opps.length) {
        n++;
        tn.getCell(`A${n}`).value = "OPORTUNIDADES";
        tn.getCell(`A${n}`).font = { bold: true };
        n++;
        for (const r of opps) filaDe(r, n++);
      }
    }

    const nombre = `Formato_electronico_NIIF_${slug(ins.denominacion)}_${ejercicio}.xlsx`;
    const salida = await wb.xlsx.writeBuffer();
    console.log(`[export-formato] reporte=${reporteId} respuestas=${escritas} archivo=${nombre}`);
    return new NextResponse(salida as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-formato] fallo al construir el formato:", err);
    return NextResponse.json({ error: "No se pudo construir el Formato electrónico." }, { status: 500 });
  }
}
