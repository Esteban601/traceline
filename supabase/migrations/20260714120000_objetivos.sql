-- =============================================================================
-- Fase 3, Sprint 3 — Registro de objetivos climáticos y de sostenibilidad.
--
-- Alimenta 5 hojas de la plantilla oficial:
--   · NIIF S1 51           — objetivos de sostenibilidad (todos los ámbitos),
--                            en secciones Riesgos / Oportunidades.
--   · NIIF S2 33           — objetivos climáticos (definición completa).
--   · NIIF S2 34/35/36(a-d)— fichas hermanas de un objetivo climático, keyed por
--                            el MISMO objetivo y escritas en el MISMO orden de
--                            filas (el lector sigue un objetivo a través de ellas).
--
-- LEY DE LA CASA: toda tabla nueva incluye sus GRANTS explícitos.
-- RLS: internos de IRStrat → solo staff (patrón registros_clima).
-- =============================================================================

-- 1. objetivos -----------------------------------------------------------------
--    Ficha de un objetivo. `naturaleza` clasifica el objetivo para la hoja S1 51
--    (secciones Riesgos / Oportunidades). Los campos siguen las columnas verbatim
--    de la plantilla (S2 33 y S1 51).
create table public.objetivos (
  id                               uuid primary key default gen_random_uuid(),
  reporte_id                       uuid not null references public.reportes (id) on delete cascade,
  ambito                           text not null
                                     check (ambito in ('climatico', 'sostenibilidad')),
  naturaleza                       text not null default 'riesgo'
                                     check (naturaleza in ('riesgo', 'oportunidad')),
  nombre                           text not null,
  descripcion                      text,
  tipo                             text,  -- cuantitativo / cualitativo (S2 33 B, S1 51 B)
  metrica                          text,  -- S2 33 C / S1 51 C
  meta                             text,  -- "Objetivo de la meta" (S2 33 D)
  parte_entidad                    text,  -- S2 33 E
  periodo_aplicacion               text,  -- S2 33 F / S1 51 E
  periodo_base                     text,  -- S2 33 G / S1 51 F
  hito_intermedio                  text,  -- S2 33 H / S1 51 G
  tipo_objetivo                    text,  -- absoluto / de intensidad (S2 33 I)
  alineacion_acuerdo_internacional text,  -- S2 33 J
  orden                            int not null default 0,
  activo                           boolean not null default true,
  created_at                       timestamptz not null default now()
);

create index objetivos_reporte_idx on public.objetivos (reporte_id);
create index objetivos_ambito_idx  on public.objetivos (ambito, orden);

comment on table public.objetivos is
  'Objetivos climáticos y de sostenibilidad de un reporte (NIIF S1 51 / S2 33). Solo staff (RLS). No se borran: se desactivan (activo=false) por trazabilidad. `naturaleza` ubica el objetivo en las secciones Riesgos/Oportunidades de la hoja S1 51.';

-- 2. objetivos_detalle (1:1, EDITABLE) -----------------------------------------
--    Atributos de las hojas hermanas de un objetivo climático. Ficha descriptiva
--    editable (no evidencia => no append-only), pero TODO cambio va a bitácora.
--    unique(objetivo_id) garantiza la relación 1:1 y habilita upsert.
create table public.objetivos_detalle (
  id                       uuid primary key default gen_random_uuid(),
  objetivo_id              uuid not null unique
                             references public.objetivos (id) on delete cascade,
  -- S2 34 — validación, supervisión y revisión
  validacion_tercero       text,  -- B: validado por un tercero
  procesos_revision        text,  -- C: procesos para revisar el objetivo
  metricas_supervision     text,  -- D: métricas para supervisar el progreso
  revisiones               text,  -- E: información sobre las revisiones (S1 51 I)
  -- S2 35 — resultados y análisis de tendencias
  resultados               text,  -- B: resultados en relación con el objetivo
  analisis_tendencias      text,  -- C: análisis de tendencias/cambios
  -- S2 36 (a)-(d) — cobertura del objetivo
  gases_cubiertos          text,  -- (a) B: gases de efecto invernadero cubiertos
  alcances_cubiertos       text,  -- (b) C: Alcance 1/2/3 cubiertos por el objetivo
  bruto_neto               text,  -- (c) D: emisiones brutas o netas
  enfoque_descarbonizacion text,  -- (d) E: enfoque de descarbonización sectorial
  notas                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.objetivos_detalle is
  'Ficha descriptiva 1:1 de un objetivo (hojas hermanas S2 34/35/36(a)-(d) y columnas H/I de S1 51). Editable, pero cada cambio se registra en bitácora. `alcances_cubiertos` = col C de S2 36 (Alcance 1/2/3); `enfoque_descarbonizacion` = col (d) de S2 36.';

-- 3. GRANTS (LEY DE LA CASA) ---------------------------------------------------
grant select, insert, update, delete on public.objetivos         to authenticated;
grant select, insert, update, delete on public.objetivos_detalle to authenticated;
grant select on public.objetivos, public.objetivos_detalle to service_role;

-- 4. RLS — solo staff (patrón registros_clima) ---------------------------------
alter table public.objetivos         enable row level security;
alter table public.objetivos_detalle enable row level security;

create policy objetivos_staff_all on public.objetivos
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

create policy objetivos_detalle_staff_all on public.objetivos_detalle
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());
