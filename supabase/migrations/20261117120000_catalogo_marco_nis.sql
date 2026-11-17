-- =============================================================================
-- MARCO NIS (IBSO, NIS A-1 del CINIF) Y COLUMNAS DE NOMBRE, PILAR ASG Y MEDICIÓN EN EL CATÁLOGO
-- (encargo docs/encargos/2026-11-17-catalogo-ibso.md, Fase 1; decisiones 2 y 4 de Esteban del 17/11/2026).
--
--   · marco: 'NIIF' | 'GRI' | 'SASB' | 'NIS'. El CHECK `datapoints_marco_chk` se sustituye por uno más amplio
--     (CLAUDE.md §3): toda fila que cumplía el anterior cumple este.
--   · nombre: el nombre del indicador («Emisiones GEI: alcance 1»). Hoy solo para NIS; GRI y SASB lo llevan en la
--     descripción.
--   · pilar_asg: 'A' | 'S' | 'G' (ambiental, social, gobernanza), el pilar de la NIS. `pilar` sigue siendo el enum
--     NIIF, NOT NULL, y para NIS se llena por indicador (decisión 4).
--   · como_se_mide: cómo se mide el indicador (redacción de IRStrat). `descripcion` lleva «qué recopilar».
-- Para NIS, `estandar` = «NIS A-1» y `edicion` = «2024» (CHECK `datapoints_edicion_chk` de v45). `pagina_origen` queda
-- nula: el texto no es el de la norma, que no se reproduce (CLAUDE.md §4).
--
-- ADITIVA: tres columnas nullable, un CHECK más amplio y un CHECK nuevo que ninguna fila existente viola (solo
-- restringe filas NIS, que aún no hay). La barrera del auditor es idempotente.
-- =============================================================================

alter table public.datapoints_taxonomia add column if not exists nombre text;
alter table public.datapoints_taxonomia add column if not exists pilar_asg text;
alter table public.datapoints_taxonomia add column if not exists como_se_mide text;

comment on column public.datapoints_taxonomia.nombre is
  'Nombre del indicador, para los marcos que lo tienen aparte de la descripción (NIS: «Emisiones GEI: alcance 1»).';
comment on column public.datapoints_taxonomia.pilar_asg is
  'Pilar ASG del indicador: A (ambiental), S (social) o G (gobernanza). Obligatorio para NIS; nulo para los demás.';
comment on column public.datapoints_taxonomia.como_se_mide is
  'Cómo se mide el indicador (orientación práctica, redacción de IRStrat). Para NIS; la descripción lleva qué recopilar.';

alter table public.datapoints_taxonomia drop constraint if exists datapoints_marco_chk;
alter table public.datapoints_taxonomia
  add constraint datapoints_marco_chk check (marco in ('NIIF', 'GRI', 'SASB', 'NIS'));

comment on column public.datapoints_taxonomia.marco is
  'Marco del datapoint: ''NIIF'' (taxonomía oficial S1/S2), ''GRI'', ''SASB'' o ''NIS'' (IBSO de la NIS A-1). Los conteos de avance y la plantilla oficial de taxonomía son solo de ''NIIF''; los demás cuentan aparte y van en su propio libro.';

alter table public.datapoints_taxonomia drop constraint if exists datapoints_pilar_asg_chk;
alter table public.datapoints_taxonomia
  add constraint datapoints_pilar_asg_chk check (
    (pilar_asg is null or pilar_asg in ('A', 'S', 'G'))
    and (marco <> 'NIS' or (pilar_asg is not null and nombre is not null))
  );

select public.fn_aplicar_barrera_auditor();
