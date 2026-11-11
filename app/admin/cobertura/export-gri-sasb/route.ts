import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, puedeEntrarPanel } from "@/lib/data";
import { registrarActividadAuditor } from "@/lib/auditoria";
import { aplicaAEmisora, industriasSasb } from "@/lib/catalogo-marcos";
import { armarLibroGriSasb, type FilaGriSasb } from "@/lib/excel/gri-sasb";

export const runtime = "nodejs";

// =============================================================================
// LIBRO GRI/SASB de un reporte (encargo 2026-10-31-catalogo-gri-sasb). Aparte del Excel de taxonomía, que sigue
// siendo solo NIIF y no se toca. Mismo acceso que el Excel de taxonomía: staff, administrador del cliente y
// auditor; RLS acota cada consulta al tenant de quien descarga. Qué lleva: lib/excel/gri-sasb.ts.
// =============================================================================

export async function GET(request: Request) {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return NextResponse.json({ error: "Acceso reservado al panel de seguimiento." }, { status: 403 });
  }
  await registrarActividadAuditor(perfil, { tipo: "descarga_excel", objetoTipo: "Libro GRI/SASB" });

  const reporteId = new URL(request.url).searchParams.get("reporte");
  if (!reporteId) {
    return NextResponse.json({ error: "Falta el reporte: /admin/cobertura/export-gri-sasb?reporte=<id>." }, { status: 400 });
  }

  const db = await createClient();
  try {
    const { data: reporte } = await db
      .from("reportes")
      .select("id, ejercicio, tenant_id, tenant:tenants!reportes_tenant_id_fkey(nombre, slug, es_demo, generador_activo)")
      .eq("id", reporteId)
      .maybeSingle();
    if (!reporte) return NextResponse.json({ error: "El reporte no existe o no tienes acceso a él." }, { status: 404 });
    const tenant = reporte.tenant as unknown as { nombre: string; slug: string | null; es_demo: boolean; generador_activo: boolean } | null;

    const [{ data: catalogo, error: eCat }, { data: perfilEmisor }] = await Promise.all([
      db
        .from("datapoints_taxonomia")
        .select("codigo, marco, estandar, edicion, descripcion")
        .in("marco", ["GRI", "SASB"])
        .eq("activo", true)
        .eq("version_taxonomia", "2025"),
      db.from("perfil_emisor").select("sector_sasb").eq("tenant_id", reporte.tenant_id).maybeSingle(),
    ]);
    if (eCat) return NextResponse.json({ error: "No se pudo leer el catálogo." }, { status: 500 });
    const industrias = industriasSasb(perfilEmisor?.sector_sasb);
    const filas = ((catalogo ?? []) as FilaGriSasb[]).filter((d) => aplicaAEmisora(d, industrias));
    if (!filas.length) return NextResponse.json({ error: "El catálogo no tiene contenidos GRI ni métricas SASB para esta emisora." }, { status: 422 });

    // Respuestas: como la columna del Excel de taxonomía, solo con el generador encendido y del último documento aprobado.
    let respuestas: Map<string, string> | null = null;
    if (tenant?.generador_activo === true) {
      const { data: rs } = await db
        .from("respuestas_datapoint")
        .select("clave, texto")
        .eq("reporte_id", reporteId)
        .eq("destino", "taxonomia")
        .in("clave", filas.map((f) => f.codigo));
      respuestas = new Map((rs ?? []).filter((r) => r.texto).map((r) => [r.clave.trim(), r.texto as string]));
    }

    const { wb, hojas } = armarLibroGriSasb({
      filas,
      respuestas,
      titulo: `Índice GRI/SASB · ${reporte.ejercicio}`,
      esDemo: tenant?.es_demo === true,
    });
    const slug = tenant?.slug ?? "reporte";
    const filename = `gri-sasb-${slug}-${reporte.ejercicio}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const salida = await wb.xlsx.writeBuffer();
    console.log(
      `[export-gri-sasb] reporte=${reporteId} hojas=${hojas.map((h) => `${h.nombre}:${h.filas}`).join(",")} ` +
        `respuestas=${respuestas ? `${[...respuestas.keys()].length}/${filas.length}` : "sin generador"} archivo=${filename}`
    );
    return new NextResponse(salida as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-gri-sasb] fallo al construir el libro:", err);
    return NextResponse.json({ error: "No se pudo construir el libro GRI/SASB." }, { status: 500 });
  }
}
