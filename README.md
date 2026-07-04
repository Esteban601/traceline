# vert-evidencia

Herramienta de **recabado y trazabilidad de evidencia ESG** (taxonomía NIIF
S1/S2), multi-tenant, para la elaboración de Reportes Anuales Sustentables de
emisoras BMV (IRStrat / Vert).

> El nombre comercial está **pendiente**. La aplicación lo toma siempre de
> `NEXT_PUBLIC_APP_NAME` (default provisional: `TRACELINE`), nunca hardcodeado.

## Estado

Fase actual: **base de datos, seguridad y seeds** (sin UI todavía).
Stack: Next.js 15 (App Router, TypeScript, pnpm) + Supabase local (CLI + Docker).

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local     # ajusta claves (ver `supabase status`)
supabase start                 # levanta Postgres/Studio/Storage local
supabase db reset              # aplica migraciones + seed DEMO
```

## Documentación

- **[README-SCHEMA.md](./README-SCHEMA.md)** — esquema, diagrama de relaciones,
  modelo RLS, triggers, storage, **credenciales demo** y decisiones de diseño.
- Types generados: `lib/database.types.ts`
  (`supabase gen types typescript --local > lib/database.types.ts`).
