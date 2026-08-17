"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/portal");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return {
      error: "No pudimos validar esos datos. Revisa tu correo y contraseña e inténtalo de nuevo.",
    };
  }

  // Ruteo por rol: el staff de IRStrat (tenant_id NULL) entra al panel interno;
  // el cliente/coordinador va a su portal (respetando `next` si es del portal,
  // solo rutas internas para evitar open redirect).
  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("tenant_id, tenants(activo)")
    .eq("id", data.user.id)
    .single();

  // Cliente desactivado: se corta aquí, no después de dejarlo entrar. El
  // middleware repite la comprobación en cada request (defensa en profundidad).
  if (perfil?.tenant_id != null && perfil.tenants?.activo === false) {
    await supabase.auth.signOut();
    return {
      error: "El acceso de tu organización está desactivado. Contacta al equipo de IRStrat.",
    };
  }

  if (perfil != null && perfil.tenant_id === null) {
    redirect("/admin");
  }
  redirect(next.startsWith("/portal") ? next : "/portal");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
