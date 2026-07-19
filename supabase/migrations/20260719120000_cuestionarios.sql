-- =============================================================================
-- Fase 3, Sprint 4 — Cuestionarios narrativos (cierre del Excel de taxonomía).
--
-- Alimenta 3 hojas de la plantilla oficial (rejillas pregunta/respuesta):
--   · NIIF S2 22(b)(i)      — insumos del análisis de escenarios climáticos.
--   · NIIF S2 22(b)(ii)     — supuestos clave del análisis de escenarios.
--   · NIIF S2 36(e)(i)-(iv) — créditos de carbono para objetivos de emisiones netas.
--
-- Las PREGUNTAS no viven en BD: son fijas de la plantilla y se definen como
-- catálogo tipado en código (lib/cuestionarios.ts). Aquí solo vive la RESPUESTA,
-- ligada por (hoja, pregunta_orden). Ficha descriptiva editable (no evidencia =>
-- no append-only), pero TODO cambio va a bitácora.
--
-- LEY DE LA CASA: toda tabla nueva incluye sus GRANTS explícitos.
-- RLS: internos de IRStrat → solo staff (patrón objetivos / registros_clima).
-- =============================================================================

-- 1. cuestionarios_respuestas --------------------------------------------------
--    Una respuesta por (reporte, hoja, pregunta_orden). unique(...) garantiza la
--    unicidad y habilita el upsert desde la UI.
create table public.cuestionarios_respuestas (
  id             uuid primary key default gen_random_uuid(),
  reporte_id     uuid not null references public.reportes (id) on delete cascade,
  hoja           text not null
                   check (hoja in ('S2 22(b)(i)', 'S2 22(b)(ii)', 'S2 36(e)')),
  pregunta_orden int  not null,
  respuesta      text,
  tipo_dato      text,  -- col "Tipo de dato" de la plantilla (Cualitativo/Cuantitativo/…)
  notas          text,  -- col "Notas / Brechas"
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (reporte_id, hoja, pregunta_orden)
);

create index cuestionarios_respuestas_reporte_idx
  on public.cuestionarios_respuestas (reporte_id, hoja, pregunta_orden);

comment on table public.cuestionarios_respuestas is
  'Respuestas a los cuestionarios narrativos (NIIF S2 22(b)(i)/(ii) y 36(e)). Las preguntas son fijas de la plantilla y viven en código (lib/cuestionarios.ts); aquí solo la respuesta, ligada por (hoja, pregunta_orden). Editable, pero cada cambio se registra en bitácora.';

-- 2. GRANTS (LEY DE LA CASA) ---------------------------------------------------
grant select, insert, update, delete on public.cuestionarios_respuestas to authenticated;
grant select on public.cuestionarios_respuestas to service_role;

-- 3. RLS — solo staff (patrón objetivos) ---------------------------------------
alter table public.cuestionarios_respuestas enable row level security;

create policy cuestionarios_respuestas_staff_all on public.cuestionarios_respuestas
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());
