import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";

export const runtime = "nodejs";

// =============================================================================
// Descarga del Suplemento NIIF S1 y S2 del tenant de demostración.
//
// Sirve un archivo de vitrina, no uno generado: el generador vive en la rama de
// desarrollo y no está en producción. Esta ruta existe para que la demostración
// pueda enseñar el entregable final mientras tanto.
//
// Los dos archivos de `assets/vitrina/` son PROVISIONALES a propósito. Los
// definitivos se sustituyen copiando encima, sin tocar código ni desplegar
// nada más: por eso el nombre del archivo en disco es fijo y el nombre que ve
// quien descarga se arma aquí.
//
// El acceso se resuelve contra el REPORTE, no contra un parámetro de tenant: el
// tenant sale del reporte y nadie puede pedir el de otro cambiando la URL.
// =============================================================================

const ARCHIVOS = {
  docx: {
    ruta: "suplemento-demo.docx",
    ext: "docx",
    tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pdf: {
    ruta: "suplemento-demo.pdf",
    ext: "pdf",
    tipo: "application/pdf",
  },
} as const;

type Formato = keyof typeof ARCHIVOS;

const esFormato = (v: string | null): v is Formato => v === "docx" || v === "pdf";

/** Sin acentos, sin espacios: el nombre viaja en una cabecera HTTP. */
function normalizar(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "emisora"
  );
}

export async function GET(req: Request) {
  const perfil = await getPerfilActual();
  if (!perfil) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const reporteId = url.searchParams.get("reporte");
  const formato = url.searchParams.get("formato");

  if (!reporteId) {
    return NextResponse.json({ error: "Falta el reporte." }, { status: 400 });
  }
  if (!esFormato(formato)) {
    return NextResponse.json({ error: "Formato desconocido." }, { status: 400 });
  }

  const db = await createClient();

  // RLS ya acota lo que este perfil puede ver; que la fila no aparezca es
  // indistinguible de que no exista, y así debe seguir siendo.
  const { data: reporte } = await db
    .from("reportes")
    .select("id, ejercicio, tenant_id, tenants(slug, nombre, es_demo)")
    .eq("id", reporteId)
    .maybeSingle();

  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });
  }

  const tenant = reporte.tenants as unknown as {
    slug: string | null;
    nombre: string;
    es_demo: boolean;
  } | null;

  // El botón solo se pinta para emisoras de demostración, pero la puerta no
  // puede ser el botón: quien teclee la URL con otro reporte recibe un 403.
  if (!tenant?.es_demo) {
    return NextResponse.json(
      { error: "Este reporte no es de demostración." },
      { status: 403 }
    );
  }

  const staff = esStaff(perfil);
  const admin = esAdminCliente(perfil) && perfil.tenant_id === reporte.tenant_id;
  if (!staff && !admin) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const archivo = ARCHIVOS[formato];
  let contenido: Buffer;
  try {
    contenido = await fs.readFile(
      path.join(process.cwd(), "assets", "vitrina", archivo.ruta)
    );
  } catch {
    // Que falte el archivo de vitrina es un problema del despliegue, no de quien
    // pulsa el botón: se dice así en vez de devolver un 500 mudo.
    return NextResponse.json(
      { error: "El documento de muestra no está disponible en este ambiente." },
      { status: 503 }
    );
  }

  const nombre = `Suplemento_S1S2_${normalizar(tenant.slug ?? tenant.nombre)}_${reporte.ejercicio}.${archivo.ext}`;

  await logEvento(db, {
    tenantId: reporte.tenant_id,
    usuarioId: perfil.id,
    accion: "suplemento_demo_descargado",
    entidad: "reportes",
    entidadId: reporte.id,
    detalle: { formato, ejercicio: reporte.ejercicio, archivo: nombre },
  });

  return new NextResponse(new Uint8Array(contenido), {
    status: 200,
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Content-Length": String(contenido.byteLength),
      // Es un archivo de vitrina que se sustituye en caliente: que nadie lo
      // guarde en caché o la sustitución no se vería.
      "Cache-Control": "no-store",
    },
  });
}
