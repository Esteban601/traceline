-- =============================================================================
-- Libro de hechos del Suplemento (encargo 2026-10-06, suplemento-calidad —
-- Paso 5, redefinido por la revisión externa del 7 de octubre de 2026).
--
-- Antes de generar, un libro por reporte con los HECHOS ATÓMICOS de sus fuentes:
-- solicitudes (capturas confirmadas, extractos confirmados, respuestas de
-- cuestionarios), Perfil del emisor (y los registros y objetivos que la emisora
-- declara en la plataforma) y adjuntos del Perfil. Cada hecho trae:
--   · su extracto LITERAL y su ubicación, verificados por código contra el texto
--     de la fuente (lo que no está ahí se descarta, con el motivo);
--   · su rango de fuente: validado > perfil > adjunto;
--   · su bloque dueño (uno) y los bloques que pueden referirlo en una línea;
--   · si choca con otro hecho de la misma clave: grupo de contradicción.
-- Los bloques generarán desde su subconjunto (pasos siguientes), no desde los
-- adjuntos completos. Revisión externa: docs/suplemento-s1s2/revision-externa-2026-10-07.md.
--
-- QUIÉN ESCRIBE: el staff (el libro se arma con su sesión, como la generación).
-- QUIÉN LEE: staff, y el administrador del cliente de su emisora. Ni usuarios de
-- área ni auditor (el suplemento está fuera de su alcance).
--
-- Aditiva: dos tablas nuevas con RLS y barrera.
-- =============================================================================

create table if not exists public.libros_hechos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  reporte_id      uuid not null references public.reportes (id) on delete cascade,
  estado          text not null default 'generando' check (estado in ('generando', 'listo', 'error')),
  -- Huella de los insumos: con la misma huella, el libro se reutiliza.
  huella          text,
  modelo          text,
  prompt_version  text,
  llamadas        integer not null default 0,
  tokens_entrada  integer not null default 0,
  tokens_entrada_cache_escritura integer not null default 0,
  tokens_entrada_cache_lectura   integer not null default 0,
  tokens_salida   integer not null default 0,
  costo_usd       numeric(10, 4) not null default 0,
  duracion_ms     integer not null default 0,
  -- Conteos por rango, fuente, verificación y contradicciones; y los insumos que no entraron.
  resumen         jsonb not null default '{}'::jsonb,
  error           text,
  creado_por      uuid references public.perfiles_usuario (id) on delete set null,
  created_at      timestamptz not null default now(),
  terminado_en    timestamptz
);

comment on table public.libros_hechos is
  'Un libro de hechos por corrida y reporte: la capa de hechos atómicos verificados de la que generan los bloques del Suplemento (encargo suplemento-calidad, Paso 5).';

create index if not exists libros_hechos_reporte_idx on public.libros_hechos (reporte_id, created_at desc);
create unique index if not exists libros_hechos_uno_en_curso on public.libros_hechos (reporte_id) where estado = 'generando';

create table if not exists public.hechos (
  id                 uuid primary key default gen_random_uuid(),
  libro_id           uuid not null references public.libros_hechos (id) on delete cascade,
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  -- Sujeto y atributo canónicos, en snake_case: comite_sostenibilidad.frecuencia_sesiones.
  clave              text not null,
  enunciado          text not null,
  tipo               text not null check (tipo in ('cifra', 'fecha', 'nombre', 'frecuencia', 'responsable', 'composicion', 'proceso', 'politica', 'otro')),
  valor              numeric,
  unidad             text,
  periodo            text,
  rango_fuente       text not null check (rango_fuente in ('validado', 'perfil', 'adjunto')),
  fuente_tipo        text not null check (fuente_tipo in ('captura', 'extracto', 'cuestionario', 'perfil', 'registro', 'objetivo', 'adjunto')),
  -- Id citable (sol:…, cue:…, perfil:campo, reg:…, obj:…, adj:<adjunto>:p3) y detalle legible.
  fuente_id          text not null,
  fuente_detalle     text not null,
  extracto           text not null,
  verificado         boolean not null default false,
  -- Cómo se verificó (registro, subcadena) o por qué se descartó.
  verificacion       text,
  bloque_dueno       integer check (bloque_dueno between 1 and 40),
  bloques_referencia integer[] not null default '{}',
  grupo_conflicto    uuid,
  conflicto          text,
  estado             text not null default 'vigente' check (estado in ('vigente', 'en_conflicto', 'descartado')),
  created_at         timestamptz not null default now()
);

comment on table public.hechos is
  'Hechos atómicos del libro: enunciado, extracto literal verificado por código, rango de fuente, bloque dueño y contradicciones (encargo suplemento-calidad, Paso 5).';

create index if not exists hechos_libro_idx on public.hechos (libro_id, bloque_dueno);
create index if not exists hechos_clave_idx on public.hechos (libro_id, clave);

alter table public.libros_hechos enable row level security;
alter table public.hechos enable row level security;

grant select, insert, update on public.libros_hechos to authenticated;
grant select, insert, update on public.hechos to authenticated;
grant select on public.libros_hechos to service_role;
grant select on public.hechos to service_role;

drop policy if exists libros_hechos_staff_all on public.libros_hechos;
create policy libros_hechos_staff_all on public.libros_hechos
  for all to authenticated using (public.fn_is_staff()) with check (public.fn_is_staff());
drop policy if exists libros_hechos_admin_cliente_select on public.libros_hechos;
create policy libros_hechos_admin_cliente_select on public.libros_hechos
  for select to authenticated using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

drop policy if exists hechos_staff_all on public.hechos;
create policy hechos_staff_all on public.hechos
  for all to authenticated using (public.fn_is_staff()) with check (public.fn_is_staff());
drop policy if exists hechos_admin_cliente_select on public.hechos;
create policy hechos_admin_cliente_select on public.hechos
  for select to authenticated using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

select public.fn_aplicar_barrera_auditor();
