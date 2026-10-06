import { NextResponse, type NextRequest } from "next/server";
import { generarSugerencia } from "@/lib/evidencias/sugerencias";

export const runtime = "nodejs";

/**
 * POST /api/evidencias/sugerir?contenido=<id> — regenera la sugerencia de una
 * evidencia ya leída, sin volver a leer el archivo (captura sugerida, Paso 2).
 *
 * Header `x-cron-secret` = CRON_SECRET, como /api/evidencias/procesar. Es para
 * operación y pruebas: la sugerencia normal la genera la cola al terminar la
 * lectura. La anterior sugerida de la solicitud queda obsoleta. Cada
 * regeneración cuenta como una lectura contra `lecturas_mes_max`; con el tope
 * alcanzado responde 429.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "No autorizado. Falta o no coincide x-cron-secret." }, { status: 401 });
  }
  const contenido = req.nextUrl.searchParams.get("contenido");
  if (!contenido || !/^[0-9a-f-]{36}$/i.test(contenido)) {
    return NextResponse.json({ error: "Falta `contenido` (id de evidencias_contenido)." }, { status: 400 });
  }
  const r = await generarSugerencia(contenido, { regenerada: true });
  return NextResponse.json(r, { status: r.estado === "tope" ? 429 : 200 });
}
