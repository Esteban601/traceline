-- =============================================================================
-- SEED DEMO — datos de demostración
--
-- REGLA DE ORO: cero datos inventados presentados como reales. TODO lo que
-- aquí se siembra es DEMO y así se etiqueta (tenant, reporte y usuarios llevan
-- el prefijo [DEMO]; correos usan el TLD reservado .example).
--
-- Los códigos de datapoint provienen VERBATIM del catálogo oficial de la
-- taxonomía NIIF S1/S2 (catalogo_taxonomia_S1_S2.csv, plantilla base de la
-- firma): codigo, norma, pilar, seccion_indice, descripcion y ods se cargan sin
-- modificación de texto.
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
  'a0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
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
  ('a0000000-0000-0000-0000-000000000005', 'admin.cliente@empresademo.example','[DEMO] Administradora del cliente'),
  ('b0000000-0000-0000-0000-000000000001', 'analista@irstrat.example',        '[DEMO] Analista IRStrat'),
  ('b0000000-0000-0000-0000-000000000002', 'admin@irstrat.example',           '[DEMO] Admin IRStrat')
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
  ('a0000000-0000-0000-0000-000000000005', 'admin.cliente@empresademo.example'),
  ('b0000000-0000-0000-0000-000000000001', 'analista@irstrat.example'),
  ('b0000000-0000-0000-0000-000000000002', 'admin@irstrat.example')
) as u(id, email);

-- =============================================================================
-- 2. Tenant demo
-- =============================================================================
-- `es_demo = true` explícito: es la ÚNICA emisora de demostración. De ella
-- dependen la franja "Entorno de demostración" en sus sesiones y el pie [DEMO]
-- de su Excel. Un cliente real nace con el default (false).
insert into public.tenants (id, nombre, slug, prefijo_folio, activo, es_demo)
values ('10000000-0000-0000-0000-000000000001', '[DEMO] Empresa Demo SAB', 'empresa-demo-sab', 'DEMO', true, true);

-- Catálogo de áreas del tenant demo. Son las MISMAS que usan sus usuarios y sus
-- solicitudes (no se inventan áreas nuevas): el catálogo solo las hace
-- seleccionables desde la UI en vez de escribirlas a mano.
insert into public.areas_tenant (tenant_id, nombre, orden) values
  ('10000000-0000-0000-0000-000000000001', 'RH',                   0),
  ('10000000-0000-0000-0000-000000000001', 'Operaciones',          1),
  ('10000000-0000-0000-0000-000000000001', 'Finanzas',             2),
  ('10000000-0000-0000-0000-000000000001', 'Gobierno Corporativo', 3),
  ('10000000-0000-0000-0000-000000000001', 'Dirección',            4);

-- =============================================================================
-- 3. Perfiles de usuario
--    Clientes -> tenant demo. Analista IRStrat -> tenant_id NULL (staff).
-- =============================================================================
insert into public.perfiles_usuario (id, tenant_id, rol, area, nombre, email) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'coordinador', null,          '[DEMO] Coordinador de Sostenibilidad', 'coordinador@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'cliente',     'RH',          '[DEMO] Responsable RH',                'rh@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'cliente',     'Operaciones', '[DEMO] Responsable Operaciones',       'operaciones@empresademo.example'),
  ('a0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'cliente',     'Finanzas',    '[DEMO] Responsable Finanzas',          'finanzas@empresademo.example'),
  -- Administradora DEL CLIENTE (tier de autoservicio): entra al PANEL sobre su
  -- propio tenant. Sin área: ve las solicitudes de todas las de su cliente.
  ('a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'admin_cliente', null,        '[DEMO] Administradora del cliente',    'admin.cliente@empresademo.example'),
  ('b0000000-0000-0000-0000-000000000001', null,                                   'analista',    null,          '[DEMO] Analista IRStrat',              'analista@irstrat.example'),
  ('b0000000-0000-0000-0000-000000000002', null,                                   'admin',       null,          '[DEMO] Admin IRStrat',                 'admin@irstrat.example');

-- =============================================================================
-- 4. Reporte
-- =============================================================================
insert into public.reportes (id, tenant_id, nombre, ejercicio, estado)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '[DEMO] Informe Anual Sustentable 2025', 2025, 'activo');

-- =============================================================================
-- 5. Datapoints de taxonomía NIIF S1/S2 (91, catálogo oficial completo)
--    codigo, norma, pilar, seccion_indice, descripcion y ods VERBATIM del CSV.
-- =============================================================================
insert into public.datapoints_taxonomia (codigo, norma, pilar, seccion_indice, descripcion, ods) values
  ('IFRS S1 2023-06-26 40 a', 'S1', 'estrategia', '3. Gobernanza', 'Explicación de por qué no se proporcionó información cuantitativa sobre los efectos financieros actuales o previstos de un riesgo o oportunidad identificado', null),
  ('NIIF S1 27(a)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'Órgano u órganos de gobernanza o personas responsables de la supervisión de los riesgos y oportunidades relacionados con la sostenibilidad', null),
  ('NIIF S1 27(a)(i)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'Cómo se reflejan las responsabilidades relativas a los riesgos y oportunidades relacionados con la sostenibilidad en los términos de referencia a, mandatos, descripciones de funciones y otras políticas relacionadas aplicables a dichos órganos o personas.', null),
  ('NIIF S1 27(a)(ii)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'Cómo determina el órgano o los órganos o las personas si se dispone o se desarrollarán las habilidades y competencias adecuadas para supervisar las estrategias diseñadas para responder a los riesgos y oportunidades relacionados con la sostenibilidad.', null),
  ('NIIF S1 27(a)(iii)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'Cómo y con qué frecuencia se informa a los órganos o personas sobre los riesgos y oportunidades relacionados con la sostenibilidad.', null),
  ('NIIF S1 27(a)(iv)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'Cómo tiene en cuenta el órgano o los órganos los riesgos y oportunidades relacionados con la sostenibilidad al supervisar la estrategia de la entidad, sus decisiones sobre transacciones importantes y sus procesos de gestión de riesgos y políticas relacionadas, incluyendo si el órgano o los órganos han considerado las compensaciones asociadas a esos riesgos y oportunidades.', null),
  ('NIIF S1 27(a)(v)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'La forma en que el órgano o los órganos o la persona o personas supervisan el establecimiento de objetivos relacionados con los riesgos y las oportunidades relacionados con la sostenibilidad, y controlan los avances hacia la consecución de los objetivos (desarrollados en el apartado "Metricas y Objetivos", sección "Objetivos", del presente informe).', null),
  ('NIIF S1 27(b)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'La gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con la sostenibilidad', null),
  ('NIIF S1 27(b)(i)', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'En el papel de la gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionadas con la sostenibilidad ¿La función se delega en un cargo específico de la dirección o en un comité a nivel de dirección?', null),
  ('NIIF S1 30(a)y(b)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Riesgos y oportunidades relacionados con la sostenibilidad que podría esperarse razonablemente que afecten a las perspectivas de la entidad.', null),
  ('NIIF S1 30(c)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Explicar cómo define la entidad el "corto plazo", el "medio plazo" y el "largo plazo" y cómo se vinculan estas definiciones a los horizontes de planificación utilizados por la entidad para la toma de decisiones estratégicas.', '8. Trabajo decente y crecimiento económico'),
  ('NIIF S1 32(a)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Descripción de los efectos actuales y previstos de los riesgos y oportunidades relacionados con la sostenibilidad sobre el modelo de negocio y la cadena de valor [bloque de texto]', null),
  ('NIIF S1 32(b)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos y oportunidades relacionados con la sostenibilidad.', null),
  ('NIIF S1 33(a)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Cómo se ha respondido y prevé responder a los riesgos y oportunidades relacionados con la sostenibilidad en su estrategia y toma de decisiones.', null),
  ('NIIF S1 33(b)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Progresos realizados en relación con los planes que la entidad haya revelado en periodos anteriores sobre los que se informa, incluida la información cuantitativa y cualitativa.', null),
  ('NIIF S1 33(c)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Compensaciones entre los riesgos relacionados con la sostenibilidad y las oportunidades que la entidad consideró.', null),
  ('NIIF S1 35(a)', 'S1', 'estrategia', '2. Actividades y trabajadores', 'Cómo los riesgos y oportunidades relacionados con la sostenibilidad han afectado a su situación financiera durante el periodo sobre el que se informa', '8. Trabajo decente y crecimiento económico'),
  ('NIIF S1 35(b)', 'S1', 'estrategia', '3. Gobernanza', 'Riesgos y oportunidades relacionados con la sostenibilidad identificados para los que existe un riesgo significativo de un ajuste material o con importancia relativa dentro del próximo periodo anual sobre el que se informa sobre los importes en libros de los activos y pasivos informados en los estados financieros relacionados', null),
  ('NIIF S1 35(c)(i)(ii)', 'S1', 'estrategia', '3. Gobernanza', 'En términos generales, los riesgos y oportunidades identificados en este informe pueden influir en el corto, medio y largo plazo en los siguientes elementos: Ingresos: Cambios en patrones de tráfico, restricciones operativas, ajustes tarifarios o pérdida temporal de capacidad pueden afectar los ingresos de peaje y servicios asociados. Costos y gastos de operación (OpEx): Incremento en costos de mantenimiento correctivo, seguridad, energía, seguros o cumplimiento normativo. Oportunidades como eficiencia energética, la economía circular o la digitalización pueden contribuir a reducir costos operativos en el mediano plazo. Inversiones en activos fijos (CapEx): Necesidad de inversiones adicionales para reforzar infraestructura, implementar tecnologías de monitoreo, modernizar equipos o cumplir con requerimientos ambientales y de seguridad. Valor de los activos y provisiones: Cambios en supuestos de deterioro, vida útil, provisiones por mantenimiento mayor o contingencias pueden generar impactos en el balance. Costo de financiamiento y acceso a capital: La gestión efectiva de los riesgos ASG puede influir en el acceso a financiamiento verde o sostenible, mientras que un deterioro reputacional o incumplimientos pueden encarecer el costo del capital.', null),
  ('NIIF S1 35(d)', 'S1', 'estrategia', '3. Gobernanza', 'Como se espera que cambien su rendimineto financiero a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con la sostenibilidad', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S1 41', 'S1', 'estrategia', '3. Gobernanza', 'Evaluación cualitativa y, en su caso, cuantitativa de la resiliencia de su estrategia y modelo de negocio en relación con sus riesgos relacionados con la sostenibilidad, incluyendo información sobre cómo se llevó a cabo la evaluación y su horizonte temporal.', null),
  ('NIIF S1 44 (a)(i)a(v)', 'S1', 'riesgos', '3. Gobernanza', 'Procesos y políticas relacionadas que la entidad utiliza para identificar, evaluar, priorizar y supervisar los riesgos relacionados con la sostenibilidad', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S1 44 (a)(vi)', 'S1', 'riesgos', '3. Gobernanza', '¿La entidad ha cambiado los procesos que utiliza en comparación con el periodo de información anterior?', null),
  ('NIIF S1 44 (b)', 'S1', 'riesgos', '3. Gobernanza', 'Procesos utilizados para identificar, evaluar, priorizar y supervisar las oportunidades relacionadas con la sostenibilidad', null),
  ('NIIF S1 44 (c)', 'S1', 'riesgos', '3. Gobernanza', 'Grado y forma en que los procesos de identificación, evaluación, priorización y seguimiento de los riesgos y oportunidades relacionados con la sostenibilidad se integran en el proceso global de gestión de riesgos de la entidad e informan al respecto.', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S1 46 a 50', 'S1', 'metricas', '3. Gobernanza', 'Métricas para riesgos y oportunidades de sostenibilidad: métricas requeridas por NIIF/SASB/CDSB/Apéndice C-NIIF S1 y métricas propias de la entidad (fuente, tipo, validación por tercero, método de cálculo, datos, limitaciones y supuestos)', null),
  ('NIIF S1 51', 'S1', 'metricas', '3. Gobernanza', 'Objetivos que se ha fijado la entidad y requeridos para cumplir por ley o regulación para supervisar el progreso hacia la consecución de sus objetivos estratégicos en relación con ese riesgo u oportunidad relacionados con la sostenibilidad.', null),
  ('NIIF S1 72', 'S1', 'metricas', '3. Gobernanza', '¿La entidad cumple con todos los requerimientos de las Normas NIIF de Información a Revelar sobre Sostenibilidad explícitamente y sin reservas?', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S1 74', 'S1', 'metricas', '3. Gobernanza', 'Revelar la información que se considere necesaria por la Emisora a que hace referencia el apartado "Juicios, incertidumbres y errores" de la NIIF S1', null),
  ('NIIF S2 10(a), (b)y(c)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Riesgos y oportunidades climáticos: nombre, descripción, tipo de riesgo climático (físico/transición) y horizontes temporales en los que cabe esperar razonablemente que se produzcan sus efectos', null),
  ('NIIF S2 10(d)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Explicar cómo define la entidad el "corto plazo", el "medio plazo" y el "largo plazo" y cómo se vinculan estas definiciones a los horizontes de planificación utilizados por la entidad para la toma de decisiones estratégicas.', null),
  ('NIIF S2 13(a)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Descripción de los efectos actuales y previstos de los riesgos y oportunidades relacionados con el clima sobre el modelo de negocio y la cadena de valor de la entidad', null),
  ('NIIF S2 13(b)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos y oportunidades relacionados con el clima.', null),
  ('NIIF S2 14(a)(i)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Los cambios actuales y previstos en el modelo de negocio de la entidad, incluida su asignación de recursos, para abordar los riesgos y oportunidades relacionados con el clima', null),
  ('NIIF S2 14(a)(ii)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Los esfuerzos directos actuales y previstos de reducción o adaptación', null),
  ('NIIF S2 14(a)(iii)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Los esfuerzos indirectos actuales y previstos de reducción o adaptación', null),
  ('NIIF S2 14(a)(iv)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Planes de transición relacionado con el clima que tenga la entidad, incluida la información sobre los supuestos clave utilizados en el desarrollo de su plan de transición, y las dependencias en las que se basa el plan de transición de la entida.', null),
  ('NIIF S2 14(a)(v)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Cómo prevé la entidad alcanzar cualquier objetivo relacionado con el clima, incluido cualquier objetivo de emisiones de gases de efecto invernadero, descrito de conformidad con los desarrollados en el apartado "Metricas y Objetivos", sección "Objetivos relacionados con el clima", del presente informe)', null),
  ('NIIF S2 14(b)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Forma en que la entidad está dotando de recursos a las actividades reveladas en su estrategia y toma de decisiones, así como sus planes de seguir haciéndolo:', null),
  ('NIIF S2 14(c)', 'S2', 'estrategia', '4. Estrategia, políticas y prácticas', 'Información cuantitativa y cualitativa sobre el progreso de los planes revelados en periodos anteriores sobre los que se informa de acuerdo con su estrategia y toma de decisiones:', null),
  ('NIIF S2 16(a)', 'S2', 'estrategia', '5. Participación de los grupos de interés', 'Cómo los riesgos y oportunidades relacionados con el clima han afectado a su situación financiera durante el periodo sobre el que se informa', null),
  ('NIIF S2 16(b)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Riesgos y oportunidades relacionados con el clima identificados para los que existe un riesgo significativo de un ajuste material o con importancia relativa dentro del próximo periodo anual sobre el que se informa sobre los importes en libros de los activos y pasivos informados en los estados financieros relacionados', null),
  ('NIIF S2 16(c)(i)(ii)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Como se espera que cambie su situación financiera a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con el clima (Considerar: i) sus planes de inversión y disposición (por ejemplo, planes de desembolso de capital, adquisiciones y desinversiones importantes, negocios conjuntos, transformación de negocios, innovación, nuevas áreas de negocio y retiros de activos), incluidos los planes con los que la entidad no esté compromet ida contractualmente; y (ii) sus fuentes de financiación previstas para la implementación de su estrategia)', null),
  ('NIIF S2 16(d)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Como se espera que cambien su rendimineto financiero a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con el clima', null),
  ('NIIF S2 22(a)(i)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Evaluación de su resiliencia climática en la fecha de presentación incluidos los efectos identificados en el análisis del escenario relacionado con el clima.', null),
  ('NIIF S2 22(a)(ii)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Áreas significativas de incertidumbre consideradas en la evaluación de la resiliencia climática', null),
  ('NIIF S2 22(a)(iii)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Como espera que afecten su capacidad de respuesta ante el cambio climático, a corto, mediano y largo plazo, los recursos financieros y operativos disponibles para hacer frente al riesgo y aprovechar las oportunidades, incluido el acceso al capital.', null),
  ('NIIF S2 22(b)(i)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Analisis de escenarios', null),
  ('NIIF S2 22(b)(ii)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Supuestos clave que la entidad realizó en el análisis', null),
  ('NIIF S2 22(b)(iii)', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Periodo sobre el que se informa en el que se ha llevado a cabo el análisis del escenario', null),
  ('NIIF S2 25 (a)(i)a(v)', 'S2', 'riesgos', '6. Contenidos sobre los temas materiales', 'Procesos y políticas relacionadas que la entidad utiliza para identificar, evaluar, priorizar y supervisar los riesgos relacionados con el clima', null),
  ('NIIF S2 25 (a)(vi)', 'S2', 'riesgos', '6. Contenidos sobre los temas materiales', '¿La entidad ha cambiado los procesos que utiliza en comparación con el periodo de información anterior?', null),
  ('NIIF S2 25 (b)', 'S2', 'riesgos', '6. Contenidos sobre los temas materiales', 'Procesos que utiliza la entidad para identificar, evaluar, priorizar y supervisar las oportunidades relacionadas con el clima, incluida la información sobre si la entidad utiliza, y de qué manera, el análisis de escenarios relacionados con el clima para fundamentar su identificación de oportunidades relacionadas con el clima', null),
  ('NIIF S2 25 (c)', 'S2', 'riesgos', '6. Contenidos sobre los temas materiales', 'Grado y forma en que los procesos de identificación, evaluación, priorización y seguimiento de los riesgos y oportunidades relacionados con el clima se integran en el proceso global de gestión de riesgos de la entidad e informan al respecto', null),
  ('NIIF S2 29 (a)(i)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre sus emisiones brutas absolutas de gases de efecto invernadero generadas durante el periodo sobre el que se informa, expresadas en toneladas métricas equivalentes de CO2 (CO2e) :', null),
  ('NIIF S2 29 (a)(ii)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre la medición de sus emisiones de gases de efecto invernadero de conformidad con el Protocolo sobre Gases de Efecto Invernadero (Un Estándar Corporativo de Contabilidad y Reporte (2004))', null),
  ('NIIF S2 29 (a)(iii)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre el enfoque que utiliza para medir sus emisiones de gases de efecto invernadero', null),
  ('NIIF S2 29 (a)(iv) EI5', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Desagregación de las emisiones de gases de efecto invernadero de Alcance 1 y Alcance 2 entre el grupo contable consolidado y otras participadas excluidas.', null),
  ('NIIF S2 29 (a)(v)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Emisiones de gases de efecto invernadero de Alcance 2', null),
  ('NIIF S2 29 (a)(vi)(1)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Emisiones de gases de efecto invernadero de Alcance 3', null),
  ('NIIF S2 29 (a)(vi)(1) EI12', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Extracto de la información a revelar de las emisiones de gases de efecto invernadero de Alcance 3 desagregado en categorías :', null),
  ('NIIF S2 29 (a)(vi)(2)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información adicional sobre las emisiones de gases de efecto invernadero de la Categoría 15 de la entidad o las asociadas a sus inversiones (emisiones financiadas), si las actividades de la entidad incluyen la gestión de activos, la banca comercial o los seguros:', null),
  ('NIIF S2 29 (b) B64 y B65 inciso (a)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Riesgos físicos relacionados con el clima: cantidad y porcentaje de activos o actividades empresariales vulnerables, y despliegue de capital aplicado (comparativo anual)', null),
  ('NIIF S2 29 (b) B64 y B65 inciso (b)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos de transición relacionados con el clima.', null),
  ('NIIF S2 29 (b) B64 y B65 inciso (c)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Cómo los riesgos de transición relacionados con el clima han afectado a su situación financiera durante el periodo sobre el que se informa', null),
  ('NIIF S2 29 (c) B64 y B65 inciso (b)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos físicos relacionados con el clima.', null),
  ('NIIF S2 29 (c) B64 y B65 inciso (c)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Cómo los riesgos de transición relacionados con el clima han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa', null),
  ('NIIF S2 29 (d) B64 y B65 inciso (a)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Oportunidades relacionadas con el clima: cantidad y porcentaje de activos o actividades empresariales alineadas, y despliegue de capital aplicado (comparativo anual)', null),
  ('NIIF S2 29 (d) B64 y B65 inciso (b)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad las oportunidades relacionados con el clima.', null),
  ('NIIF S2 29 (d) B64 y B65 inciso (c)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Cómo las oportunidades relacionadas con el clima han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa', null),
  ('NIIF S2 29 (e)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre la cantidad de gasto de capital, financiación o inversión aplicada a los riesgos y oportunidades relacionados con el clima:', null),
  ('NIIF S2 29 (f) (i) y (ii)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', '¿La entidad está aplicando un precio del carbono en la toma de decisiones?', null),
  ('NIIF S2 29 (g) (i) y (ii)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', '¿Las consideraciones relacionadas con el clima se tienen en cuenta en la remuneración de los ejecutivos ?', null),
  ('NIIF S2 30', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Cantidad y porcentaje de activos o actividades empresariales vulnerables a los riesgos de transición relacionados con el clima', null),
  ('NIIF S2 32', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Seleccionar el tipo de sector o sectores en las que participa:', null),
  ('NIIF S2 33', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Objetivos cuantitativos y cualitativos relacionados con el clima establecidos para supervisar el progreso hacia la consecución de sus objetivos estratégicos y objetivos requeridos por ley o regulación, incluido cualquier objetivo de emisiones de gases de efecto invernadero.', null),
  ('NIIF S2 34', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre su enfoque para establecer y revisar cada objetivo, y sobre cómo supervisa el progreso con respecto a cada objetivo', null),
  ('NIIF S2 35', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre sus resultados en relación con cada objetivo relacionado con el clima y un análisis de las tendencias o cambios en los resultados de la entidad', null),
  ('NIIF S2 36 (a)a(d)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Objetivo de emisiones de gases de efecto invernadero', null),
  ('NIIF S2 36 (e)(i)a(iv)', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Información sobre el uso previsto por la entidad de créditos de carbono para compensar las emisiones de gases de efecto invernadero con el fin de alcanzar cualquier objetivo de emisiones de gases de efecto invernadero en términos netos.', null),
  ('NIIF S2 6 (a)', 'S2', 'gobernanza', '3. Gobernanza', 'Órgano u órganos de gobernanza o personas responsables de la supervisión de los riesgos y oportunidades relacionados con el clima', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S2 6 (a)(i)', 'S2', 'gobernanza', '3. Gobernanza', 'Indicar cómo se reflejan las responsabilidades relativas a los riesgos y oportunidades relacionados con el cima en los términos de referencia a, mandatos, descripciones de funciones y otras políticas relacionadas aplicables a dichos órganos o personas.', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S2 6 (a)(ii)', 'S2', 'gobernanza', '3. Gobernanza', 'Indicar cómo determina el órgano o los órganos o las personas si se dispone o se desarrollarán las habilidades y competencias adecuadas para supervisar las estrategias diseñadas para responder a los riesgos y oportunidades relacionados con el clima.', null),
  ('NIIF S2 6 (a)(iii)', 'S2', 'gobernanza', '3. Gobernanza', 'Incicar cómo y con qué frecuencia se informa a los órganos o personas sobre los riesgos y oportunidades relacionados con el clima.', null),
  ('NIIF S2 6 (a)(iv)', 'S2', 'gobernanza', '3. Gobernanza', 'Indicar cómo tiene en cuenta el órgano o los órganos los riesgos y oportunidades relacionados con la sostenibilidad al supervisar la estrategia de la entidad, sus decisiones sobre transacciones importantes y sus procesos de gestión de riesgos y políticas relacionadas, incluyendo si el órgano o los órganos han considerado las compensaciones asociadas a esos riesgos y oportunidades.', null),
  ('NIIF S2 6 (a)(v)', 'S2', 'gobernanza', '3. Gobernanza', 'La forma en que el órgano o los órganos o la persona o personas supervisan el establecimiento de objetivos relacionados con los riesgos y las oportunidades relacionados con la sostenibilidad, y controlan los avances hacia la consecución de los objetivos (desarrollados en el apartado "Metricas y Objetivos", sección "Objetivos relacionados con el clima", del presente informe).', '5. Igualdad de género 8. Trabajo decente y crecimiento económico'),
  ('NIIF S2 6(b)', 'S2', 'gobernanza', '4. Estrategia, políticas y prácticas', 'La gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con el cima', '16. Paz, justicia e instituciones sólidas'),
  ('NIIF S2 6(b)(i)', 'S2', 'gobernanza', '4. Estrategia, políticas y prácticas', 'En el papel de la gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con el clima ¿La función se delega en un cargo específico de la dirección o en un comité a nivel de dirección?', null),
  ('NIIF S2 6(b)(ii)', 'S2', 'gobernanza', '4. Estrategia, políticas y prácticas', '¿La gerencia utiliza controles y procedimientos para apoyar la supervisión de los riesgos y oportunidades relacionados con el clima?', null),
  ('NIIF S2 EI14 a E18', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Emisiones de gases de efecto invernadero de Alcance 1', null),
  ('NIIF S2 EI19 a EI24', 'S2', 'estrategia', '6. Contenidos sobre los temas materiales', 'Desagregación de una categoría de Alcance 3 por los gases que la componen:', null);

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
  ('c0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'Inventario GEI Alcance 1 con memoria de cálculo', 'Emisiones directas y metodología de cálculo conforme al GHG Protocol.', 'Operaciones', true, 'tCO2e', 'validado', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-02-28', 70),
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
  ('c0000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000001', 'Análisis de escenarios climáticos y resiliencia', 'Escenarios utilizados y conclusiones de resiliencia.', 'Dirección', false, null, 'pendiente', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-03-20', 200),
  -- ---- Caso de DISCREPANCIA DEMO ----
  -- Finanzas reporta el consumo eléctrico corporativo con un valor DISTINTO al de
  -- Operaciones (solicitud #6), misma unidad (kWh) y mismo periodo (2025): alimenta
  -- el mismo datapoint 'NIIF S2 29 (a)(v)' y dispara la alerta de discrepancia.
  ('c0000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000001', 'Consumo eléctrico corporativo 2025 (consolidado Finanzas)', 'Consumo eléctrico total del ejercicio conforme a la contabilidad de Finanzas.', 'Finanzas', true, 'kWh', 'en_revision', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '2026-02-20', 210);

-- =============================================================================
-- 7. Mapeo N:N solicitud <-> datapoint (interno IRStrat).
--    Nota: varias solicitudes -> mismo datapoint, y una solicitud -> varios.
-- =============================================================================
insert into public.mapeo_solicitud_datapoint (solicitud_id, datapoint_id)
select s.sid::uuid, d.id
from (values
  ('c0000000-0000-0000-0000-000000000001', 'NIIF S1 46 a 50'), -- plantilla/rotación -> métricas de sostenibilidad S1 (no hay datapoint social específico) [DUDOSA]
  ('c0000000-0000-0000-0000-000000000002', 'NIIF S1 46 a 50'), -- horas capacitación -> métricas de sostenibilidad S1 (sin datapoint social específico) [DUDOSA]
  ('c0000000-0000-0000-0000-000000000003', 'NIIF S1 27(a)'), -- diversidad en órganos de gobierno -> gobernanza S1
  ('c0000000-0000-0000-0000-000000000003', 'NIIF S1 46 a 50'), -- diversidad plantilla -> métricas de sostenibilidad S1 [DUDOSA parcial]
  ('c0000000-0000-0000-0000-000000000004', 'NIIF S1 46 a 50'), -- rotación % -> métricas de sostenibilidad S1 [DUDOSA]
  ('c0000000-0000-0000-0000-000000000004', 'NIIF S1 51'), -- rotación % -> objetivos S1
  ('c0000000-0000-0000-0000-000000000005', 'NIIF S1 44 (a)(i)a(v)'), -- política DDHH y debida diligencia -> procesos de gestión de riesgos de sostenibilidad S1 (no hay datapoint DDHH específico) [DUDOSA]
  ('c0000000-0000-0000-0000-000000000006', 'NIIF S2 29 (a)(v)'), -- consumo energía eléctrica -> base de Alcance 2
  ('c0000000-0000-0000-0000-000000000006', 'NIIF S2 29 (a)(ii)'), -- consumo energía eléctrica -> medición conforme GHG Protocol
  ('c0000000-0000-0000-0000-000000000007', 'NIIF S2 29 (a)(i)'), -- inventario GEI Alcance 1 -> emisiones brutas absolutas GEI (mapeo indicado en el brief)
  ('c0000000-0000-0000-0000-000000000007', 'NIIF S2 EI14 a E18'), -- inventario GEI Alcance 1 -> detalle Alcance 1
  ('c0000000-0000-0000-0000-000000000007', 'NIIF S2 29 (a)(ii)'), -- inventario GEI Alcance 1 -> medición conforme GHG Protocol
  ('c0000000-0000-0000-0000-000000000008', 'NIIF S2 29 (a)(v)'), -- inventario GEI Alcance 2 -> emisiones Alcance 2
  ('c0000000-0000-0000-0000-000000000008', 'NIIF S2 29 (a)(ii)'), -- inventario GEI Alcance 2 -> medición conforme GHG Protocol
  ('c0000000-0000-0000-0000-000000000009', 'NIIF S1 46 a 50'), -- consumo de agua -> métricas de sostenibilidad S1 (no hay datapoint de agua) [DUDOSA]
  ('c0000000-0000-0000-0000-000000000010', 'NIIF S1 46 a 50'), -- residuos -> métricas de sostenibilidad S1 (no hay datapoint de residuos) [DUDOSA]
  ('c0000000-0000-0000-0000-000000000011', 'NIIF S2 29 (b) B64 y B65 inciso (a)'), -- riesgos físicos en instalaciones -> activos vulnerables a riesgos físicos
  ('c0000000-0000-0000-0000-000000000011', 'NIIF S2 10(a), (b)y(c)'), -- riesgos físicos -> identificación de riesgos climáticos (físico/transición)
  ('c0000000-0000-0000-0000-000000000012', 'NIIF S2 29 (a)(i)'), -- consumo combustibles -> base de emisiones Alcance 1
  ('c0000000-0000-0000-0000-000000000012', 'NIIF S2 EI14 a E18'), -- consumo combustibles -> detalle Alcance 1
  ('c0000000-0000-0000-0000-000000000012', 'NIIF S2 29 (a)(ii)'), -- consumo combustibles -> medición conforme GHG Protocol
  ('c0000000-0000-0000-0000-000000000013', 'NIIF S2 29 (e)'), -- inversiones/gastos ambientales -> gasto de capital, financiación o inversión aplicada al clima
  ('c0000000-0000-0000-0000-000000000014', 'NIIF S2 29 (d) B64 y B65 inciso (a)'), -- ingresos por productos/servicios sostenibles -> oportunidades climáticas: activos/actividades alineadas [DUDOSA]
  ('c0000000-0000-0000-0000-000000000015', 'NIIF S2 29 (f) (i) y (ii)'), -- precio interno del carbono -> aplicación de precio del carbono en decisiones
  ('c0000000-0000-0000-0000-000000000016', 'NIIF S2 16(a)'), -- efectos financieros de riesgos climáticos -> efecto en situación financiera
  ('c0000000-0000-0000-0000-000000000016', 'NIIF S2 16(b)'), -- efectos financieros -> riesgo de ajuste material en importes en libros
  ('c0000000-0000-0000-0000-000000000017', 'NIIF S1 27(a)'), -- composición del Consejo -> órgano de gobernanza responsable (sostenibilidad)
  ('c0000000-0000-0000-0000-000000000017', 'NIIF S2 6 (a)'), -- composición del Consejo -> órgano de gobernanza responsable (clima)
  ('c0000000-0000-0000-0000-000000000018', 'NIIF S1 27(a)(ii)'), -- competencias del Consejo -> habilidades y competencias (sostenibilidad)
  ('c0000000-0000-0000-0000-000000000018', 'NIIF S2 6 (a)(ii)'), -- competencias del Consejo -> habilidades y competencias (clima)
  ('c0000000-0000-0000-0000-000000000019', 'NIIF S2 14(a)(iv)'), -- plan de transición climática -> plan de transición
  ('c0000000-0000-0000-0000-000000000019', 'NIIF S2 36 (a)a(d)'), -- objetivos de reducción -> objetivo de emisiones GEI
  ('c0000000-0000-0000-0000-000000000019', 'NIIF S2 33'), -- objetivos de reducción -> objetivos climáticos
  ('c0000000-0000-0000-0000-000000000020', 'NIIF S2 22(a)(i)'), -- resiliencia climática -> evaluación de resiliencia
  ('c0000000-0000-0000-0000-000000000020', 'NIIF S2 22(b)(i)'), -- análisis de escenarios -> análisis de escenarios
  ('c0000000-0000-0000-0000-000000000021', 'NIIF S2 29 (a)(v)')  -- consumo eléctrico (Finanzas) -> mismo datapoint que #6 (discrepancia)
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
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000009/consumo_agua_2025.pdf', 'a0000000-0000-0000-0000-000000000003', '{"demo": true, "mimetype": "application/pdf"}'::jsonb),
  -- Objetos de coherencia: solicitudes en estado avanzado que carecían de evidencia.
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000002/horas_capacitacion_2025_DEMO.xlsx', 'a0000000-0000-0000-0000-000000000002', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000003/diversidad_inclusion_2025_DEMO.pdf', 'a0000000-0000-0000-0000-000000000002', '{"demo": true, "mimetype": "application/pdf"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000004/indice_rotacion_2025_DEMO.xlsx', 'a0000000-0000-0000-0000-000000000002', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000013/inversiones_ambientales_2025_DEMO.xlsx', 'a0000000-0000-0000-0000-000000000004', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000017/consejo_composicion_esg_2025_DEMO.pdf', 'a0000000-0000-0000-0000-000000000001', '{"demo": true, "mimetype": "application/pdf"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000018/consejo_competencias_esg_2025_DEMO.pdf', 'a0000000-0000-0000-0000-000000000001', '{"demo": true, "mimetype": "application/pdf"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000019/plan_transicion_climatica_2025_DEMO.pdf', 'a0000000-0000-0000-0000-000000000001', '{"demo": true, "mimetype": "application/pdf"}'::jsonb),
  (gen_random_uuid(), 'evidencias', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000021/consumo_electrico_finanzas_2025_DEMO.xlsx', 'a0000000-0000-0000-0000-000000000004', '{"demo": true, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'::jsonb);

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
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000009/consumo_agua_2025.pdf', 'consumo_agua_2025.pdf', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Reporte de consumo por fuente.'),
  -- ---- Evidencias de coherencia ----
  -- Solicitudes ya en estado avanzado (recibido/en_revision/observaciones/validado)
  -- que carecían de evidencia. Como su estado NO es pendiente/solicitado, el
  -- trigger AFTER INSERT (que solo promueve pendiente/solicitado -> recibido) es
  -- un no-op: el estado declarado se conserva (incluido #17 'validado').
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000002/horas_capacitacion_2025_DEMO.xlsx', 'horas_capacitacion_2025_DEMO.xlsx', '2025 (ene-dic)', 'RH', 'a0000000-0000-0000-0000-000000000002', 'Registro de horas de formación por colaborador.'),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000003/diversidad_inclusion_2025_DEMO.pdf', 'diversidad_inclusion_2025_DEMO.pdf', '2025 (cierre)', 'RH', 'a0000000-0000-0000-0000-000000000002', 'Distribución por género en plantilla y órganos de gobierno.'),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000004/indice_rotacion_2025_DEMO.xlsx', 'indice_rotacion_2025_DEMO.xlsx', '2025 (ene-dic)', 'RH', 'a0000000-0000-0000-0000-000000000002', 'Primer envío; pendiente de conciliar el denominador (ver observación).'),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000013/inversiones_ambientales_2025_DEMO.xlsx', 'inversiones_ambientales_2025_DEMO.xlsx', '2025 (ene-dic)', 'Finanzas', 'a0000000-0000-0000-0000-000000000004', 'Desglose de CAPEX/OPEX ambiental por proyecto.'),
  ('d0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000017/consejo_composicion_esg_2025_DEMO.pdf', 'consejo_composicion_esg_2025_DEMO.pdf', '2025 (cierre)', 'Gobierno Corporativo', 'a0000000-0000-0000-0000-000000000001', 'Integrantes del Consejo, comités y mandatos ESG.'),
  ('d0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000018/consejo_competencias_esg_2025_DEMO.pdf', 'consejo_competencias_esg_2025_DEMO.pdf', '2025 (cierre)', 'Gobierno Corporativo', 'a0000000-0000-0000-0000-000000000001', 'Matriz de competencias de los consejeros en sostenibilidad y clima.'),
  ('d0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000019/plan_transicion_climatica_2025_DEMO.pdf', 'plan_transicion_climatica_2025_DEMO.pdf', '2025 (ene-dic)', 'Dirección', 'a0000000-0000-0000-0000-000000000001', 'Plan de transición: metas de reducción, alcance y año base.'),
  -- Evidencia del caso de discrepancia (#21, Finanzas)
  ('d0000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000021/consumo_electrico_finanzas_2025_DEMO.xlsx', 'consumo_electrico_finanzas_2025_DEMO.xlsx', '2025 (ene-dic)', 'Finanzas', 'a0000000-0000-0000-0000-000000000004', 'Consolidado de Finanzas; difiere del reporte de Operaciones (ver discrepancia).');

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
  -- Alcance 1: VALIDADO con captura 2025 y SIN captura de 2024 → en el export la
  -- celda 2025 se llena y la nota de la fila dice 'Sin evidencia (2024)'.
  ('c0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003', 400000, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #1 plantilla
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 412, 'personas', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #9 agua
  ('c0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000005', 32450, 'm3', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- Capturas de coherencia (solicitudes cuantitativas con evidencia nueva)
  -- #2 horas de capacitación
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', 8450, 'horas', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #4 índice de rotación voluntaria
  ('c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000008', 12.4, '%', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  -- #21 consumo eléctrico (Finanzas): 1,912,000 kWh vs 1,875,430 kWh de #6 (Operaciones)
  -- -> misma unidad (kWh) y periodo (2025), valor distinto = DISCREPANCIA en 'NIIF S2 29 (a)(v)'
  ('c0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-00000000000d', 1912000, 'kWh', '2025', 'b0000000-0000-0000-0000-000000000001', true);

-- =============================================================================
-- 11. Comentarios / observaciones
-- =============================================================================
insert into public.comentarios (solicitud_id, autor_id, contenido, es_observacion) values
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'El índice de rotación no concilia con la plantilla reportada. Favor de revisar el denominador (plantilla promedio) y adjuntar la memoria de cálculo.', true),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Confirmado, corregimos el denominador y reenviamos esta semana.', false),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'Evidencia recibida. Estamos validando los factores de emisión contra el GHG Protocol.', false);

-- =============================================================================
-- 12. Plantilla base [DEMO] — generada desde las 20 solicitudes del reporte demo.
--     Snapshot de título/descripción/área/tipo/unidad/orden + mapeo a datapoints
--     (SIN estados ni evidencia). Global de la firma; solo staff la ve.
-- =============================================================================
-- Idempotencia: la cascada elimina sus plantilla_solicitudes.
delete from public.plantillas where id = 'e0000000-0000-0000-0000-000000000001';

insert into public.plantillas (id, nombre, descripcion, creado_por)
values (
  'e0000000-0000-0000-0000-000000000001',
  'Checklist base NIIF S1/S2 [DEMO]',
  'Set base de solicitudes NIIF S1/S2 generado desde el reporte demo. Clónalo a un reporte nuevo para arrancar un cliente.',
  'b0000000-0000-0000-0000-000000000001'
);

-- Sus solicitudes se copian AL FINAL del seed (§17): la plantilla debe incluir
-- también las solicitudes GEI que se crean en §13 y sus rubros de taxonomía; si
-- se copiara aquí, un cliente clonado nacería sin la parte GEI y su primer
-- export saldría vacío en las dos hojas de emisiones.


-- =============================================================================
-- 13. Fase 3, Sprint 1 — GEI cuantitativo para el export de la plantilla oficial.
--     Cubre las dos hojas GEI de 'Taxonomias NIIF S1 y S2': Alcances 1/2/3 (hoja
--     'NIIF S2 29(a)(i)') y las 15 categorías de Alcance 3 del GHG Protocol (hoja
--     'NIIF S2 29(a)(vi)(1)'). Las categorías se toman VERBATIM de la plantilla.
--
--     Diseño del DEMO: ~mitad validadas (llenan celda), unas con captura sin
--     validar (brecha 'Pendiente de validación') y otras sin captura (brecha
--     'Sin evidencia'), para que el export demuestre llenado Y huecos.
--
--     Va AL FINAL del seed a propósito: el estado 'validado' se fija en un UPDATE
--     posterior a toda inserción de evidencia/captura, porque los triggers de
--     Fase 2 reabren 'validado' -> 'en_revision' en cada INSERT de evidencia/captura.
--
--     NOTA de diseño: el enlace de estas solicitudes a su datapoint vive en
--     mapeo_export.datapoint_id (capa de export de Fase 3). A propósito NO se
--     agregan filas a mapeo_solicitud_datapoint: el detector de discrepancias
--     (lib/discrepancias.ts) agrupa por datapoint+unidad+periodo y marcaría como
--     "discrepancia" el desglose legítimo de Alcance 3 (15 categorías, valores
--     distintos, mismo datapoint) y los tres alcances sobre 29(a)(i). Mapearlas a
--     la capa de cobertura queda para un sprint posterior que refine ese detector.
-- =============================================================================

-- 13.0 Al activar Alcance 2 (c…0008) con valor, su mapeo base a 29(a)(ii)
--      ("medición conforme GHG Protocol", compartido con Alcance 1 c…0007)
--      generaría una falsa discrepancia tCO2e (dos alcances distintos, mismo
--      datapoint). Su datapoint de VALOR es 29(a)(v), que se conserva; aquí se
--      retira solo la fila redundante para dejar UNA discrepancia (la de kWh).
delete from public.mapeo_solicitud_datapoint
 where solicitud_id = 'c0000000-0000-0000-0000-000000000008'
   and datapoint_id = (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(ii)' and version_taxonomia = '2025');

-- 13.1 Solicitudes cuantitativas nuevas (Alcance 3 total + 15 categorías).
insert into public.solicitudes
  (id, reporte_id, titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, estado, responsable_cliente_id, responsable_irstrat_id, fecha_limite, orden)
values
  ('c3000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — total (todas las categorías)', 'Suma de emisiones indirectas de Alcance 3 conforme al GHG Protocol.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 220),
  ('c3000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 1-Bienes y servicios adquiridos', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 230),
  ('c3000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 2-Bienes de capital', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 240),
  ('c3000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 3-Actividades relacionadas con el combustible y la energía no incluidas en las emisiones de gases de efecto invernadero de Alcance 1 o Alcance 2', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 250),
  ('c3000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 4-Transporte y distribución', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 260),
  ('c3000000-0000-0000-0000-000000000105', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 5-Residuos generados en las operaciones', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 270),
  ('c3000000-0000-0000-0000-000000000106', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 6-Viajes de negocios', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 280),
  ('c3000000-0000-0000-0000-000000000107', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 7: Desplazamientos de los empleados', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 290),
  ('c3000000-0000-0000-0000-000000000108', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 8-Activos en arrendamiento financiero', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 300),
  ('c3000000-0000-0000-0000-000000000109', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 9-Transporte y distribución', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 310),
  ('c3000000-0000-0000-0000-000000000110', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 10-Transformación de los productos vendidos', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 320),
  ('c3000000-0000-0000-0000-000000000111', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 11-Uso de los productos vendidos', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 330),
  ('c3000000-0000-0000-0000-000000000112', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 12-Tratamiento de los productos vendidos al final de su vida útil', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 340),
  ('c3000000-0000-0000-0000-000000000113', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 13-Activos arrendados en fases posteriores', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 350),
  ('c3000000-0000-0000-0000-000000000114', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 14-Franquicias', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'pendiente', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 360),
  ('c3000000-0000-0000-0000-000000000115', '20000000-0000-0000-0000-000000000001', 'Emisiones GEI Alcance 3 — Categoría 15-Inversiones', 'Emisiones de la categoría de Alcance 3 (GHG Protocol) para el inventario GEI.', 'Operaciones', true, 'tCO2e', 'en_revision', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 370);

-- 13.2 Evidencias (una por solicitud con datos; el trigger asigna 'version').
insert into public.evidencias (id, solicitud_id, archivo_path, nombre_original, periodo_cubierto, area_origen, subido_por, notas) values
  ('d3000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000008/inventario_gei_alcance2_2025_DEMO.xlsx', 'inventario_gei_alcance2_2025_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Emisiones de Alcance 2 (ubicación y mercado), ambos ejercicios.'),
  ('d3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000001/inventario_gei_alcance3_total_DEMO.xlsx', 'inventario_gei_alcance3_total_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Consolidado de Alcance 3 (todas las categorías), ambos ejercicios.'),
  ('d3000000-0000-0000-0000-000000000101', 'c3000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000101/gei_alcance3_cat1_DEMO.xlsx', 'gei_alcance3_cat1_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 1 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000102', 'c3000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000102/gei_alcance3_cat2_DEMO.xlsx', 'gei_alcance3_cat2_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 2 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000103', 'c3000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000103/gei_alcance3_cat3_DEMO.xlsx', 'gei_alcance3_cat3_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 3 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000104', 'c3000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000104/gei_alcance3_cat4_DEMO.xlsx', 'gei_alcance3_cat4_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 4 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000105', 'c3000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000105/gei_alcance3_cat5_DEMO.xlsx', 'gei_alcance3_cat5_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 5 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000106', 'c3000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000106/gei_alcance3_cat6_DEMO.xlsx', 'gei_alcance3_cat6_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 6 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000107', 'c3000000-0000-0000-0000-000000000107', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000107/gei_alcance3_cat7_DEMO.xlsx', 'gei_alcance3_cat7_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 7 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000108', 'c3000000-0000-0000-0000-000000000108', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000108/gei_alcance3_cat8_DEMO.xlsx', 'gei_alcance3_cat8_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 8 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000111', 'c3000000-0000-0000-0000-000000000111', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000111/gei_alcance3_cat11_DEMO.xlsx', 'gei_alcance3_cat11_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 11 de Alcance 3.'),
  ('d3000000-0000-0000-0000-000000000115', 'c3000000-0000-0000-0000-000000000115', '10000000-0000-0000-0000-000000000001/c3000000-0000-0000-0000-000000000115/gei_alcance3_cat15_DEMO.xlsx', 'gei_alcance3_cat15_DEMO.xlsx', '2025 (ene-dic)', 'Operaciones', 'a0000000-0000-0000-0000-000000000003', 'Soporte de la categoría 15 de Alcance 3.');

-- 13.3 Capturas de valor (confirmadas). Para 'lleno' y 'pendiente': 2025 y 2024.
--      Alcance 1 (c0007) conserva SOLO su captura 2025 de la §10 (última = 2025):
--      así no colisiona con Alcance 2 (última = 2024) en su datapoint compartido
--      29(a)(ii) y no genera una falsa discrepancia. Queda 'Pendiente' en el export.
insert into public.capturas_valor (solicitud_id, evidencia_id, valor, unidad, periodo, capturado_por, confirmado) values
  ('c0000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000002', 3120.4, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000002', 2980.1, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 15750.0, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 14992.3, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000101', 'd3000000-0000-0000-0000-000000000101', 1240, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000101', 'd3000000-0000-0000-0000-000000000101', 1180.5, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000102', 'd3000000-0000-0000-0000-000000000102', 305.7, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000102', 'd3000000-0000-0000-0000-000000000102', 288, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000103', 'd3000000-0000-0000-0000-000000000103', 512.4, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000103', 'd3000000-0000-0000-0000-000000000103', 497.1, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000104', 'd3000000-0000-0000-0000-000000000104', 2110.9, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000104', 'd3000000-0000-0000-0000-000000000104', 1975.4, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000105', 'd3000000-0000-0000-0000-000000000105', 88.3, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000105', 'd3000000-0000-0000-0000-000000000105', 91.2, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000106', 'd3000000-0000-0000-0000-000000000106', 143.6, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000106', 'd3000000-0000-0000-0000-000000000106', 120.8, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000107', 'd3000000-0000-0000-0000-000000000107', 64.2, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000107', 'd3000000-0000-0000-0000-000000000107', 59.9, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000108', 'd3000000-0000-0000-0000-000000000108', 41, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000108', 'd3000000-0000-0000-0000-000000000108', 38.5, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000111', 'd3000000-0000-0000-0000-000000000111', 9820, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000111', 'd3000000-0000-0000-0000-000000000111', 9410.7, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000115', 'd3000000-0000-0000-0000-000000000115', 1500, 'tCO2e', '2025', 'b0000000-0000-0000-0000-000000000001', true),
  ('c3000000-0000-0000-0000-000000000115', 'd3000000-0000-0000-0000-000000000115', 1450, 'tCO2e', '2024', 'b0000000-0000-0000-0000-000000000001', true);

-- 13.4 Mapeo celda↔dato de las dos hojas GEI (leído de la plantilla real).
--      Etiquetas (categoría verbatim + unidad) y celdas de valor por año.
insert into public.mapeo_export (hoja, celda, etiqueta) values
  ('NIIF S2 29(a)(i)', 'A3', 'Alcance 1'),
  ('NIIF S2 29(a)(i)', 'B3', 'tCO2e'),
  ('NIIF S2 29(a)(i)', 'A4', 'Alcance 2'),
  ('NIIF S2 29(a)(i)', 'B4', 'tCO2e'),
  ('NIIF S2 29(a)(i)', 'A5', 'Alcance 3'),
  ('NIIF S2 29(a)(i)', 'B5', 'tCO2e'),
  ('NIIF S2 29(a)(vi)(1)', 'A4', 'Categoría 1-Bienes y servicios adquiridos'),
  ('NIIF S2 29(a)(vi)(1)', 'A5', 'Categoría 2-Bienes de capital'),
  ('NIIF S2 29(a)(vi)(1)', 'A6', 'Categoría 3-Actividades relacionadas con el combustible y la energía no incluidas en las emisiones de gases de efecto invernadero de Alcance 1 o Alcance 2'),
  ('NIIF S2 29(a)(vi)(1)', 'A7', 'Categoría 4-Transporte y distribución'),
  ('NIIF S2 29(a)(vi)(1)', 'A8', 'Categoría 5-Residuos generados en las operaciones'),
  ('NIIF S2 29(a)(vi)(1)', 'A9', 'Categoría 6-Viajes de negocios'),
  ('NIIF S2 29(a)(vi)(1)', 'A10', 'Categoría 7: Desplazamientos de los empleados'),
  ('NIIF S2 29(a)(vi)(1)', 'A11', 'Categoría 8-Activos en arrendamiento financiero'),
  ('NIIF S2 29(a)(vi)(1)', 'A12', 'Categoría 9-Transporte y distribución'),
  ('NIIF S2 29(a)(vi)(1)', 'A13', 'Categoría 10-Transformación de los productos vendidos'),
  ('NIIF S2 29(a)(vi)(1)', 'A14', 'Categoría 11-Uso de los productos vendidos'),
  ('NIIF S2 29(a)(vi)(1)', 'A15', 'Categoría 12-Tratamiento de los productos vendidos al final de su vida útil'),
  ('NIIF S2 29(a)(vi)(1)', 'A16', 'Categoría 13-Activos arrendados en fases posteriores'),
  ('NIIF S2 29(a)(vi)(1)', 'A17', 'Categoría 14-Franquicias'),
  ('NIIF S2 29(a)(vi)(1)', 'A18', 'Categoría 15-Inversiones');

-- 13.4.a Rubro canónico de cada solicitud GEI: es la llave con la que el export
--        resuelve su celda en el reporte que se esté generando. El mapeo ya no
--        apunta a estos UUID (ver migración 20260818120000).
update public.solicitudes set rubro_taxonomia = 'gei_alcance_1'       where id = 'c0000000-0000-0000-0000-000000000007';
update public.solicitudes set rubro_taxonomia = 'gei_alcance_2'       where id = 'c0000000-0000-0000-0000-000000000008';
update public.solicitudes set rubro_taxonomia = 'gei_alcance_3_total' where id = 'c3000000-0000-0000-0000-000000000001';
update public.solicitudes s
set rubro_taxonomia = 'gei_a3_cat_' || lpad(n::text, 2, '0')
from generate_series(1, 15) as n
where s.id = ('c3000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid;

-- 13.4.b Celdas de VALOR: (hoja, celda) → (rubro canónico, año relativo).
--        anio_offset 0 = ejercicio del reporte (2025 en el demo), 1 = anterior.
insert into public.mapeo_export (hoja, celda, rubro_clave, datapoint_id, anio_offset, celda_nota) values
  ('NIIF S2 29(a)(i)', 'C3', 'gei_alcance_1',       (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(i)' and version_taxonomia = '2025'), 0, 'E3'),
  ('NIIF S2 29(a)(i)', 'D3', 'gei_alcance_1',       (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(i)' and version_taxonomia = '2025'), 1, 'E3'),
  ('NIIF S2 29(a)(i)', 'C4', 'gei_alcance_2',       (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(i)' and version_taxonomia = '2025'), 0, 'E4'),
  ('NIIF S2 29(a)(i)', 'D4', 'gei_alcance_2',       (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(i)' and version_taxonomia = '2025'), 1, 'E4'),
  ('NIIF S2 29(a)(i)', 'C5', 'gei_alcance_3_total', (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(i)' and version_taxonomia = '2025'), 0, 'E5'),
  ('NIIF S2 29(a)(i)', 'D5', 'gei_alcance_3_total', (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(i)' and version_taxonomia = '2025'), 1, 'E5');

-- Las 15 categorías ocupan las filas 4-18 en el orden impreso de la plantilla:
-- columna B el ejercicio del reporte, C el anterior, D la nota de la fila.
insert into public.mapeo_export (hoja, celda, rubro_clave, datapoint_id, anio_offset, celda_nota)
select
  'NIIF S2 29(a)(vi)(1)',
  col.letra || (3 + n)::text,
  'gei_a3_cat_' || lpad(n::text, 2, '0'),
  (select id from public.datapoints_taxonomia where codigo = 'NIIF S2 29 (a)(vi)(1) EI12' and version_taxonomia = '2025'),
  col.offset_anio,
  'D' || (3 + n)::text
from generate_series(1, 15) as n
cross join (values ('B', 0), ('C', 1)) as col(letra, offset_anio);

-- 13.5 Fijar 'validado' DESPUÉS de toda inserción (los triggers ya no reabren).
--      Solo estas entran a la plantilla oficial; el resto queda como brecha.
update public.solicitudes set estado = 'validado' where id in (
  'c0000000-0000-0000-0000-000000000008',
  'c3000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000101',
  'c3000000-0000-0000-0000-000000000102',
  'c3000000-0000-0000-0000-000000000104',
  'c3000000-0000-0000-0000-000000000105',
  'c3000000-0000-0000-0000-000000000106',
  'c3000000-0000-0000-0000-000000000107',
  'c3000000-0000-0000-0000-000000000111'
);

-- =============================================================================
-- 14. Fase 3, Sprint 2 — rubro_clave, restauración de mapeos GEI, fix #1/#17 y
--     registros de riesgos/oportunidades climáticos.
-- =============================================================================

-- 14.1 rubro_clave: las DOS solicitudes de consumo eléctrico capturan el mismo
--      concepto (consumo eléctrico total del ejercicio) y deben cuadrar. Es la
--      discrepancia intencional de la demo (Operaciones #6 vs Finanzas #21).
update public.solicitudes set rubro_clave = 'consumo_electrico_total'
 where id in (
   'c0000000-0000-0000-0000-000000000006',
   'c0000000-0000-0000-0000-000000000021'
 );

-- 14.2 Restaura en mapeo_solicitud_datapoint las ligas GEI que el Sprint 1 dejó
--      solo en mapeo_export (para que cobertura muestre solicitudes en esos
--      datapoints). Con el detector por rubro_clave (estas NO llevan rubro) el
--      desglose de Alcance 3 ya NO genera falsas discrepancias.
insert into public.mapeo_solicitud_datapoint (solicitud_id, datapoint_id)
select s.sid::uuid, d.id
from (values
  ('c0000000-0000-0000-0000-000000000008', 'NIIF S2 29 (a)(i)'),          -- Alcance 2
  ('c3000000-0000-0000-0000-000000000001', 'NIIF S2 29 (a)(i)'),          -- Alcance 3 total
  ('c3000000-0000-0000-0000-000000000001', 'NIIF S2 29 (a)(vi)(1)'),
  ('c3000000-0000-0000-0000-000000000101', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000102', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000103', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000104', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000105', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000106', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000107', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000108', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000109', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000110', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000111', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000112', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000113', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000114', 'NIIF S2 29 (a)(vi)(1) EI12'),
  ('c3000000-0000-0000-0000-000000000115', 'NIIF S2 29 (a)(vi)(1) EI12')
) as s(sid, codigo)
join public.datapoints_taxonomia d on d.codigo = s.codigo and d.version_taxonomia = '2025'
on conflict do nothing;

-- 14.3 Fix #1/#17: quedaron declaradas 'validado' en §6 pero los triggers de
--      Fase 2 las reabrieron a 'en_revision' al insertar su evidencia (§9). Se
--      fijan aquí, DESPUÉS de toda inserción de evidencia/captura, igual que el
--      patrón del Sprint 1 (§13.5).
update public.solicitudes set estado = 'validado'
 where id in (
   'c0000000-0000-0000-0000-000000000001',  -- Plantilla y rotación de personal 2025
   'c0000000-0000-0000-0000-000000000007',  -- Inventario GEI Alcance 1 (2025 validado 400,000; sin 2024 → 'Sin evidencia (2024)')
   'c0000000-0000-0000-0000-000000000017'   -- Composición del Consejo en sostenibilidad
 );

-- 14.4 Registros de riesgos y oportunidades climáticos (DEMO) -----------------
--      3 riesgos (2 físicos, 1 transición) + 2 oportunidades. Valores de ambos
--      ejercicios en la mayoría; una oportunidad SIN valores (demuestra brecha).
--      Horizontes como multi-enum (v2): algunos registros cubren varios plazos.
insert into public.registros_clima (id, reporte_id, tipo, nombre, descripcion, horizontes, orden, activo) values
  ('f0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'riesgo_fisico',     '[DEMO] Estrés hídrico en planta norte',            'Reducción de disponibilidad de agua para procesos en la planta norte por sequías recurrentes.', array['Corto plazo','Mediano plazo'], 10, true),
  ('f0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'riesgo_fisico',     '[DEMO] Inundación costera en centro de distribución', 'Exposición del centro de distribución del golfo a marejadas e inundación por elevación del nivel del mar.', array['Largo plazo'], 20, true),
  ('f0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'riesgo_transicion', '[DEMO] Precio del carbono y endurecimiento regulatorio', 'Aumento de costos operativos por impuestos al carbono y regulación de emisiones en jurisdicciones clave.', array['Mediano plazo','Largo plazo'], 30, true),
  ('f0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'oportunidad',       '[DEMO] Eficiencia energética en operaciones',      'Ahorro por eficiencia energética y autoconsumo solar en instalaciones propias.', array['Corto plazo'], 40, true),
  ('f0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'oportunidad',       '[DEMO] Línea de productos bajos en carbono',       'Nueva línea de productos de baja huella para mercados con preferencia sostenible.', array['Mediano plazo','Largo plazo'], 50, true);

--      Despliegue de capital en tres (v2): gasto / financiación / inversión.
insert into public.registros_clima_valores
  (registro_id, ejercicio, cantidad_activos, porcentaje, capital_gasto, capital_financiacion, capital_inversion, notas, capturado_por) values
  -- R1 estrés hídrico (ambos ejercicios)
  ('f0000000-0000-0000-0000-000000000001', 2025, 3, 12.5, 450000, 120000, 80000,  'Tres sitios con captación propia en zona de sequía.', 'b0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000001', 2024, 2, 8.0,  300000, 90000,  50000,  null, 'b0000000-0000-0000-0000-000000000001'),
  -- R2 inundación costera (ambos ejercicios)
  ('f0000000-0000-0000-0000-000000000002', 2025, 1, 4.2,  180000, 60000,  null,   null, 'b0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', 2024, 1, 4.0,  150000, 50000,  null,   null, 'b0000000-0000-0000-0000-000000000001'),
  -- R3 precio del carbono (ambos ejercicios)
  ('f0000000-0000-0000-0000-000000000003', 2025, 5, 22.0, 1200000, 500000, 300000, 'Cobertura ampliada a la operación de exportación.', 'b0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000003', 2024, 4, 18.5, 900000,  400000, 200000, null, 'b0000000-0000-0000-0000-000000000001'),
  -- O1 eficiencia energética (ambos ejercicios)
  ('f0000000-0000-0000-0000-000000000004', 2025, 6, 30.0, 2100000, 900000, 700000, 'Incluye autoconsumo solar en dos plantas.', 'b0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000004', 2024, 5, 25.0, 1750000, 750000, 600000, null, 'b0000000-0000-0000-0000-000000000001');
  -- O2 (línea de productos bajos en carbono): SIN valores — demuestra la brecha 'Sin datos del ejercicio'.

-- 15. Fase 3, Sprint 3 — Objetivos climáticos y de sostenibilidad (DEMO) -------
--     Alimentan 5 hojas: S1 51 (todos), S2 33/34/35/36(a-d) (solo climáticos).
--       O1: climático absoluto GEI  — ficha completa.
--       O2: climático de intensidad — ficha completa.
--       O3: sostenibilidad general  — naturaleza 'oportunidad' (sección Oportunidades de S1 51).
--       O4: climático INCOMPLETO    — sin ficha hermana => brecha 'Sección pendiente en plataforma'.
insert into public.objetivos (
  id, reporte_id, ambito, naturaleza, nombre, descripcion, tipo, metrica, meta,
  parte_entidad, periodo_aplicacion, periodo_base, hito_intermedio, tipo_objetivo,
  alineacion_acuerdo_internacional, orden, activo
) values
  ('d0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'climatico', 'riesgo',
   '[DEMO] Reducción absoluta de emisiones GEI (Alcance 1 y 2)',
   'Reducir las emisiones absolutas de gases de efecto invernadero de Alcance 1 y 2 respecto del año base.',
   'Objetivo de emisiones de gases de efecto invernadero', 'tCO2e absolutas (Alcance 1 + 2, con base en el mercado)',
   'Reducir 42% las emisiones absolutas de Alcance 1 y 2 al 2030',
   'Toda la entidad (operaciones propias)', '2024–2030', '2023',
   'Reducción intermedia de 25% al 2027', 'Absoluto',
   'Alineado con la trayectoria de 1.5 °C del Acuerdo de París; compromiso presentado a SBTi.',
   10, true),
  ('d0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'climatico', 'riesgo',
   '[DEMO] Intensidad de carbono por tonelada producida',
   'Reducir la intensidad de emisiones por unidad de producción física.',
   'Objetivo de emisiones de gases de efecto invernadero', 'tCO2e por tonelada producida',
   'Reducir 50% la intensidad de emisiones al 2030',
   'Unidades de negocio manufactureras', '2024–2030', '2022',
   'Reducción intermedia de 30% al 2027', 'De intensidad',
   'Consistente con el enfoque de contracción y convergencia del Acuerdo de París.',
   20, true),
  ('d0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'sostenibilidad', 'oportunidad',
   '[DEMO] Mujeres en posiciones de liderazgo',
   'Incrementar la proporción de mujeres en puestos de dirección y gerencia.',
   'Fijado por la entidad', 'Porcentaje de mujeres en posiciones de liderazgo',
   'Alcanzar 40% de mujeres en liderazgo al 2028',
   'Toda la entidad', '2024–2028', '2023',
   'Alcanzar 30% al 2026', 'Cuantitativo', null,
   30, true),
  ('d0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'climatico', 'riesgo',
   '[DEMO] Consumo de energía renovable',
   'Incrementar la participación de energía renovable en el consumo total.',
   'Fijado por la entidad', 'Porcentaje de energía renovable sobre el consumo total',
   null, null, '2024–2030', null, null, null, null,
   40, true);

-- Fichas hermanas (S2 34/35/36 y columnas H/I de S1 51). O4 se deja SIN ficha.
insert into public.objetivos_detalle (
  objetivo_id, validacion_tercero, procesos_revision, metricas_supervision,
  revisiones, resultados, analisis_tendencias, gases_cubiertos,
  alcances_cubiertos, bruto_neto, enfoque_descarbonizacion, notas
) values
  -- validacion_tercero y enfoque_descarbonizacion ahora son booleanos ('Verdadero'/
  -- 'Falso'); el detalle de "por cuál" se migra a notas para no perder la traza.
  ('d0000000-0000-0000-0000-000000000001',
   'Verdadero',
   'Revisión anual por el Comité de Sostenibilidad; recalibración cada 3 años.',
   'tCO2e absolutas de Alcance 1 y 2 reportadas trimestralmente.',
   'Sin revisiones al objetivo desde su fijación en 2024.',
   'Reducción de 12% acumulada al cierre 2025 respecto del año base.',
   'Tendencia descendente sostenida; mayor caída por electrificación de flota.',
   'Dióxido de carbono (CO2); Metano (CH4); Óxido nitroso (N2O)',
   'Alcance 1; Alcance 2',
   'Emisiones brutas de gases de efecto invernadero',
   'Falso',
   'Objetivo y metodología validados por SBTi en 2024.'),
  ('d0000000-0000-0000-0000-000000000002',
   'Verdadero',
   'Revisión semestral del denominador de producción por Operaciones.',
   'tCO2e por tonelada producida, normalizada por mezcla de producto.',
   'Ajuste del año base a 2022 tras la adquisición de la planta sur (2024).',
   'Intensidad reducida 18% respecto de 2022.',
   'Mejora acelerada por eficiencia térmica; sensible al volumen de producción.',
   'Dióxido de carbono (CO2); Metano (CH4); Óxido nitroso (N2O)',
   'Alcance 1; Alcance 2',
   'Emisiones brutas de gases de efecto invernadero',
   'Verdadero',
   'Metodología de intensidad revisada por consultor externo independiente.'),
  ('d0000000-0000-0000-0000-000000000003',
   null,
   'Revisión anual por el Comité de Talento y Cultura.',
   'Porcentaje de mujeres en el primer y segundo nivel de reporte.',
   'Sin revisiones al objetivo.',
   'Avance a 34% de mujeres en liderazgo al cierre 2025.',
   'Tendencia ascendente; mayor avance en áreas comerciales.',
   null, null, null, null,
   null);
  -- O4 (energía renovable): SIN ficha hermana — demuestra 'Sección pendiente en plataforma'.

-- 16. Fase 3, Sprint 4 — Cuestionarios narrativos (DEMO) ----------------------
--     Alimentan 3 hojas: S2 22(b)(i)/(ii) y 36(e). Grados de avance distintos
--     para demostrar cómo el export refleja las brechas:
--       · 'S2 22(b)(i)'  COMPLETO  — 8 de 8 respondidas (incluye booleanos y
--                                    enumeraciones múltiples).
--       · 'S2 22(b)(ii)' A MEDIAS  — 4 de 6 (orden 5 y 6 quedan 'Pendiente en plataforma').
--       · 'S2 36(e)'     2 de 5    — solo (i) y (ii); (iii)-(iv) quedan pendientes.
--     Las preguntas NO viven en BD: son fijas de la estructura oficial
--     (lib/cuestionarios.ts); aquí solo la respuesta (serializada: "Verdadero"/
--     "Falso" para booleanos, opciones unidas por "; " para enumeraciones), el
--     tipo de dato (fijo del catálogo en 22(b), libre en 36(e)) y la nota.
insert into public.cuestionarios_respuestas
  (reporte_id, hoja, pregunta_orden, respuesta, tipo_dato, notas) values
  -- S2 22(b)(i) — cómo/cuándo + insumos (COMPLETO 8/8)
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 1,
   'El análisis se llevó a cabo en el segundo semestre de 2024 mediante modelación cuantitativa de escenarios, con actualización anual.',
   'Bloque de texto', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 2,
   'Escenarios AIE NZE 2050, NGFS Transición Ordenada y NGFS Políticas Actuales; fuentes: Agencia Internacional de la Energía y NGFS (fase IV).',
   'Bloque de texto', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 3,
   'Verdadero', 'Booleano', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 4,
   'Riesgos físicos relacionados con el clima; Riesgos de transición relacionados con el clima',
   'Enumeración', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 5,
   'Verdadero', 'Booleano', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 6,
   'Representan el rango plausible de trayectorias regulatorias y físicas relevantes para los mercados en los que opera la entidad.',
   'Bloque de texto', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 7,
   'Corto plazo; Mediano plazo; Largo plazo', 'Enumeración', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(i)', 8,
   'Todas las operaciones propias y los centros de distribución consolidados.',
   'Bloque de texto', null),
  -- S2 22(b)(ii) — supuestos clave (A MEDIAS 4/6; faltan orden 5 y 6)
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(ii)', 1,
   'Implementación gradual de un precio al carbono en las jurisdicciones principales a partir de 2027.',
   'Bloque de texto', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(ii)', 2,
   'Crecimiento del PIB de 2% anual y convergencia de la inflación al objetivo del banco central.',
   'Bloque de texto', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(ii)', 3,
   'Mayor frecuencia de sequías en la región norte y elevación del nivel del mar en la costa del golfo.',
   'Bloque de texto', 'Falta cerrar el supuesto de disponibilidad de agua con Operaciones.'),
  ('20000000-0000-0000-0000-000000000001', 'S2 22(b)(ii)', 4,
   'Transición gradual hacia fuentes renovables; 40% de energía limpia en la matriz al 2030.',
   'Bloque de texto', null),
  -- S2 36(e) — créditos de carbono (2 de 5; solo (i) y (ii); tipo de dato libre)
  ('20000000-0000-0000-0000-000000000001', 'S2 36(e)', 1,
   'El objetivo de emisiones netas prevé el uso de créditos de carbono para no más del 10% de las reducciones al 2030.',
   'Cuantitativo', null),
  ('20000000-0000-0000-0000-000000000001', 'S2 36(e)', 2,
   'Créditos verificados bajo los regímenes Verra (VCS) y Gold Standard.',
   'Cualitativo', null);


-- =============================================================================
-- 17. Plantilla base — se llena AL FINAL, cuando el reporte demo ya está completo.
--
--     La plantilla es el vehículo con el que arranca un cliente nuevo: al
--     clonarla se copian título, descripción, área, tipo, unidad, orden, el
--     snapshot de datapoints y —clave para el export— el RUBRO DE TAXONOMÍA de
--     cada solicitud. Sin el rubro, el reporte del cliente nuevo no resolvería
--     ninguna celda GEI de la plantilla oficial.
-- =============================================================================
insert into public.plantilla_solicitudes
  (plantilla_id, titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada,
   orden, datapoint_ids, rubro_taxonomia)
select
  'e0000000-0000-0000-0000-000000000001',
  s.titulo, s.descripcion, s.area_asignada, s.es_cuantitativa, s.unidad_esperada, s.orden,
  coalesce(
    array_agg(m.datapoint_id order by m.datapoint_id) filter (where m.datapoint_id is not null),
    '{}'::uuid[]
  ),
  s.rubro_taxonomia
from public.solicitudes s
left join public.mapeo_solicitud_datapoint m on m.solicitud_id = s.id
where s.reporte_id = '20000000-0000-0000-0000-000000000001'
group by s.id, s.titulo, s.descripcion, s.area_asignada, s.es_cuantitativa,
         s.unidad_esperada, s.orden, s.rubro_taxonomia;
