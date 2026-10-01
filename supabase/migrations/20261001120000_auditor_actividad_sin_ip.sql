-- =============================================================================
-- auditor_actividad SIN dirección IP (01/10/2026).
--
-- Decisión de Esteban y Manuel a petición del cliente, por protección de datos:
-- la plataforma deja de registrar la IP del auditor externo. Se conserva todo
-- lo demás del registro (tipo de evento, objeto, archivo, fecha, navegador).
--
-- EXCEPCIONES a CLAUDE.md §3, aprobadas y anotadas en el encargo rol auditor §7:
--   1. El UPDATE que anula las IP ya guardadas no es aditivo: es una supresión
--      DELIBERADA de datos personales, irreversible. Los respaldos de Supabase
--      las conservan hasta que caducan (7 días).
--   2. El CHECK (ip IS NULL) es más estricto, no más amplio: es lo que garantiza
--      que ningún camino —código, script o service_role— vuelva a escribirla.
-- La columna NO se elimina (regla de migraciones aditivas): queda siempre null.
--
-- Idempotente: el UPDATE no toca nada la segunda vez, y el CHECK se crea solo si
-- no existe. No crea tablas ni buckets, así que no llama a
-- fn_aplicar_barrera_auditor() (sigue en 69).
-- =============================================================================

update public.auditor_actividad set ip = null where ip is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.auditor_actividad'::regclass
      and conname = 'auditor_actividad_sin_ip'
  ) then
    alter table public.auditor_actividad
      add constraint auditor_actividad_sin_ip check (ip is null);
  end if;
end $$;

comment on column public.auditor_actividad.ip is
  'Ya NO se registra desde el 01/10/2026 (protección de datos, a petición del cliente; encargo rol auditor §7). Siempre null: lo impone el CHECK auditor_actividad_sin_ip. La columna se conserva por la regla de migraciones aditivas.';
