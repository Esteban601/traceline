import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { EmptyState } from "@/components/ui/empty-state";
import { limpiarNombreTenant } from "@/lib/tenants";
import { REGIMEN_LABEL, type Regimen } from "@/lib/perfil-emisor";
import { RevisionView, type BloqueRevision } from "./revision-view";

export const metadata: Metadata = { title: "Revisión del suplemento" };

// =============================================================================
// Vista de revisión de un documento generado (§7.4).
//
// Es la pantalla donde una persona lee lo que escribió el modelo antes de que
// salga con la firma de la emisora. Por eso todo lo que un revisor necesita para
// decidir está a la vista y no detrás de un clic: de qué fuente salió cada
// bloque, qué le falta, y qué juicios le dejó el redactor.
// =============================================================================

export default async function RevisionPage({
  params,
}: {
  params: Promise<{ documento: string }>;
}) {
  const { documento: documentoId } = await params;

  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");
  if (!esStaff(perfil) && !esAdminCliente(perfil)) redirect("/admin");

  const db = await createClient();
  const { data: doc } = await db
    .from("documentos_generados")
    .select(
      "id, version, idioma, estado, regimen, alivios, costo_usd, tokens_entrada, tokens_salida, created_at, aprobado_en, reporte_id, tenant_id, aprobado:perfiles_usuario!documentos_generados_aprobado_por_fkey(nombre), generado:perfiles_usuario!documentos_generados_generado_por_fkey(nombre)"
    )
    .eq("id", documentoId)
    .maybeSingle();

  if (!doc) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          titulo="Documento no encontrado"
          descripcion="Ese suplemento no existe o no es visible para tu cuenta."
        >
          <Link href="/admin/cobertura" className="text-sm font-medium text-teal hover:underline">
            Volver a Cobertura
          </Link>
        </EmptyState>
      </div>
    );
  }

  const [{ data: rep }, { data: tenant }, { data: filas }] = await Promise.all([
    db.from("reportes").select("nombre, ejercicio").eq("id", doc.reporte_id).maybeSingle(),
    db.from("tenants").select("nombre").eq("id", doc.tenant_id).maybeSingle(),
    db
      .from("documentos_bloques")
      .select(
        "numero, clave, titulo, seccion, estado, texto, fuentes, pendientes, modelo, prompt_version, costo_usd, duracion_ms, tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, editado_en, editado:perfiles_usuario!documentos_bloques_editado_por_fkey(nombre)"
      )
      .eq("documento_id", documentoId)
      .order("numero"),
  ]);

  const bloques: BloqueRevision[] = (filas ?? []).map((b) => {
    const ps = (b.pendientes ?? []) as { campo: string; motivo: string }[];
    return {
      numero: b.numero,
      titulo: b.titulo,
      seccion: b.seccion ?? "—",
      estado: b.estado,
      texto: b.texto,
      fuentes: (b.fuentes ?? []) as { tipo: string; id: string; detalle: string }[],
      pendientes: ps.filter((p) => p.campo !== "nota_revision").map((p) => p.motivo),
      notasRevision: ps.filter((p) => p.campo === "nota_revision").map((p) => p.motivo),
      modelo: b.modelo,
      promptVersion: b.prompt_version,
      costoUsd: Number(b.costo_usd ?? 0),
      duracionMs: b.duracion_ms,
      tokensSalida: b.tokens_salida,
      editadoEn: b.editado_en,
      editadoPor: (b.editado as unknown as { nombre: string } | null)?.nombre ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <RevisionView
        documentoId={documentoId}
        version={doc.version}
        estado={doc.estado}
        regimenLabel={REGIMEN_LABEL[(doc.regimen ?? "indeterminado") as Regimen]}
        emisora={tenant ? limpiarNombreTenant(tenant.nombre) : "—"}
        reporte={rep ? `${rep.nombre} · ${rep.ejercicio}` : "—"}
        costoUsd={Number(doc.costo_usd ?? 0)}
        tokensEntrada={doc.tokens_entrada}
        tokensSalida={doc.tokens_salida}
        aprobadoEn={doc.aprobado_en}
        aprobadoPor={(doc.aprobado as unknown as { nombre: string } | null)?.nombre ?? null}
        generadoPor={(doc.generado as unknown as { nombre: string } | null)?.nombre ?? null}
        bloques={bloques}
        puedeAprobar={esStaff(perfil)}
      />
    </div>
  );
}
