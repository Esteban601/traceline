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
  ('c0000000-0000-0000-0000-000000000020', 'NIIF S2 22(b)(i)')  -- análisis de escenarios -> análisis de escenarios
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
