-- =============================================================================
-- SEED DEMO — datos de demostración
--
-- REGLA DE ORO: cero datos inventados presentados como reales. TODO lo que
-- aquí se siembra es DEMO y así se etiqueta (tenant, reporte y usuarios llevan
-- el prefijo [DEMO]; correos usan el TLD reservado .example).
--
-- Los códigos de datapoint usan la convención de marcador 'S1/S2-REF-PEND-NN':
-- describen fielmente la divulgación NIIF S1/S2 pero NO afirman un número de
-- párrafo exacto — pendiente de verificación/mapeo manual contra la norma.
--
-- Se ejecuta durante `supabase db reset` como rol postgres (BYPASSRLS): las
-- políticas RLS no obstruyen la carga; los triggers SÍ se disparan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Idempotencia: limpiar datos demo previos (orden inverso de dependencias)
-- -----------------------------------------------------------------------------
delete from auth.users where id in (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000001'
);  -- cascada elimina perfiles; el resto cae por FK on delete cascade desde reportes/tenant
delete from public.tenants where id = '10000000-0000-0000-0000-000000000001';
-- (storage.objects no admite DELETE directo — protect_delete; en re-seed manual
--  limpie los objetos vía Storage API. En `supabase db reset` la BD se recrea.)

-- =============================================================================
-- 1. Usuarios (auth.users + auth.identities) — contraseña demo: Demo2025!
--    Documentadas en README-SCHEMA.md.
-- =============================================================================
-- Nota: las columnas de token (confirmation_token, recovery_token, etc.) se
-- inicializan en '' (no NULL): GoTrue las lee como strings de Go y un NULL
-- provoca "Database error querying schema" al iniciar sesión.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id::uuid, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Demo2025!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nombre', u.nombre),
  now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-0000-0000-000000000001', 'coordinador@empresademo.example', '[DEMO] Coordinador de Sostenibilidad'),
  ('a0000000-0000-0000-0000-000000000002', 'rh@empresademo.example',          '[DEMO] Responsable RH'),
  ('a0000000-0000-0000-0000-000000000003', 'operaciones@empresademo.example', '[DEMO] Responsable Operaciones'),
  ('a0000000-0000-0000-0000-000000000004', 'finanzas@empresademo.example',    '[DEMO] Responsable Finanzas'),
  ('b0000000-0000-0000-0000-000000000001', 'analista@irstrat.example',        '[DEMO] Analista IRStrat')
) as u(id, email, nombre);

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id::text, u.id::uuid,
  jsonb_build_object('sub', u.id, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from (values
  ('a0000000-0000-0000-0000-000000000001', 'coordinador@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000002', 'rh@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000003', 'operaciones@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000004', 'finanzas@empresademo.example'),
  ('b0000000-0000-0000-0000-000000000001', 'analista@irstrat.example')
) as u(id, email);

-- =============================================================================
-- 2. Tenant demo
-- =============================================================================
insert into public.tenants (id, nombre, slug, activo)
values ('10000000-0000-0000-0000-000000000001', '[DEMO] Empresa Demo SAB', 'empresa-demo-sab', true);

-- =============================================================================
-- 3. Perfiles de usuario
--    Clientes -> tenant demo. Analista IRStrat -> tenant_id NULL (staff).
-- =============================================================================
insert into public.perfiles_usuario (id, tenant_id, rol, area, nombre, email) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'coordinador', null,          '[DEMO] Coordinador de Sostenibilidad', 'coordinador@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'cliente',     'RH',          '[DEMO] Responsable RH',                'rh@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'cliente',     'Operaciones', '[DEMO] Responsable Operaciones',       'operaciones@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'cliente',     'Finanzas',    '[DEMO] Responsable Finanzas',          'finanzas@empresademo.example'),
  ('b0000000-0000-0000-0000-000000000001', null,                                   'analista',    null,          '[DEMO] Analista IRStrat',              'analista@irstrat.example');

-- =============================================================================
-- 4. Reporte
-- =============================================================================
insert into public.reportes (id, tenant_id, nombre, ejercicio, estado)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '[DEMO] Informe Anual Sustentable 2025', 2025, 'activo');

-- =============================================================================
-- 5. Datapoints de taxonomía NIIF S1/S2 (~30, núcleo)
--    codigo = marcador REF-PEND (ver nota de cabecera).
-- =============================================================================
insert into public.datapoints_taxonomia (codigo, norma, pilar, descripcion) values
  -- ---- NIIF S1 (requisitos generales) ----
  ('S1-REF-PEND-01', 'S1', 'gobernanza', 'Órgano(s) de gobierno responsable(s) de la supervisión de riesgos y oportunidades relacionados con la sostenibilidad'),
  ('S1-REF-PEND-02', 'S1', 'gobernanza', 'Competencias y capacidades del órgano de gobierno en materia de sostenibilidad'),
  ('S1-REF-PEND-03', 'S1', 'gobernanza', 'Rol de la dirección en la evaluación y gestión de riesgos y oportunidades de sostenibilidad'),
  ('S1-REF-PEND-04', 'S1', 'estrategia', 'Riesgos y oportunidades de sostenibilidad que razonablemente podrían afectar flujos de efectivo, acceso a financiamiento o costo de capital'),
  ('S1-REF-PEND-05', 'S1', 'estrategia', 'Efectos actuales y previstos sobre el modelo de negocio y la cadena de valor'),
  ('S1-REF-PEND-06', 'S1', 'estrategia', 'Efectos sobre la estrategia y la toma de decisiones de la entidad'),
  ('S1-REF-PEND-07', 'S1', 'estrategia', 'Efectos actuales y previstos sobre la situación financiera, el desempeño financiero y los flujos de efectivo'),
  ('S1-REF-PEND-08', 'S1', 'estrategia', 'Resiliencia de la estrategia y del modelo de negocio ante riesgos de sostenibilidad'),
  ('S1-REF-PEND-09', 'S1', 'riesgos',    'Procesos para identificar y evaluar riesgos de sostenibilidad'),
  ('S1-REF-PEND-10', 'S1', 'riesgos',    'Procesos para priorizar y monitorear los riesgos de sostenibilidad'),
  ('S1-REF-PEND-11', 'S1', 'riesgos',    'Integración de la gestión de riesgos de sostenibilidad en la gestión de riesgos general de la entidad'),
  ('S1-REF-PEND-12', 'S1', 'metricas',   'Métricas utilizadas para medir y monitorear los riesgos y oportunidades de sostenibilidad'),
  ('S1-REF-PEND-13', 'S1', 'metricas',   'Objetivos (targets) establecidos y desempeño frente a ellos'),
  ('S1-REF-PEND-14', 'S1', 'metricas',   'Información comparativa y revisión de estimaciones e incertidumbres de medición'),
  -- ---- NIIF S2 (clima) ----
  ('S2-REF-PEND-01', 'S2', 'gobernanza', 'Órgano de gobierno responsable de la supervisión de riesgos y oportunidades relacionados con el clima'),
  ('S2-REF-PEND-02', 'S2', 'gobernanza', 'Rol de la dirección en los procesos de gestión de riesgos y oportunidades climáticas'),
  ('S2-REF-PEND-03', 'S2', 'estrategia', 'Riesgos físicos del clima (agudos y crónicos) identificados y su horizonte temporal'),
  ('S2-REF-PEND-04', 'S2', 'estrategia', 'Riesgos de transición climática (política y legal, tecnología, mercado y reputación)'),
  ('S2-REF-PEND-05', 'S2', 'estrategia', 'Oportunidades relacionadas con el clima identificadas por la entidad'),
  ('S2-REF-PEND-06', 'S2', 'estrategia', 'Efectos de los riesgos y oportunidades climáticos en el modelo de negocio y la cadena de valor'),
  ('S2-REF-PEND-07', 'S2', 'estrategia', 'Plan de transición climática, incluidos supuestos clave y dependencias'),
  ('S2-REF-PEND-08', 'S2', 'estrategia', 'Resiliencia climática evaluada mediante análisis de escenarios'),
  ('S2-REF-PEND-09', 'S2', 'riesgos',    'Procesos para identificar, evaluar y priorizar riesgos relacionados con el clima'),
  ('S2-REF-PEND-10', 'S2', 'riesgos',    'Integración de la gestión de riesgos climáticos en la gestión de riesgos general'),
  ('S2-REF-PEND-11', 'S2', 'metricas',   'Emisiones brutas de GEI de Alcance 1 (tCO2e), conforme al GHG Protocol'),
  ('S2-REF-PEND-12', 'S2', 'metricas',   'Emisiones brutas de GEI de Alcance 2 (tCO2e), basadas en ubicación y/o en mercado, conforme al GHG Protocol'),
  ('S2-REF-PEND-13', 'S2', 'metricas',   'Emisiones brutas de GEI de Alcance 3 (tCO2e) y categorías aplicables, conforme al GHG Protocol'),
  ('S2-REF-PEND-14', 'S2', 'metricas',   'Metodología, factores de emisión y supuestos utilizados en el cálculo del inventario de GEI'),
  ('S2-REF-PEND-15', 'S2', 'metricas',   'Objetivos climáticos, incluidas metas de reducción de emisiones de GEI y avance frente a ellas'),
  ('S2-REF-PEND-16', 'S2', 'metricas',   'Métricas intersectoriales: riesgos físicos y de transición, oportunidades, capital desplegado, precio interno del carbono y remuneración vinculada al clima');

-- =============================================================================
-- 6. Solicitudes (~20) en lenguaje cliente, repartidas por área.
--    Estados variados para alimentar el semáforo.
-- =============================================================================
insert into public.solicitudes
  (id, reporte_id, titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, estado, responsable_cliente_id, responsable_irstrat_id, fecha_limite, orden)
values
  -- ---- RH ----
  ('c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Plantilla y rotación de personal 2025', 'Número total de colaboradores al cierre del ejercicio, altas y bajas.', 'RH', true, 'personas', 'validado', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2026-02-15', 10),
  ('c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Horas de capacitación 2025', 'Total de horas de formación impartidas durante el año.', 'RH', true, 'horas', 'recibido', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2026-02-20', 20),
  ('c0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Diversidad e inclusión en plantilla y órganos de gobierno', 'Distribución por género y otros indicadores de diversidad.', 'RH', false, null, 'en_revision', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2026-02-20', 30),
  ('c0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Índice de rotación voluntaria 2025 (%)', 'Rotación voluntaria como porcentaje de la plantilla promedio.', 'RH', true, '%', 'observaciones', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2026-02-25', 40),
  ('c0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Política de derechos humanos y debida diligencia', 'Documento de política vigente y evidencia de su aplicación.', 'RH', false, null, 'solicitado', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2026-03-01', 50),
  -- ---- Operaciones ----
  ('c0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Consumo de energía eléctrica 2025 por instalación (kWh)', 'Desglose de consumo eléctrico por sitio operativo.', 'Operaciones', true, 'kWh', 'recibido', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-02-10', 60),
  ('c0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'Inventario GEI Alcance 1 con memoria de cálculo', 'Emisiones directas y metodología de cálculo conforme al GHG Protocol.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-02-28', 70),
  ('c0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'Inventario GEI Alcance 2 (ubicación y mercado)', 'Emisiones indirectas por energía adquirida, ambos métodos.', 'Operaciones', true, 'tCO2e', 'solicitado', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-05', 80),
  ('c0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'Consumo de agua 2025 por fuente (m3)', 'Extracción de agua desglosada por fuente.', 'Operaciones', true, 'm3', 'solicitado', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-02-18', 90),
  ('c0000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'Generación y disposición de residuos 2025 (ton)', 'Residuos peligrosos y no peligrosos, y su disposición.', 'Operaciones', true, 'ton', 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-10', 100),
  ('c0000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 'Riesgos físicos climáticos en instalaciones', 'Exposición de sitios a eventos físicos agudos y crónicos.', 'Operaciones', false, null, 'solicitado', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-12', 110),
  ('c0000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', 'Consumo de combustibles fósiles 2025', 'Combustibles de fuentes fijas y móviles (base para Alcance 1).', 'Operaciones', false, null, 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-01', 120),
  -- ---- Finanzas ----
  ('c0000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', 'Inversiones y gastos ambientales 2025 (CAPEX/OPEX)', 'Montos destinados a proyectos e iniciativas ambientales.', 'Finanzas', false, null, 'en_revision', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '2026-02-22', 130),
  ('c0000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000001', 'Ingresos asociados a productos/servicios sostenibles 2025', 'Porcentaje de ingresos vinculado a la oferta sostenible.', 'Finanzas', true, '%', 'solicitado', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '2026-03-08', 140),
  ('c0000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000001', 'Precio interno del carbono aplicado en decisiones de inversión', 'Existencia, nivel y uso del precio interno del carbono.', 'Finanzas', false, null, 'pendiente', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 150),
  ('c0000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000001', 'Efectos financieros de riesgos climáticos en estados financieros', 'Partidas afectadas y magnitud estimada.', 'Finanzas', false, null, 'solicitado', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '2026-03-18', 160),
  -- ---- Gobierno Corporativo / Dirección (los ve el coordinador) ----
  ('c0000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000001', 'Composición y responsabilidades del Consejo en sostenibilidad', 'Integrantes, comités y mandatos relacionados con ESG.', 'Gobierno Corporativo', false, null, 'validado', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-02-12', 170),
  ('c0000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000001', 'Competencias del Consejo en temas ESG y clima', 'Formación y experiencia de los consejeros en sostenibilidad.', 'Gobierno Corporativo', false, null, 'recibido', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-02-24', 180),
  ('c0000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000001', 'Plan de transición climática y objetivos de reducción', 'Metas de descarbonización, alcance y año base.', 'Dirección', false, null, 'en_revision', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-03-05', 190),
  ('c0000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000001', 'Análisis de escenarios climáticos y resiliencia', 'Escenarios utilizados y conclusiones de resiliencia.', 'Dirección', false, null, 'pendiente', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-03-20', 200);

-- =============================================================================
-- 7. Mapeo N:N solicitud <-> datapoint (interno IRStrat).
--    Nota: varias solicitudes -> mismo datapoint, y una solicitud -> varios.
-- =============================================================================
insert into public.mapeo_solicitud_datapoint (solicitud_id, datapoint_id)
select s.sid::uuid, d.id
from (values
  ('c0000000-0000-0000-0000-000000000001', 'S1-REF-PEND-12'),  -- plantilla -> métricas S1
  ('c0000000-0000-0000-0000-000000000002', 'S1-REF-PEND-12'),  -- capacitación -> métricas S1
  ('c0000000-0000-0000-0000-000000000003', 'S1-REF-PEND-01'),  -- diversidad -> gobernanza
  ('c0000000-0000-0000-0000-000000000003', 'S1-REF-PEND-12'),  -- diversidad -> métricas
  ('c0000000-0000-0000-0000-000000000004', 'S1-REF-PEND-12'),  -- rotación % -> métricas
  ('c0000000-0000-0000-0000-000000000004', 'S1-REF-PEND-13'),  -- rotación % -> objetivos
  ('c0000000-0000-0000-0000-000000000005', 'S1-REF-PEND-09'),  -- DDHH -> riesgos S1
  ('c0000000-0000-0000-0000-000000000006', 'S2-REF-PEND-12'),  -- energía -> Alcance 2
  ('c0000000-0000-0000-0000-000000000006', 'S2-REF-PEND-14'),  -- energía -> metodología GEI
  ('c0000000-0000-0000-0000-000000000007', 'S2-REF-PEND-11'),  -- Alcance 1 -> Alcance 1
  ('c0000000-0000-0000-0000-000000000007', 'S2-REF-PEND-14'),  -- Alcance 1 -> metodología GEI
  ('c0000000-0000-0000-0000-000000000008', 'S2-REF-PEND-12'),  -- Alcance 2 -> Alcance 2
  ('c0000000-0000-0000-0000-000000000008', 'S2-REF-PEND-14'),  -- Alcance 2 -> metodología GEI
  ('c0000000-0000-0000-0000-000000000009', 'S1-REF-PEND-12'),  -- agua -> métricas S1
  ('c0000000-0000-0000-0000-000000000010', 'S1-REF-PEND-12'),  -- residuos -> métricas S1
  ('c0000000-0000-0000-0000-000000000011', 'S2-REF-PEND-03'),  -- riesgos físicos -> S2 físicos
  ('c0000000-0000-0000-0000-000000000011', 'S2-REF-PEND-06'),  -- riesgos físicos -> efectos negocio
  ('c0000000-0000-0000-0000-000000000012', 'S2-REF-PEND-11'),  -- combustibles -> Alcance 1 (mismo dp que #7)
  ('c0000000-0000-0000-0000-000000000012', 'S2-REF-PEND-14'),  -- combustibles -> metodología GEI
  ('c0000000-0000-0000-0000-000000000013', 'S1-REF-PEND-07'),  -- inversiones amb. -> efectos financieros
  ('c0000000-0000-0000-0000-000000000013', 'S2-REF-PEND-16'),  -- inversiones amb. -> capital desplegado
  ('c0000000-0000-0000-0000-000000000014', 'S1-REF-PEND-07'),  -- ingresos sostenibles -> efectos financieros
  ('c0000000-0000-0000-0000-000000000015', 'S2-REF-PEND-16'),  -- precio carbono -> métricas intersectoriales
  ('c0000000-0000-0000-0000-000000000016', 'S1-REF-PEND-07'),  -- efectos financieros clima -> S1 financieros
  ('c0000000-0000-0000-0000-000000000016', 'S2-REF-PEND-06'),  -- efectos financieros clima -> efectos negocio
  ('c0000000-0000-0000-0000-000000000017', 'S1-REF-PEND-01'),  -- consejo composición -> gobernanza S1
  ('c0000000-0000-0000-0000-000000000017', 'S2-REF-PEND-01'),  -- consejo composición -> gobernanza S2
  ('c0000000-0000-0000-0000-000000000018', 'S1-REF-PEND-02'),  -- consejo competencias -> competencias
  ('c0000000-0000-0000-0000-000000000019', 'S2-REF-PEND-07'),  -- plan transición -> plan de transición
  ('c0000000-0000-0000-0000-000000000019', 'S2-REF-PEND-15'),  -- plan transición -> objetivos climáticos
  ('c0000000-0000-0000-0000-000000000020', 'S2-REF-PEND-08')   -- escenarios -> resiliencia
) as s(sid, codigo)
join public.datapoints_taxonomia d
  on d.codigo = s.codigo and d.version_taxonomia = '2025';

-- =============================================================================
-- 8. Objetos placeholder en storage (bucket 'evidencias').
--    Rutas conforme a la convención {tenant_id}/{solicitud_id}/<archivo>.
--    NOTA: son registros DEMO; no hay bytes físicos cargados en el backend.
-- =============================================================================
insert into storage.objects (id, bucket_id, name, owner_id, metadata) values
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000006/consumo_energia_2025_v1.xlsx', 'a0000000-0000-0000-0000-000000000003', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000006/consumo_energia_2025_v2.xlsx', 'a0000000-0000-0000-0000-000000000003', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000007/inventario_gei_alcance1_2025.xlsx', 'a0000000-0000-0000-0000-000000000003', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/plantilla_rotacion_2025.xlsx', 'a0000000-0000-0000-0000-000000000002', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000009/consumo_agua_2025.pdf', 'a0000000-0000-0000-0000-000000000003', '{"demo": true, "mimetype": "application/pdf"}'::jsonb);

-- =============================================================================
-- 9. Evidencias (APPEND ONLY). La columna version la asigna el trigger.
--    Se insertan con id fijo para poder referenciarlas desde capturas_valor.
--    Al insertar, el trigger avanza el estado pendiente/solicitado -> recibido.
-- =============================================================================
insert into public.evidencias (id, solicitud_id, archivo_path, nombre_original, periodo_cubierto, area_origen, subido_por, notas) values
  -- #6 energía: dos versiones (demuestra el versionado append-only)
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000006/consumo_energia_2025_v1.xlsx', 'consumo_energia_2025_v1.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Primera carga; pendiente conciliar sitio norte.'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000006/consumo_energia_2025_v2.xlsx', 'consumo_energia_2025_v2.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Versión corregida con el sitio norte incluido.'),
  -- #7 Alcance 1
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000007/inventario_gei_alcance1_2025.xlsx', 'inventario_gei_alcance1_2025.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Incluye memoria de cálculo y factores de emisión.'),
  -- #1 plantilla
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/plantilla_rotacion_2025.xlsx', 'plantilla_rotacion_2025.xlsx', '2025 (cierre)', 'RH', 'a0000000-0000-0000-0000-000000000002', 'Plantilla al 31-dic con altas y bajas.'),
  -- #9 agua
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000009/consumo_agua_2025.pdf', 'consumo_agua_2025.pdf', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Reporte de consumo por fuente.');

-- =============================================================================
-- 10. Capturas de valor (APPEND ONLY). Correcciones = filas nuevas.
--     La corrección de #6 se registra como una segunda fila (confirmada),
--     dejando la anterior como no confirmada (superada).
-- =============================================================================
insert into public.capturas_valor (solicitud_id, evidencia_id, valor, unidad, periodo, capturado_por, confirmado) values
  -- #6 energía: captura inicial (v1, superada) y corregida (v2, confirmada)
  ('c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 1850000, 'kWh', '2025', 'b0000000-0000-0000-0000-000000000001', false),
  ('c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000002', 1875430, 'kWh', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #7 Alcance 1
  ('c0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003', 4820.5, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #1 plantilla
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 412, 'personas', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #9 agua
  ('c0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000005', 32450, 'm3', '2025', 'b0000000-0000-0000-0000-000000000001', true);

-- =============================================================================
-- 11. Comentarios / observaciones
-- =============================================================================
insert into public.comentarios (solicitud_id, autor_id, contenido, es_observacion) values
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'El índice de rotación no concilia con la plantilla reportada. Favor de revisar el denominador (plantilla promedio) y adjuntar la memoria de cálculo.', true),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Confirmado, corregimos el denominador y reenviamos esta semana.', false),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'Evidencia recibida. Estamos validando los factores de emisión contra el GHG Protocol.', false);
