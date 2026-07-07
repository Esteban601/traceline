# DESIGN.md — Sistema de diseño

Guía viva del portal. **Todo lo que se construya (hoy y en adelante) respeta
estos tokens y patrones.** Look premium editorial (revista / informe anual), no
plantilla de administración genérica: espaciado generoso, jerarquía tipográfica
clara, microinteracciones sutiles. Tailwind v4 puro (tokens en
`app/globals.css` vía `@theme`), sin librerías de componentes pesadas.

> El nombre comercial de la app se toma **siempre** de `NEXT_PUBLIC_APP_NAME`
> (helper `lib/app.ts → APP_NAME`), nunca hardcodeado.

---

## Tipografía

| Uso | Fuente | Notas |
|-----|--------|-------|
| Headings / display | **Sora** (`--font-display`) | `letter-spacing: -0.02em`, pesos 500–700. |
| Cuerpo / UI | **Inter** (`--font-sans`) | Peso 400–600. |

Cargadas con `next/font/google` en `app/layout.tsx` (sin FOUT, `display: swap`).

Escala tipográfica (utilidades Tailwind):

- Display página: `text-3xl sm:text-4xl font-semibold` (Sora)
- Título sección: `text-xl font-semibold`
- Título tarjeta: `text-base font-semibold`
- Cuerpo: `text-sm` / `text-base` (Inter)
- Metadato / etiqueta: `text-xs uppercase tracking-wide text-muted`

---

## Color

Tokens en `@theme` (generan `bg-*`, `text-*`, `border-*`, y modificadores de
opacidad `bg-teal/10`).

| Token | Hex | Rol |
|-------|-----|-----|
| `crema` | `#F7F3EA` | Fondo de página |
| `surface` | `#FEFCF6` | Tarjetas y superficies elevadas |
| `line` | `#E7DECB` | Bordes cálidos |
| `ink` | `#1C2B28` | Texto principal |
| `muted` | `#5F6E6A` | Texto secundario |
| `teal` | `#0E4F47` | **Primario** (marca, botones, enlaces) |
| `teal-dark` | `#0A3A34` | Hover / activo del primario |
| `gold` | `#BE9130` | **Acento** (detalles, líneas, foco de atención) |

### Semáforo de estados

**Principio:** el color comunica **quién tiene la pelota**; el tono (claro vs.
fuerte) y el **ícono** distinguen el estado exacto. Los pares del mismo dueño
(pendiente/solicitado, recibido/en_revisión) se separan por tono **y** por ícono
para ser legibles incluso en un proyector de baja calidad — nunca solo por matiz.

Fuente única de verdad: `lib/estados.ts` (`ESTADO_META` → `tono` + `icono` +
`bucket`) y `components/ui/badge.tsx` (`EstadoBadge`, un solo componente con los
íconos SVG). **No** se estilan badges de estado sueltos: siempre `EstadoBadge`.

| Estado | Token (tono) | Hex | Ícono | Dueño / bucket KPI |
|--------|--------------|-----|-------|--------------------|
| `pendiente` | `ambar` | `#97621A` | círculo vacío | Cliente · **Pendientes** |
| `solicitado` | `ambar-fuerte` | `#8A5210` | flecha de envío | Cliente · **Pendientes** |
| `recibido` | `azul` | `#2E6CA6` | bandeja de entrada | Nosotros · **Recibidas** |
| `en_revision` | `azul-fuerte` | `#1E4E7C` | lupa | Nosotros · **Recibidas** |
| `observaciones` | `rojo` | `#B0402F` | alerta | Cliente · **Con observaciones** |
| `validado` | `verde` | `#2F7A55` | check | — · **Validadas** |
| `congelado` | `gris` | `#62706C` | candado | — · **Validadas** |

Los buckets de KPI agregan los pares (pendiente+solicitado → *Pendientes*;
recibido+en_revisión → *Recibidas*) y usan el tono base (`ambar`, `azul`).

Uso en badges/tints: texto `text-<tono>`, fondo `bg-<tono>/10`, borde
`border-<tono>/25` (o `/30` en los tonos fuertes). La misma paleta de cobertura
(`lib/cobertura.ts`) reutiliza estos tonos: verde/ámbar/rojo/gris.

---

## Espaciado y layout

- Escala base Tailwind (múltiplos de 4px). **Generosidad**: secciones separadas
  por `space-y-8`/`space-y-10`; padding de tarjeta `p-5`/`p-6`.
- Ancho de contenido: `max-w-5xl` (tablero) / `max-w-3xl`–`max-w-4xl` (detalle),
  centrado con `mx-auto px-5 sm:px-8`.
- Header sticky de altura cómoda (`h-16`), con borde inferior `border-line`.
- Grid de KPIs: `grid-cols-2 lg:grid-cols-4 gap-4`.

## Radios

| Token | Valor | Uso |
|-------|-------|-----|
| `rounded-card` | 16px | Tarjetas, paneles |
| `rounded-xl` | 12px | Inputs, botones grandes |
| `rounded-lg` | 8px | Botones, badges rectangulares |
| `rounded-pill` | 9999px | Badges de estado, chips |

## Sombras

| Token | Uso |
|-------|-----|
| `shadow-soft` | Tarjetas en reposo |
| `shadow-card` | Tarjetas destacadas / hover de listas |
| `shadow-lift` | Popovers, dropzone activa |

## Motion

- Transiciones **150–200ms**, `ease-out`. Clase base: `transition duration-150`.
- Hover: elevación sutil (`hover:shadow-card`), desplazamiento leve
  (`hover:-translate-y-0.5`), o cambio de tono de borde.
- Entrada de página: reveal escalonado ligero (opacidad + `translate-y`) solo en
  momentos de alto impacto. Sin animaciones ruidosas.
- Respeta `prefers-reduced-motion` (deshabilitar transforms).

## Foco / accesibilidad

- `:focus-visible` con **anillo dorado** (`--color-gold`, definido en
  `globals.css`), visible sobre superficies claras y sobre la barra teal.
- **Contraste AA (≥4.5:1) como texto sobre crema/tint** — verificado y medido:
  `ink`, `muted` (4.8), y los tonos de estado usados como texto de badge:
  `azul` (4.98), `azul-fuerte`, `verde` (4.7), `rojo` (5.2), `ambar` (4.66),
  `ambar-fuerte` (5.8), `gris` (4.69). `ambar` y `gris` se **oscurecieron
  levemente** respecto de su valor original (que quedaba en ~3.3 y ~4.1) para
  cumplir AA sin cambiar la identidad de la paleta. El **dorado** es acento
  decorativo (eyebrows, líneas), no texto de cuerpo.
- Botones de ícono llevan `aria-label`; los íconos decorativos, `aria-hidden`.
- `prefers-reduced-motion`: se neutralizan transiciones/animaciones (globals).
- Objetivos táctiles ≥ 40px en móvil.

---

## Componentes base (`components/ui/`)

- **`Button`** — variantes `primary` (teal), `secondary` (borde), `ghost`,
  `danger`. Estados hover/disabled/loading. Etiqueta en **una sola línea**
  (`whitespace-nowrap`): las acciones nunca parten texto en dos renglones; si es
  larga, el botón crece a lo ancho. Misma regla en toggles pill y `LogoutButton`.
- **`Badge` / `EstadoBadge`** — pill de estado con **ícono + tono** de semáforo
  (ver arriba). Único punto donde se renderiza el estado; los íconos viven en el
  componente.
- **`KpiCard`** — número grande (Sora), etiqueta, barra/acento de color de
  bucket. Interactivo opcional (filtro).
- **`Card`** — superficie con `bg-surface border border-line rounded-card
  shadow-soft`.
- **`Field`** — label + input/textarea con estilos consistentes.
- **`Toast` / `useToast`** — feedback de acciones (componente propio, sin
  librería). `useToast().success|error(mensaje)`. Éxito en `verde`, error en
  `rojo`, ícono, auto-cierre (~5s) y cierre manual; stack abajo-derecha con
  `aria-live`. Montado una vez en el root layout (`ToastProvider`).
- **`EmptyState`** — estado vacío editorial: glifo tipográfico sobrio + título +
  descripción sobre fondo punteado. Nunca una lista vacía silenciosa.
- **`Breadcrumb`** — orientación en vistas de detalle; el último crumb es la
  página actual (texto `ink`, truncado). Acompaña un botón "Volver" consistente.
- **`ConfirmDialog`** — confirmación propia (no `window.confirm`) para acciones
  con efecto externo o percibidas como irreversibles: `role=dialog`, `aria-modal`,
  Escape cancela, backdrop clicable, foco inicial en la acción principal.

## Feedback, fechas y orientación

- **Toasts** para el resultado de toda acción (subir evidencia con nº de versión,
  observación, cambio de estado, comentario, export). El feedback no depende de
  ver el refresh; los mensajes de error son útiles, no técnicos.
- **Fechas humanizadas** (`lib/fechas.ts`, es-MX, fuente única): `fmtFecha`
  ("25 feb 2026"), `fmtFechaLarga`, `fmtFechaHora`, y `relativo` ("hace 2 días",
  "ayer") para actividad reciente. Números con separador de miles (`es-MX`).
- **Favicon** env-driven (`app/icon.tsx`): inicial de `NEXT_PUBLIC_APP_NAME`
  sobre teal, consistente con el logotipo del header.

## Patrones de estado (UI)

- **Loading**: `loading.tsx` con skeletons editoriales (bloques
  `bg-line/50 animate-pulse`), no spinners genéricos. Nunca pantalla en blanco.
- **Error**: `error.tsx` con mensaje claro y acción de reintento.
- **Vacío**: `EmptyState` — glifo + mensaje editorial, no tabla vacía.
- **Listas largas (accordion)**: cuando un catálogo es extenso (p. ej. la vista
  de cobertura, 91 datapoints), se agrupa en secciones colapsables. Por defecto
  **todas colapsadas**: el encabezado muestra título, conteo y un mini-resumen
  por color (dots + números); al expandir se listan los ítems. Filtros por chips
  arriba (segmentado para selección única, chips toggle para multi-selección);
  los KPIs superiores reflejan siempre el **universo filtrado**.
- **Chips de filtro**: contenedores con `flex-wrap` para envolver en pantallas
  angostas; cada chip `whitespace-nowrap`.

## Responsive

- Mobile-first. El coordinador revisa avance desde el teléfono.
- KPIs 2×2 en móvil → 4 en desktop. Listas apilan metadatos en móvil.
- Header colapsa el detalle del usuario en pantallas pequeñas.
