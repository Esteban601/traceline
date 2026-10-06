-- =============================================================================
-- Tope de avisos inmediatos: correos retenidos (encargo
-- 2026-10-06-sistema-de-alertas, Paso 3; decisión 2 del Paso 0).
--
-- Máximo 20 avisos inmediatos por emisora y hora. Los que pasan del tope no se
-- pierden ni salen sueltos: se guardan aquí y el job de 10 minutos (el de la
-- cola, `/api/evidencias/procesar`) los manda en UN correo agrupado por
-- destinatario, y marca `agrupado_en`. La bitácora registra las dos cosas: la
-- retención (modo `retenido`) y el agrupado.
--
-- POR QUÉ UNA TABLA Y NO LA BITÁCORA. La bitácora la lee el administrador del
-- cliente, y aquí queda un extracto de lo retenido (el texto de un comentario,
-- p. ej.). Esta tabla la lee solo el staff y la escribe solo el sistema.
--
-- Aditiva: tabla nueva con RLS, lectura solo staff, sin escritura con sesión.
-- Grants explícitos (en este proyecto una tabla nueva no los hereda). Termina con
-- fn_aplicar_barrera_auditor() (CLAUDE.md §3). Idempotente.
-- =============================================================================

create table if not exists public.correos_retenidos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  destinatario_id uuid not null references public.perfiles_usuario (id) on delete cascade,
  -- La acción de bitácora del aviso retenido (aviso_comentario_auditor, …).
  accion          text not null,
  -- El hecho que lo originó: {tipo, id}.
  evento          jsonb not null,
  -- Lo que el correo agrupado dice de cada aviso: su asunto, un extracto y el
  -- enlace al objeto. No se guarda el HTML.
  asunto          text not null,
  extracto        text,
  ruta            text,
  created_at      timestamptz not null default now(),
  agrupado_en     timestamptz
);

comment on table public.correos_retenidos is
  'Avisos inmediatos que pasaron el tope de 20 por emisora y hora. El job de 10 minutos los manda en un correo agrupado por destinatario y marca agrupado_en. Solo staff lee; solo el sistema escribe.';

create index if not exists correos_retenidos_pendientes_idx
  on public.correos_retenidos (tenant_id, destinatario_id)
  where agrupado_en is null;

alter table public.correos_retenidos enable row level security;

drop policy if exists correos_retenidos_select on public.correos_retenidos;
create policy correos_retenidos_select on public.correos_retenidos
  for select to authenticated
  using (public.fn_is_staff());

revoke insert, update, delete on public.correos_retenidos from authenticated, anon;
drop policy if exists correos_retenidos_no_insert on public.correos_retenidos;
create policy correos_retenidos_no_insert on public.correos_retenidos
  as restrictive for insert to authenticated with check (false);
drop policy if exists correos_retenidos_no_update on public.correos_retenidos;
create policy correos_retenidos_no_update on public.correos_retenidos
  as restrictive for update to authenticated using (false);
drop policy if exists correos_retenidos_no_delete on public.correos_retenidos;
create policy correos_retenidos_no_delete on public.correos_retenidos
  as restrictive for delete to authenticated using (false);

grant select on public.correos_retenidos to authenticated;
grant select, insert, update on public.correos_retenidos to service_role;

select public.fn_aplicar_barrera_auditor();
