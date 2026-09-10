"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";

export type RegistroState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  registroId?: string | null;
};
export type ValorState = { ok: boolean; error?: string | null; mensaje?: string | null };
export type ActivoRegistroState = { ok: boolean; error?: string | null; mensaje?: string | null };

const TIPOS = ["riesgo_fisico", "riesgo_transicion", "oportunidad"] as const;
const HORIZONTES = ["Corto plazo", "Mediano plazo", "Largo plazo"] as const;

function texto(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

/**
 * Horizontes temporales (multi-enum). Acepta las opciones canónicas y conserva
 * valores libres preexistentes que el cliente reenvíe (preserva-ajeno). Devuelve
 * el array deduplicado, en el orden canónico primero.
 */
function horizontes(fd: FormData): string[] {
  const crudos = fd
    .getAll("horizontes")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const set = new Set(crudos);
  const canon = HORIZONTES.filter((h) => set.has(h));
  const ajenos = [...set].filter((h) => !(HORIZONTES as readonly string[]).includes(h));
  return [...canon, ...ajenos];
}
function numero(fd: FormData, k: string): number | null {
  const raw = String(fd.get(k) ?? "").trim().replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Priorización: probabilidad × impacto = severidad, o la severidad capturada a
 * secas. §5 admite las dos formas porque no todos los clientes entregan los dos
 * factores; el que solo da el puntaje no debe verse obligado a inventarlos.
 *
 * `nivel` NO se calcula aquí: depende de la matriz del perfil del emisor, que es
 * de la emisora y puede cambiar. Se resuelve al pintar, contra la matriz vigente.
 */
function priorizacion(fd: FormData): {
  probabilidad: number | null;
  impacto: number | null;
  severidad: number | null;
} {
  const probabilidad = numero(fd, "probabilidad");
  const impacto = numero(fd, "impacto");
  const capturada = numero(fd, "severidad");
  return {
    probabilidad,
    impacto,
    severidad:
      probabilidad != null && impacto != null ? probabilidad * impacto : capturada,
  };
}

/** tenant del reporte, para la bitácora. */
async function tenantDeReporte(
  db: Awaited<ReturnType<typeof createClient>>,
  reporteId: string
): Promise<string | null> {
  const { data } = await db.from("reportes").select("tenant_id").eq("id", reporteId).single();
  return data?.tenant_id ?? null;
}

// -----------------------------------------------------------------------------
// Crear registro
// -----------------------------------------------------------------------------
export async function crearRegistro(
  _prev: RegistroState,
  fd: FormData
): Promise<RegistroState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const reporteId = texto(fd, "reporte_id");
  const tipo = texto(fd, "tipo");
  const nombre = texto(fd, "nombre");
  if (!reporteId) return { ok: false, error: "Selecciona el reporte." };
  if (!tipo || !TIPOS.includes(tipo as (typeof TIPOS)[number]))
    return { ok: false, error: "Tipo de registro no válido." };
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  const db = await createClient();

  // Orden por defecto: al final del reporte.
  const ordenRaw = numero(fd, "orden");
  let orden = ordenRaw;
  if (orden == null) {
    const { data: maxRow } = await db
      .from("registros_clima")
      .select("orden")
      .eq("reporte_id", reporteId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    orden = (maxRow?.orden ?? 0) + 10;
  }

  const { data: creado, error } = await db
    .from("registros_clima")
    .insert({
      reporte_id: reporteId,
      tipo,
      nombre,
      descripcion: texto(fd, "descripcion"),
      horizontes: horizontes(fd),
      ...priorizacion(fd),
      orden,
    })
    .select("id")
    .single();
  if (error || !creado) return { ok: false, error: "No se pudo crear el registro." };

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, reporteId),
    usuarioId: perfil.id,
    accion: "registro_creado",
    entidad: "registros_clima",
    entidadId: creado.id,
    detalle: { tipo, nombre },
  });

  revalidatePath("/admin/registros");
  return { ok: true, error: null, mensaje: "Registro creado.", registroId: creado.id };
}

// -----------------------------------------------------------------------------
// Editar registro
// -----------------------------------------------------------------------------
export async function editarRegistro(
  _prev: RegistroState,
  fd: FormData
): Promise<RegistroState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const registroId = texto(fd, "registro_id");
  const nombre = texto(fd, "nombre");
  if (!registroId) return { ok: false, error: "Registro no válido." };
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  const db = await createClient();
  const { data: reg } = await db
    .from("registros_clima")
    .select("id, reporte_id")
    .eq("id", registroId)
    .single();
  if (!reg) return { ok: false, error: "No se encontró el registro." };

  const { error } = await db
    .from("registros_clima")
    .update({
      nombre,
      descripcion: texto(fd, "descripcion"),
      horizontes: horizontes(fd),
      ...priorizacion(fd),
    })
    .eq("id", registroId);
  if (error) return { ok: false, error: "No se pudo guardar el registro." };

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, reg.reporte_id),
    usuarioId: perfil.id,
    accion: "registro_editado",
    entidad: "registros_clima",
    entidadId: registroId,
    detalle: { nombre },
  });

  revalidatePath("/admin/registros");
  return { ok: true, error: null, mensaje: "Registro actualizado.", registroId };
}

// -----------------------------------------------------------------------------
// Activar / desactivar (nunca borrar — trazabilidad)
// -----------------------------------------------------------------------------
export async function cambiarActivoRegistro(
  registroId: string,
  activar: boolean
): Promise<ActivoRegistroState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (!registroId) return { ok: false, error: "Registro no válido." };

  const db = await createClient();
  const { data: reg } = await db
    .from("registros_clima")
    .select("id, reporte_id, nombre")
    .eq("id", registroId)
    .single();
  if (!reg) return { ok: false, error: "No se encontró el registro." };

  const { error } = await db
    .from("registros_clima")
    .update({ activo: activar })
    .eq("id", registroId);
  if (error) return { ok: false, error: "No se pudo actualizar el registro." };

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, reg.reporte_id),
    usuarioId: perfil.id,
    accion: activar ? "registro_reactivado" : "registro_desactivado",
    entidad: "registros_clima",
    entidadId: registroId,
    detalle: { nombre: reg.nombre },
  });

  revalidatePath("/admin/registros");
  return {
    ok: true,
    error: null,
    mensaje: activar ? "Registro reactivado." : "Registro desactivado.",
  };
}

// -----------------------------------------------------------------------------
// Capturar valores de un ejercicio (APPEND ONLY: corrección = fila nueva)
// -----------------------------------------------------------------------------
export async function capturarValores(
  _prev: ValorState,
  fd: FormData
): Promise<ValorState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const registroId = texto(fd, "registro_id");
  const ejercicioRaw = texto(fd, "ejercicio");
  if (!registroId) return { ok: false, error: "Registro no válido." };
  if (!ejercicioRaw || !/^\d{4}$/.test(ejercicioRaw))
    return { ok: false, error: "Ejercicio: un año de 4 dígitos." };
  const ejercicio = Number(ejercicioRaw);

  const cantidad = numero(fd, "cantidad_activos");
  const porcentaje = numero(fd, "porcentaje");
  const gasto = numero(fd, "capital_gasto");
  const financiacion = numero(fd, "capital_financiacion");
  const inversion = numero(fd, "capital_inversion");
  const notas = texto(fd, "notas");
  if (
    cantidad == null &&
    porcentaje == null &&
    gasto == null &&
    financiacion == null &&
    inversion == null &&
    !notas
  ) {
    return { ok: false, error: "Captura al menos un valor o una nota." };
  }

  const db = await createClient();
  const { data: reg } = await db
    .from("registros_clima")
    .select("id, reporte_id, nombre")
    .eq("id", registroId)
    .single();
  if (!reg) return { ok: false, error: "No se encontró el registro." };

  const { error } = await db.from("registros_clima_valores").insert({
    registro_id: registroId,
    ejercicio,
    cantidad_activos: cantidad,
    porcentaje,
    capital_gasto: gasto,
    capital_financiacion: financiacion,
    capital_inversion: inversion,
    notas,
    capturado_por: perfil.id,
  });
  if (error) return { ok: false, error: "No se pudieron guardar los valores." };

  await logEvento(db, {
    tenantId: await tenantDeReporte(db, reg.reporte_id),
    usuarioId: perfil.id,
    accion: "registro_valores_capturados",
    entidad: "registros_clima",
    entidadId: registroId,
    detalle: { ejercicio, cantidad, porcentaje, gasto, financiacion, inversion },
  });

  revalidatePath("/admin/registros");
  return { ok: true, error: null, mensaje: `Valores de ${ejercicio} registrados.` };
}
