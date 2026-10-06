#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Crea en ensayo el auditor de utilería para los e2e del rol auditor (Paso 4 del
// encargo 2026-10-05-generador-a-produccion). Lo inverso es borrar-utileria.sql.
//
//   E2E_PASSWORD_AUDITOR=… node scripts/ensayo/crear-utileria.mjs
//
// Requiere en el entorno NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de
// ensayo. La copia de staging no trae al auditor del seed: se crea con su id y
// su correo del seed, sobre Empresa Demo (nunca Grupo Carso), con el nombre
// «[ENSAYO] …» que exige borrar-utileria.sql. La contraseña llega por el entorno
// del subshell y no se imprime ni se escribe.
// -----------------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_PASSWORD_AUDITOR;
const ID = "a0000000-0000-0000-0000-000000000007";
const EMAIL = "auditor.externo@despacho.example";
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";

if (!URL_SB?.includes("sqpxcxewoznhpwvhxamy") || !SERVICE || !PASSWORD) {
  console.error("✗ Solo contra ensayo, con SUPABASE_SERVICE_ROLE_KEY y E2E_PASSWORD_AUDITOR en el entorno.");
  process.exit(2);
}

const svc = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });

const { data: previo } = await svc.auth.admin.getUserById(ID);
if (previo?.user) {
  console.error(`✗ Ya existe el usuario ${ID}; corre borrar-utileria.sql antes.`);
  process.exit(1);
}

const { error: eUser } = await svc.auth.admin.createUser({ id: ID, email: EMAIL, password: PASSWORD, email_confirm: true });
if (eUser) throw new Error(`createUser: ${eUser.message}`);

const { error: ePerfil } = await svc.from("perfiles_usuario").upsert({
  id: ID, tenant_id: TENANT_DEMO, rol: "auditor", area: null, nombre: "[ENSAYO] Auditor externo", email: EMAIL,
});
if (ePerfil) throw new Error(`perfil: ${ePerfil.message}`);

const { data: perfil } = await svc.from("perfiles_usuario").select("rol, tenant_id, nombre").eq("id", ID).single();
const bien = perfil?.rol === "auditor" && perfil.tenant_id === TENANT_DEMO && perfil.nombre.startsWith("[ENSAYO]");
console.log(bien ? `✓ auditor de utilería creado en Empresa Demo (${ID})` : "✗ el perfil no quedó como se esperaba");
process.exit(bien ? 0 : 1);
