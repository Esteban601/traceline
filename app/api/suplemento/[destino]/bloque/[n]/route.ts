import { NextResponse, after } from "next/server";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { generarBloque } from "@/lib/suplemento/generar-bloque";
import { esModeloConocido, MODELO_POR_DEFECTO } from "@/lib/suplemento/modelos";
import { regimenDe, leerAlivios } from "@/lib/perfil-emisor";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";
// El router de Heroku corta a los 30 s y esta llamada es la que se le acerca.
// Un bloque por petición es justamente la forma de no chocar con ese límite.
export const maxDuration = 60;

// =============================================================================
// POST /api/suplemento/{documento}/bloque/{n}
//
// Genera UN bloque. Un bloque por petición, no cuarenta: el router de Heroku
// corta a los 30 s y el cliente encadena las llamadas mostrando progreso. Cada
// resultado se persiste al llegar, así que cerrar el navegador no pierde lo ya
// generado (§6 de la especificación).
//
// EL SEGMENTO {documento} ACEPTA DOS COSAS. Si es el id de un
// `documentos_generados`, se usa ese. Si es el id de un REPORTE, se busca su
// documento en español versión 1 y se crea si no existe. Sin esa segunda forma
// no habría manera de empezar: la primera generación de un reporte no tiene
// todavía un documento al que apuntar.
// =============================================================================

export async function POST(
  req: Request,
  ctx: { params: Promise<{ documento: string; n: string }> }
) {
  const { documento: destino, n } = await ctx.params;

  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const numero = Number(n);
  if (!Number.isInteger(numero) || numero < 1 || numero > 40) {
    return NextResponse.json({ error: "Número de bloque fuera de rango." }, { status: 400 });
  }

  // Modelo opcional en el cuerpo; solo se acepta uno de la tabla conocida, para
  // que nadie pueda facturar contra un modelo cuyo precio no sabemos calcular.
  let modelo = MODELO_POR_DEFECTO;
  try {
    const cuerpo = (await req.json()) as { modelo?: string } | null;
    if (cuerpo?.modelo) {
      if (!esModeloConocido(cuerpo.modelo)) {
        return NextResponse.json({ error: `Modelo desconocido: ${cuerpo.modelo}.` }, { status: 400 });
      }
      modelo = cuerpo.modelo;
    }
  } catch {
    // Sin cuerpo: se usa el modelo por defecto.
  }

  const db = await createClient();
  const resuelto = await resolverDocumento(db, destino, perfil.id);
  if ("error" in resuelto) {
    return NextResponse.json({ error: resuelto.error }, { status: resuelto.status });
  }

  // --- La ruta NO espera a la generación ------------------------------------
  // Un bloque tarda entre 20 y 40 segundos y el router de Heroku corta a los 30.
  // Se marca 'generando', se responde de inmediato, y la llamada al modelo corre
  // en after(), que se ejecuta después de enviar la respuesta. El cliente
  // consulta cada dos segundos hasta que el estado cambie.
  const marca = await marcarGenerando(db, resuelto.documentoId, numero);
  if (!marca.ok) {
    return NextResponse.json({ error: marca.error }, { status: marca.status });
  }

  after(async () => {
    const r = await generarBloque(db, resuelto.documentoId, numero, { modelo });

    await logEvento(db, {
      tenantId: resuelto.tenantId,
      usuarioId: perfil.id,
      accion: "suplemento_bloque_generado",
      entidad: "documentos_generados",
      entidadId: resuelto.documentoId,
      detalle: r.ok
        ? {
            bloque: numero,
            modelo: r.modelo,
            costo_usd: r.costo,
            duracion_ms: r.duracionMs,
            intentos: r.intentos,
            pendientes: r.pendientes.length,
            notas_revision: r.notasRevision.length,
          }
        : { bloque: numero, modelo, fallo: r.motivo, detalle: r.detalle },
    });
  });

  return NextResponse.json(
    {
      documentoId: resuelto.documentoId,
      bloque: numero,
      estado: "generando",
      // El cliente consulta aquí cada 2 s hasta que `estado` deje de ser
      // 'generando'. Un bloque que lleve más de 3 minutos así lo pasa a 'error'
      // la propia consulta: si el proceso murió, nadie más lo va a hacer.
      consultarEn: `/api/suplemento/${resuelto.documentoId}/bloque/${numero}`,
    },
    { status: 202 }
  );
}

/**
 * Estado del bloque, para la consulta cada dos segundos. Es también quien vence
 * los bloques colgados: un 'generando' de más de tres minutos significa que el
 * proceso que lo tomó ya no existe —un dyno reiniciado, un after() interrumpido—
 * y nadie más lo va a cerrar.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ documento: string; n: string }> }
) {
  const { documento, n } = await ctx.params;
  const perfil = await getPerfilActual();
  if (!perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!esStaff(perfil) && !esAdminCliente(perfil)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const db = await createClient();
  const { data: b } = await db
    .from("documentos_bloques")
    .select(
      "numero, titulo, estado, texto, fuentes, pendientes, modelo, prompt_version, tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, costo_usd, duracion_ms, generado_en"
    )
    .eq("documento_id", documento)
    .eq("numero", Number(n))
    .maybeSingle();

  if (!b) return NextResponse.json({ error: "Ese bloque no se ha generado." }, { status: 404 });

  if (b.estado === "generando" && vencido(b.generado_en)) {
    await db
      .from("documentos_bloques")
      .update({
        estado: "error",
        pendientes: [{ campo: "generacion", motivo: "tiempo excedido" }],
        updated_at: new Date().toISOString(),
      })
      .eq("documento_id", documento)
      .eq("numero", Number(n));
    return NextResponse.json({ ...b, estado: "error", motivo: "tiempo excedido", reintentable: true });
  }

  return NextResponse.json(b);
}

const LIMITE_GENERANDO_MS = 3 * 60 * 1000;

const vencido = (desde: string | null): boolean =>
  !!desde && Date.now() - new Date(desde).getTime() > LIMITE_GENERANDO_MS;

/**
 * Reserva el bloque. Si ya hay uno 'generando' y no ha vencido, se rechaza: dos
 * generaciones simultáneas del mismo bloque se pisarían y se pagarían las dos.
 */
async function marcarGenerando(
  db: Awaited<ReturnType<typeof createClient>>,
  documentoId: string,
  numero: number
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const bloque = BLOQUES.find((x) => x.numero === numero)!;

  const { data: previo } = await db
    .from("documentos_bloques")
    .select("estado, generado_en")
    .eq("documento_id", documentoId)
    .eq("numero", numero)
    .maybeSingle();

  if (previo?.estado === "generando" && !vencido(previo.generado_en)) {
    return { ok: false, error: "Ese bloque ya se está generando.", status: 409 };
  }

  const { error } = await db.from("documentos_bloques").upsert(
    {
      documento_id: documentoId,
      numero,
      clave: bloque.clave,
      titulo: bloque.titulo,
      seccion: bloque.seccion,
      estado: "generando",
      texto: null,
      pendientes: [],
      fuentes: [],
      generado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "documento_id,numero" }
  );

  if (error) {
    return { ok: false, error: `No se pudo reservar el bloque: ${error.message}`, status: 500 };
  }
  return { ok: true };
}

type Resuelto = { documentoId: string; tenantId: string } | { error: string; status: number };

async function resolverDocumento(
  db: Awaited<ReturnType<typeof createClient>>,
  destino: string,
  usuarioId: string
): Promise<Resuelto> {
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id")
    .eq("id", destino)
    .maybeSingle();
  if (doc) return { documentoId: doc.id, tenantId: doc.tenant_id };

  // No es un documento: ¿es un reporte? RLS ya acota lo que este usuario ve, así
  // que un reporte de otra emisora simplemente no aparece.
  const { data: rep } = await db
    .from("reportes")
    .select("id, tenant_id, ejercicio, anio_adopcion, alivios")
    .eq("id", destino)
    .maybeSingle();
  if (!rep) return { error: "No existe ese documento ni ese reporte.", status: 404 };

  const { data: existente } = await db
    .from("documentos_generados")
    .select("id, tenant_id")
    .eq("reporte_id", rep.id)
    .eq("tipo", "suplemento_s1s2")
    .eq("idioma", "es")
    .eq("version", 1)
    .maybeSingle();
  if (existente) return { documentoId: existente.id, tenantId: existente.tenant_id };

  // El régimen se CONGELA al crear el documento: si mañana cambian los alivios
  // del reporte, este documento sigue explicándose con los que tenía.
  const { data: creado, error } = await db
    .from("documentos_generados")
    .insert({
      tenant_id: rep.tenant_id,
      reporte_id: rep.id,
      tipo: "suplemento_s1s2",
      idioma: "es",
      version: 1,
      estado: "borrador",
      regimen: regimenDe(rep.ejercicio, rep.anio_adopcion),
      alivios: rep.alivios ?? {},
      generado_por: usuarioId,
    })
    .select("id, tenant_id")
    .single();

  if (error || !creado) {
    return { error: "No se pudo crear el documento.", status: 500 };
  }
  void leerAlivios(rep.alivios);
  return { documentoId: creado.id, tenantId: creado.tenant_id };
}
