-- =============================================================================
-- Libro de hechos: estado propio para la corrida que reutiliza un libro
-- (encargo 2026-10-06, suplemento-calidad — Paso 5).
--
-- Cuando los insumos no cambiaron (misma huella), la corrida no paga otra vez:
-- apunta al libro que reutiliza. Hasta aquí quedaba en «error», que no lo es.
--   · CHECK de `estado` sustituido por uno más amplio: + 'reutilizado'.
--   · `reutiliza_libro`: el libro listo que vale para esta corrida.
-- Aditiva (CLAUDE.md §3: sustituir un CHECK por uno más amplio está permitido).
-- =============================================================================

alter table public.libros_hechos drop constraint if exists libros_hechos_estado_check;
alter table public.libros_hechos
  add constraint libros_hechos_estado_check check (estado in ('generando', 'listo', 'reutilizado', 'error'));

alter table public.libros_hechos
  add column if not exists reutiliza_libro uuid references public.libros_hechos (id) on delete set null;

comment on column public.libros_hechos.reutiliza_libro is
  'Si la corrida no cambió los insumos (misma huella), el libro listo que reutiliza; estado «reutilizado».';

select public.fn_aplicar_barrera_auditor();
