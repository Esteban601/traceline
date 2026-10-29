import type { SupabaseClient } from "@supabase/supabase-js";
import { declaracionDeCumplimiento } from "@/lib/suplemento/respuestas";
import type { Database } from "@/lib/database.types";
import { ensamblarReporte, type Ensamblado } from "@/lib/reporte/ensamblar";
import { regimenDe } from "@/lib/perfil-emisor";
import type { DatosFormato, RespuestaLeida } from "@/lib/formato/llenar";
import { clausulaDeVerificacion, insumosDeInstancias, instanciasDeMetricas, type InstanciaMetrica } from "@/lib/formato/instancias";
import { sinRemision } from "@/lib/suplemento/respuestas";

// =============================================================================
// Insumos del Formato electrónico (encargo 2026-10-13, Paso 4): lo que lee la
// ruta de descarga y la hoja de revisión, con la misma sesión y las mismas reglas.
// =============================================================================

type Db = SupabaseClient<Database>;
const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

export type TenantFormato = { nombre: string; slug: string | null; generador_activo: boolean; logo_url: string | null };

export type InsumosFormato =
  | { ok: true; datos: DatosFormato; tenant: TenantFormato; ens: Ensamblado; denominacion: string; descripciones: Record<string, string>; instancias: { riesgos: InstanciaMetrica[]; oportunidades: InstanciaMetrica[] } }
  | { ok: false; status: 404 | 409 | 500; error: string };

export async function insumosDelFormato(db: Db, reporteId: string): Promise<InsumosFormato> {
  const { data: rep } = await db
    .from("reportes")
    .select("id, tenant_id, ejercicio, anio_adopcion, tenant:tenants!reportes_tenant_id_fkey(nombre, slug, generador_activo, logo_url)")
    .eq("id", reporteId)
    .maybeSingle();
  if (!rep) return { ok: false, status: 404, error: "El reporte no existe o no tienes acceso a él." };
  const tenant = rep.tenant as unknown as TenantFormato | null;
  if (!tenant?.generador_activo) return { ok: false, status: 409, error: "El generador del suplemento está apagado para esta emisora: el Formato electrónico no se ofrece." };

  const { data: filas } = await db.from("respuestas_datapoint").select("documento_id, destino, clave, estado, texto, hechos").eq("reporte_id", reporteId);
  if (!filas?.length) return { ok: false, status: 409, error: "El Formato electrónico se genera desde el suplemento aprobado; aún no hay un documento aprobado con sus respuestas." };

  // Los booleanos ya no se deciden por el tipo de los hechos anclados: leen el «Sí.»/«No.» de su respuesta propia
  // (D1 del encargo formato-afirmaciones-y-voz; lib/formato/booleanos.ts).
  const respuestas: RespuestaLeida[] = filas.map((f) => ({
    destino: f.destino as "taxonomia" | "formato",
    clave: f.clave,
    estado: f.estado as RespuestaLeida["estado"],
    texto: f.texto,
  }));

  const [{ data: pe }, ens] = await Promise.all([
    db.from("perfil_emisor").select("denominacion_formal, clave_cotizacion, tipo_instrumento, fiduciario, numero_fideicomiso, fideicomitente, administrador_patrimonio, hechos_posteriores, actividades_financieras, sector_sasb, metricas_industria").eq("tenant_id", rep.tenant_id).maybeSingle(),
    ensamblarReporte(db, reporteId),
  ]);
  if (!ens.ok) return { ok: false, status: 500, error: "No se pudo leer el reporte." };
  const ejercicio = ens.reporte.ejercicio;

  // Emisiones del ejercicio por alcance (capturas confirmadas, como el Word).
  const gei = (["1", "2"] as const).flatMap((a) => {
    const s = ens.solicitudes.find((x) => x.rubro_taxonomia === `gei_alcance_${a}`);
    const e = s ? ens.entregaPorSolicitud.get(s.id) : null;
    return s && e?.estado === "entregado" && e.valor != null ? [{ alcance: `Alcance ${a}`, valor: `${NUM.format(e.valor)}${s.unidad_esperada ? ` ${s.unidad_esperada}` : ""}` }] : [];
  });
  const registros = ens.registros.map((r) => {
    const v = ens.vigentePorRegistro.get(r.id)?.get(ejercicio);
    const partes = v ? ([["gasto", v.capital_gasto], ["financiación", v.capital_financiacion], ["inversión", v.capital_inversion]] as const).filter(([, x]) => x != null).map(([k, x]) => `${k} ${NUM.format(x as number)}`) : [];
    return { tipo: r.tipo, nombre: r.nombre.replace(/\[DEMO\]\s*/i, "").trim(), horizontes: (r.horizontes ?? []).join(", "), concentracion: r.concentracion ?? null, descripcion: r.descripcion ?? null, cantidad: v?.cantidad_activos ?? null, porcentaje: v?.porcentaje ?? null, capital: partes.length ? `capital: ${partes.join(", ")}` : null };
  });

  // Documento aprobado del que salieron las respuestas: bloque 2 (declaración de
  // cumplimiento) y el libro de hechos de sus versiones (verificación por tercero).
  const documentoId = filas[0].documento_id;
  const { data: doc } = await db.from("documentos_generados").select("versiones_aprobadas").eq("id", documentoId).maybeSingle();
  const aprobadas = (doc?.versiones_aprobadas ?? {}) as Record<string, { id: string }>;
  // Regla 1 de Esteban (13 de octubre): «Sí» solo con cero pendientes y cero «parcial» en la cobertura aprobada.
  const { data: vers } = await db.from("documentos_bloques_versiones").select("numero, respaldo, pendientes").in("id", Object.values(aprobadas).map((v) => v.id).concat(["00000000-0000-0000-0000-000000000000"]));
  const parciales: string[] = [];
  let pendientesDoc = 0;
  for (const v of vers ?? []) {
    for (const c of ((v.respaldo as { cobertura?: { codigo: string; estado: string }[] } | null)?.cobertura ?? [])) if (c.estado === "parcial") parciales.push(c.codigo);
    pendientesDoc += ((v.pendientes as { campo: string }[] | null) ?? []).filter((p) => p.campo !== "nota_revision").length;
  }
  let declaraCumplimiento = false;
  let declaracion: string | null = null;
  if (aprobadas["2"]) {
    const { data: b2 } = await db.from("documentos_bloques_versiones").select("texto").eq("id", aprobadas["2"].id).maybeSingle();
    declaraCumplimiento = /de conformidad con las Normas NIIF S1 y (?:NIIF )?S2/i.test(b2?.texto ?? "");
    // La declaración es la oración del bloque 2 que la hace, tal cual (bloque de plantilla, sin hechos).
    declaracion = declaracionDeCumplimiento(b2?.texto ?? null);
  }
  // Instancias de métricas NIIF S1 46–50: la misma fuente que la hoja «NIIF S1 46-50» del Excel de taxonomía.
  const metodoGei = respuestas.find((r) => r.clave === "NIIF S2 29 (a)(iii)" && r.destino === "formato" && r.estado === "respuesta")?.texto
    ?? respuestas.find((r) => r.clave === "NIIF S2 29 (a)(iii)" && r.estado === "respuesta")?.texto ?? null;
  const instancias = instanciasDeMetricas(insumosDeInstancias(ens, {
    metodoGei: metodoGei ? sinRemision(metodoGei) : null,
    verificacionGei: await verificacionGeiDelDocumento(db, documentoId),
    hayDocumentoAprobado: true,
  }));
  const objetivos = ens.objetivos
    .filter((o) => o.ambito === "climatico")
    .map((o) => {
      const det = ens.detallePorObjetivo.get(o.id);
      return {
        nombre: o.nombre.replace(/\[DEMO\]\s*/i, "").trim(), origen: o.origen_objetivo ?? null, tipo_objetivo: o.tipo_objetivo ?? null,
        gases: det?.gases_cubiertos ?? null, alcances: det?.alcances_cubiertos ?? null, bruto_neto: det?.bruto_neto ?? null,
        descripcion: o.descripcion ?? null, metrica: o.metrica ?? null, parte_entidad: o.parte_entidad ?? null, periodo_aplicacion: o.periodo_aplicacion ?? null,
        periodo_base: o.periodo_base ?? null, hito_intermedio: o.hito_intermedio ?? null, alineacion: o.alineacion_acuerdo_internacional ?? null,
        proposito: o.proposito_objetivo ?? null,
        validacion_tercero: det?.validacion_tercero ?? null, procesos_revision: det?.procesos_revision ?? null, metricas_supervision: det?.metricas_supervision ?? null,
        revisiones: det?.revisiones ?? null, resultados: det?.resultados ?? null, analisis_tendencias: det?.analisis_tendencias ?? null,
        enfoque_descarbonizacion: det?.enfoque_descarbonizacion ?? null,
      };
    });
  const { data: cat } = await db.from("datapoints_taxonomia").select("codigo, descripcion").in("codigo", ["NIIF S2 29 (a)(i)", "NIIF S2 29 (b)", "NIIF S2 29 (c)", "NIIF S2 29 (d)", "NIIF S2 29 (e)"]);
  const descripciones: Record<string, string> = Object.fromEntries((cat ?? []).map((x) => [x.codigo, x.descripcion]));
  const cuestionarios: Record<string, (string | null)[]> = {};
  for (const q of [...ens.cuestionarios].sort((a, b) => a.pregunta_orden - b.pregunta_orden)) {
    (cuestionarios[q.hoja] ??= [])[q.pregunta_orden - 1] = q.respuesta;
  }

  return {
    ok: true,
    tenant,
    ens,
    denominacion: pe?.denominacion_formal ?? tenant.nombre,
    descripciones,
    datos: {
      ejercicio,
      primerAnio: regimenDe(ejercicio, rep.anio_adopcion) === "primer_anio",
      alivios: ens.reporte.aliviosVigentes,
      perfil: {
        denominacion_formal: pe?.denominacion_formal ?? null,
        clave_cotizacion: pe?.clave_cotizacion ?? null,
        tipo_instrumento: pe?.tipo_instrumento ?? null,
        fiduciario: pe?.fiduciario ?? null,
        numero_fideicomiso: pe?.numero_fideicomiso ?? null,
        fideicomitente: pe?.fideicomitente ?? null,
        administrador_patrimonio: pe?.administrador_patrimonio ?? null,
        hechos_posteriores: pe?.hechos_posteriores ?? null,
        actividades_financieras: pe?.actividades_financieras ?? [],
        sector_sasb: pe?.sector_sasb ?? [],
        metricas_industria: pe?.metricas_industria ?? null,
      },
      hayLogo: !!tenant.logo_url,
      respuestas,
      gei,
      registros,
      objetivos,
      cuestionarios,
      declaraCumplimiento,
      declaracion,
      cumplimiento: { parciales, pendientes: pendientesDoc },
    },
    instancias,
  };
}

/**
 * La cláusula de verificación externa del inventario GEI en el libro del bloque
 * 30 del documento APROBADO («inventario verificado por …, con aseguramiento
 * limitado.»), o null. La usan el Formato y el Excel de taxonomía.
 */
export async function verificacionGeiDelDocumento(db: Db, documentoId: string | null): Promise<string | null> {
  if (!documentoId) return null;
  const { data: doc } = await db.from("documentos_generados").select("versiones_aprobadas").eq("id", documentoId).maybeSingle();
  const v30 = ((doc?.versiones_aprobadas ?? {}) as Record<string, { id: string }>)["30"];
  if (!v30) return null;
  const { data: b30 } = await db.from("documentos_bloques_versiones").select("libro_id").eq("id", v30.id).maybeSingle();
  if (!b30?.libro_id) return null;
  const { data: hs } = await db.from("hechos").select("enunciado").eq("libro_id", b30.libro_id).eq("estado", "vigente").eq("bloque_dueno", 30);
  const h = (hs ?? []).find((x) => /verificad[oa] por/i.test(x.enunciado) && /aseguramiento (?:limitado|razonable)/i.test(x.enunciado)) ?? (hs ?? []).find((x) => /verificad[oa] por/i.test(x.enunciado));
  return clausulaDeVerificacion(h?.enunciado ?? null);
}
