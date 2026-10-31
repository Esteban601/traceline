-- =============================================================================
-- MARCO SASB Y COLUMNAS DE ESTÁNDAR, EDICIÓN Y PÁGINA DE ORIGEN EN EL CATÁLOGO
-- (encargo docs/encargos/2026-10-31-catalogo-gri-sasb.md, Fase 1, decisiones 5 y 7 de Esteban).
--
--   · marco: 'NIIF' | 'GRI' | 'SASB'. El CHECK `datapoints_marco_chk` se sustituye por uno más amplio
--     (CLAUDE.md §3): toda fila que cumplía el anterior cumple este.
--   · estandar: la norma de la que sale la fila, p. ej. «GRI 2», «GRI 303», «SASB FN-CB».
--   · edicion: la edición de esa norma, p. ej. «2021», «2016», «2025-12». OBLIGATORIA para GRI y SASB (decisión 5:
--     306-3 es «Derrames significativos» en GRI 306 de 2016 y «Residuos generados» en la de 2020; 302 y 305 los
--     sustituyen GRI 103 y GRI 102 desde 2027).
--   · pagina_origen: página del ARCHIVO PDF oficial (empezando en 1) de la que se tomó el texto literal.
-- Para NIIF las tres columnas quedan nulas: el catálogo NIIF ya tiene su auditoría por párrafo.
--
-- Las cuatro filas de la «Extensión GRI» reciben su estándar y edición. Su descripción no cambia aquí (son las
-- que la firma redactó en 2026-08; su texto literal entra con el nivel medio del encargo).
--
-- ADITIVA: tres columnas nullable, un CHECK más amplio y un CHECK nuevo que las filas existentes cumplen (se
-- llenan antes de crearlo). La barrera del auditor es idempotente.
-- =============================================================================

alter table public.datapoints_taxonomia add column if not exists estandar text;
alter table public.datapoints_taxonomia add column if not exists edicion text;
alter table public.datapoints_taxonomia add column if not exists pagina_origen integer;

comment on column public.datapoints_taxonomia.estandar is
  'Norma de la que sale el datapoint: «GRI 2», «GRI 303», «SASB FN-CB»… Nula para NIIF S1/S2 (la da `norma`).';
comment on column public.datapoints_taxonomia.edicion is
  'Edición de la norma (GRI: año, p. ej. «2021»; SASB: versión, p. ej. «2025-12»). Obligatoria para GRI y SASB.';
comment on column public.datapoints_taxonomia.pagina_origen is
  'Página del archivo PDF oficial (empezando en 1) de la que se tomó el texto literal de la descripción.';

alter table public.datapoints_taxonomia drop constraint if exists datapoints_marco_chk;
alter table public.datapoints_taxonomia
  add constraint datapoints_marco_chk check (marco in ('NIIF', 'GRI', 'SASB'));

comment on column public.datapoints_taxonomia.marco is
  'Marco del datapoint: ''NIIF'' (taxonomía oficial S1/S2), ''GRI'' o ''SASB''. Los conteos de avance y la plantilla oficial de taxonomía son solo de ''NIIF''; GRI y SASB cuentan aparte y van en su propio libro.';

-- Extensión GRI: estándar y edición de las cuatro filas que ya existen (las ediciones vigentes de su contenido).
update public.datapoints_taxonomia set estandar = 'GRI 303', edicion = '2018'
 where marco = 'GRI' and codigo = 'GRI 303-5' and estandar is null;
update public.datapoints_taxonomia set estandar = 'GRI 306', edicion = '2020'
 where marco = 'GRI' and codigo = 'GRI 306-3' and estandar is null;
update public.datapoints_taxonomia set estandar = 'GRI 404', edicion = '2016'
 where marco = 'GRI' and codigo = 'GRI 404-1' and estandar is null;
update public.datapoints_taxonomia set estandar = 'GRI 2 / GRI 401', edicion = '2021 / 2016'
 where marco = 'GRI' and codigo = 'GRI 2-7 / 401-1' and estandar is null;

alter table public.datapoints_taxonomia drop constraint if exists datapoints_edicion_chk;
alter table public.datapoints_taxonomia
  add constraint datapoints_edicion_chk check (marco = 'NIIF' or (estandar is not null and edicion is not null));

create index if not exists datapoints_estandar_idx on public.datapoints_taxonomia (marco, estandar);

select public.fn_aplicar_barrera_auditor();
