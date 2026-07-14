"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";

export type ObjetivoState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  objetivoId?: string | null;
};
export type ActivoObjetivoState = { ok: boolean; error?: string | null; mensaje?: string | null };

const AMBITOS = ["climatico", "sostenibilidad"] as const;
const NATURALEZAS = ["riesgo", "oportunidad"] as const;

function texto(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}
function numero(fd: FormData, k: string): number | null {
  const raw = String(fd.get(k) ?? "").trim().replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** tenant del reporte, para la bitácora. */
async function tenantDeReporte(
  db: Awaited<ReturnType<typeof createClient>>,
  reporteId: string
): Promise<string | null> {
  const { data } = await db.from("reportes").select("tenant_id").eq("id", reporteId).single();
  return data?.tenant_id ?? null;
}

/** Campos de la ficha 1:1 (hojas hermanas S2 34/35/36). */
function ficha(fd: FormData) {
  return {
    validacion_tercero: texto(fd, "validacion_tercero"),
    procesos_revision: texto(fd, "procesos_revision"),
    metricas_supervision: texto(fd, "metricas_supervision"),
    revisiones: texto(fd, "revisiones"),
    resultados: texto(fd, "resultados"),
    analisis_tendencias: texto(fd, "analisis_tendencias"),
    gases_cubiertos: texto(fd, "gases_cubiertos"),
    alcances_cubiertos: texto(fd, "alcances_cubiertos"),
    bruto_neto: texto(fd, "bruto_neto"),
    enfoque_descarbonizacion: texto(fd, "enfoque_descarbonizacion"),
    notas: texto(fd, "notas"),
  };
}
const fichaTieneDatos = (f: ReturnType<typeof ficha>) =>
  Object.values(f).some((v) => v != null);

/** Campos base de la definición del objetivo (S2 33 / S1 51). */
function base(fd: FormData) {
  return {
    nombre: texto(fd, "nombre"),
    descripcion: texto(fd, "descripcion"),
    tipo: texto(fd, "tipo"),
    metrica: texto(fd, "metrica"),
    meta: texto(fd, "meta"),
    parte_entidad: texto(fd, "parte_entidad"),
    periodo_aplicacion: texto(fd, "periodo_aplicacion"),
    periodo_base: texto(fd, "periodo_base"),
    hito_intermedio: texto(fd, "hito_intermedio"),
    tipo_objetivo: texto(fd, "tipo_objetivo"),
    alineacion_acuerdo_internacional: texto(fd, "alineacion_acuerdo_internacional"),
  };
}

// -----------------------------------------------------------------------------
// Crear objetivo (definición + ficha en una sola alta)
// -----------------------------------------------------------------------------
export async function crearObjetivo(
  _prev: ObjetivoState,
  fd: FormData
): Promise<ObjetivoState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const reporteId = texto(fd, "reporte_id");
  const ambito = texto(fd, "ambito");
  const naturaleza = texto(fd, "naturaleza");
  const b = base(fd);
  if (!reporteId) return { ok: false, error: "Selecciona el reporte." };
  if (!ambito || !AMBITOS.includes(ambito as (typeof AMBITOS)[number]))
    return { ok: false, error: "Ámbito no válido." };
  if (!naturaleza || !NATURALEZAS.includes(naturaleza as (typeof NATURALEZAS)[number]))
    return { ok: false, error: "Naturaleza no válida." };
  if (!b.nombre) return { ok: false, error: "El nombre es obligatorio." };

  const db = await createClient();

  // Orden por defecto: al final del reporte dentro de su ámbito.
  let orden = numero(fd, "orden");
  if (orden == null) {
    const { data: maxRow } = await db
      .from("objetivos")
      .select("orden")
      .eq("reporte_id", reporteId)
      .eq("ambito", ambito)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    orden = (maxRow?.orden ?? 0) + 10;
  }

  const { data: creado, error } = await db
    .from("objetivos")
    .insert({ reporte_id: reporteId, ambito, naturaleza, ...b, nombre: b.nombre!, orden })
    .select("id")
    .single();
  if (error || !creado) return { ok: false, error: "No se pudo crear el objetivo." };

  const f = ficha(fd);
  if (fichaTieneDatos(f)) {
    const { error: eDet } = await db
      .from("objetivos_detalle")
      .insert({ objetivo_id: creado.id, ...f });
    if (eDet) return { ok: false, error: "El objetivo se creó, pero falló su ficha." };
  }

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, reporteId),
    usuarioId: perfil.id,
    accion: "objetivo_creado",
    entidad: "objetivos",
    entidadId: creado.id,
    detalle: { nombre: b.nombre, ambito, naturaleza },
  });

  revalidatePath("/admin/objetivos");
  return { ok: true, error: null, mensaje: "Objetivo creado.", objetivoId: creado.id };
}

// -----------------------------------------------------------------------------
// Editar objetivo (definición + ficha 1:1 editable — todo cambio a bitácora)
// -----------------------------------------------------------------------------
export async function editarObjetivo(
  _prev: ObjetivoState,
  fd: FormData
): Promise<ObjetivoState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const objetivoId = texto(fd, "objetivo_id");
  const ambito = texto(fd, "ambito");
  const naturaleza = texto(fd, "naturaleza");
  const b = base(fd);
  if (!objetivoId) return { ok: false, error: "Objetivo no válido." };
  if (!ambito || !AMBITOS.includes(ambito as (typeof AMBITOS)[number]))
    return { ok: false, error: "Ámbito no válido." };
  if (!naturaleza || !NATURALEZAS.includes(naturaleza as (typeof NATURALEZAS)[number]))
    return { ok: false, error: "Naturaleza no válida." };
  if (!b.nombre) return { ok: false, error: "El nombre es obligatorio." };

  const db = await createClient();
  const { data: obj } = await db
    .from("objetivos")
    .select("id, reporte_id")
    .eq("id", objetivoId)
    .single();
  if (!obj) return { ok: false, error: "No se encontró el objetivo." };

  const { error } = await db
    .from("objetivos")
    .update({ ambito, naturaleza, ...b, nombre: b.nombre! })
    .eq("id", objetivoId);
  if (error) return { ok: false, error: "No se pudo guardar el objetivo." };

  // Ficha 1:1: upsert (la relación es única por objetivo_id).
  const f = ficha(fd);
  const { error: eDet } = await db
    .from("objetivos_detalle")
    .upsert(
      { objetivo_id: objetivoId, ...f, updated_at: new Date().toISOString() },
      { onConflict: "objetivo_id" }
    );
  if (eDet) return { ok: false, error: "No se pudo guardar la ficha del objetivo." };

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, obj.reporte_id),
    usuarioId: perfil.id,
    accion: "objetivo_editado",
    entidad: "objetivos",
    entidadId: objetivoId,
    detalle: { nombre: b.nombre, ambito, naturaleza },
  });

  revalidatePath("/admin/objetivos");
  return { ok: true, error: null, mensaje: "Objetivo actualizado.", objetivoId };
}

// -----------------------------------------------------------------------------
// Activar / desactivar (nunca borrar — trazabilidad)
// -----------------------------------------------------------------------------
export async function cambiarActivoObjetivo(
  objetivoId: string,
  activar: boolean
): Promise<ActivoObjetivoState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (!objetivoId) return { ok: false, error: "Objetivo no válido." };

  const db = await createClient();
  const { data: obj } = await db
    .from("objetivos")
    .select("id, reporte_id, nombre")
    .eq("id", objetivoId)
    .single();
  if (!obj) return { ok: false, error: "No se encontró el objetivo." };

  const { error } = await db
    .from("objetivos")
    .update({ activo: activar })
    .eq("id", objetivoId);
  if (error) return { ok: false, error: "No se pudo actualizar el objetivo." };

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, obj.reporte_id),
    usuarioId: perfil.id,
    accion: activar ? "objetivo_reactivado" : "objetivo_desactivado",
    entidad: "objetivos",
    entidadId: objetivoId,
    detalle: { nombre: obj.nombre },
  });

  revalidatePath("/admin/objetivos");
  return {
    ok: true,
    error: null,
    mensaje: activar ? "Objetivo reactivado." : "Objetivo desactivado.",
  };
}
