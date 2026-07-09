import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { UsuariosView, type UsuarioFila, type TenantOpcion } from "./usuarios-view";

export const metadata: Metadata = { title: "Usuarios del cliente" };

export default async function UsuariosPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const [{ data: tenants }, { data: perfiles }] = await Promise.all([
    db.from("tenants").select("id, nombre, activo").order("nombre", { ascending: true }),
    db
      .from("perfiles_usuario")
      .select("id, nombre, email, rol, area, activo, tenant_id")
      .not("tenant_id", "is", null)
      .order("nombre", { ascending: true }),
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

  // Áreas sugeridas por tenant (de los usuarios existentes).
  const areas: { tenant_id: string; area: string }[] = [];
  const vistos = new Set<string>();
  for (const u of usuarios) {
    if (!u.area) continue;
    const k = `${u.tenantId}::${u.area}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    areas.push({ tenant_id: u.tenantId, area: u.area });
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

      <UsuariosView usuarios={usuarios} tenants={tenantsOpc} areas={areas} />
    </div>
  );
}
