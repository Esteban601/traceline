import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/** Rutas públicas que no requieren sesión. */
const RUTAS_PUBLICAS = ["/login"];

/**
 * Refresca la sesión de Supabase y aplica el ruteo por rol:
 *   - Sin sesión en ruta privada → /login (recordando el destino en `next`).
 *   - Con sesión en /login → su home según rol (staff /admin, cliente /portal).
 *   - Cliente/coordinador que intente entrar a /admin → /portal.
 * `staff` = perfil de IRStrat (tenant_id NULL), consistente con fn_is_staff() en
 * la BD y con esStaff() en lib/data.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() valida el token contra el servidor de auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPublica = RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    // Rol para el ruteo: staff (IRStrat) = perfil con tenant_id NULL.
    // La política perfiles_select permite leer el propio perfil (id = auth.uid()).
    const { data: perfil } = await supabase
      .from("perfiles_usuario")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const esStaff = perfil != null && perfil.tenant_id === null;

    const redirigir = (destino: string) => {
      const url = request.nextUrl.clone();
      url.pathname = destino;
      url.search = "";
      return NextResponse.redirect(url);
    };

    // Ya autenticado en /login → a su home según rol.
    if (pathname === "/login") {
      return redirigir(esStaff ? "/admin" : "/portal");
    }

    // El panel interno es solo para staff; el cliente/coordinador rebota a /portal.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      if (!esStaff) return redirigir("/portal");
    }
  }

  return response;
}
