-- =============================================================================
-- Sprint 7 — Operación multi-cliente: alta de tenants desde UI + branding.
--
--  1. tenants: prefijo_folio (clave corta de la emisora) y logo_url (branding).
--     El slug pasa a validarse en la BD (kebab-case), no solo en la UI.
--
--  2. areas_tenant: las áreas del cliente dejan de ser texto libre disperso en
--     perfiles_usuario.area y solicitudes.area_asignada y pasan a tener un
--     catálogo POR TENANT. No se toca el texto existente (sigue siendo la
--     fuente para el export y las solicitudes): esta tabla es el catálogo que
--     el alta siembra y del que se alimentan los selectores. Se backfillea con
--     las áreas ya presentes en los datos para no inventar nada.
--
--  3. invitaciones: liga de un solo uso con expiración para que la persona
--     establezca SU contraseña. Se guarda el SHA-256 del token, nunca el token
--     (una fuga de BD no debe entregar accesos). El canje ocurre sin sesión, con
--     service_role; por eso 'authenticated' no necesita UPDATE aquí.
--
--  4. storage bucket 'logos': PÚBLICO DE LECTURA (el logo se pinta en el header
--     del portal sin firmar URLs), escritura solo staff. Las políticas son
--     explícitas: el patrón de grants aplica también a storage.
--
-- Las tablas nuevas NO quedan cubiertas por el grant "on all tables" de la
-- migración inicial (es puntual, no futuro): se otorgan aquí una por una.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. tenants — prefijo de folios, logo y slug validado
-- -----------------------------------------------------------------------------
alter table public.tenants
  add column prefijo_folio text,
  add column logo_url      text;

comment on column public.tenants.prefijo_folio is
  'Clave corta de la emisora (3-4 letras mayúsculas, única). Prefijo de folios y etiqueta breve del cliente en el panel staff.';
comment on column public.tenants.logo_url is
  'URL pública del logo en el bucket ''logos''. NULL = sin logo (la UI cae a las iniciales del tenant).';

-- Backfill: los tenants preexistentes necesitan un prefijo antes del NOT NULL.
-- Se deriva del nombre (primeras 4 letras A-Z, sin la etiqueta [DEMO]), se
-- rellena a 3 si el nombre es corto y se desempata con una letra final —nunca
-- un dígito— para no violar el formato ^[A-Z]{3,4}$ que se declara abajo.
do $$
declare
  r      record;
  v_base text;
  v_cand text;
  v_i    int;
begin
  for r in
    select id, nombre from public.tenants where prefijo_folio is null order by created_at, id
  loop
    v_base := left(
      upper(regexp_replace(regexp_replace(r.nombre, '\[DEMO\]', '', 'gi'), '[^a-zA-Z]', '', 'g')),
      4
    );
    -- rpad TRUNCA además de rellenar: solo se aplica si falta longitud.
    if length(v_base) < 3 then
      v_base := rpad(v_base, 3, 'X');   -- nombres cortos o sin letras -> mínimo 3
    end if;
    v_cand := v_base;
    v_i    := 0;

    while exists (select 1 from public.tenants where prefijo_folio = v_cand) loop
      v_i := v_i + 1;
      if v_i > 26 then
        raise exception 'No se pudo derivar un prefijo de folios único para el tenant %', r.id;
      end if;
      v_cand := left(v_base, 3) || chr(64 + v_i);   -- EMP -> EMPA, EMPB, …
    end loop;

    update public.tenants set prefijo_folio = v_cand where id = r.id;
  end loop;
end $$;

alter table public.tenants
  alter column prefijo_folio set not null,
  add constraint tenants_prefijo_folio_unique unique (prefijo_folio),
  add constraint tenants_prefijo_folio_formato check (prefijo_folio ~ '^[A-Z]{3,4}$'),
  add constraint tenants_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- -----------------------------------------------------------------------------
-- 2. areas_tenant — catálogo de áreas por cliente
-- -----------------------------------------------------------------------------
create table public.areas_tenant (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  nombre     text not null,
  orden      int  not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, nombre)
);

comment on table public.areas_tenant is
  'Áreas del cliente (RH, Operaciones, Finanzas, …). Catálogo por tenant que alimenta los selectores de alta de usuarios y solicitudes.';

create index areas_tenant_tenant_idx on public.areas_tenant (tenant_id);

-- Backfill sin inventar datos: las áreas que YA existen en los datos del tenant
-- (usuarios asignados y solicitudes con área) se vuelven su catálogo inicial.
insert into public.areas_tenant (tenant_id, nombre, orden)
select tenant_id, nombre, row_number() over (partition by tenant_id order by nombre) - 1
from (
  select p.tenant_id, p.area as nombre
  from public.perfiles_usuario p
  where p.tenant_id is not null and p.area is not null and btrim(p.area) <> ''
  union
  select r.tenant_id, s.area_asignada as nombre
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.area_asignada is not null and btrim(s.area_asignada) <> ''
) origen
on conflict (tenant_id, nombre) do nothing;

alter table public.areas_tenant enable row level security;

grant select, insert, update, delete on public.areas_tenant to authenticated;
grant select on public.areas_tenant to service_role;

-- El usuario del cliente ve el catálogo de su tenant (los selectores del portal
-- lo necesitan); escribirlo es del staff.
create policy areas_tenant_select on public.areas_tenant
  for select to authenticated
  using (public.fn_is_staff() or tenant_id = public.fn_current_tenant());

create policy areas_tenant_staff_write on public.areas_tenant
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- 3. invitaciones — liga de un solo uso para establecer contraseña
-- -----------------------------------------------------------------------------
create table public.invitaciones (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles_usuario (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  token_hash text not null unique,
  expira_en  timestamptz not null,
  usada_en   timestamptz,
  creada_por uuid references public.perfiles_usuario (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.invitaciones is
  'Invitación de un solo uso (expira a las 72 h) para que el usuario establezca su contraseña. Guarda SHA-256 del token, nunca el token.';
comment on column public.invitaciones.token_hash is
  'SHA-256 (hex) del token que viaja en la liga. El token en claro solo existe una vez, al mostrárselo al staff.';
comment on column public.invitaciones.usada_en is
  'Sello de canje. No NULL = invitación consumida; la liga deja de servir.';

create index invitaciones_perfil_idx on public.invitaciones (perfil_id);

alter table public.invitaciones enable row level security;

-- El staff crea y consulta invitaciones. El CANJE ocurre SIN sesión (la persona
-- aún no puede entrar): lo resuelve el servidor con service_role, por eso
-- 'authenticated' no necesita UPDATE ni DELETE sobre esta tabla.
grant select, insert on public.invitaciones to authenticated;
grant select, insert, update on public.invitaciones to service_role;

create policy invitaciones_staff_select on public.invitaciones
  for select to authenticated
  using (public.fn_is_staff());

create policy invitaciones_staff_insert on public.invitaciones
  for insert to authenticated
  with check (public.fn_is_staff());

-- -----------------------------------------------------------------------------
-- 4. Storage — bucket 'logos' (lectura pública, escritura solo staff)
--
-- Convención de ruta: {tenant_id}/<archivo>
-- El logo es branding, no evidencia: se sirve por URL pública para pintarlo en
-- el header del portal sin firmar cada request. Nada sensible vive aquí.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos', 'logos', true, 2097152,
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: cualquiera. El bucket público ya sirve los objetos por URL directa;
-- la política explícita mantiene coherente el acceso vía API.
create policy logos_lectura_publica on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos');

-- Escritura (subir, reemplazar, quitar): SOLO staff IRStrat.
create policy logos_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and public.fn_is_staff());

create policy logos_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and public.fn_is_staff())
  with check (bucket_id = 'logos' and public.fn_is_staff());

create policy logos_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and public.fn_is_staff());
