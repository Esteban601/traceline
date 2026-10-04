import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { registrarActividadAuditor } from "@/lib/auditoria";

const BUCKET = "evidencias";

/**
 * Respuesta propia cuando el archivo no se puede servir.
 *
 * Es HTML y no JSON porque a esta ruta se llega haciendo clic en un enlace: lo
 * que había antes —redirigir a la URL firmada y dejar que Storage contestara—
 * ponía al usuario frente a `{"statusCode":"500","error":"Internal",...}`, que
 * no le dice nada y además expone el error interno de un servicio.
 *
 * El detalle técnico va al log del servidor, no a la pantalla.
 */
function noDisponible(mensaje: string, status: number) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Archivo no disponible</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;
       font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
       background:#faf8f5;color:#2b2b2b}
  main{max-width:34rem;padding:2rem;text-align:center}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{margin:0 0 1.5rem;color:#6b6b6b}
  a{color:#0f6d6d;text-decoration:none;font-weight:500}
  a:hover{text-decoration:underline}
</style></head><body><main>
<h1>${mensaje}</h1>
<p>Si necesitas este documento, avisa al equipo de IRStrat con el nombre de la solicitud.</p>
<a href="javascript:history.back()">Volver</a>
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Sirve una evidencia por URL firmada de corta duración.
 *
 * La evidencia se resuelve por id bajo RLS (el usuario solo ve las suyas), y la
 * firma se emite con la sesión del usuario, por lo que Storage también valida el
 * acceso.
 *
 * ENTRE RESOLVER LA FILA Y FIRMAR hay una comprobación que parece redundante y
 * no lo es: que el objeto tenga BYTES. `createSignedUrl` firma contra la fila de
 * `storage.objects`, no contra el archivo, así que una fila sin contenido —el
 * seed inserta trece así, con `metadata` sin `size`— produce una firma válida
 * que al abrirse devuelve un 500 de Storage. Sin este paso, la ruta prometía un
 * archivo que no existía y lo anotaba como descargado.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ evidenciaId: string }> }
) {
  const { evidenciaId } = await params;
  const supabase = await createClient();

  const { data: ev } = await supabase
    .from("evidencias")
    .select("archivo_path, nombre_original")
    .eq("id", evidenciaId)
    .single();

  if (!ev) {
    return noDisponible("No encontramos esa evidencia.", 404);
  }

  // ¿El objeto tiene contenido? `list` devuelve la metadata que Storage escribe
  // al subir: un objeto real trae `size`, `eTag` y `contentLength`; una fila
  // insertada a mano, no. Se compara el nombre exacto porque `search` es un
  // filtro por coincidencia, no una búsqueda puntual.
  const corte = ev.archivo_path.lastIndexOf("/");
  const carpeta = corte >= 0 ? ev.archivo_path.slice(0, corte) : "";
  const archivo = ev.archivo_path.slice(corte + 1);

  const { data: enCarpeta, error: errorLista } = await supabase.storage
    .from(BUCKET)
    .list(carpeta, { limit: 100, search: archivo });

  const objeto = enCarpeta?.find((o) => o.name === archivo);
  const bytes = objeto?.metadata?.size;

  if (errorLista || !objeto || typeof bytes !== "number") {
    console.error(
      `[descargar] evidencia ${evidenciaId} sin archivo servible en ${BUCKET}/${ev.archivo_path} — ` +
        (errorLista
          ? `list falló: ${errorLista.message}`
          : !objeto
            ? "no hay objeto con ese nombre"
            : `objeto sin bytes (metadata: ${JSON.stringify(objeto.metadata)})`)
    );
    return noDisponible("El archivo no está disponible.", 404);
  }

  // `?ver=1` (enlace de la fuente de una sugerencia): se abre en el navegador en
  // vez de descargarse, para que el `#page=N` del enlace lleve a la página. El
  // navegador conserva el fragmento a través de la redirección.
  const ver = req.nextUrl.searchParams.get("ver") === "1";
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ev.archivo_path, 60, ver ? undefined : { download: ev.nombre_original });

  if (error || !data) {
    console.error(
      `[descargar] no se pudo firmar ${BUCKET}/${ev.archivo_path}: ${error?.message ?? "sin datos"}`
    );
    return noDisponible("El archivo no está disponible.", 404);
  }

  // Esta es la ÚNICA puerta por la que sale un archivo de evidencia, para
  // cualquier rol, así que es el único sitio donde hay que anotar que el auditor
  // se llevó uno.
  //
  // Va al final, cuando ya se comprobó que el objeto tiene contenido y que la
  // firma existe. Registrar antes —como estaba— anotaba como descargado un
  // archivo que el usuario nunca recibió, y un registro de auditoría que afirma
  // entregas que no ocurrieron es peor que no tenerlo.
  await registrarActividadAuditor(await getPerfilActual(), {
    tipo: "descarga_evidencia",
    objetoTipo: "evidencias",
    objetoId: evidenciaId,
    archivo: ev.nombre_original,
  });

  return NextResponse.redirect(data.signedUrl);
}
