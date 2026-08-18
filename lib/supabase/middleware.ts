import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { puedeEntrarPanel, rutaSoloStaff } from "@/lib/roles";

/**
 * Rutas públicas que no requieren sesión: el ingreso y todo el camino de acceso
 * (canje de invitación, recuperación y restablecimiento de contraseña). La liga
 * de recuperación DEBE poder abrirse sin sesión: es lo que la genera.
 */
const RUTAS_PUBLICAS = ["/login", "/invitacion", "/recuperar", "/restablecer", "/auth"];

/**
 * Refresca la sesión de Supabase y aplica el ruteo por rol:
 *   - Sin sesión en ruta privada → /login (recordando el destino en `next`).
 *   - Con sesión en /login → su home según rol (panel /admin, portal /portal).
 *   - Cliente/coordinador que intente entrar a /admin → /portal.
 *   - admin_cliente SÍ entra a /admin (es su panel, acotado a su tenant), pero
 *     las rutas solo-staff (clientes, reportes, plantillas y la captura de
 *     taxonomía) lo devuelven a su matriz.
 * `staff` = perfil de IRStrat (tenant_id NULL), consistente con fn_is_staff() en
 * la BD y con esStaff() en lib/data.ts. La matriz completa de secciones por rol
 * vive en lib/roles.ts, y esta comprobación se repite en cada página (defensa en
 * profundidad: el middleware no es la única barrera).
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
  // Las rutas /api se autentican por su cuenta (p. ej. CRON_SECRET); no pasan por
  // el redirect a /login basado en sesión.
  const esApi = pathname.startsWith("/api/");
  const esPublica =
    esApi || RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    // Rol para el ruteo: staff (IRStrat) = perfil con tenant_id NULL.
    // La política perfiles_select permite leer el propio perfil (id = auth.uid())
    // y tenants_select el tenant propio, así que este join no necesita privilegios.
    const { data: perfil } = await supabase
      .from("perfiles_usuario")
      .select("tenant_id, rol, tenants(activo)")
      .eq("id", user.id)
      .single();
    const esStaff = perfil != null && perfil.tenant_id === null;
    const entraAlPanel = perfil != null && puedeEntrarPanel(perfil);

    const redirigir = (destino: string) => {
      const url = request.nextUrl.clone();
      url.pathname = destino;
      url.search = "";
      return NextResponse.redirect(url);
    };

    // Cliente desactivado: sus usuarios dejan de entrar. Desactivar un tenant
    // nunca borra nada, pero sí corta el acceso — si no, "desactivar" sería
    // cosmético. El staff no tiene tenant, así que no le aplica.
    if (!esPublica && perfil?.tenant_id != null && perfil.tenants?.activo === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=cliente_inactivo";
      const salida = NextResponse.redirect(url);
      // signOut() escribe el borrado de las cookies de sesión sobre `response`
      // vía el adaptador setAll; una respuesta de redirección nueva no las
      // hereda. Sin copiarlas, el navegador se quedaría con la sesión puesta.
      for (const cookie of response.cookies.getAll()) salida.cookies.set(cookie);
      return salida;
    }

    // Ya autenticado en /login → a su home según rol.
    if (pathname === "/login") {
      return redirigir(entraAlPanel ? "/admin" : "/portal");
    }

    // El panel es para el staff y para el administrador del cliente; el usuario
    // de área y el coordinador rebotan a /portal.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      if (!entraAlPanel) return redirigir("/portal");
      // Secciones de la firma: el administrador del cliente vuelve a su matriz.
      if (!esStaff && rutaSoloStaff(pathname)) return redirigir("/admin");
    }
  }

  return response;
}
