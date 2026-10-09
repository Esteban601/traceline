import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const hasta = Date.now() + 10 * 60 * 1000;
while (Date.now() < hasta) {
  const { data: p } = await db.from("observaciones_coherencia").select("estado, observaciones, costo_usd, error, duracion_ms").eq("documento_id", "98d57a6a-0ff0-4725-bab2-dae21b8f7bc5").order("created_at", { ascending: false }).limit(1).single();
  if (p.estado !== "generando") {
    const t = {}; for (const o of p.observaciones ?? []) { const k = `${o.origen ?? "modelo"}:${o.tipo}`; t[k] = (t[k] ?? 0) + 1; }
    console.log(p.estado, "obs", (p.observaciones ?? []).length, "$" + p.costo_usd, Math.round((p.duracion_ms ?? 0) / 1000) + "s", JSON.stringify(t), (p.error ?? "").slice(0, 200));
    for (const o of (p.observaciones ?? []).filter((o) => (o.origen ?? "modelo") === "modelo")) console.log(` · ${o.tipo} [${o.bloques.join(",")}] ${o.observacion.slice(0, 170)}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 15000));
}
console.log("sigue generando tras 10 min");
