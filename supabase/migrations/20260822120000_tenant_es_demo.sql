-- =============================================================================
-- tenants.es_demo — la etiqueta de demostración deja de ser del AMBIENTE y pasa
-- a ser del CLIENTE.
--
-- Hasta hoy la franja "Entorno de demostración — datos ilustrativos" se prendía
-- con NEXT_PUBLIC_STAGING, una propiedad del DESPLIEGUE. Con Grupo Carso
-- operando en ese mismo despliegue, la franja MIENTE en la cabeza de cada
-- pantalla: sus datos son reales y su entregable es oficial. La etiqueta
-- corresponde al tenant, no al servidor donde viva.
--
-- Lo que NO cambia: el noindex/nofollow del layout sigue siendo global y no
-- depende de esta columna. La URL no tiene dominio propio; no debe indexarse
-- sea de quien sea la sesión.
--
-- GRANTS: no hace falta ninguno nuevo. El grant de la migración inicial es a
-- nivel TABLA (`grant select, insert, update, delete on all tables in schema
-- public to authenticated`) y cubre las columnas que se agreguen después; lo que
-- exige grant explícito son las tablas NUEVAS. Quién puede LEER la columna lo
-- decide la política `tenants_select` (staff, o el usuario de ese tenant), y
-- quién puede CAMBIARLA, el trigger del punto 2.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La columna
-- -----------------------------------------------------------------------------
alter table public.tenants
  add column es_demo boolean not null default false;

comment on column public.tenants.es_demo is
  'true = emisora de demostración: sus sesiones muestran la franja "Entorno de demostración" y su Excel de taxonomía lleva el pie [DEMO]. DEFAULT false: un cliente nuevo nace REAL, porque el costo de equivocarse en ese sentido (una franja de más) es menor que el contrario (presentar datos demo como oficiales). Solo la cambia el rol ''admin'' de IRStrat (trigger trg_tenant_es_demo).';

-- Backfill: el único tenant de demostración que existe se identifica por la
-- etiqueta [DEMO] en el nombre, que es como se ha marcado desde el seed. Lo
-- demás queda en false por el DEFAULT — que es el hecho, no una suposición:
-- Grupo Carso entró con su proceso IAS 2025 real.
update public.tenants
set es_demo = true
where nombre ilike '%[DEMO]%';

-- -----------------------------------------------------------------------------
-- 2. Quién la mueve: solo el rol 'admin' de IRStrat
-- -----------------------------------------------------------------------------
-- Misma forma que `fn_valida_toggle_carga_staff` y por la misma razón: quitarle
-- la etiqueta al tenant demo (o ponérsela a una emisora real) cambia lo que dice
-- su entregable sobre sí mismo. Cubre INSERT **y** UPDATE porque dar de alta un
-- cliente ya marcado es otra forma de marcarlo.
create or replace function public.fn_valida_es_demo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambia boolean;
begin
  if tg_op = 'INSERT' then
    v_cambia := coalesce(new.es_demo, false);   -- nacer marcado es un cambio
  else
    v_cambia := new.es_demo is distinct from old.es_demo;
  end if;

  if not v_cambia then
    return new;
  end if;
  -- Sin sesión (seed / service_role / migraciones): no se gatea.
  if auth.uid() is null then
    return new;
  end if;
  if public.fn_is_staff() and public.fn_current_rol() = 'admin' then
    return new;
  end if;
  raise exception 'Marcar o desmarcar una emisora como de demostración es una acción de administrador de IRStrat.'
    using errcode = 'check_violation';
end;
$$;

create trigger trg_tenant_es_demo
  before insert or update on public.tenants
  for each row execute function public.fn_valida_es_demo();
