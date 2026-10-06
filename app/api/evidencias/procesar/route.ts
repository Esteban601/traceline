import { NextResponse, type NextRequest } from "next/server";
import { procesarPendientes } from "@/lib/evidencias/cola";
import { vaciarRetenidos } from "@/lib/notificaciones/inmediatos";

export const runtime = "nodejs";

/**
 * POST /api/evidencias/procesar — barrido de la cola de lectura de evidencias.
 *
 * Header `x-cron-secret` = CRON_SECRET, igual que /api/recordatorios. Pensada
 * para Heroku Scheduler: recoge lo que la lectura inmediata (`after()` al subir)
 * no terminó —un reinicio del dyno, un error transitorio— y lo reintenta.
 * Query opcional `maximo` (1–50, default 10).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "No autorizado. Falta o no coincide x-cron-secret." }, { status: 401 });
  }
  const pedido = Number(req.nextUrl.searchParams.get("maximo") ?? 10);
  const maximo = Number.isInteger(pedido) && pedido >= 1 && pedido <= 50 ? pedido : 10;
  // El mismo job vacía los avisos inmediatos retenidos por el tope de 20 por
  // emisora y hora (sistema de alertas): un correo agrupado por destinatario. Va
  // primero y aparte: un fallo de la cola no debe dejar avisos sin salir.
  let agrupados: { correos: number; avisos: number } | { error: string };
  try {
    agrupados = await vaciarRetenidos();
  } catch (e) {
    agrupados = { error: e instanceof Error ? e.message : "error al vaciar los retenidos" };
  }
  const resultados = await procesarPendientes(maximo);
  const porEstado: Record<string, number> = {};
  for (const r of resultados) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
  return NextResponse.json({ procesadas: resultados.length, porEstado, resultados, agrupados });
}
