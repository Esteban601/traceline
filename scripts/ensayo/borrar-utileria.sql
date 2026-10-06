-- -----------------------------------------------------------------------------
-- Borra el auditor de utilería del ensayo y todo lo que dejó (paso 4d del
-- encargo rol auditor). SOLO contra ensayo: comentarios_auditor y
-- auditor_actividad son append-only para la aplicación, y aquí se borran con el
-- dueño de las tablas porque la utilería no debe sobrevivir a la prueba.
--
--   psql "$ENSAYO_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/ensayo/borrar-utileria.sql
--
-- Aborta sin tocar nada si la cuenta no es la de utilería (id del seed, rol
-- auditor, tenant Empresa Demo, nombre «[ENSAYO] …») o si alguna fila de la
-- utilería quedó fuera de Empresa Demo. Las filas de auditoría de otros autores
-- (la copia de staging ya las trae) no se tocan: el borrado es por id.
-- -----------------------------------------------------------------------------
begin;

do $$
declare
  v_id constant uuid := 'a0000000-0000-0000-0000-000000000007';
  v_demo constant uuid := '10000000-0000-0000-0000-000000000001';
  n_ajenos int;
begin
  if not exists (
    select 1 from public.perfiles_usuario
    where id = v_id and rol = 'auditor' and tenant_id = v_demo and nombre like '[ENSAYO]%'
  ) then
    raise exception 'la cuenta % no es el auditor de utilería del ensayo; no se borra nada', v_id;
  end if;

  select (select count(*) from public.comentarios_auditor
          where autor_id = v_id and tenant_id <> v_demo)
       + (select count(*) from public.auditor_actividad
          where auditor_id = v_id and tenant_id <> v_demo)
    into n_ajenos;
  if n_ajenos > 0 then
    raise exception '% filas de la utilería están fuera de Empresa Demo; no se borra nada', n_ajenos;
  end if;
end $$;

delete from public.comentarios_auditor where autor_id = 'a0000000-0000-0000-0000-000000000007';
delete from public.auditor_actividad  where auditor_id = 'a0000000-0000-0000-0000-000000000007';
-- perfiles_usuario e identities caen en cascada desde auth.users.
delete from auth.users where id = 'a0000000-0000-0000-0000-000000000007';
delete from public.tenants where slug like 'e2e-auditor-ajena-%';

select
  (select count(*) from public.comentarios_auditor) as comentarios_auditor,
  (select count(*) from public.auditor_actividad)   as auditor_actividad,
  (select count(*) from public.perfiles_usuario where id = 'a0000000-0000-0000-0000-000000000007') as perfil,
  (select count(*) from auth.users where id = 'a0000000-0000-0000-0000-000000000007') as usuario,
  (select count(*) from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000007') as identidades,
  (select count(*) from public.tenants where slug like 'e2e-%') as tenants_e2e;

commit;
