import { chromium } from "playwright";
const BASE = "https://traceline-staging-70ce5b369e7c.herokuapp.com";
const EMAIL = process.argv[2];
const PASS = process.argv[3];
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
await p.goto("/login", { waitUntil: "load" });
await p.fill("#email", "admin@irstrat.example");
await p.fill("#password", "Demo2025!");
await Promise.all([p.waitForURL(u => !u.pathname.startsWith("/login"), { timeout: 60000 }), p.click('button[type="submit"]')]);
await p.goto("/admin/usuarios", { waitUntil: "load" });
await p.waitForLoadState("networkidle").catch(()=>{});
const fila = p.locator("li").filter({ hasText: EMAIL });
if (await fila.count() !== 1) { console.error("filas encontradas:", await fila.count()); process.exit(1); }
await fila.getByRole("button", { name: "Invitar" }).click();
await p.waitForTimeout(6000);
const liga = await fila.locator("p.font-mono").first().textContent().catch(()=>null);
if (!liga || !liga.includes("/invitacion/")) { console.error("no obtuve la liga:", liga); process.exit(1); }
console.log("liga obtenida:", liga.replace(/\/invitacion\/.*/, "/invitacion/<token>"));
// Canje en un contexto limpio (quien canjea no tiene sesión).
const ctx2 = await b.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(liga.trim(), { waitUntil: "load" });
await p2.waitForLoadState("networkidle").catch(()=>{});
const campos = await p2.locator('input[type="password"]').count();
console.log("campos de contraseña en la página de canje:", campos);
for (let i = 0; i < campos; i++) await p2.locator('input[type="password"]').nth(i).fill(PASS);
await Promise.all([
  p2.waitForURL(u => /\/portal|\/login/.test(u.pathname), { timeout: 60000 }),
  p2.locator('button[type="submit"]').click(),
]);
console.log("tras canjear:", new URL(p2.url()).pathname);
await b.close();
