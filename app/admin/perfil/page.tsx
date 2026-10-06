import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { ParamSelect } from "@/components/ui/param-select";
import { limpiarNombreTenant } from "@/lib/tenants";
import {
  leerCadena,
  leerHitos,
  leerHorizontes,
  leerMatriz,
} from "@/lib/perfil-emisor";
import { PerfilView, type Adjunto, type PerfilData } from "./perfil-view";
import { urlAdjunto, urlOrganigrama } from "./actions";

export const metadata: Metadata = { title: "Perfil del emisor" };

// =============================================================================
// Perfil del emisor — una sola pantalla con dos públicos.
//
// El staff de IRStrat elige la emisora con el selector; el administrador del
// cliente entra directo al suyo y no ve selector porque no hay nada que elegir.
// Es el mismo componente y las mismas acciones: duplicar la pantalla habría
// significado dos formularios que se desincronizan al primer campo nuevo.
//
// Los usuarios de área y los jefes de área no llegan aquí: la RLS de
// `perfil_emisor` no los cubre y esta página los rebota antes de consultar nada.
// =============================================================================

export default async function PerfilEmisorPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; seccion?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");

  const staff = esStaff(perfil);
  const adminCliente = esAdminCliente(perfil);
  if (!staff && !adminCliente) {
    redirect("/admin");
  }

  const db = await createClient();
  const { tenant: tenantParam, seccion: seccionParam } = await searchParams;

  // Emisoras entre las que se puede elegir. Para el administrador del cliente es
  // siempre una: la suya, tomada de la sesión y no del parámetro.
  const { data: tenants } = await db
    .from("tenants")
    .select("id, nombre, slug")
    .eq("activo", true)
    .order("nombre");

  const opciones = (tenants ?? []).map((t) => ({
    value: t.id,
    label: limpiarNombreTenant(t.nombre),
  }));

  const tenantId = staff
    ? tenantParam ?? opciones[0]?.value ?? null
    : perfil.tenant_id;

  if (!tenantId) {
    return (
      <div className="mx-auto max-w-4xl">
        <Encabezado />
        <EmptyState
          titulo="Sin emisora"
          descripcion="No hay ninguna emisora activa sobre la que capturar el perfil."
        />
      </div>
    );
  }

  const tenantNombre =
    opciones.find((o) => o.value === tenantId)?.label ?? "esta emisora";

  const { data: fila } = await db
    .from("perfil_emisor")
    .select(
      "denominacion_formal, nombre_corto, forma_de_referencia, entidad_que_informa, perimetro, carta_texto, carta_firmante, carta_cargo, proceso_materialidad, modelo_negocio, gobierno_texto, organigrama_path, horizontes, hitos_corporativos, hitos_sostenibilidad, cadena_valor, matriz_riesgos, actualizado_en, actualizado:perfiles_usuario!perfil_emisor_actualizado_por_fkey(nombre)"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const datos: PerfilData | null = fila
    ? {
        denominacion_formal: fila.denominacion_formal,
        nombre_corto: fila.nombre_corto,
        forma_de_referencia: fila.forma_de_referencia,
        entidad_que_informa: fila.entidad_que_informa,
        perimetro: fila.perimetro,
        carta_texto: fila.carta_texto,
        carta_firmante: fila.carta_firmante,
        carta_cargo: fila.carta_cargo,
        proceso_materialidad: fila.proceso_materialidad,
        modelo_negocio: fila.modelo_negocio,
        gobierno_texto: fila.gobierno_texto,
        organigrama_path: fila.organigrama_path,
        horizontes: leerHorizontes(fila.horizontes),
        hitos_corporativos: leerHitos(fila.hitos_corporativos),
        hitos_sostenibilidad: leerHitos(fila.hitos_sostenibilidad),
        cadena_valor: leerCadena(fila.cadena_valor),
        matriz_riesgos: leerMatriz(fila.matriz_riesgos),
        actualizado_en: fila.actualizado_en,
        actualizado_por_nombre:
          (fila.actualizado as unknown as { nombre: string } | null)?.nombre ?? null,
      }
    : null;

  // El bucket es privado: la vista previa necesita una URL firmada, que caduca.
  const organigramaUrl = datos?.organigrama_path
    ? await urlOrganigrama(datos.organigrama_path)
    : null;

  // Adjuntos de todas las secciones, con su URL de descarga firmada. Se piden en
  // paralelo: son una vuelta al almacenamiento por archivo y en serie se notarían.
  const { data: filasAdj } = await db
    .from("perfil_emisor_adjuntos")
    .select(
      "id, seccion, nombre_original, tamano, created_at, subido:perfiles_usuario!perfil_emisor_adjuntos_subido_por_fkey(nombre), archivo_path"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const adjuntos: Adjunto[] = await Promise.all(
    (filasAdj ?? []).map(async (a) => ({
      id: a.id,
      seccion: a.seccion,
      nombreOriginal: a.nombre_original,
      tamano: a.tamano,
      creadoEn: a.created_at,
      subidoPor: (a.subido as unknown as { nombre: string } | null)?.nombre ?? null,
      url: await urlAdjunto(a.archivo_path),
    }))
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado />

      {staff && opciones.length > 0 && (
        <div className="mb-5">
          <ParamSelect
            param="tenant"
            etiqueta="Emisora"
            opciones={opciones}
            valor={tenantId}
            placeholder="Elige la emisora"
          />
        </div>
      )}

      <PerfilView
        key={tenantId}
        tenantId={tenantId}
        tenantNombre={tenantNombre}
        perfil={datos}
        organigramaUrl={organigramaUrl}
        adjuntos={adjuntos}
        puedeElegirEmisora={staff}
        seccionInicial={seccionParam ?? null}
      />
    </div>
  );
}

function Encabezado() {
  return (
    <header className="mb-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-dorado">
        Taxonomía S1 / S2 · Suplemento
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
        Perfil del emisor
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Lo institucional que el Suplemento S1 / S2 necesita y la evidencia no aporta: la
        carta de la Dirección, la historia, el modelo de negocio, los horizontes y la
        matriz con la que se priorizan los riesgos. Se captura una vez y se conserva entre
        ejercicios.
      </p>
    </header>
  );
}
