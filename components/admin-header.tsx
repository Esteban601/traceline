"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/app";
import { logout } from "@/app/login/actions";
import { LogoutButton } from "@/components/logout-button";
import type { PerfilActual } from "@/lib/data";

function iniciales(nombre: string): string {
  const limpio = nombre.replace(/\[DEMO\]\s*/i, "").trim();
  const partes = limpio.split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join("") || "·";
}

/**
 * Cabecera del panel interno IRStrat. Mismo sistema de diseño que el portal,
 * pero con barra teal sólida (acento distinto) para distinguir de un vistazo el
 * panel interno del portal del cliente durante la demo.
 */
export function AdminHeader({ perfil }: { perfil: PerfilActual }) {
  const pathname = usePathname();
  type NavKey =
    | "matriz"
    | "cobertura"
    | "reportes"
    | "plantillas"
    | "usuarios"
    | "bitacora";
  const activo: NavKey = pathname.startsWith("/admin/cobertura")
    ? "cobertura"
    : pathname.startsWith("/admin/reportes")
      ? "reportes"
      : pathname.startsWith("/admin/plantillas")
        ? "plantillas"
        : pathname.startsWith("/admin/usuarios")
          ? "usuarios"
          : pathname.startsWith("/admin/bitacora")
            ? "bitacora"
            : "matriz";
  const nav: { href: string; label: string; key: NavKey }[] = [
    { href: "/admin", label: "Matriz", key: "matriz" },
    { href: "/admin/cobertura", label: "Cobertura", key: "cobertura" },
    { href: "/admin/reportes", label: "Reportes", key: "reportes" },
    { href: "/admin/plantillas", label: "Plantillas", key: "plantillas" },
    { href: "/admin/usuarios", label: "Usuarios", key: "usuarios" },
    { href: "/admin/bitacora", label: "Bitácora", key: "bitacora" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-teal-dark/40 bg-teal text-crema shadow-soft">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 transition duration-150 hover:opacity-85"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-gold/90 font-display text-sm font-bold text-teal-dark">
              {APP_NAME.charAt(0)}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-base font-semibold tracking-tight">
                {APP_NAME}
              </span>
              <span className="rounded-pill bg-crema/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-crema/90">
                Interno
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                aria-current={activo === n.key ? "page" : undefined}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150 " +
                  (activo === n.key
                    ? "bg-crema/15 text-crema"
                    : "text-crema/75 hover:bg-crema/10 hover:text-crema")
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight text-crema">
              {perfil.nombre.replace(/\[DEMO\]\s*/i, "")}
            </div>
            <div className="text-xs leading-tight text-crema/70">IRStrat · Analista</div>
          </div>
          <span
            className="grid size-9 place-items-center rounded-full bg-crema/15 text-xs font-semibold text-crema"
            title={perfil.nombre}
          >
            {iniciales(perfil.nombre)}
          </span>

          <div className="h-6 w-px bg-crema/20" aria-hidden />

          <form action={logout}>
            <LogoutButton tone="invert" />
          </form>
        </div>
      </div>

      {/* Navegación en móvil */}
      <nav className="flex items-center gap-1 border-t border-crema/15 px-5 pb-2 pt-1.5 sm:hidden">
        {nav.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            aria-current={activo === n.key ? "page" : undefined}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150 " +
              (activo === n.key
                ? "bg-crema/15 text-crema"
                : "text-crema/75 hover:bg-crema/10 hover:text-crema")
            }
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
