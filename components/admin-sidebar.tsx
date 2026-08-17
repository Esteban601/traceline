"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/app";
import { logout } from "@/app/login/actions";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/cn";
import type { PerfilActual } from "@/lib/data";

type NavKey =
  | "matriz"
  | "bitacora"
  | "cobertura"
  | "registros"
  | "objetivos"
  | "cuestionarios"
  | "reportes"
  | "plantillas"
  | "clientes"
  | "usuarios";

type NavItem = { href: string; label: string; key: NavKey; icono: NavKey };
type NavGrupo = { titulo: string; items: NavItem[] };

// Agrupado por flujo de trabajo (hallazgo "me pierdo entre secciones").
const GRUPOS: NavGrupo[] = [
  {
    titulo: "Seguimiento",
    items: [
      { href: "/admin", label: "Matriz", key: "matriz", icono: "matriz" },
      { href: "/admin/bitacora", label: "Bitácora", key: "bitacora", icono: "bitacora" },
    ],
  },
  {
    titulo: "Taxonomía",
    items: [
      { href: "/admin/cobertura", label: "Cobertura", key: "cobertura", icono: "cobertura" },
      { href: "/admin/registros", label: "Clima", key: "registros", icono: "registros" },
      { href: "/admin/objetivos", label: "Objetivos", key: "objetivos", icono: "objetivos" },
      { href: "/admin/cuestionarios", label: "Cuestionarios", key: "cuestionarios", icono: "cuestionarios" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/admin/clientes", label: "Clientes", key: "clientes", icono: "clientes" },
      { href: "/admin/reportes", label: "Reportes", key: "reportes", icono: "reportes" },
      { href: "/admin/plantillas", label: "Plantillas", key: "plantillas", icono: "plantillas" },
      { href: "/admin/usuarios", label: "Usuarios", key: "usuarios", icono: "usuarios" },
    ],
  },
];

/** Sección activa a partir de la ruta. '/admin' y '/admin/solicitudes/*' → matriz. */
function claveActiva(pathname: string): NavKey {
  const rutas: [string, NavKey][] = [
    ["/admin/cobertura", "cobertura"],
    ["/admin/registros", "registros"],
    ["/admin/objetivos", "objetivos"],
    ["/admin/cuestionarios", "cuestionarios"],
    ["/admin/clientes", "clientes"],
    ["/admin/reportes", "reportes"],
    ["/admin/plantillas", "plantillas"],
    ["/admin/usuarios", "usuarios"],
    ["/admin/bitacora", "bitacora"],
  ];
  for (const [prefijo, clave] of rutas) if (pathname.startsWith(prefijo)) return clave;
  return "matriz";
}

function iniciales(nombre: string): string {
  const limpio = nombre.replace(/\[DEMO\]\s*/i, "").trim();
  return (
    limpio
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "·"
  );
}

function Icono({ tipo }: { tipo: NavKey }) {
  const p = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "size-5 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (tipo) {
    case "matriz":
      return (<svg {...p}><path d="M3 5h18M3 12h18M3 19h18" /><path d="M8 5v14" /></svg>);
    case "bitacora":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case "cobertura":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /></svg>);
    case "registros":
      return (<svg {...p}><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.98A6 6 0 0 0 6.2 9.6 4 4 0 0 0 7 19h10.5z" /></svg>);
    case "objetivos":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="1" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>);
    case "cuestionarios":
      return (<svg {...p}><path d="M9 3h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1z" /><path d="M9 12l1.5 1.5L13 11" /></svg>);
    case "reportes":
      return (<svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>);
    case "plantillas":
      return (<svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>);
    case "clientes":
      return (<svg {...p}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9.5 12h1.5M13 12h1.5M9.5 16h1.5M13 16h1.5" /></svg>);
    case "usuarios":
      return (<svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17 20a5.5 5.5 0 0 0-2.5-4.6" /></svg>);
  }
}

/**
 * Sidebar persistente del panel interno. Reemplaza el header de links: agrupa por
 * flujo, marca el ítem activo y colapsa a íconos (desktop, con el botón; móvil,
 * automáticamente por ancho). Las RUTAS no cambian, solo su presentación.
 */
export function AdminSidebar({ perfil }: { perfil: PerfilActual }) {
  const pathname = usePathname();
  const activa = claveActiva(pathname);
  // Por defecto EXPANDIDO en desktop; se colapsa solo si el usuario lo elige, y
  // esa elección persiste (localStorage). Se lee tras montar para no romper SSR.
  const [colapsado, setColapsado] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("admin-sidebar-colapsado") === "1") setColapsado(true);
  }, []);
  const alternarColapso = () =>
    setColapsado((v) => {
      const next = !v;
      localStorage.setItem("admin-sidebar-colapsado", next ? "1" : "0");
      return next;
    });

  // Ancho: rail de íconos en móvil siempre; en md+, según el toggle.
  const ancho = colapsado ? "w-16 md:w-16" : "w-16 md:w-60";
  const soloIconos = "hidden" as const; // etiquetas ocultas en el rail móvil
  const etiquetaCls = colapsado ? soloIconos : "hidden md:inline";
  const grupoCls = colapsado ? soloIconos : "hidden md:block";
  const nombre = perfil.nombre.replace(/\[DEMO\]\s*/i, "");

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex h-dvh shrink-0 flex-col border-r border-teal-dark/40 bg-teal text-crema transition-[width] duration-200",
        ancho
      )}
    >
      {/* Marca */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-3.5">
        <Link href="/admin" className="flex items-center gap-2.5 transition duration-150 hover:opacity-85">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold/90 font-display text-sm font-bold text-teal-dark">
            {APP_NAME.charAt(0)}
          </span>
          <span className={cn("flex items-baseline gap-2", etiquetaCls)}>
            <span className="font-display text-base font-semibold tracking-tight">{APP_NAME}</span>
            <span className="rounded-pill bg-crema/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-crema/90">
              Interno
            </span>
          </span>
        </Link>
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {GRUPOS.map((g) => {
          const grupoActivo = g.items.some((i) => i.key === activa);
          return (
            <div key={g.titulo} className="mb-4 last:mb-0">
              <p
                className={cn(
                  "px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  grupoActivo ? "text-crema/90" : "text-crema/55",
                  grupoCls
                )}
              >
                {g.titulo}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const activo = it.key === activa;
                  return (
                    <li key={it.key}>
                      <Link
                        href={it.href}
                        aria-current={activo ? "page" : undefined}
                        title={it.label}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition duration-150",
                          colapsado ? "md:justify-center" : "justify-center md:justify-start",
                          activo
                            ? "bg-crema/15 text-crema"
                            : "text-crema/75 hover:bg-crema/10 hover:text-crema"
                        )}
                      >
                        <Icono tipo={it.icono} />
                        <span className={etiquetaCls}>{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Colapsar (solo desktop) */}
      <button
        type="button"
        onClick={alternarColapso}
        className="mx-2.5 mb-1.5 hidden items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-crema/70 transition duration-150 hover:bg-crema/10 hover:text-crema md:flex"
        aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
        title={colapsado ? "Expandir menú" : "Colapsar menú"}
      >
        <svg aria-hidden viewBox="0 0 24 24" className={cn("size-5 shrink-0 transition-transform duration-200", colapsado && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        <span className={etiquetaCls}>Colapsar</span>
      </button>

      {/* Usuario + salir. En el rail (móvil o colapsado) se apila y el logout es
          icono; expandido es fila con nombre y "Salir" con texto. */}
      <div className="mt-auto border-t border-crema/15 p-2.5">
        <div
          className={cn(
            "flex items-center gap-2.5",
            colapsado ? "flex-col" : "flex-col md:flex-row"
          )}
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-crema/15 text-xs font-semibold text-crema"
            title={nombre}
          >
            {iniciales(perfil.nombre)}
          </span>
          <div className={cn("min-w-0 flex-1", etiquetaCls)}>
            <div className="truncate text-sm font-medium leading-tight text-crema">{nombre}</div>
            <div className="text-xs leading-tight text-crema/70">IRStrat · Analista</div>
          </div>
          {/* Salir con texto (expandido) */}
          <form action={logout} className={etiquetaCls}>
            <LogoutButton tone="invert" />
          </form>
          {/* Salir icono (rail: siempre en móvil; en desktop solo si colapsado) */}
          <form action={logout} className={colapsado ? "block" : "block md:hidden"}>
            <button
              type="submit"
              aria-label="Salir"
              title="Salir"
              className="grid size-9 place-items-center rounded-lg text-crema/80 transition duration-150 hover:bg-crema/10 hover:text-crema"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
