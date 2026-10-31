import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { bloquesIterados, booleanosVaciosPorContradiccion, llenarFormato } from "@/lib/formato/llenar";
import { SECCION_OBJETIVOS, bloquesDeObjetivos, expandirObjetivos } from "@/lib/formato/objetivos";
import { expandirMetricas, SECCION_METRICAS } from "@/lib/formato/metricas";
import { insumosDelFormato } from "@/lib/formato/datos";
import { RUTA_PLANTILLA_FORMATO, HOJA_ESTRUCTURA, IMAGENES_EN_CELDA } from "@/lib/formato/plantilla";
import { celdasConCorchete, opcionesDeListas, ponerTexto, validarImagenesEnCelda } from "@/lib/formato/xlsx-xml";
import { escribirMetricasSasb, filasMetricasSasb } from "@/lib/formato/metricas-sasb";
import { industriaDe, industriasSasb } from "@/lib/catalogo-marcos";
import type { EstadoRespuesta } from "@/lib/suplemento/respuestas";
import { rutaDeHoja } from "@/lib/formato/zip";
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
  // Informe del validador (D1): booleanos que quedaron vacíos porque la respuesta narrativa los contradice.
  for (const b of booleanosVaciosPorContradiccion(valores, datos.objetivos.length)) {
    console.warn(`[export-formato] reporte=${reporteId} booleano vacío ${b.celda} (fila ${b.fila}): valor propuesto «${b.valor}», contradicho por «${b.oracion}»`);
  }

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
      // Las secciones de métricas S1 46–50 y de objetivos (con bloques por objetivo) se escriben al expandirlas, abajo.
      if (!v.texto || (fila >= SECCION_METRICAS.desde && fila <= SECCION_METRICAS.hasta)) continue;
      if (datos.objetivos.length && fila >= SECCION_OBJETIVOS.desde && fila <= SECCION_OBJETIVOS.hasta) continue;
      // Ninguna celda exportada empieza con «[» (CLAUDE.md §5, 1.10).
      est = ponerTexto(est, `K${fila}`, pendienteEnTextoPlano(v.texto));
      escritas++;
    }
    // Objetivos (NIIF S1 51 y S2 33–36): un bloque «Objetivo N» por objetivo, en coordenadas de la plantilla, antes de
    // expandir las métricas (que están antes en la hoja y desplazan todo lo de después).
    est = expandirObjetivos(est, bloquesDeObjetivos(datos.objetivos, valores, !!datos.alivios.E5)).xml;
    // Métricas S1 46–50: una copia del bloque por métrica de NIIF S2 29 de cada riesgo u oportunidad.
    const it = bloquesIterados(valores, ins.instancias);
    est = expandirMetricas(est, it.riesgos, it.oportunidades).xml;
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

    // Hoja «Métricas SASB»: las métricas de la industria del Perfil con su respuesta (encargo catalogo-gri-sasb).
    let metricasSasb = "sin sector SASB";
    const industrias = industriasSasb(datos.perfil.sector_sasb);
    const rutaSasb = industrias.size ? await rutaDeHoja(zip, "Métricas SASB") : null;
    if (rutaSasb) {
      const { data: cat } = await db
        .from("datapoints_taxonomia")
        .select("codigo, descripcion, estandar")
        .eq("marco", "SASB")
        .eq("activo", true)
        .eq("version_taxonomia", "2025");
      const metricas = (cat ?? []).filter((m) => industrias.has(industriaDe(m.estandar) ?? ""));
      const { data: rs } = metricas.length
        ? await db.from("respuestas_datapoint").select("clave, estado, texto").eq("reporte_id", reporteId).eq("destino", "taxonomia").in("clave", metricas.map((m) => m.codigo))
        : { data: [] };
      const respuestas = new Map((rs ?? []).map((r) => [r.clave, { estado: r.estado as EstadoRespuesta, texto: r.texto }]));
      const r = escribirMetricasSasb(await zip.file(rutaSasb)!.async("string"), filasMetricasSasb(metricas, respuestas));
      zip.file(rutaSasb, r.xml);
      metricasSasb = `${metricas.length} métricas, ${r.conRespuesta} con respuesta`;
    }

    // Validador de entrega: las imágenes en celda siguen enlazadas; ningún «#VALUE!» suelto.
    const hojas: Record<string, string> = {};
    for (const nombre of Object.keys(zip.files).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) hojas[nombre] = await zip.file(nombre)!.async("string");
    const problemas = validarImagenesEnCelda(hojas, Object.keys(zip.files), IMAGENES_EN_CELDA);
    const opciones = opcionesDeListas((await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "");
    const conCorchete = celdasConCorchete(est, "K", opciones);
    if (conCorchete.length) problemas.push(`celdas K con «[»: ${conCorchete.join(", ")}`);
    if (problemas.length) {
      console.error("[export-formato] el validador de imágenes falló:", problemas.join("; "));
      return NextResponse.json({ error: `El Formato electrónico no pasó el validador de entrega: ${problemas.join("; ")}.` }, { status: 500 });
    }

    const nombre = `Formato_electronico_NIIF_${slug(ins.denominacion)}_${datos.ejercicio}.xlsx`;
    const salida = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    console.log(`[export-formato] reporte=${reporteId} respuestas=${escritas} métricas SASB: ${metricasSasb} archivo=${nombre}`);
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
