import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { ClientesView, type ClienteFila } from "./clientes-view";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const [{ data: tenants }, { data: areas }, { data: perfiles }, { data: reportes }] =
    await Promise.all([
      db
        .from("tenants")
        .select("id, nombre, slug, prefijo_folio, logo_url, activo, created_at")
        .order("activo", { ascending: false })
        .order("nombre", { ascending: true }),
      db
        .from("areas_tenant")
        .select("tenant_id, nombre, orden")
        .eq("activo", true)
        .order("orden", { ascending: true }),
      db.from("perfiles_usuario").select("tenant_id").not("tenant_id", "is", null),
      db.from("reportes").select("tenant_id"),
    ]);

  const areasPorTenant = new Map<string, string[]>();
  for (const a of (areas ?? []) as { tenant_id: string; nombre: string }[]) {
    const lista = areasPorTenant.get(a.tenant_id) ?? [];
    lista.push(a.nombre);
    areasPorTenant.set(a.tenant_id, lista);
  }

  const contar = (filas: { tenant_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const f of filas ?? []) {
      if (!f.tenant_id) continue;
      m.set(f.tenant_id, (m.get(f.tenant_id) ?? 0) + 1);
    }
    return m;
  };
  const usuariosPorTenant = contar(perfiles as { tenant_id: string | null }[] | null);
  const reportesPorTenant = contar(reportes as { tenant_id: string | null }[] | null);

  const clientes: ClienteFila[] = (
    (tenants ?? []) as {
      id: string;
      nombre: string;
      slug: string;
      prefijo_folio: string;
      logo_url: string | null;
      activo: boolean;
      created_at: string;
    }[]
  ).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    slug: t.slug,
    prefijoFolio: t.prefijo_folio,
    logoUrl: t.logo_url,
    activo: t.activo,
    createdAt: t.created_at,
    areas: areasPorTenant.get(t.id) ?? [],
    usuarios: usuariosPorTenant.get(t.id) ?? 0,
    reportes: reportesPorTenant.get(t.id) ?? 0,
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Administración
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Clientes
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Da de alta una emisora con sus áreas y su logo; queda lista para recibir
          su primer reporte y sus usuarios. Los clientes no se eliminan: se
          desactivan, y su historia se conserva.
        </p>
      </header>

      <ClientesView clientes={clientes} />
    </div>
  );
}
