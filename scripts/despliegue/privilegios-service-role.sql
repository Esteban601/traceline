-- Privilegios de service_role sobre las tablas de public (solo lectura).
-- Encargo 2026-10-26-carga-lectura-primero: en dev las 37 tablas tienen los 7
-- (DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE); el stack
-- local, mucho menos. Antes de migrar staging se corre contra staging y se
-- compara con dev:
--   supabase db query --linked -o json -f scripts/despliegue/privilegios-service-role.sql
select c.relname as tabla,
       coalesce(string_agg(distinct p.privilege_type, ',' order by p.privilege_type), '') as privilegios
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  left join information_schema.role_table_grants p
    on p.table_schema = 'public' and p.table_name = c.relname and p.grantee = 'service_role'
 where c.relkind in ('r', 'p')
 group by c.relname
 order by 1;
