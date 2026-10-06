-- =============================================================================
-- Sugerencias regeneradas cuentan contra el tope de lecturas (encargo
-- 2026-10-04, captura sugerida — decisión al aprobar el Paso 2).
--
-- Una sugerencia es parte de la lectura y no cuenta aparte. La regeneración
-- por /api/evidencias/sugerir sí cuenta como una lectura contra
-- `tenants.lecturas_mes_max`, porque es lo que se puede repetir. Esta columna
-- es la que permite contarla.
--
-- Aditiva: una columna con default. Idempotente. No crea tabla; la barrera se
-- vuelve a aplicar igual (es idempotente).
-- =============================================================================

alter table public.sugerencias_captura
  add column if not exists regenerada boolean not null default false;

comment on column public.sugerencias_captura.regenerada is
  'true si la generó /api/evidencias/sugerir (regeneración sin volver a leer el archivo). Cuenta como una lectura contra tenants.lecturas_mes_max.';

create index if not exists sugerencias_captura_regenerada_mes_idx
  on public.sugerencias_captura (tenant_id, created_at) where regenerada;

select public.fn_aplicar_barrera_auditor();
