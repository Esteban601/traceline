-- =============================================================================
-- Banco de importancia sistémica global (correcciones v6.1 del demo, decisión de
-- Esteban del 10/11/2026, punto 10).
--
--   · perfil_emisor.banco_sistemico_global — si la emisora es un banco de
--     importancia sistémica global (G-SIB). Lo pide SASB FN-CB-550a.1 (puntuación
--     G-SIB por categoría): con «false», la respuesta es «No aplica: la Compañía no
--     es un banco de importancia sistémica global»; con «true», la puntuación queda
--     pendiente; null = sin capturar (pendiente con el campo).
--
-- ADITIVA: una columna nullable en una tabla con RLS existente; la llamada a la
-- barrera es idempotente y va aunque no se cree tabla (CLAUDE.md §3).
-- =============================================================================

alter table public.perfil_emisor add column if not exists banco_sistemico_global boolean;

comment on column public.perfil_emisor.banco_sistemico_global is 'Si la emisora es un banco de importancia sistémica global (G-SIB), para SASB FN-CB-550a.1. false → «No aplica»; true → puntuación G-SIB pendiente; null → sin capturar.';

select public.fn_aplicar_barrera_auditor();
