import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ensamblarReporte, type Ensamblado } from "@/lib/reporte/ensamblar";
import { regimenDe } from "@/lib/perfil-emisor";
import type { DatosFormato, RespuestaLeida } from "@/lib/formato/llenar";

// =============================================================================
// Insumos del Formato electrónico (encargo 2026-10-13, Paso 4): lo que lee la
// ruta de descarga y la hoja de revisión, con la misma sesión y las mismas reglas.
// =============================================================================

type Db = SupabaseClient<Database>;
const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

export type TenantFormato = { nombre: string; slug: string | null; generador_activo: boolean; logo_url: string | null };

export type InsumosFormato =
  | { ok: true; datos: DatosFormato; tenant: TenantFormato; ens: Ensamblado; denominacion: string }
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

  // Booleanos: ¿la respuesta se apoya en una declaración negativa?
  const ids = [...new Set(filas.flatMap((f) => (f.hechos as string[] | null) ?? []))];
  const negativos = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: hs } = await db.from("hechos").select("id").in("id", ids.slice(i, i + 100)).eq("tipo", "declaracion_negativa");
    for (const h of hs ?? []) negativos.add(h.id);
  }
  const respuestas: RespuestaLeida[] = filas.map((f) => ({
    destino: f.destino as "taxonomia" | "formato",
    clave: f.clave,
    estado: f.estado as RespuestaLeida["estado"],
    texto: f.texto,
    hechosNegativos: ((f.hechos as string[] | null) ?? []).some((h) => negativos.has(h)),
  }));

  const [{ data: pe }, ens] = await Promise.all([
    db.from("perfil_emisor").select("denominacion_formal, clave_cotizacion, tipo_instrumento, fiduciario, numero_fideicomiso, hechos_posteriores, actividades_financieras, sector_sasb").eq("tenant_id", rep.tenant_id).maybeSingle(),
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
    return { tipo: r.tipo, nombre: r.nombre.replace(/\[DEMO\]\s*/i, "").trim(), horizontes: (r.horizontes ?? []).join(", "), cantidad: v?.cantidad_activos ?? null, porcentaje: v?.porcentaje ?? null, capital: partes.length ? `capital: ${partes.join(", ")}` : null };
  });

  // Documento aprobado del que salieron las respuestas: bloque 2 (declaración de
  // cumplimiento) y el libro de hechos de sus versiones (verificación por tercero).
  const documentoId = filas[0].documento_id;
  const { data: doc } = await db.from("documentos_generados").select("versiones_aprobadas").eq("id", documentoId).maybeSingle();
  const aprobadas = (doc?.versiones_aprobadas ?? {}) as Record<string, { id: string }>;
  let declaraCumplimiento = false;
  let declaracion: string | null = null;
  let verificacionTercero = false;
  if (aprobadas["2"]) {
    const { data: b2 } = await db.from("documentos_bloques_versiones").select("texto").eq("id", aprobadas["2"].id).maybeSingle();
    declaraCumplimiento = /de conformidad con las Normas NIIF S1 y (?:NIIF )?S2/i.test(b2?.texto ?? "");
    // La declaración es la oración del bloque 2 que la hace, tal cual (bloque de plantilla, sin hechos).
    declaracion = (b2?.texto ?? "").split(/\n+/).map((p) => p.trim()).find((p) => /de conformidad con las Normas NIIF S1/i.test(p)) ?? null;
  }
  if (aprobadas["30"]) {
    const { data: b30 } = await db.from("documentos_bloques_versiones").select("libro_id").eq("id", aprobadas["30"].id).maybeSingle();
    if (b30?.libro_id) {
      const { data: hs } = await db.from("hechos").select("enunciado").eq("libro_id", b30.libro_id).eq("estado", "vigente").eq("bloque_dueno", 30);
      verificacionTercero = (hs ?? []).some((h) => /verificad[oa] por (?:un )?tercero/i.test(h.enunciado));
    }
  }
  const objetivos = ens.objetivos
    .filter((o) => o.ambito === "climatico")
    .map((o) => {
      const det = ens.detallePorObjetivo.get(o.id);
      return { nombre: o.nombre.replace(/\[DEMO\]\s*/i, "").trim(), tipo_objetivo: o.tipo_objetivo ?? null, gases: det?.gases_cubiertos ?? null, alcances: det?.alcances_cubiertos ?? null, bruto_neto: det?.bruto_neto ?? null };
    });
  const cuestionarios: Record<string, (string | null)[]> = {};
  for (const q of [...ens.cuestionarios].sort((a, b) => a.pregunta_orden - b.pregunta_orden)) {
    (cuestionarios[q.hoja] ??= [])[q.pregunta_orden - 1] = q.respuesta;
  }

  return {
    ok: true,
    tenant,
    ens,
    denominacion: pe?.denominacion_formal ?? tenant.nombre,
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
        hechos_posteriores: pe?.hechos_posteriores ?? null,
        actividades_financieras: pe?.actividades_financieras ?? [],
        sector_sasb: pe?.sector_sasb ?? [],
      },
      hayLogo: !!tenant.logo_url,
      respuestas,
      gei,
      registros,
      objetivos,
      cuestionarios,
      declaraCumplimiento,
      declaracion,
      verificacionTercero,
    },
  };
}
