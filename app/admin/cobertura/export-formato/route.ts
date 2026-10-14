import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { llenarFormato } from "@/lib/formato/llenar";
import { insumosDelFormato } from "@/lib/formato/datos";
import { RUTA_PLANTILLA_FORMATO, HOJA_ESTRUCTURA, IMAGENES_EN_CELDA, leyendaDelFormato } from "@/lib/formato/plantilla";
import { ponerTexto, validarImagenesEnCelda } from "@/lib/formato/xlsx-xml";
import { agregarHoja, rutaDeHoja } from "@/lib/formato/zip";
import { pendienteEnTextoPlano } from "@/lib/suplemento/respuestas";

export const runtime = "nodejs";

// =============================================================================
// /admin/cobertura/export-formato?reporte=<id> — el Formato electrónico NIIF
// S1/S2 de la BMV, lleno por tipo de campo (encargo 2026-10-13, Paso 4).
//
// QUIÉN: staff y administrador del cliente (RLS acota al suyo). El AUDITOR NO:
// descarga el Excel de taxonomía, no el formato que presenta la emisora.
// CUÁNDO: solo con el generador encendido para la emisora y con respuestas del
// último documento APROBADO; si no, 409 con el motivo.
// CÓMO (revisión externa, punto 1): sobre una COPIA del asset, editando solo el
// XML de la columna K, de la «Tabla NIIF» y la hoja «Leyenda» nueva; las 23
// imágenes en celda (xl/richData, xl/metadata.xml) se copian intactas. Antes de
// entregar, el validador comprueba que siguen enlazadas y que ningún «#VALUE!»
// quedó suelto; si falla, 500 y no se entrega.
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
  const { ens, datos } = ins;
  const valores = llenarFormato(datos);

  try {
    const { data: blob, error } = await createAdminClient().storage.from("documentos").download(RUTA_PLANTILLA_FORMATO);
    if (error || !blob) {
      console.error("[export-formato] sin plantilla en Storage:", error?.message);
      return NextResponse.json({ error: "Falta la plantilla del Formato electrónico en la plataforma." }, { status: 500 });
    }
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const rutaEst = await rutaDeHoja(zip, HOJA_ESTRUCTURA);
    const rutaTabla = await rutaDeHoja(zip, "Tabla NIIF");
    if (!rutaEst) return NextResponse.json({ error: "La plantilla no trae la hoja de estructura." }, { status: 500 });

    // Columna K de la estructura.
    let est = await zip.file(rutaEst)!.async("string");
    let escritas = 0;
    for (const [fila, v] of valores) {
      if (!v.texto) continue;
      // Ninguna celda exportada empieza con «[» (CLAUDE.md §5, 1.10).
      est = ponerTexto(est, `K${fila}`, pendienteEnTextoPlano(v.texto));
      escritas++;
    }
    zip.file(rutaEst, est);

    // Hoja «Tabla NIIF»: riesgos y oportunidades desde los registros de clima.
    if (rutaTabla) {
      let tn = await zip.file(rutaTabla)!.async("string");
      let n = 3;
      const fila = (r: (typeof ens.registros)[number]) => {
        const siete = [r.nombre.replace(/\[DEMO\]\s*/i, "").trim(), r.descripcion ?? "", "Sí", TIPO_LABEL[r.tipo] ?? r.tipo, (r.horizontes ?? []).join(", "), r.impactos_potenciales ?? "", r.concentracion ?? ""];
        siete.forEach((x, i) => {
          if (x) tn = ponerTexto(tn, `${"ABCDEFG"[i]}${n}`, x);
        });
        n++;
      };
      for (const r of ens.registros.filter((x) => x.tipo !== "oportunidad")) fila(r);
      const opps = ens.registros.filter((x) => x.tipo === "oportunidad");
      if (opps.length) {
        n++;
        tn = ponerTexto(tn, `A${n}`, "OPORTUNIDADES");
        n++;
        for (const r of opps) fila(r);
      }
      zip.file(rutaTabla, tn);
    }

    await agregarHoja(zip, "Leyenda", leyendaDelFormato(datos.alivios, datos.perfil.actividades_financieras));

    // Validador de entrega: las imágenes en celda siguen enlazadas; ningún «#VALUE!» suelto.
    const hojas: Record<string, string> = {};
    for (const nombre of Object.keys(zip.files).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) hojas[nombre] = await zip.file(nombre)!.async("string");
    const problemas = validarImagenesEnCelda(hojas, Object.keys(zip.files), IMAGENES_EN_CELDA);
    if (problemas.length) {
      console.error("[export-formato] el validador de imágenes falló:", problemas.join("; "));
      return NextResponse.json({ error: "El Formato electrónico no pasó el validador de entrega (imágenes de la plantilla)." }, { status: 500 });
    }

    const nombre = `Formato_electronico_NIIF_${slug(ins.denominacion)}_${datos.ejercicio}.xlsx`;
    const salida = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
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
