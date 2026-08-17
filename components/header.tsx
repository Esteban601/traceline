import Link from "next/link";
import { APP_NAME } from "@/lib/app";
import { logout } from "@/app/login/actions";
import { LogoutButton } from "@/components/logout-button";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { limpiarNombreTenant } from "@/lib/tenants";
import type { PerfilActual, TenantActual } from "@/lib/data";

function iniciales(nombre: string): string {
  const limpio = nombre.replace(/\[DEMO\]\s*/i, "").trim();
  const partes = limpio.split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join("") || "·";
}

export function Header({
  perfil,
  tenant,
}: {
  perfil: PerfilActual;
  /** Cliente del usuario. Null para el staff de IRStrat, que no tiene uno. */
  tenant: TenantActual | null;
}) {
  const rolLabel =
    perfil.tenant_id === null
      ? "IRStrat"
      : perfil.rol === "coordinador"
        ? "Coordinación"
        : perfil.area ?? "Cliente";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-crema/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        {/* La marca del portal es la DEL CLIENTE, no la de IRStrat: quien entra
            aquí ve su propia casa. Sin logo cargado, sus iniciales. El staff no
            tiene cliente, así que conserva la marca de la aplicación. */}
        <Link
          href="/portal"
          className="flex min-w-0 items-center gap-2.5 transition duration-150 hover:opacity-80"
        >
          {tenant ? (
            <>
              <TenantLogo nombre={tenant.nombre} logoUrl={tenant.logo_url} tamano="sm" />
              <span className="truncate font-display text-base font-semibold tracking-tight text-ink">
                {limpiarNombreTenant(tenant.nombre)}
              </span>
            </>
          ) : (
            <>
              <span className="grid size-8 place-items-center rounded-lg bg-teal font-display text-sm font-bold text-crema">
                {APP_NAME.charAt(0)}
              </span>
              <span className="font-display text-base font-semibold tracking-tight text-ink">
                {APP_NAME}
              </span>
            </>
          )}
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight text-ink">
                {perfil.nombre.replace(/\[DEMO\]\s*/i, "")}
              </div>
              <div className="text-xs leading-tight text-muted">{rolLabel}</div>
            </div>
            <span
              className="grid size-9 place-items-center rounded-full bg-teal/10 text-xs font-semibold text-teal"
              title={perfil.nombre}
            >
              {iniciales(perfil.nombre)}
            </span>
          </div>

          <div className="h-6 w-px bg-line" aria-hidden />

          <form action={logout}>
            <LogoutButton />
          </form>
        </div>
      </div>
    </header>
  );
}
