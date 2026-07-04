import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Genera una URL firmada de corta duración para descargar una evidencia.
 * La evidencia se resuelve por id bajo RLS (el usuario solo ve las suyas), y la
 * firma se emite con la sesión del usuario, por lo que Storage también valida el
 * acceso. Redirige a la URL firmada.
 */
export async function GET(
  _req: NextRequest,
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
    return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("evidencias")
    .createSignedUrl(ev.archivo_path, 60, { download: ev.nombre_original });

  if (error || !data) {
    return NextResponse.json(
      { error: "No se pudo generar el enlace de descarga." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
