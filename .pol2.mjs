import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(process.argv[2],"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2].replace(/^'|'$/g,""); }
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error } = await c.auth.signInWithPassword({ email: process.argv[3], password: process.argv[4] });
if (error) { console.error("login:", error.message); process.exit(1); }
console.log("login de datos:", "✓");
const { data: staffVis } = await c.from("perfiles_usuario").select("email, rol").is("tenant_id", null);
console.log("perfiles de IRStrat visibles para el cliente:", JSON.stringify(staffVis));
const { data: sols } = await c.from("solicitudes").select("id, titulo, area_asignada").limit(3);
console.log("solicitudes visibles (muestra):", (sols??[]).length, (sols??[]).map(s=>s.area_asignada).join(","));
const { data: evs } = await c.from("evidencias").select("nombre_original, cargado_por_staff, subio:perfiles_usuario!evidencias_subido_por_fkey(nombre)").like("notas","[HISTÓRICO]%");
console.log("evidencias históricas visibles:", (evs??[]).length);
for (const e of (evs??[]).slice(0,4)) console.log(`   ${e.nombre_original} · cargado_por_staff=${e.cargado_por_staff} · por=${e.subio?.nombre ?? "—"}`);
const { data: caps } = await c.from("capturas_valor").select("periodo").in("periodo",["2023","2024"]);
console.log("capturas históricas visibles:", (caps??[]).length);
