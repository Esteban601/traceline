"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";

export type PlantillaState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  plantillaId?: string | null;
  reporteId?: string | null;
};

/**
 * Guarda el set de solicitudes de un reporte como una plantilla nombrada:
 * título, descripción, área, cuantitativa, unidad, orden y el mapeo a datapoints
 * (como snapshot). SIN estados ni evidencia. Las plantillas son globales de la
 * firma (solo staff).
 */
export async function guardarComoPlantilla(
  _prev: PlantillaState,
  fd: FormData
): Promise<PlantillaState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const reporteId = String(fd.get("reporte_id") ?? "").trim();
  const nombre = String(fd.get("nombre") ?? "").trim();
  const descripcion = String(fd.get("descripcion") ?? "").trim() || null;

  if (!reporteId) return { ok: false, error: "Selecciona el reporte de origen." };
  if (!nombre) return { ok: false, error: "Ponle nombre a la plantilla." };

  const db = await createClient();

  const { data: reporte } = await db
    .from("reportes")
    .select("id")
    .eq("id", reporteId)
    .single();
  if (!reporte) return { ok: false, error: "El reporte no existe." };

  const { data: sols, error: solErr } = await db
    .from("solicitudes")
    .select("id, titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, orden")
    .eq("reporte_id", reporteId)
    .order("orden", { ascending: true });
  if (solErr) return { ok: false, error: "No se pudieron leer las solicitudes." };
  if (!sols || sols.length === 0) {
    return { ok: false, error: "El reporte no tiene solicitudes para guardar." };
  }

  // Mapeo a datapoints por solicitud.
  const { data: mapeo } = await db
    .from("mapeo_solicitud_datapoint")
    .select("solicitud_id, datapoint_id")
    .in(
      "solicitud_id",
      sols.map((s) => s.id)
    );
  const dpPorSol = new Map<string, string[]>();
  for (const m of mapeo ?? []) {
    const arr = dpPorSol.get(m.solicitud_id) ?? [];
    arr.push(m.datapoint_id);
    dpPorSol.set(m.solicitud_id, arr);
  }

  const { data: plantilla, error: plErr } = await db
    .from("plantillas")
    .insert({ nombre, descripcion, creado_por: perfil.id })
    .select("id")
    .single();
  if (plErr || !plantilla) return { ok: false, error: "No se pudo crear la plantilla." };

  const { error: itemsErr } = await db.from("plantilla_solicitudes").insert(
    sols.map((s) => ({
      plantilla_id: plantilla.id,
      titulo: s.titulo,
      descripcion: s.descripcion,
      area_asignada: s.area_asignada,
      es_cuantitativa: s.es_cuantitativa,
      unidad_esperada: s.unidad_esperada,
      orden: s.orden,
      datapoint_ids: dpPorSol.get(s.id) ?? [],
    }))
  );
  if (itemsErr) {
    // Sin ítems la plantilla no sirve; se limpia (cascade borra lo insertado).
    await db.from("plantillas").delete().eq("id", plantilla.id);
    return { ok: false, error: "No se pudieron guardar las solicitudes de la plantilla." };
  }

  await logEvento(db, {
    tenantId: null, // las plantillas son globales de la firma
    usuarioId: perfil.id,
    accion: "plantilla_creada",
    entidad: "plantillas",
    entidadId: plantilla.id,
    detalle: { nombre, solicitudes: sols.length, reporte_id: reporteId },
  });

  revalidatePath("/admin/plantillas");
  return {
    ok: true,
    error: null,
    plantillaId: plantilla.id,
    mensaje: `Plantilla creada con ${sols.length} solicitudes.`,
  };
}

/**
 * Crea un reporte nuevo clonando las solicitudes de una plantilla: todas en
 * 'pendiente', sin responsables (se asignan después). Reconstruye el mapeo a
 * datapoints desde el snapshot de la plantilla.
 */
export async function crearReporteDesdePlantilla(
  _prev: PlantillaState,
  fd: FormData
): Promise<PlantillaState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const plantillaId = String(fd.get("plantilla_id") ?? "").trim();
  const tenantId = String(fd.get("tenant_id") ?? "").trim();
  const nombre = String(fd.get("nombre") ?? "").trim();
  const ejercicioRaw = String(fd.get("ejercicio") ?? "").trim();

  if (!plantillaId) return { ok: false, error: "Plantilla no válida." };
  if (!tenantId) return { ok: false, error: "Selecciona el cliente (tenant)." };
  if (!nombre) return { ok: false, error: "Ponle nombre al reporte." };
  if (!/^\d{4}$/.test(ejercicioRaw)) {
    return { ok: false, error: "El ejercicio debe ser un año de 4 dígitos." };
  }
  const ejercicio = Number(ejercicioRaw);

  const db = await createClient();

  const [{ data: tenant }, { data: plantilla }, { data: items, error: itErr }] =
    await Promise.all([
      db.from("tenants").select("id, nombre").eq("id", tenantId).single(),
      db.from("plantillas").select("id, nombre").eq("id", plantillaId).single(),
      db
        .from("plantilla_solicitudes")
        .select("titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, orden, datapoint_ids")
        .eq("plantilla_id", plantillaId)
        .order("orden", { ascending: true }),
    ]);

  if (!tenant) return { ok: false, error: "El cliente (tenant) no existe." };
  if (!plantilla) return { ok: false, error: "La plantilla no existe." };
  if (itErr) return { ok: false, error: "No se pudieron leer las solicitudes de la plantilla." };
  if (!items || items.length === 0) {
    return { ok: false, error: "La plantilla no tiene solicitudes." };
  }

  const { data: reporte, error: repErr } = await db
    .from("reportes")
    .insert({ tenant_id: tenantId, nombre, ejercicio, estado: "activo" })
    .select("id")
    .single();
  if (repErr || !reporte) return { ok: false, error: "No se pudo crear el reporte." };

  // Clonar cada solicitud (pendiente, sin responsables) y su mapeo.
  let clonadas = 0;
  for (const it of items) {
    const { data: nueva, error: sErr } = await db
      .from("solicitudes")
      .insert({
        reporte_id: reporte.id,
        titulo: it.titulo,
        descripcion: it.descripcion,
        area_asignada: it.area_asignada,
        es_cuantitativa: it.es_cuantitativa,
        unidad_esperada: it.unidad_esperada,
        orden: it.orden,
        // estado 'pendiente' por default; responsables sin asignar.
      })
      .select("id")
      .single();
    if (sErr || !nueva) continue;
    clonadas += 1;

    const dps = (it.datapoint_ids ?? []).filter(Boolean);
    if (dps.length > 0) {
      await db
        .from("mapeo_solicitud_datapoint")
        .insert(dps.map((datapoint_id) => ({ solicitud_id: nueva.id, datapoint_id })));
    }
  }

  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: "reporte_creado_desde_plantilla",
    entidad: "reportes",
    entidadId: reporte.id,
    detalle: {
      nombre,
      ejercicio,
      plantilla: plantilla.nombre,
      plantilla_id: plantillaId,
      solicitudes: clonadas,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/plantillas");
  return {
    ok: true,
    error: null,
    reporteId: reporte.id,
    mensaje: `Reporte creado con ${clonadas} solicitudes en estado pendiente.`,
  };
}
