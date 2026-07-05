import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarRecordatorios } from "@/lib/recordatorios";

export const runtime = "nodejs";

/**
 * Dispara los recordatorios. Protegido por el header 'x-cron-secret' que debe
 * coincidir con CRON_SECRET. Pensado para el cron (Heroku Scheduler). El botón
 * manual del panel NO pasa por aquí: usa la misma rutina server-side vía server
 * action (para no exponer el secreto al navegador).
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

  try {
    const db = createAdminClient();
    const resumen = await procesarRecordatorios(db);
    return NextResponse.json(resumen);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al procesar recordatorios." },
      { status: 500 }
    );
  }
}
