-- =============================================================================
-- Rol ADMIN-CLIENTE (tier de autoservicio) — 1/2: el valor del enum.
--
-- Va SOLO en esta migración a propósito. Postgres permite `alter type … add
-- value` dentro de una transacción, pero PROHÍBE usar el valor nuevo en la misma
-- transacción ("unsafe use of new value of enum type"). La migración que declara
-- las políticas, los triggers y las columnas necesita comparar contra
-- 'admin_cliente', así que el valor tiene que estar confirmado antes: un archivo
-- aparte = otra transacción.
--
-- Qué es admin_cliente: un usuario DEL CLIENTE que administra su propio tenant
-- sin acompañamiento de IRStrat. No es staff (tiene tenant_id), pero opera el
-- panel sobre su propio cliente. La matriz de permisos vive en la migración 2/2
-- (RLS) y en lib/roles.ts (UI + server actions).
-- =============================================================================

alter type public.rol_usuario add value if not exists 'admin_cliente';
