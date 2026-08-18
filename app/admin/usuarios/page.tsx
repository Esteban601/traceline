import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { esAdminCliente, rolesAsignablesPor, type OpcionRol, type Rol } from "@/lib/roles";
import { limpiarNombreTenant } from "@/lib/tenants";
import {
  UsuariosView,
  type UsuarioFila,
  type TenantOpcion,
  type AreaFila,
} from "./usuarios-view";

export const metadata: Metadata = { title: "Usuarios del cliente" };

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  // El administrador del cliente gestiona SU equipo: RLS acota tenants, perfiles
  // y áreas a su tenant, así que aquí solo cambia lo que se le ofrece.
  const soyStaff = esStaff(perfil);

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
    // El catálogo completo (activas e inactivas): esta pantalla también las
    // gestiona, así que una área desactivada tiene que poder verse para reactivarla.
    db
      .from("areas_tenant")
      .select("id, tenant_id, nombre, orden, activo")
      .order("orden", { ascending: true }),
  ]);

  const tenantsList = (tenants ?? []) as { id: string; nombre: string; activo: boolean }[];
  const nombreTenant = new Map(tenantsList.map((t) => [t.id, t.nombre]));

  const usuarios: UsuarioFila[] = (
    (perfiles ?? []) as {
      id: string;
      nombre: string;
      email: string;
      rol: Rol;
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
    /** El propio perfil no se puede desactivar a sí mismo (ni por UI ni por acción). */
    esYo: p.id === perfil.id,
    // Misma regla que `puedeAdministrarUsuario` en las server actions y que
    // `perfiles_admin_cliente_update` en RLS: la UI no ofrece lo que el servidor
    // rechazaría. Al administrador del cliente le quedan fuera los coordinadores,
    // que sigue designando IRStrat.
    administrable:
      soyStaff ||
      (esAdminCliente(perfil) &&
        p.tenant_id === perfil.tenant_id &&
        (p.rol === "cliente" || p.rol === "admin_cliente")),
  }));

  const catalogo = (areasCatalogo ?? []) as {
    id: string;
    tenant_id: string;
    nombre: string;
    orden: number;
    activo: boolean;
  }[];

  // Áreas del selector de alta: el CATÁLOGO ACTIVO del cliente, no las derivadas
  // de los usuarios ya existentes — un cliente recién dado de alta aún no tiene
  // ninguno y aun así debe poder asignar áreas. Se complementa con las áreas
  // heredadas que algún usuario tenga y no estén en el catálogo, para no perderlas.
  const areas: { tenant_id: string; area: string }[] = [];
  const vistos = new Set<string>();
  const registrarArea = (tenantId: string, area: string) => {
    const k = `${tenantId}::${area}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    areas.push({ tenant_id: tenantId, area });
  };
  for (const a of catalogo) if (a.activo) registrarArea(a.tenant_id, a.nombre);
  for (const u of usuarios) {
    if (u.area) registrarArea(u.tenantId, u.area);
  }

  const tenantsOpc: TenantOpcion[] = tenantsList
    .filter((t) => t.activo)
    .map((t) => ({ id: t.id, nombre: t.nombre }));

  // Cliente cuyas ÁREAS se gestionan. La gestión necesita un cliente concreto:
  // el administrador del cliente siempre tiene el suyo; el staff, solo si llegó
  // con ?tenant= (o si únicamente hay uno). Sin él, la sección no se muestra.
  const tenantPreseleccionado = tenantsOpc.some((t) => t.id === tenantInicial)
    ? tenantInicial!
    : null;
  const tenantAreas = soyStaff
    ? (tenantPreseleccionado ?? (tenantsOpc.length === 1 ? tenantsOpc[0].id : null))
    : perfil.tenant_id;

  const areasGestion: AreaFila[] = tenantAreas
    ? catalogo
        .filter((a) => a.tenant_id === tenantAreas)
        .map((a) => ({ id: a.id, nombre: a.nombre, activo: a.activo }))
    : [];

  const roles: OpcionRol[] = [...rolesAsignablesPor(perfil)];

  const nombreClienteAreas = tenantAreas
    ? limpiarNombreTenant(nombreTenant.get(tenantAreas) ?? "")
    : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          {soyStaff ? "Panel interno IRStrat · Gestión" : "Tu panel · Gestión"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          {soyStaff ? "Usuarios del cliente" : "Usuarios y áreas"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {soyStaff
            ? "Da de alta responsables del cliente, y desactiva o reactiva su acceso. Los usuarios no se eliminan: la trazabilidad conserva su historia."
            : "Da de alta a tu equipo, define las áreas que reciben solicitudes y desactiva accesos cuando alguien deja el proceso. Nada se elimina: la trazabilidad conserva su historia."}
        </p>
      </header>

      <UsuariosView
        usuarios={usuarios}
        tenants={tenantsOpc}
        areas={areas}
        roles={roles}
        soyStaff={soyStaff}
        tenantInicial={tenantPreseleccionado ?? (soyStaff ? null : perfil.tenant_id)}
        // El formulario abre solo cuando se llegó desde el alta de un cliente
        // ("da de alta a sus usuarios"); ahí la intención ya era crear alguien.
        abrirAltaInicial={tenantPreseleccionado != null}
        tenantAreas={tenantAreas}
        nombreClienteAreas={nombreClienteAreas}
        areasGestion={areasGestion}
      />
    </div>
  );
}
