import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { estadoDeLectura, type EstadoLectura } from "@/lib/evidencias/estado-lectura";

export const runtime = "nodejs";

// =============================================================================
// GET /api/evidencias/lectura?solicitud=…&evidencia=…
//
// Lo que el paso 3 sondea cada 4 s después de «Subir y leer» (encargo
// 2026-10-26-carga-lectura-primero). Es una ruta y no una acción de servidor:
// las acciones van en fila en el router de Next, y con el sondeo como acción el
// Confirmar que venía después se quedaba en espera en producción y solo se veía
// al recargar (prueba de Esteban en traceline-dev, 26/10).
//
// Con la sesión de quien mira: RLS acota la solicitud, la evidencia y la lectura.
// =============================================================================

export type ConsultaLectura = { ok: true; estado: EstadoLectura } | { ok: false; error: string };

export async function GET(req: Request) {
  const u = new URL(req.url);
  const solicitudId = u.searchParams.get("solicitud") ?? "";
  const evidenciaId = u.searchParams.get("evidencia") ?? "";
  const no = (error: string, status: number) => NextResponse.json({ ok: false, error } satisfies ConsultaLectura, { status });

  const perfil = await getPerfilActual();
  if (!perfil) return no("Sesión no válida.", 401);
  if (!solicitudId || !evidenciaId) return no("Solicitud no válida.", 400);
  const db = await createClient();
  const [{ data: sol }, { data: ev }] = await Promise.all([
    db.from("solicitudes").select("id, unidad_esperada").eq("id", solicitudId).maybeSingle(),
    db.from("evidencias").select("id, nombre_original, solicitud_id").eq("id", evidenciaId).maybeSingle(),
  ]);
  if (!sol || !ev || ev.solicitud_id !== solicitudId) return no("No se encontró la evidencia o no tienes acceso.", 404);
  const r: ConsultaLectura = { ok: true, estado: await estadoDeLectura(db, sol, ev) };
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}
