import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashTokenInvitacion } from "@/lib/invitaciones";
import { limpiarNombreTenant } from "@/lib/tenants";
import { EstablecerForm } from "./establecer-form";

export const metadata: Metadata = { title: "Establece tu contraseña" };

type Estado = "valida" | "inexistente" | "usada" | "vencida" | "sin_usuario";

/**
 * Canje de invitación. La página se resuelve con service_role porque quien llega
 * aún no tiene sesión: la autorización la da el token de la liga (un solo uso,
 * con vencimiento), no una identidad.
 */
export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: invitacion } = await admin
    .from("invitaciones")
    .select("id, perfil_id, tenant_id, expira_en, usada_en")
    // Sin decodeURIComponent: Next ya decodifica el parámetro de ruta, y la
    // server action hashea el token tal cual. Decodificar aquí los desalinearía
    // (y un '%' suelto en una liga mal copiada tiraría un 500 en vez de mostrar
    // la pantalla de "liga no válida").
    .eq("token_hash", hashTokenInvitacion(token))
    .maybeSingle();

  let estado: Estado = "valida";
  let nombre: string | null = null;
  let cliente: string | null = null;

  if (!invitacion) {
    estado = "inexistente";
  } else if (invitacion.usada_en) {
    estado = "usada";
  } else if (new Date(invitacion.expira_en) < new Date()) {
    estado = "vencida";
  } else {
    const [{ data: perfil }, { data: tenant }] = await Promise.all([
      admin.from("perfiles_usuario").select("nombre, activo").eq("id", invitacion.perfil_id).single(),
      admin.from("tenants").select("nombre").eq("id", invitacion.tenant_id).single(),
    ]);
    if (!perfil || !perfil.activo) {
      estado = "sin_usuario";
    } else {
      nombre = perfil.nombre.replace(/\[DEMO\]\s*/i, "").trim();
      cliente = tenant ? limpiarNombreTenant(tenant.nombre) : null;
    }
  }

  const marca = {
    titulo: "Un acceso propio, no una contraseña prestada.",
    texto:
      "Estableces tu contraseña una sola vez y desde ahí entras a tu portal de evidencia: tus solicitudes, tus cargas y su validación.",
  };

  if (estado !== "valida") {
    return (
      <AuthShell
        encabezado="Invitación"
        titulo={TITULOS[estado]}
        descripcion={DESCRIPCIONES[estado]}
        marca={marca}
      >
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
        >
          Ir al ingreso
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      encabezado="Invitación"
      titulo={nombre ? `Hola, ${nombre}` : "Establece tu contraseña"}
      descripcion={
        cliente
          ? `Estás activando tu acceso al portal de evidencia de ${cliente}. Elige la contraseña con la que entrarás de ahora en adelante.`
          : "Elige la contraseña con la que entrarás de ahora en adelante."
      }
      marca={marca}
    >
      <EstablecerForm token={token} />
    </AuthShell>
  );
}

const TITULOS: Record<Exclude<Estado, "valida">, string> = {
  inexistente: "Esta liga no es válida",
  usada: "Esta liga ya se usó",
  vencida: "Esta liga venció",
  sin_usuario: "Este acceso no está disponible",
};

const DESCRIPCIONES: Record<Exclude<Estado, "valida">, string> = {
  inexistente:
    "No encontramos esta invitación. Revisa que hayas copiado la liga completa, o pide una nueva al equipo de IRStrat.",
  usada:
    "Las invitaciones sirven una sola vez. Si ya estableciste tu contraseña, ingresa con ella; si no fuiste tú, avisa al equipo de IRStrat.",
  vencida:
    "Las invitaciones vencen a las 72 horas por seguridad. Pide una nueva al equipo de IRStrat.",
  sin_usuario:
    "El usuario de esta invitación está desactivado o ya no existe. Contacta al equipo de IRStrat.",
};
