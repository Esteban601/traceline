#!/usr/bin/env node
// =============================================================================
// Tenants de DEMOSTRACIÓN para prospectos — mockups comerciales.
//
// Monta, dentro de la plataforma, cómo se vería el proceso de recabado de un
// prospecto: su nombre y su logo REALES, y datos ILUSTRATIVOS. Es para una
// reunión comercial, no para operar.
//
// La regla que gobierna todo el script:
//
//   EL NOMBRE Y EL LOGO SON DEL PROSPECTO. LOS DATOS, NUNCA.
//
// Por eso cada tenant nace con `es_demo = true`, que es lo que enciende la franja
// "Entorno de demostración — datos ilustrativos" en sus sesiones y el pie [DEMO]
// en su Excel de taxonomía. Y por eso las cifras son redondas y cada captura dice
// en su justificación que no corresponde a información del prospecto: si alguien
// abre la plataforma sin contexto, el propio dato lo desmiente.
//
// NO INVENTA MAQUINARIA. Usa la que ya existe:
//   · el alta de cliente de /admin/clientes (tenant + áreas + logo al bucket)
//   · el clonado de reporte desde plantilla (con sus rubros y recordatorios)
//   · el alta de usuarios de /admin/usuarios
//   · la carga de evidencia del portal, con la sesión del usuario del área
//   · el visto bueno del jefe de área, con la sesión del jefe
//   · la observación y la validación del staff, por la regla de origen
//
// Lo único que se hace "por debajo" es poner las solicitudes en `solicitado`
// (enviarlas por el botón exige un correo entregable, y estas cuentas son
// @example: el envío se omite a propósito y el estado no avanza) y crear las
// cuentas en auth, que también en la aplicación pasa por service_role.
//
// Uso:
//   node scripts/crear-demo-prospecto.mjs                  # todos, idempotente
//   node scripts/crear-demo-prospecto.mjs --solo gav       # uno
//   node scripts/crear-demo-prospecto.mjs --rehacer        # borra y reconstruye
//   node scripts/crear-demo-prospecto.mjs --limpiar        # solo borra
//   DEMO_TARGET_OK=1 node scripts/... --rehacer            # requerido si NO es local
//
// IDEMPOTENCIA: por default NO destruye nada. Completa lo que falte y deja en
// paz lo que ya está —incluidas las contraseñas, que no se pueden volver a leer—.
// Con `--rehacer` sí borra y reconstruye, y entonces las credenciales son nuevas.
// =============================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// -----------------------------------------------------------------------------
// Configuración: los prospectos
// -----------------------------------------------------------------------------
// `areas` es el catálogo del cliente (el orden es el del selector).
// `mapa` traduce el área de la PLANTILLA al área de este cliente: la plantilla
// habla de RH/Operaciones/Finanzas/Gobierno Corporativo/Dirección, y cada
// prospecto organiza el trabajo a su manera.
// `mueve` reasigna solicitudes concretas por título. Existe para que ninguna área
// del catálogo quede vacía: un área sin una sola solicitud, en un mockup, se lee
// como un defecto de la plataforma y no como una decisión.
const PROSPECTOS = [
  {
    slug: "gav",
    nombre: "Grupo Acosta Verde",
    prefijo: "GAV",
    logo: "gav.png",
    areas: [
      "Operación de Plazas",
      "Desarrollo y Construcción",
      "Administración y Finanzas",
      "Capital Humano",
      "Sostenibilidad",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Operación de Plazas",
      Finanzas: "Administración y Finanzas",
      "Gobierno Corporativo": "Sostenibilidad",
      Dirección: "Sostenibilidad",
    },
    mueve: [
      { re: /Riesgos físicos climáticos/i, area: "Desarrollo y Construcción" },
      { re: /Inversiones y gastos ambientales/i, area: "Desarrollo y Construcción" },
      { re: /Categoría 2-Bienes de capital/i, area: "Desarrollo y Construcción" },
    ],
  },
  {
    slug: "traton-fs",
    nombre: "TRATON Financial Services México",
    prefijo: "TFS",
    logo: "traton-fs.png",
    areas: [
      "Riesgos",
      "Crédito y Operaciones",
      "Capital Humano",
      "Administración y Finanzas",
      "Cumplimiento",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Crédito y Operaciones",
      Finanzas: "Administración y Finanzas",
      "Gobierno Corporativo": "Cumplimiento",
      Dirección: "Riesgos",
    },
    mueve: [
      { re: /Riesgos físicos climáticos/i, area: "Riesgos" },
      { re: /Efectos financieros de riesgos climáticos/i, area: "Riesgos" },
      { re: /Política de derechos humanos/i, area: "Cumplimiento" },
      // En una financiera la categoría material de Alcance 3 es la cartera.
      { re: /Categoría 15-Inversiones/i, area: "Riesgos" },
    ],
  },
  {
    slug: "fibra-inn",
    nombre: "Fibra Inn",
    prefijo: "FINN",
    logo: "fibra-inn.png",
    areas: [
      "Operación Hotelera",
      "Desarrollo y Mantenimiento",
      "Administración y Finanzas",
      "Capital Humano",
      "Sostenibilidad",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Operación Hotelera",
      Finanzas: "Administración y Finanzas",
      "Gobierno Corporativo": "Sostenibilidad",
      Dirección: "Sostenibilidad",
    },
    mueve: [
      // En una fibra hotelera el efecto financiero del clima lo lleva el área que
      // responde por el valor de los inmuebles y los seguros.
      { re: /Efectos financieros de riesgos climáticos/i, area: "Administración y Finanzas" },
      // "Uso de los productos/servicios" en un hotel es la estancia: la operación.
      { re: /productos\/servicios sostenibles/i, area: "Operación Hotelera" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Operación Hotelera" },
      // El riesgo físico y el capex de los inmuebles son de quien los construye y
      // los mantiene. Sin esto, "Desarrollo y Mantenimiento" quedaría sin una sola
      // entrega y en un mockup eso se lee como un área que nadie usa.
      { re: /Riesgos físicos climáticos/i, area: "Desarrollo y Mantenimiento" },
      { re: /Inversiones y gastos ambientales/i, area: "Desarrollo y Mantenimiento" },
      { re: /Categoría 2-Bienes de capital/i, area: "Desarrollo y Mantenimiento" },
    ],
  },
  {
    slug: "afirme",
    nombre: "Afirme",
    prefijo: "AFR",
    logo: "afirme.png",
    areas: [
      "Riesgos",
      "Banca y Operaciones",
      "Cumplimiento",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Banca y Operaciones",
      Finanzas: "Administración y Finanzas",
      "Gobierno Corporativo": "Cumplimiento",
      Dirección: "Riesgos",
    },
    // Mismo criterio de materialidad que TRATON, por ser grupo financiero: lo
    // material no es la huella de las oficinas, es la cartera y el balance.
    mueve: [
      { re: /Categoría 15-Inversiones/i, area: "Riesgos" },
      { re: /Efectos financieros de riesgos climáticos/i, area: "Riesgos" },
      { re: /Riesgos físicos climáticos/i, area: "Riesgos" },
      { re: /Política de derechos humanos/i, area: "Cumplimiento" },
    ],
  },
  {
    slug: "inmobilia",
    nombre: "Inmobilia",
    prefijo: "INM",
    logo: "inmobilia.png",
    areas: [
      "Desarrollo y Proyectos",
      "Construcción",
      "Comercialización",
      "Capital Humano",
      "Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Construcción",
      Finanzas: "Finanzas",
      "Gobierno Corporativo": "Desarrollo y Proyectos",
      Dirección: "Desarrollo y Proyectos",
    },
    mueve: [
      { re: /Riesgos físicos climáticos/i, area: "Desarrollo y Proyectos" },
      { re: /productos\/servicios sostenibles/i, area: "Comercialización" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercialización" },
    ],
  },
  {
    slug: "bafar",
    nombre: "Grupo Bafar",
    prefijo: "BFR",
    logo: "bafar.png",
    areas: [
      "Producción y Plantas",
      "Cadena de Suministro y Logística",
      "Comercial",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Producción y Plantas",
      Finanzas: "Administración y Finanzas",
      // No hay área de sostenibilidad ni de gobierno en el catálogo: en un grupo
      // agroindustrial de control familiar el expediente del Consejo y el plan
      // de transición los arma la dirección de administración.
      "Gobierno Corporativo": "Administración y Finanzas",
      Dirección: "Administración y Finanzas",
    },
    // El riesgo físico climático, el capex ambiental y la Categoría 2-Bienes de
    // capital ya caen en Producción y Plantas por el `mapa` (son Operaciones y
    // Finanzas en la plantilla), salvo el capex, que vive en Finanzas y sí hay
    // que moverlo: en una agroindustria la inversión ambiental es la planta.
    mueve: [
      { re: /Inversiones y gastos ambientales/i, area: "Producción y Plantas" },
      // Lo que se vende: el ingreso sostenible y el uso del producto son del área
      // que pone el producto en el anaquel, no de la planta.
      { re: /productos\/servicios sostenibles/i, area: "Comercial" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercial" },
      // En una agroindustria el Alcance 3 lo domina lo que se compra —grano,
      // ganado— y la cadena de frío que lo mueve. Ese inventario lo arma
      // abastecimiento, y es lo que le da movimiento a su área.
      { re: /Alcance 3 — total/i, area: "Cadena de Suministro y Logística" },
      { re: /Categoría 1-Bienes y servicios adquiridos/i, area: "Cadena de Suministro y Logística" },
      { re: /Transporte y distribución/i, area: "Cadena de Suministro y Logística" },
    ],
  },
  {
    slug: "gcc",
    nombre: "GCC",
    prefijo: "GCC",
    logo: "gcc.png",
    areas: [
      "Operaciones y Plantas",
      "Técnica y Medio Ambiente",
      "Comercial y Logística",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Operaciones y Plantas",
      Finanzas: "Administración y Finanzas",
      // En una cementera la función de sostenibilidad cuelga de la dirección
      // técnica: es quien redacta el expediente del Consejo y quien firma el
      // plan de transición y los escenarios climáticos.
      "Gobierno Corporativo": "Técnica y Medio Ambiente",
      Dirección: "Técnica y Medio Ambiente",
    },
    // Es el giro de mayor intensidad de carbono del portafolio de mockups, y por
    // eso el reparto importa: los GEI, la energía y el riesgo físico se quedan en
    // el área operativa —que es donde de verdad viven en una cementera, con el
    // horno— y ahí es donde caen las validadas de la escena.
    mueve: [
      // El capex ambiental es de planta (filtros, quemadores, coprocesamiento),
      // aunque la plantilla lo pida por Finanzas.
      { re: /Inversiones y gastos ambientales/i, area: "Operaciones y Plantas" },
      // El resto de lo ambiental —agua y residuos— es del área técnica, que es
      // la que responde por la licencia ambiental de cada planta.
      { re: /Consumo de agua/i, area: "Técnica y Medio Ambiente" },
      { re: /disposición de residuos/i, area: "Técnica y Medio Ambiente" },
      // El cemento se vende a granel y se mueve por tren y por camión: el uso del
      // producto y el transporte son de la misma área comercial y logística.
      { re: /productos\/servicios sostenibles/i, area: "Comercial y Logística" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercial y Logística" },
      { re: /Transporte y distribución/i, area: "Comercial y Logística" },
    ],
  },
  {
    slug: "cadu",
    nombre: "CADU Inmobiliaria",
    prefijo: "CADU",
    logo: "cadu.png",
    areas: [
      "Desarrollo y Construcción",
      "Diseño y Urbanismo",
      "Comercialización",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Desarrollo y Construcción",
      Finanzas: "Administración y Finanzas",
      // En una desarrolladora de vivienda la sostenibilidad se decide en el
      // tablero: certificación, eficiencia y densidad se resuelven cuando se
      // dibuja el conjunto, no cuando se vende. Por eso el expediente del
      // Consejo y el plan de transición cuelgan de Diseño y Urbanismo.
      "Gobierno Corporativo": "Diseño y Urbanismo",
      Dirección: "Diseño y Urbanismo",
    },
    // El riesgo físico climático y la Categoría 2-Bienes de capital ya caen en
    // Desarrollo y Construcción por el `mapa`; el capex ambiental vive en
    // Finanzas en la plantilla y sí hay que moverlo: en una vivienda la
    // inversión ambiental es la obra.
    mueve: [
      { re: /Inversiones y gastos ambientales/i, area: "Desarrollo y Construcción" },
      // "Uso de los productos vendidos" en vivienda es la casa habitada, y el
      // ingreso sostenible es lo que se vende como tal: los dos son del área
      // que la coloca, no de la que la construye.
      { re: /productos\/servicios sostenibles/i, area: "Comercialización" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercialización" },
    ],
  },
  {
    slug: "planigrupo",
    nombre: "Planigrupo",
    prefijo: "PLG",
    logo: "planigrupo.png",
    areas: [
      "Operación de Centros Comerciales",
      "Desarrollo y Construcción",
      "Comercialización",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Operación de Centros Comerciales",
      Finanzas: "Administración y Finanzas",
      // No hay área de sostenibilidad en el catálogo: el expediente del Consejo
      // y el plan de transición los arma la dirección corporativa, que es la
      // que reporta al órgano de gobierno.
      "Gobierno Corporativo": "Administración y Finanzas",
      Dirección: "Administración y Finanzas",
    },
    // Mismo criterio que GAV, que también opera plazas: la huella de la
    // operación —energía y GEI de los centros— es de quien los opera, pero el
    // riesgo físico y lo que se invierte en el inmueble son de quien lo levanta.
    mueve: [
      { re: /Riesgos físicos climáticos/i, area: "Desarrollo y Construcción" },
      { re: /Inversiones y gastos ambientales/i, area: "Desarrollo y Construcción" },
      { re: /Categoría 2-Bienes de capital/i, area: "Desarrollo y Construcción" },
      // Lo que se coloca: el arrendamiento del local y su uso son del área que
      // comercializa el metro cuadrado.
      { re: /productos\/servicios sostenibles/i, area: "Comercialización" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercialización" },
    ],
  },
  {
    slug: "frisa",
    nombre: "Grupo Frisa",
    prefijo: "FRS",
    logo: "frisa.png",
    areas: [
      "Desarrollo y Construcción",
      "Operación y Mantenimiento",
      "Comercialización",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Operación y Mantenimiento",
      Finanzas: "Administración y Finanzas",
      // Sin área de sostenibilidad en el catálogo: el expediente del Consejo y
      // el plan de transición los arma la dirección corporativa.
      "Gobierno Corporativo": "Administración y Finanzas",
      Dirección: "Administración y Finanzas",
    },
    // Mismo criterio que CADU y O'Donnell: en una desarrolladora la inversión
    // ambiental es la obra, y el riesgo físico y los bienes de capital son de
    // quien construye; la energía del inmueble ya entregado es de quien lo
    // opera y lo mantiene.
    mueve: [
      { re: /Riesgos físicos climáticos/i, area: "Desarrollo y Construcción" },
      { re: /Inversiones y gastos ambientales/i, area: "Desarrollo y Construcción" },
      { re: /Categoría 2-Bienes de capital/i, area: "Desarrollo y Construcción" },
      // Lo entregado en uso y el ingreso sostenible son de quien lo coloca.
      { re: /productos\/servicios sostenibles/i, area: "Comercialización" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercialización" },
    ],
  },
  {
    slug: "fondo-de-fondos",
    nombre: "Fondo de Fondos",
    prefijo: "FDF",
    logo: "fondo-de-fondos.png",
    areas: [
      "Inversiones y Riesgos",
      "Administración de Portafolios",
      "Cumplimiento",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Administración de Portafolios",
      Finanzas: "Administración y Finanzas",
      "Gobierno Corporativo": "Cumplimiento",
      Dirección: "Inversiones y Riesgos",
    },
    // Es el caso extremo del criterio financiero de TRATON y Afirme: en una
    // administradora de fondos de capital la huella de la oficina es ruido y la
    // Categoría 15 no es una categoría más — es la materia del negocio.
    mueve: [
      { re: /Categoría 15-Inversiones/i, area: "Inversiones y Riesgos" },
      { re: /Efectos financieros de riesgos climáticos/i, area: "Inversiones y Riesgos" },
      { re: /Riesgos físicos climáticos/i, area: "Inversiones y Riesgos" },
      { re: /Política de derechos humanos/i, area: "Cumplimiento" },
    ],
  },
  {
    slug: "odonnell",
    nombre: "O'Donnell",
    prefijo: "ODN",
    logo: "odonnell.png",
    areas: [
      "Desarrollo y Construcción",
      "Operación de Parques",
      "Comercialización",
      "Capital Humano",
      "Administración y Finanzas",
    ],
    mapa: {
      RH: "Capital Humano",
      Operaciones: "Operación de Parques",
      Finanzas: "Administración y Finanzas",
      "Gobierno Corporativo": "Administración y Finanzas",
      Dirección: "Administración y Finanzas",
    },
    // Mismo criterio que CADU: en una desarrolladora la inversión ambiental es
    // la obra, y el riesgo físico y los bienes de capital son de quien levanta
    // la nave; la energía del parque ya operando es de quien lo administra.
    mueve: [
      { re: /Riesgos físicos climáticos/i, area: "Desarrollo y Construcción" },
      { re: /Inversiones y gastos ambientales/i, area: "Desarrollo y Construcción" },
      { re: /Categoría 2-Bienes de capital/i, area: "Desarrollo y Construcción" },
      // La nave arrendada en uso y el ingreso sostenible son de quien la coloca.
      { re: /productos\/servicios sostenibles/i, area: "Comercialización" },
      { re: /Categoría 11-Uso de los productos vendidos/i, area: "Comercialización" },
    ],
  },
  {
    slug: "clepsa",
    nombre: "Libramiento Elevado de Puebla (CLEPSA)",
    prefijo: "LEP",
    logo: "clepsa.png",
    // Seis áreas, no cinco: una concesionaria de peaje separa quien cobra y
    // opera de quien conserva la estructura, y la seguridad vial es una función
    // con nombre propio. El script no impone un número — genera un usuario por
    // área—, así que este prospecto trae ocho cuentas en vez de siete.
    areas: [
      "Operación y Peaje",
      "Conservación y Mantenimiento",
      "Seguridad Vial",
      "Recursos Humanos",
      "Finanzas",
      "Cumplimiento",
    ],
    mapa: {
      RH: "Recursos Humanos",
      Operaciones: "Operación y Peaje",
      Finanzas: "Finanzas",
      // En una concesionaria el expediente del Consejo y el plan de transición
      // los lleva Cumplimiento: es el área que responde ante el concedente y
      // ante el grupo, y la que ya vive de acreditar obligaciones.
      "Gobierno Corporativo": "Cumplimiento",
      Dirección: "Cumplimiento",
    },
    mueve: [
      // Lo que cierra una autopista elevada —derrumbe, inundación, viento— es
      // materia de seguridad vial antes que de reporte ambiental. Es además la
      // única entrega de la escena que le da movimiento a esa área: la plantilla
      // no trae ninguna solicitud de siniestralidad.
      { re: /Riesgos físicos climáticos/i, area: "Seguridad Vial" },
      // La estructura y su huella operativa son de quien la conserva: el diésel
      // de la maquinaria, el capex ambiental, el agua, los residuos de obra y
      // los bienes de capital del propio viaducto.
      { re: /Consumo de combustibles fósiles/i, area: "Conservación y Mantenimiento" },
      { re: /Inversiones y gastos ambientales/i, area: "Conservación y Mantenimiento" },
      { re: /Categoría 2-Bienes de capital/i, area: "Conservación y Mantenimiento" },
      { re: /Consumo de agua/i, area: "Conservación y Mantenimiento" },
      { re: /disposición de residuos/i, area: "Conservación y Mantenimiento" },
    ],
  },
];

const REPORTE = { nombre: "Informe Anual Sustentable 2025", ejercicio: 2025 };

/** Mismo tope que el uploader de la aplicación (lib/tenants.ts). */
const LOGO_MAX_ANCHO = 400;

// Nombres de plantilla preferidos, en orden. Si ninguno está, se toma la que más
// rubros tenga: lo que el reporte necesita para que su Excel resuelva celdas son
// los rubros, no el nombre (local y staging las nombraron distinto).
const PLANTILLAS_PREFERIDAS = [
  "Plantilla IAS NIIF S1/S2 (con rubros)",
  "Checklist base NIIF S1/S2 [DEMO]",
];

// -----------------------------------------------------------------------------
// El estado escénico: qué se ve al abrir el mockup.
//
// Seis solicitudes con entrega, elegidas para que la pantalla cuente la historia
// completa en un scroll: tres validadas (llenan celdas del Excel y mueven los
// anillos de cobertura), una con observación abierta, una con el visto bueno del
// área esperando validación, y una recién recibida.
//
// Las tres validadas son las de GEI Alcance 1, 2 y 3-total a propósito: son los
// rubros que el mapeo celda↔dato resuelve, así que son las que hacen que el Excel
// salga con números en NIIF S2 29(a)(i) en vez de vacío.
//
// CIFRAS: redondas y de un solo dígito significativo. No es descuido — es lo que
// hace evidente que son ilustrativas.
// -----------------------------------------------------------------------------
const ESCENA = [
  {
    re: /Inventario GEI Alcance 1/i,
    valor: 100000,
    unidad: "tCO2e",
    estado: "validado",
    dias: 20,
  },
  {
    re: /Inventario GEI Alcance 2/i,
    valor: 50000,
    unidad: "tCO2e",
    estado: "validado",
    dias: 20,
  },
  {
    re: /Alcance 3 — total/i,
    valor: 250000,
    unidad: "tCO2e",
    estado: "validado",
    dias: 20,
  },
  {
    // Del área de finanzas (o comercial, según el prospecto): la observación no
    // cae en la misma área que las tres validadas a propósito — un mockup en el
    // que solo se mueve un área se ve como una plataforma de un solo usuario.
    re: /productos\/servicios sostenibles/i,
    valor: 20,
    unidad: "%",
    estado: "observaciones",
    dias: 35,
    observacion:
      "El porcentaje viene sin la definición de qué se contó como producto o " +
      "servicio sostenible, y sin el ingreso total que sirve de base. NIIF S1 pide " +
      "el criterio junto con la cifra: sin él el dato no es comparable ni auditable.",
  },
  {
    re: /Horas de capacitación/i,
    valor: 15000,
    unidad: "horas",
    estado: "en_revision",
    dias: 35,
    vistoBueno: true,
  },
  {
    // Cualitativa: entrega documento y NO lleva cifra. Que en la misma pantalla
    // convivan las dos formas de entrega es parte de lo que hay que mostrar.
    re: /Diversidad e inclusión/i,
    valor: null,
    estado: "recibido",
    dias: 50,
  },

  // ---------------------------------------------------------------------------
  // LAS CUATRO PARA QUE LOS CUATRO PILARES TENGAN COLOR.
  //
  // El mockup es para vender, y un tablero con los cuatro anillos en 0% dice
  // "plataforma vacía" en la pantalla que más se enseña. Cuáles validar NO es
  // cuestión de gusto: la cobertura de un datapoint exige que TODAS sus
  // solicitudes ligadas estén validadas (N:N), así que hay que validar las que
  // son la ÚNICA fuente de un datapoint de cada pilar. Se midió contra
  // `mapeo_solicitud_datapoint`, y esto es lo que cada una enciende:
  //
  //   Composición del Consejo   → gobernanza: NIIF S2 6(a)
  //   Competencias del Consejo  → gobernanza: NIIF S1 27(a)(ii), NIIF S2 6(a)(ii)
  //   Riesgos físicos           → estrategia: NIIF S2 10 · métricas: NIIF S2 29(b)
  //   Política de der. humanos  → riesgos: NIIF S1 44(a)(i)a(v)  ← el ÚNICO
  //                               datapoint del pilar Riesgos con solicitud
  //
  // Las cuatro son cualitativas en la plantilla: entregan documento, no cifra,
  // así que ninguna toca el Excel de taxonomía. Las celdas de la norma siguen
  // saliendo solo de las tres de GEI.
  // ---------------------------------------------------------------------------
  {
    re: /Composición y responsabilidades del Consejo/i,
    valor: null,
    estado: "validado",
    dias: 20,
  },
  {
    re: /Competencias del Consejo/i,
    valor: null,
    estado: "validado",
    dias: 20,
  },
  {
    re: /Riesgos físicos climáticos/i,
    valor: null,
    estado: "validado",
    dias: 20,
  },
  {
    // Sin esta, el pilar Riesgos se queda en 0% por más que se validen las de
    // clima: es la única solicitud de la plantilla ligada a su datapoint.
    re: /Política de derechos humanos/i,
    valor: null,
    estado: "validado",
    dias: 20,
  },
  {
    // Comparte datapoint con las de GEI (NIIF S2 EI14-E18 y 29(a)(i)): sin ella
    // esos dos quedan parciales por más que las de GEI estén validadas.
    re: /Consumo de combustibles fósiles/i,
    valor: null,
    estado: "validado",
    dias: 20,
  },
  {
    // Es del área financiera de la plantilla, y es la que le da movimiento a la
    // quinta área de Inmobilia (donde el resto de la escena no cae). No está
    // aquí solo por eso: es la fuente ÚNICA de `NIIF S2 16(a)` y `16(b)`, los
    // dos datapoints de Estrategia sobre efectos financieros del clima, así que
    // sube el anillo más flojo de 6 % a 11 %. En TRATON el `mueve` la lleva a
    // Riesgos, que es donde vive ese análisis en una financiera.
    re: /Efectos financieros de riesgos climáticos/i,
    valor: null,
    estado: "validado",
    dias: 35,
  },
];

/** Plazo por default de las que no están en la escena (quedan en solicitado). */
const DIAS_LIMITE_RESTO = 45;

// -----------------------------------------------------------------------------
// Entorno
// -----------------------------------------------------------------------------
const RAIZ = process.cwd();
const DIR_LOGOS = path.join(RAIZ, "logos-demo");

/**
 * Dónde quedan las contraseñas generadas. Es un archivo IGNORADO por git (ver
 * .gitignore) y existe por dos razones concretas:
 *
 *   1. El mockup se abre en una reunión: quien lo presenta necesita las siete
 *      cuentas de ese prospecto a mano, no en el scrollback de una terminal.
 *   2. Sin él, una corrida interrumpida deja cuentas cuya contraseña ya nadie
 *      puede leer, y la única salida es --rehacer. Con él, la corrida siguiente
 *      retoma donde se quedó.
 *
 * Son cuentas @example de emisoras de demostración con datos ilustrativos: lo que
 * protegen es el acceso a un mockup. Aun así el archivo no se versiona.
 */
function leerEnvLocal() {
  const out = {};
  const p = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(p)) return out;
  for (const linea of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...leerEnvLocal(), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Nombre corto del destino: `local`, o la referencia del proyecto de Supabase.
 * Las mismas cuentas existen en local y en staging con contraseñas DISTINTAS
 * (son bases distintas), así que el archivo de credenciales va por destino. Con
 * un solo archivo, correr contra staging borraría las de local sin avisar.
 */
function claveDestino(url) {
  if (!url) return "desconocido";
  if (/127\.0\.0\.1|localhost/.test(url)) return "local";
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "desconocido";
  }
}
const DESTINO = claveDestino(SUPABASE_URL);
const DIR_CRED = path.join(RAIZ, ".credenciales-demo");
const CRED_FILE = path.join(DIR_CRED, `prospectos-${DESTINO}.json`);

// Migración del archivo único de antes de que hubiera más de un destino. Se
// mueve, no se copia: dos archivos con las mismas cuentas y contraseñas
// distintas es la forma más rápida de entrar a un mockup con la credencial
// equivocada y no entender por qué.
{
  const legado = path.join(DIR_CRED, "prospectos.json");
  if (DESTINO === "local" && fs.existsSync(legado) && !fs.existsSync(CRED_FILE)) {
    fs.renameSync(legado, CRED_FILE);
    console.log(`  (credenciales movidas a ${path.relative(RAIZ, CRED_FILE)})`);
  }
}

function leerCredenciales() {
  try {
    return JSON.parse(fs.readFileSync(CRED_FILE, "utf8"));
  } catch {
    return {};
  }
}
function guardarCredenciales(mapa) {
  fs.mkdirSync(DIR_CRED, { recursive: true });
  fs.writeFileSync(CRED_FILE, `${JSON.stringify(mapa, null, 2)}\n`, { mode: 0o600 });
}
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
// El rol `admin` de IRStrat, no `analista`: marcar un tenant como de
// demostración es acción de administrador (trg_tenant_es_demo).
const ADMIN_EMAIL = env.ADMIN_EMAIL || "admin@irstrat.example";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "Demo2025!";

const args = process.argv.slice(2);
const REHACER = args.includes("--rehacer");
const SOLO_LIMPIAR = args.includes("--limpiar");
const SOLO = (() => {
  const i = args.indexOf("--solo");
  return i >= 0 ? args[i + 1] : null;
})();

const log = (...a) => console.log(...a);
const paso = (t) => console.log(`\n▸ ${t}`);

/** Contraseña fuerte y legible. Nunca una compartida ni la del seed demo. */
function passwordFuerte() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(15);
  const ch = Array.from(bytes, (b) => abc[b % abc.length]);
  return `${ch.slice(0, 5).join("")}-${ch.slice(5, 10).join("")}-${ch.slice(10, 15).join("")}!`;
}

/** Fecha de hoy + N días en YYYY-MM-DD (hora local, como la pone una persona). */
function enDias(n) {
  const f = new Date();
  f.setDate(f.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}

const fmt = (n) => new Intl.NumberFormat("es-MX").format(n);

const MIME_POR_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * Prepara el logo para subirlo. Devuelve `{ bytes, ext, tipo, ancho }`.
 *
 * Los archivos que entrega diseño suelen venir a resolución de imprenta (4500 px)
 * y el slot donde se pintan mide 32. El uploader de /admin/clientes reduce en el
 * NAVEGADOR a `LOGO_MAX_ANCHO` (400 px) antes de subir; aquí no hay navegador, así
 * que se hace con `sips`, que viene con macOS. Si no está disponible se sube el
 * original y se avisa: un logo pesado es un desperdicio, no un defecto.
 */
function prepararLogo(rutaOrigen) {
  const ext = path.extname(rutaOrigen).slice(1).toLowerCase();
  const tipo = MIME_POR_EXT[ext];
  if (!tipo) {
    throw new Error(`Formato de logo no admitido: .${ext}. Usa PNG, JPG, SVG o WebP.`);
  }
  const original = fs.readFileSync(rutaOrigen);
  // Los vectoriales no se reescalan: no tienen resolución que sobre.
  if (ext === "svg") return { bytes: original, ext, tipo, nota: null };

  const tmp = path.join(
    os.tmpdir(),
    `logo-demo-${crypto.randomBytes(6).toString("hex")}.${ext}`
  );
  try {
    execFileSync("sips", ["-Z", String(LOGO_MAX_ANCHO), rutaOrigen, "--out", tmp], {
      stdio: "pipe",
    });
    const reducido = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return {
      bytes: reducido,
      ext,
      tipo,
      nota: `reducido a ${LOGO_MAX_ANCHO} px (${Math.round(original.length / 1024)} kB → ${Math.round(reducido.length / 1024)} kB)`,
    };
  } catch {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* no se creó */
    }
    return {
      bytes: original,
      ext,
      tipo,
      nota: `sin reducir (sips no disponible): ${Math.round(original.length / 1024)} kB`,
    };
  }
}

const huella = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);

/**
 * Nombre de objeto seguro para storage — la MISMA función que usan el portal y el
 * panel (`nombreSeguro`). Las claves de storage no admiten acentos ni guiones
 * largos: el nombre bonito viaja en `evidencias.nombre_original`, que es el que
 * la interfaz muestra y el que se descarga.
 */
function nombreSeguro(nombre) {
  const base = nombre.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim();
  return base.replace(/\s+/g, "_").slice(0, 120) || "archivo";
}

// -----------------------------------------------------------------------------
// Conexión: sesión de STAFF (RLS activo) + service_role para lo que en la propia
// aplicación también corre con service_role (alta de cuentas en auth).
// -----------------------------------------------------------------------------
async function sesion(email, password) {
  const jar = new Map();
  const db = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login (${email}): ${error.message}`);
  const { data } = await db.auth.getUser();
  return { db, id: data.user.id };
}

async function conectar() {
  if (!SUPABASE_URL || !ANON || !SERVICE) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY.");
    process.exit(2);
  }
  const esLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
  log(`  Destino: ${SUPABASE_URL} ${esLocal ? "(local)" : "⚠️  NO LOCAL"}`);
  if (!esLocal && env.DEMO_TARGET_OK !== "1") {
    console.error(
      "\n❌ El destino no es local y falta la confirmación explícita.\n" +
        "   Estos tenants llevan el nombre y el logo reales de un prospecto:\n" +
        "   subirlos a un ambiente compartido es una decisión, no un detalle.\n" +
        "     DEMO_TARGET_OK=1 node scripts/crear-demo-prospecto.mjs\n"
    );
    process.exit(2);
  }

  const staff = await sesion(ADMIN_EMAIL, ADMIN_PASSWORD);
  const { data: perfil } = await staff.db
    .from("perfiles_usuario")
    .select("rol")
    .eq("id", staff.id)
    .single();
  if (perfil?.rol !== "admin") {
    console.error(
      `\n❌ ${ADMIN_EMAIL} tiene rol '${perfil?.rol}'. Marcar una emisora como de\n` +
        "   demostración es acción del rol 'admin' de IRStrat (trg_tenant_es_demo).\n"
    );
    process.exit(2);
  }
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db: staff.db, staffId: staff.id, admin };
}

// -----------------------------------------------------------------------------
// Teardown (--rehacer / --limpiar). Mismo orden que el import de GCARSO: los
// objetos de storage primero, porque el borrado en cascada de la base no los ve.
// -----------------------------------------------------------------------------
async function limpiar({ db, admin }, p) {
  const { data: tenant } = await db
    .from("tenants")
    .select("id, es_demo, nombre")
    .eq("slug", p.slug)
    .maybeSingle();
  if (!tenant) return log(`  ${p.slug}: no había nada`);

  // Salvaguarda: este script solo borra emisoras de DEMOSTRACIÓN. Si alguien
  // llegara a dar de alta un cliente real con uno de estos slugs, --rehacer no
  // se lo lleva por delante.
  if (!tenant.es_demo) {
    throw new Error(
      `${p.slug} ("${tenant.nombre}") NO está marcado como demostración: ` +
        "este script no borra clientes reales. Revísalo a mano."
    );
  }

  const { data: reportes } = await db.from("reportes").select("id").eq("tenant_id", tenant.id);
  for (const r of reportes ?? []) {
    const { data: sols } = await db.from("solicitudes").select("id").eq("reporte_id", r.id);
    for (const s of sols ?? []) {
      const carpeta = `${tenant.id}/${s.id}`;
      const { data: objs } = await admin.storage.from("evidencias").list(carpeta);
      if (objs?.length) {
        await admin.storage
          .from("evidencias")
          .remove(objs.map((o) => `${carpeta}/${o.name}`));
      }
    }
  }
  // El logo vive en su propia carpeta del bucket público.
  const { data: logos } = await admin.storage.from("logos").list(tenant.id);
  if (logos?.length) {
    await admin.storage.from("logos").remove(logos.map((o) => `${tenant.id}/${o.name}`));
  }

  await db.from("reportes").delete().eq("tenant_id", tenant.id);
  const { data: perfiles } = await db
    .from("perfiles_usuario")
    .select("id")
    .eq("tenant_id", tenant.id);
  for (const u of perfiles ?? []) await admin.auth.admin.deleteUser(u.id);
  await db.from("areas_tenant").delete().eq("tenant_id", tenant.id);
  const { error } = await db.from("tenants").delete().eq("id", tenant.id);
  if (error) throw new Error(`no se pudo retirar ${p.slug}: ${error.message}`);

  // Las credenciales guardadas de este prospecto ya no abren nada: se retiran
  // para que el archivo no acumule contraseñas de cuentas que no existen.
  const guardadas = leerCredenciales();
  let cambio = false;
  for (const [email, v] of Object.entries(guardadas)) {
    if (v.slug === p.slug) {
      delete guardadas[email];
      cambio = true;
    }
  }
  if (cambio) guardarCredenciales(guardadas);
  log(`  ${p.slug}: retirado (${tenant.id})`);
}

// -----------------------------------------------------------------------------
// Tenant, áreas y logo
// -----------------------------------------------------------------------------
async function asegurarTenant({ db, admin, staffId }, p) {
  const nuevo = [];

  let { data: tenant } = await db
    .from("tenants")
    .select("id, nombre, es_demo, logo_url")
    .eq("slug", p.slug)
    .maybeSingle();

  if (!tenant) {
    const { data, error } = await db
      .from("tenants")
      .insert({
        nombre: p.nombre,
        slug: p.slug,
        prefijo_folio: p.prefijo,
        activo: true,
        // Lo que enciende la franja y el pie [DEMO]. Es la única razón por la que
        // este script puede llevar el nombre real de alguien que no es cliente.
        es_demo: true,
        // Apagado: en el mockup la evidencia la carga el área desde su portal,
        // que es lo que el prospecto va a ver hacer a su gente.
        staff_puede_cargar: false,
      })
      .select("id, nombre, es_demo, logo_url")
      .single();
    if (error) throw new Error(`tenant ${p.slug}: ${error.message}`);
    tenant = data;
    nuevo.push("tenant");
    await db.from("bitacora").insert({
      tenant_id: tenant.id,
      usuario_id: staffId,
      accion: "tenant_creado",
      entidad: "tenants",
      entidad_id: tenant.id,
      detalle: {
        nombre: p.nombre,
        slug: p.slug,
        prefijo_folio: p.prefijo,
        es_demo: true,
        motivo: "mockup comercial para prospecto (datos ilustrativos)",
      },
    });
  } else if (!tenant.es_demo) {
    throw new Error(
      `${p.slug} existe y NO está marcado como demostración. No se toca: ` +
        "un mockup no puede convivir con un cliente real en el mismo slug."
    );
  }

  // Áreas: solo las que falten (el catálogo puede haberse editado a mano).
  const { data: yaAreas } = await db
    .from("areas_tenant")
    .select("nombre")
    .eq("tenant_id", tenant.id);
  const existentes = new Set((yaAreas ?? []).map((a) => a.nombre));
  const faltan = p.areas.filter((a) => !existentes.has(a));
  if (faltan.length) {
    const { error } = await db.from("areas_tenant").insert(
      faltan.map((nombre) => ({
        tenant_id: tenant.id,
        nombre,
        orden: p.areas.indexOf(nombre),
      }))
    );
    if (error) throw new Error(`áreas ${p.slug}: ${error.message}`);
    nuevo.push(`${faltan.length} área(s)`);
  }

  // Logo: mismo camino que /admin/clientes (bucket público `logos`, la URL
  // pública en `tenants.logo_url`).
  //
  // El objeto se nombra con la HUELLA del archivo, no con un timestamp como en la
  // aplicación. Así "¿cambió el logo?" se responde leyendo el nombre del objeto
  // que ya está guardado: si diseño reemplaza el archivo en logos-demo/, la
  // corrida siguiente lo detecta y lo sustituye sola —sin bandera y sin
  // --rehacer—, y si no cambió no se vuelve a subir. Con un timestamp habría que
  // descargar el objeto y compararlo, o subirlo de nuevo en cada corrida.
  {
    const ruta = path.join(DIR_LOGOS, p.logo);
    if (!fs.existsSync(ruta)) {
      throw new Error(
        `Falta el logo ${p.logo}. Colócalo en logos-demo/ (PNG, JPG, SVG o WebP).`
      );
    }
    const { bytes, ext, tipo, nota } = prepararLogo(ruta);
    const destino = `${tenant.id}/logo-${huella(bytes)}.${ext}`;
    const yaEsElMismo = (tenant.logo_url ?? "").endsWith(`/${destino}`);

    if (!yaEsElMismo) {
      const { error: upErr } = await db.storage
        .from("logos")
        .upload(destino, bytes, { contentType: tipo, upsert: true });
      if (upErr) throw new Error(`logo ${p.slug}: ${upErr.message}`);
      const {
        data: { publicUrl },
      } = db.storage.from("logos").getPublicUrl(destino);
      const { error: updErr } = await db
        .from("tenants")
        .update({ logo_url: publicUrl })
        .eq("id", tenant.id);
      if (updErr) throw new Error(`logo_url ${p.slug}: ${updErr.message}`);

      // El anterior ya no se referencia: se retira para no dejar basura en el
      // bucket, igual que hace la acción de la aplicación.
      const anterior = (tenant.logo_url ?? "").split("/logos/")[1];
      if (anterior && anterior !== destino) {
        await db.storage.from("logos").remove([anterior]);
      }
      nuevo.push(tenant.logo_url ? `logo reemplazado (${nota})` : `logo (${nota})`);
      tenant.logo_url = publicUrl;
    }
  }

  return { tenantId: tenant.id, nuevo };
}

// -----------------------------------------------------------------------------
// Usuarios genéricos.
//
// Nunca cuentas a nombre de personas reales: el prospecto todavía no es cliente y
// nadie de su equipo consintió tener un usuario aquí. Por área va un usuario
// numerado; además, un jefe de área (para que se vea la doble verificación) y un
// administrador del cliente (que es quien ve el panel, la matriz y el Excel — el
// lado que más se enseña en una reunión).
// -----------------------------------------------------------------------------
function plantillaUsuarios(p, areaDelJefe) {
  const cuentas = p.areas.map((area, i) => ({
    email: `usuario${i + 1}@${p.slug}.example`,
    nombre: `Usuario ${i + 1} · ${area}`,
    rol: "cliente",
    area,
  }));
  cuentas.push({
    email: `jefe@${p.slug}.example`,
    nombre: `Jefatura · ${areaDelJefe}`,
    rol: "jefe_area",
    area: areaDelJefe,
  });
  cuentas.push({
    email: `admin@${p.slug}.example`,
    nombre: `Administración · ${p.nombre}`,
    rol: "admin_cliente",
    area: null,
  });
  return cuentas;
}

async function asegurarUsuarios({ db, admin, staffId }, p, tenantId, areaDelJefe) {
  const guardadas = leerCredenciales();
  const credenciales = [];
  for (const c of plantillaUsuarios(p, areaDelJefe)) {
    const { data: ya } = await db
      .from("perfiles_usuario")
      .select("id, rol, area")
      .eq("email", c.email)
      .maybeSingle();
    if (ya) {
      credenciales.push({
        ...c,
        password: guardadas[c.email]?.password ?? null,
        existente: true,
      });
      continue;
    }
    const password = passwordFuerte();
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: c.email,
      password,
      email_confirm: true,
      user_metadata: { nombre: c.nombre },
    });
    if (error) throw new Error(`cuenta ${c.email}: ${error.message}`);
    const { error: pErr } = await db.from("perfiles_usuario").insert({
      id: creado.user.id,
      tenant_id: tenantId,
      rol: c.rol,
      area: c.area,
      nombre: c.nombre,
      email: c.email,
      activo: true,
    });
    if (pErr) throw new Error(`perfil ${c.email}: ${pErr.message}`);
    await db.from("bitacora").insert({
      tenant_id: tenantId,
      usuario_id: staffId,
      accion: "usuario_creado",
      entidad: "perfiles_usuario",
      entidad_id: creado.user.id,
      detalle: { nombre: c.nombre, email: c.email, rol: c.rol, area: c.area },
    });
    credenciales.push({ ...c, password, existente: false });
    guardadas[c.email] = { password, rol: c.rol, area: c.area, slug: p.slug };
    guardarCredenciales(guardadas);
  }
  return credenciales;
}

// -----------------------------------------------------------------------------
// Reporte desde la plantilla, con las áreas traducidas al catálogo del cliente.
// -----------------------------------------------------------------------------
async function elegirPlantilla({ db }) {
  const { data: plantillas } = await db
    .from("plantillas")
    .select("id, nombre")
    .order("created_at", { ascending: false });
  const conRubros = [];
  for (const pl of plantillas ?? []) {
    const { count } = await db
      .from("plantilla_solicitudes")
      .select("id", { count: "exact", head: true })
      .eq("plantilla_id", pl.id)
      .not("rubro_taxonomia", "is", null);
    if ((count ?? 0) > 0) conRubros.push({ ...pl, rubros: count });
  }
  if (!conRubros.length) {
    throw new Error(
      "No hay ninguna plantilla con rubros de taxonomía. Guarda una desde el " +
        "reporte demo (/admin/plantillas → 'Guardar desde un reporte') primero."
    );
  }
  for (const nombre of PLANTILLAS_PREFERIDAS) {
    const m = conRubros.find((x) => x.nombre === nombre);
    if (m) return m;
  }
  return conRubros.sort((a, b) => b.rubros - a.rubros)[0];
}

/** Área de este cliente para una solicitud de la plantilla. */
function areaDe(p, item) {
  for (const m of p.mueve ?? []) {
    if (m.re.test(item.titulo)) return m.area;
  }
  const destino = p.mapa[item.area_asignada];
  if (!destino) {
    throw new Error(
      `La plantilla trae el área "${item.area_asignada}" y ${p.slug} no la traduce. ` +
        "Agrégala al `mapa` del prospecto: sin área, la solicitud no le llega a nadie."
    );
  }
  return destino;
}

const PRESETS_RECORDATORIO = [7, 1];

/**
 * Área de ESTE cliente donde cae la solicitud que lleva visto bueno — y por tanto
 * dónde tiene que estar su jefe. Se resuelve leyendo la plantilla en vez de
 * escribirla en la config: cambiar la escena no debe obligar a tocar tres lugares.
 */
async function areaDelJefeDe({ db }, p) {
  const escenaVb = ESCENA.find((e) => e.vistoBueno);
  if (!escenaVb) throw new Error("ESCENA no tiene ninguna entrada con visto bueno.");
  const { data: items } = await db
    .from("plantilla_solicitudes")
    .select("titulo, area_asignada")
    .order("orden");
  const item = (items ?? []).find((it) => escenaVb.re.test(it.titulo));
  if (!item) {
    throw new Error(
      `Ninguna solicitud de la plantilla empata con ${escenaVb.re} (la del visto bueno).`
    );
  }
  return areaDe(p, item);
}

async function asegurarReporte(ctx, p, tenantId) {
  const { db } = ctx;
  const { data: ya } = await db
    .from("reportes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("ejercicio", REPORTE.ejercicio)
    .maybeSingle();
  if (ya) {
    const { count } = await db
      .from("solicitudes")
      .select("id", { count: "exact", head: true })
      .eq("reporte_id", ya.id);
    return { reporteId: ya.id, clonadas: 0, existentes: count ?? 0, plantilla: null };
  }

  const plantilla = await elegirPlantilla(ctx);
  const { data: items, error: itErr } = await db
    .from("plantilla_solicitudes")
    .select(
      "titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, orden, datapoint_ids, rubro_taxonomia"
    )
    .eq("plantilla_id", plantilla.id)
    .order("orden", { ascending: true });
  if (itErr) throw new Error(`plantilla: ${itErr.message}`);

  const { data: reporte, error: rErr } = await db
    .from("reportes")
    .insert({
      tenant_id: tenantId,
      nombre: REPORTE.nombre,
      ejercicio: REPORTE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`reporte ${p.slug}: ${rErr.message}`);

  // Responsable por área: el usuario del área. Sin responsable la solicitud no se
  // puede enviar y el mockup mostraría "sin asignar" en toda la matriz.
  const { data: usuarios } = await db
    .from("perfiles_usuario")
    .select("id, area, rol")
    .eq("tenant_id", tenantId)
    .eq("rol", "cliente");
  const responsablePorArea = new Map((usuarios ?? []).map((u) => [u.area, u.id]));

  let clonadas = 0;
  for (const it of items ?? []) {
    const area = areaDe(p, it);
    const enEscena = ESCENA.find((e) => e.re.test(it.titulo));
    const { data: nueva, error: sErr } = await db
      .from("solicitudes")
      .insert({
        reporte_id: reporte.id,
        titulo: it.titulo,
        descripcion: it.descripcion,
        area_asignada: area,
        es_cuantitativa: it.es_cuantitativa,
        unidad_esperada: it.unidad_esperada,
        orden: it.orden,
        rubro_taxonomia: it.rubro_taxonomia,
        responsable_cliente_id: responsablePorArea.get(area) ?? null,
        fecha_limite: enDias(enEscena?.dias ?? DIAS_LIMITE_RESTO),
      })
      .select("id")
      .single();
    if (sErr) throw new Error(`solicitud "${it.titulo.slice(0, 40)}": ${sErr.message}`);
    clonadas += 1;

    await db.from("solicitudes_recordatorios").insert(
      PRESETS_RECORDATORIO.map((dias_antes) => ({
        solicitud_id: nueva.id,
        dias_antes,
        activo: true,
      }))
    );
    const dps = (it.datapoint_ids ?? []).filter(Boolean);
    if (dps.length) {
      await db
        .from("mapeo_solicitud_datapoint")
        .insert(dps.map((datapoint_id) => ({ solicitud_id: nueva.id, datapoint_id })));
    }
  }

  await db.from("bitacora").insert({
    tenant_id: tenantId,
    usuario_id: ctx.staffId,
    accion: "reporte_creado_desde_plantilla",
    entidad: "reportes",
    entidad_id: reporte.id,
    detalle: {
      nombre: REPORTE.nombre,
      ejercicio: REPORTE.ejercicio,
      plantilla: plantilla.nombre,
      plantilla_id: plantilla.id,
      solicitudes: clonadas,
      fallidas: 0,
    },
  });

  return { reporteId: reporte.id, clonadas, existentes: 0, plantilla: plantilla.nombre };
}

// -----------------------------------------------------------------------------
// La evidencia ilustrativa: un PDF de una página que se explica solo.
//
// Se genera en vez de traer un archivo del repo para que diga de qué solicitud es
// y de quién NO son sus datos. Si alguien lo descarga y lo ve fuera de contexto,
// el documento mismo lo aclara.
// -----------------------------------------------------------------------------
async function pdfIlustrativo({ tenant, titulo, area, valor, unidad, ejercicio }) {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([612, 792]); // carta
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.13, 0.14, 0.15);
  const teal = rgb(0.05, 0.4, 0.4);
  const gris = rgb(0.45, 0.45, 0.45);

  let y = 720;
  const linea = (texto, { font = sans, size = 11, color = tinta, salto = 16 } = {}) => {
    // Ajuste a lo ancho de la caja de texto (no hay layout automático en pdf-lib).
    const max = 500;
    const palabras = String(texto).split(" ");
    let actual = "";
    for (const w of palabras) {
      const prueba = actual ? `${actual} ${w}` : w;
      if (font.widthOfTextAtSize(prueba, size) > max) {
        pagina.drawText(actual, { x: 56, y, size, font, color });
        y -= salto;
        actual = w;
      } else {
        actual = prueba;
      }
    }
    if (actual) {
      pagina.drawText(actual, { x: 56, y, size, font, color });
      y -= salto;
    }
  };

  linea("EVIDENCIA ILUSTRATIVA", { font: bold, size: 9, color: teal, salto: 22 });
  linea(tenant, { font: bold, size: 20, salto: 26 });
  linea(`${REPORTE.nombre} · ejercicio ${ejercicio}`, { size: 11, color: gris, salto: 28 });
  linea(titulo, { font: bold, size: 13, salto: 20 });
  linea(`Área responsable: ${area}`, { size: 11, color: gris, salto: 28 });
  if (valor == null) {
    linea("Entrega cualitativa", { font: bold, size: 10, color: teal, salto: 18 });
    linea(
      "Este requerimiento se atiende con documento, no con cifra: la plataforma " +
        "guarda el archivo y su versión, y la revisión se hace sobre el contenido.",
      { size: 11, salto: 15 }
    );
    y -= 14;
  } else {
    linea("Dato entregado", { font: bold, size: 10, color: teal, salto: 18 });
    linea(`${fmt(valor)} ${unidad}`, { font: bold, size: 22, salto: 30 });
  }
  linea(
    "Este documento es un ejemplo de la plataforma TRACELINE, generado para mostrar " +
      "cómo se ve una entrega de información dentro del proceso de recabado.",
    { size: 10, color: gris, salto: 14 }
  );
  y -= 8;
  linea(
    `El contenido es ilustrativo y NO corresponde a información de ${tenant}. ` +
      "No debe usarse, citarse ni reportarse.",
    { font: bold, size: 10, color: tinta, salto: 14 }
  );

  pagina.drawText("Documento de demostración — datos ilustrativos", {
    x: 56,
    y: 56,
    size: 8,
    font: sans,
    color: gris,
  });
  return Buffer.from(await doc.save());
}

// -----------------------------------------------------------------------------
// El estado escénico.
//
// El orden NO es negociable y es el mismo del seed y del import de GCARSO:
// evidencia → captura → visto bueno → observación → estados finales. Los triggers
// de Fase 2 reabren una solicitud validada y revocan el visto bueno en cuanto
// entra evidencia nueva; fijar el estado antes lo perdería.
// -----------------------------------------------------------------------------
async function montarEscena(ctx, p, { tenantId, reporteId, areaDelJefe }) {
  const { db, admin } = ctx;
  const hechos = { evidencias: 0, capturas: 0, vb: 0, observaciones: 0, estados: {} };

  const { data: sols } = await db
    .from("solicitudes")
    .select("id, titulo, area_asignada, estado, unidad_esperada, responsable_cliente_id")
    .eq("reporte_id", reporteId)
    .order("orden");

  // Sesiones de los usuarios del área: la evidencia la carga QUIEN la tiene, no
  // el staff. Es lo que el prospecto va a ver hacer a su gente, y con
  // `staff_puede_cargar = false` la base lo exige de todas formas.
  const sesiones = new Map();
  const sesionDe = async (email, password) => {
    if (!sesiones.has(email)) sesiones.set(email, await sesion(email, password));
    return sesiones.get(email);
  };

  const pendientes = [];
  for (const e of ESCENA) {
    const sol = (sols ?? []).find((s) => e.re.test(s.titulo));
    if (!sol) {
      log(`  ⚠️  ${p.slug}: la plantilla no trae ninguna solicitud para ${e.re}`);
      continue;
    }
    pendientes.push({ ...e, sol });
  }

  // 1. Todas a `solicitado`: es el punto de partida del proceso (ya se le pidió
  //    al área). El botón de enviar no sirve aquí porque estas cuentas son
  //    @example y el envío se omite a propósito, así que el estado no avanzaría.
  const { error: solErr } = await db
    .from("solicitudes")
    .update({ estado: "solicitado" })
    .eq("reporte_id", reporteId)
    .eq("estado", "pendiente");
  if (solErr) throw new Error(`estado solicitado ${p.slug}: ${solErr.message}`);

  // 2. Entregas: evidencia + captura, con la sesión del usuario del área.
  for (const e of pendientes) {
    const { count: yaHay } = await db
      .from("evidencias")
      .select("id", { count: "exact", head: true })
      .eq("solicitud_id", e.sol.id);
    if ((yaHay ?? 0) > 0) continue; // ya montada en una corrida anterior

    const cuenta = ctx.credencialesPorArea.get(e.sol.area_asignada);
    if (!cuenta?.password) {
      throw new Error(
        `No hay contraseña conocida del usuario de "${e.sol.area_asignada}" (${p.slug}). ` +
          `No está en ${path.relative(RAIZ, CRED_FILE)}: corre con --rehacer.`
      );
    }
    const usuario = await sesionDe(cuenta.email, cuenta.password);

    const cuerpo = await pdfIlustrativo({
      tenant: p.nombre,
      titulo: e.sol.titulo,
      area: e.sol.area_asignada,
      valor: e.valor,
      unidad: e.unidad,
      ejercicio: REPORTE.ejercicio,
    });
    const nombreArchivo = `Evidencia ilustrativa — ${e.sol.area_asignada}.pdf`;
    // Misma forma de ruta que el portal: {tenant}/{solicitud}/{ts}-{nombre seguro}.
    const ruta = `${tenantId}/${e.sol.id}/${Date.now()}-${nombreSeguro(nombreArchivo)}`;
    const { error: upErr } = await usuario.db.storage
      .from("evidencias")
      .upload(ruta, cuerpo, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`storage ${p.slug}/${e.sol.titulo}: ${upErr.message}`);

    const { data: ev, error: evErr } = await usuario.db
      .from("evidencias")
      .insert({
        solicitud_id: e.sol.id,
        archivo_path: ruta,
        nombre_original: nombreArchivo,
        periodo_cubierto: String(REPORTE.ejercicio),
        area_origen: e.sol.area_asignada,
        subido_por: usuario.id,
        notas: "Documento ilustrativo de demostración. No contiene información real.",
      })
      .select("id")
      .single();
    if (evErr) throw new Error(`evidencia ${p.slug}/${e.sol.titulo}: ${evErr.message}`);
    hechos.evidencias += 1;

    // Sin cifra no hay captura: una entrega cualitativa se respalda con el
    // documento y nada más. Inventarle un número sería peor que dejarlo vacío.
    if (e.valor == null) continue;

    const { error: capErr } = await usuario.db.from("capturas_valor").insert({
      solicitud_id: e.sol.id,
      evidencia_id: ev.id,
      valor: e.valor,
      unidad: e.unidad,
      periodo: String(REPORTE.ejercicio),
      capturado_por: usuario.id,
      confirmado: true,
      justificacion: `Cifra ilustrativa de demostración. No corresponde a información de ${p.nombre}.`,
    });
    if (capErr) throw new Error(`captura ${p.slug}/${e.sol.titulo}: ${capErr.message}`);
    hechos.capturas += 1;
  }

  // 3. Visto bueno del área: con la sesión del JEFE, que es quien puede darlo
  //    (fn_es_jefe_de_area). Hacerlo con service_role saltaría justo la regla que
  //    se quiere mostrar funcionando.
  const conVb = pendientes.find((e) => e.vistoBueno);
  if (conVb) {
    if (conVb.sol.area_asignada !== areaDelJefe) {
      throw new Error(
        `El visto bueno toca a "${conVb.sol.area_asignada}" y el jefe se creó en ` +
          `"${areaDelJefe}". Revisa el mapa de áreas del prospecto.`
      );
    }
    const { data: estado } = await db
      .from("solicitudes")
      .select("vb_area_por")
      .eq("id", conVb.sol.id)
      .single();
    if (!estado?.vb_area_por) {
      const jefe = ctx.credenciales.find((c) => c.rol === "jefe_area");
      if (!jefe?.password) {
        throw new Error(
          `No hay contraseña conocida del jefe de área de ${p.slug}. No está en ${path.relative(RAIZ, CRED_FILE)}: corre con --rehacer.`
        );
      }
      const sJefe = await sesionDe(jefe.email, jefe.password);
      // El trigger calcula quién firma y cuándo; el valor que se manda solo tiene
      // que ser no nulo.
      const { error } = await sJefe.db
        .from("solicitudes")
        .update({ vb_area_por: sJefe.id, vb_area_fecha: new Date().toISOString() })
        .eq("id", conVb.sol.id);
      if (error) throw new Error(`visto bueno ${p.slug}: ${error.message}`);
      hechos.vb += 1;
    }
  }

  // 4. Observación abierta: la escribe el staff (la solicitud es de origen
  //    'irstrat', así que es su lado el que observa).
  const conObs = pendientes.find((e) => e.observacion);
  if (conObs) {
    const { count } = await db
      .from("comentarios")
      .select("id", { count: "exact", head: true })
      .eq("solicitud_id", conObs.sol.id)
      .eq("es_observacion", true);
    if ((count ?? 0) === 0) {
      const { error } = await db.from("comentarios").insert({
        solicitud_id: conObs.sol.id,
        autor_id: ctx.staffId,
        contenido: conObs.observacion,
        es_observacion: true,
      });
      if (error) throw new Error(`observación ${p.slug}: ${error.message}`);
      hechos.observaciones += 1;
    }
  }

  // 5. Estados finales, AL FINAL.
  for (const e of pendientes) {
    const { error } = await db
      .from("solicitudes")
      .update({ estado: e.estado })
      .eq("id", e.sol.id);
    if (error) throw new Error(`estado ${p.slug}/${e.sol.titulo}: ${error.message}`);
  }

  const { data: finales } = await db
    .from("solicitudes")
    .select("estado")
    .eq("reporte_id", reporteId);
  for (const s of finales ?? []) {
    hechos.estados[s.estado] = (hechos.estados[s.estado] ?? 0) + 1;
  }
  return hechos;
}

// -----------------------------------------------------------------------------
// Orquestación
// -----------------------------------------------------------------------------
async function main() {
  log("\n=== Tenants de demostración para prospectos ===");
  const ctx = await conectar();

  const objetivo = SOLO ? PROSPECTOS.filter((p) => p.slug === SOLO) : PROSPECTOS;
  if (!objetivo.length) {
    console.error(`\n❌ No hay ningún prospecto con slug "${SOLO}".`);
    process.exit(2);
  }

  if (SOLO_LIMPIAR || REHACER) {
    paso(SOLO_LIMPIAR ? "Limpieza" : "Limpieza previa (--rehacer)");
    for (const p of objetivo) await limpiar(ctx, p);
    if (SOLO_LIMPIAR) {
      log("\n✅ Listo (solo limpieza).");
      return;
    }
  }

  const resumen = [];
  for (const p of objetivo) {
    paso(`${p.nombre} (${p.slug})`);

    const { tenantId, nuevo } = await asegurarTenant(ctx, p);
    if (nuevo.length) log(`  alta: ${nuevo.join(", ")}`);

    // El jefe de área va donde cae la solicitud del visto bueno.
    const areaDelJefe = await areaDelJefeDe(ctx, p);

    const credenciales = await asegurarUsuarios(ctx, p, tenantId, areaDelJefe);
    const creadas = credenciales.filter((c) => !c.existente).length;
    log(
      `  usuarios: ${credenciales.length} (${creadas} nuevos, ` +
        `${credenciales.length - creadas} ya existían)`
    );

    ctx.credenciales = credenciales;
    ctx.credencialesPorArea = new Map(
      credenciales.filter((c) => c.rol === "cliente").map((c) => [c.area, c])
    );

    const rep = await asegurarReporte(ctx, p, tenantId);
    log(
      rep.clonadas
        ? `  reporte ${REPORTE.ejercicio}: ${rep.clonadas} solicitudes clonadas de "${rep.plantilla}"`
        : `  reporte ${REPORTE.ejercicio}: ya existía (${rep.existentes} solicitudes)`
    );

    const hechos = await montarEscena(ctx, p, {
      tenantId,
      reporteId: rep.reporteId,
      areaDelJefe,
    });
    log(
      `  escena: ${hechos.evidencias} evidencia(s), ${hechos.capturas} captura(s), ` +
        `${hechos.vb} visto(s) bueno(s), ${hechos.observaciones} observación(es)`
    );
    log(
      `  estados: ${Object.entries(hechos.estados)
        .map(([k, v]) => `${v} ${k}`)
        .join(" · ")}`
    );

    resumen.push({ p, tenantId, credenciales, rep, hechos, areaDelJefe });
  }

  // ---------------------------------------------------------------------------
  paso("Resumen");
  // ---------------------------------------------------------------------------
  for (const r of resumen) {
    const total = Object.values(r.hechos.estados).reduce((a, b) => a + b, 0);
    log(`\n  ${r.p.nombre}  ·  ${r.p.slug}  ·  ${r.p.prefijo}  ·  ${r.tenantId}`);
    log(`    áreas: ${r.p.areas.join(" · ")}`);
    log(`    jefe de área en: ${r.areaDelJefe}`);
    log(`    solicitudes: ${total}  (${Object.entries(r.hechos.estados)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")})`);
    log("    credenciales:");
    for (const c of r.credenciales) {
      const rol = c.rol.padEnd(13);
      log(
        `      ${c.email.padEnd(30)} ${rol} ${
          c.existente ? "(ya existía — contraseña de la corrida anterior)" : c.password
        }`
      );
    }
  }

  log(
    `\n  Las contraseñas quedaron en ${path.relative(RAIZ, CRED_FILE)} (ignorado por git,\n` +
      "  permisos 600). Si el archivo se borra, --rehacer regenera las cuentas.\n"
  );
  log("✅ Listo.\n");
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
});
