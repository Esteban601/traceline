-- =============================================================================
-- Pasada de coherencia del Suplemento (encargo 2026-10-06, suplemento-calidad —
-- Paso 3 (d)).
--
-- Al terminar de generar un documento, UNA llamada al modelo lee el documento
-- completo y devuelve observaciones estructuradas: terminología inconsistente,
-- repeticiones entre bloques, referencias cruzadas que no se sostienen y bloques
-- que anuncian algo que termina en pendiente. Cada pasada es una fila, con su
-- costo. No edita nada: el revisor ve la lista y decide.
--
-- QUIÉN ESCRIBE: el staff (la pasada corre con su sesión, como la generación de
-- los bloques). QUIÉN LEE: staff, y el administrador del cliente de su emisora,
-- igual que los bloques del documento. Usuarios de área, no.
--
-- Una sola pasada `generando` por documento (índice único parcial): dos clics o
-- el fin de la generación y un clic a la vez no pagan dos llamadas.
--
-- Aditiva: tabla nueva con RLS y barrera (CLAUDE.md §3).
-- =============================================================================

create table if not exists public.observaciones_coherencia (
  id                              uuid primary key default gen_random_uuid(),
  documento_id                    uuid not null references public.documentos_generados (id) on delete cascade,
  tenant_id                       uuid not null references public.tenants (id) on delete cascade,
  estado                          text not null default 'generando'
                                  check (estado in ('generando', 'lista', 'error')),
  origen                          text not null default 'manual'
                                  check (origen in ('fin_de_generacion', 'manual')),
  -- [{tipo, gravedad, bloques[], bloque_de_la_cita, cita, observacion, sugerencia, afecta_texto_del_emisor}]
  observaciones                   jsonb not null default '[]'::jsonb,
  -- Observaciones que el modelo devolvió con una cita que no está en el bloque: se descartan.
  descartadas                     integer not null default 0,
  bloques_revisados               integer not null default 0,
  modelo                          text,
  prompt_version                  text,
  tokens_entrada                  integer not null default 0,
  tokens_entrada_cache_escritura  integer not null default 0,
  tokens_entrada_cache_lectura    integer not null default 0,
  tokens_salida                   integer not null default 0,
  costo_usd                       numeric(10, 4) not null default 0,
  duracion_ms                     integer not null default 0,
  error                           text,
  solicitado_por                  uuid references public.perfiles_usuario (id) on delete set null,
  created_at                      timestamptz not null default now(),
  terminado_en                    timestamptz
);

comment on table public.observaciones_coherencia is
  'Pasadas de coherencia de un documento del Suplemento: observaciones estructuradas sobre el documento completo, con su costo. No editan nada (encargo suplemento-calidad, Paso 3).';

create index if not exists observaciones_coherencia_documento_idx
  on public.observaciones_coherencia (documento_id, created_at desc);
create unique index if not exists observaciones_coherencia_una_en_curso
  on public.observaciones_coherencia (documento_id) where estado = 'generando';

alter table public.observaciones_coherencia enable row level security;

grant select, insert, update on public.observaciones_coherencia to authenticated;
grant select on public.observaciones_coherencia to service_role;

drop policy if exists observaciones_coherencia_staff_all on public.observaciones_coherencia;
create policy observaciones_coherencia_staff_all on public.observaciones_coherencia
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

drop policy if exists observaciones_coherencia_admin_cliente_select on public.observaciones_coherencia;
create policy observaciones_coherencia_admin_cliente_select on public.observaciones_coherencia
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

select public.fn_aplicar_barrera_auditor();
