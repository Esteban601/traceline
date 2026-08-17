import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { UsuariosView, type UsuarioFila, type TenantOpcion } from "./usuarios-view";

export const metadata: Metadata = { title: "Usuarios del cliente" };

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  // ?tenant=<id> llega del alta de un cliente ("da de alta a sus usuarios").
  const { tenant: tenantInicial } = await searchParams;

  const db = await createClient();

  const [{ data: tenants }, { data: perfiles }, { data: areasCatalogo }] = await Promise.all([
    db.from("tenants").select("id, nombre, activo").order("nombre", { ascending: true }),
    db
      .from("perfiles_usuario")
      .select("id, nombre, email, rol, area, activo, tenant_id")
      .not("tenant_id", "is", null)
      .order("nombre", { ascending: true }),
    db
      .from("areas_tenant")
      .select("tenant_id, nombre, orden")
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);

  const tenantsList = (tenants ?? []) as { id: string; nombre: string; activo: boolean }[];
  const nombreTenant = new Map(tenantsList.map((t) => [t.id, t.nombre]));

  const usuarios: UsuarioFila[] = (
    (perfiles ?? []) as {
      id: string;
      nombre: string;
      email: string;
      rol: string;
      area: string | null;
      activo: boolean;
      tenant_id: string;
    }[]
  ).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    rol: p.rol,
    area: p.area,
    activo: p.activo,
    tenantId: p.tenant_id,
    tenantNombre: nombreTenant.get(p.tenant_id) ?? "—",
  }));

  // Áreas del cliente: su CATÁLOGO (areas_tenant), no las derivadas de los
  // usuarios ya existentes — un cliente recién dado de alta aún no tiene ninguno
  // y aun así debe poder asignar áreas. Se complementa con las áreas heredadas
  // que algún usuario tenga y no estén en el catálogo, para no perderlas de vista.
  const areas: { tenant_id: string; area: string }[] = [];
  const vistos = new Set<string>();
  const registrarArea = (tenantId: string, area: string) => {
    const k = `${tenantId}::${area}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    areas.push({ tenant_id: tenantId, area });
  };
  for (const a of (areasCatalogo ?? []) as { tenant_id: string; nombre: string }[]) {
    registrarArea(a.tenant_id, a.nombre);
  }
  for (const u of usuarios) {
    if (u.area) registrarArea(u.tenantId, u.area);
  }

  const tenantsOpc: TenantOpcion[] = tenantsList
    .filter((t) => t.activo)
    .map((t) => ({ id: t.id, nombre: t.nombre }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Gestión
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Usuarios del cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Da de alta responsables del cliente, y desactiva o reactiva su acceso.
          Los usuarios no se eliminan: la trazabilidad conserva su historia.
        </p>
      </header>

      <UsuariosView
        usuarios={usuarios}
        tenants={tenantsOpc}
        areas={areas}
        tenantInicial={tenantsOpc.some((t) => t.id === tenantInicial) ? tenantInicial! : null}
      />
    </div>
  );
}
