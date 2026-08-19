import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  procesarRecordatorios,
  procesarRecordatoriosProgramados,
} from "@/lib/recordatorios";

export const runtime = "nodejs";

/**
 * Corrida diaria de recordatorios. Protegida por el header 'x-cron-secret', que
 * debe coincidir con CRON_SECRET. Pensada para el cron (Heroku Scheduler).
 *
 * Hace DOS pasadas, en este orden y no al revés:
 *
 *   1. PROGRAMADOS — los avisos atados a la fecha límite de una solicitud
 *      concreta (`solicitudes_recordatorios`): "faltan 3 días".
 *   2. DIGEST — el resumen por responsable de Fase 1: "tienes N pendientes".
 *
 * El orden importa porque la regla anti-spam del digest lee la bitácora: quien
 * acaba de recibir un aviso por un vencimiento concreto no recibe además el
 * resumen genérico. Al revés, recibiría los dos.
 *
 * `fecha` (query o cuerpo JSON, YYYY-MM-DD) permite EVALUAR OTRO DÍA. Existe para
 * las pruebas de punta a punta —simular el cron sin mover el reloj de la máquina—
 * y solo la alcanza quien ya tiene el secreto del cron. Se devuelve en la
 * respuesta para que nunca haya duda de qué día se evaluó.
 *
 * El botón manual del panel NO pasa por aquí (usa una server action con sesión de
 * staff, para no exponer el secreto al navegador) y sigue disparando solo el
 * digest: el calendario de los programados lo lleva el cron.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json(
      { error: "No autorizado. Falta o no coincide x-cron-secret." },
      { status: 401 }
    );
  }

  // La fecha forzada puede venir por query o por cuerpo. El cuerpo es opcional:
  // el cron no manda ninguno y un JSON inválido no debe tumbar la corrida.
  let fecha = req.nextUrl.searchParams.get("fecha") ?? undefined;
  if (!fecha) {
    try {
      const body = (await req.json()) as { fecha?: unknown } | null;
      if (typeof body?.fecha === "string") fecha = body.fecha;
    } catch {
      /* sin cuerpo, o cuerpo no-JSON: es el caso normal del cron */
    }
  }
  if (fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json(
      { error: "La fecha debe venir como YYYY-MM-DD." },
      { status: 400 }
    );
  }

  try {
    const db = createAdminClient();
    const programados = await procesarRecordatoriosProgramados(db, fecha);
    const digest = await procesarRecordatorios(db);
    return NextResponse.json({ programados, digest });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al procesar recordatorios." },
      { status: 500 }
    );
  }
}
