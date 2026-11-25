---
spec: "019"
estado: aprobado
actualizado: 2026-11-25
---

# Plan técnico — 019 Estilo automotriz premium con acento plata

## Resumen

Se lleva a `develop`, de forma ordenada y probada, el estilo validado en la rama
`explore/automotriz`, sin el selector de color.

- **Tema** (`hero.ts`): acento acero en claro y plata en oscuro, fondos nuevos y radios mayores.
  También los bordes y las sombras van como valores del tema.
- **Fondo:** pasa a `<html>`, con una capa fija de «garaje» quieta detrás del contenido.
- **CSS global documentado:** títulos cromados, números tipo tablero, foco de luz en las tarjetas y
  placa metálica.
- **Tres componentes con cambios de forma:** el encabezado flotante, el inicio bento y la sección
  actual del menú.
- **Sin cambios en datos, textos ni comportamiento.**
- **Regresión:** se prueba con toda la suite en claro y en oscuro, más una revisión con capturas de
  cada pantalla en escritorio y teléfono.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Las specs 003, 009 y 010 se enmiendan en lo que la 019 cambia (RF-03). |
| II. Qué antes que cómo | ✅ | La spec habla de aspecto; este plan, de tema, CSS y componentes. |
| III. Criterios verificables | ✅ | Cada CA con su prueba (E2E de estilo y geometría, auditoría de accesibilidad, unitarias). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas (el acento en claro se decidió viéndolo). |
| V. Simplicidad y stack | ✅ | Sin dependencias: Geist Mono viene de la misma fuente de Google que Geist (`next/font`). |
| VI. Seguridad y datos personales | ✅ | No toca datos ni permisos. |
| VII. Trazabilidad | ✅ | Rama `feature/019-estilo-automotriz`; pruebas con la spec en su cabecera. |
| VIII. Incrementos pequeños | ✅ | P1 (estilo, encabezado, bento, modo claro) se despliega sola; P2 (placas) es CSS aislado. |

## Base de datos (packages/supabase)

Sin cambios: ni migraciones, ni seeds, ni pgTAP.

## Aplicación (apps/web)

### Tema (`src/app/hero.ts`)

- **Radios:** `small` 10, `medium` 14 y `large` 22 px (CA-05).
- **Sombras:** `boxShadow` del tema con el canto de luz y una sombra profunda, por modo (CA-05,
  CA-10, CA-11).
- **Claro:**
  - `background` `#e9ebef` (gris de exposición, CA-10);
  - `primary` acero `#3f3f46` con tinta blanca;
  - `focus` acero;
  - `divider` negro al 7 %.
- **Oscuro:**
  - `background` `#050506`;
  - `content1` `#0d0d10`;
  - `primary` plata `#d4d4d8` con tinta `#0a0a0a` (CA-01, CA-11);
  - `divider` blanco al 8 %.
- Se mantienen la escala de `foreground`, `default`, `danger` y los semánticos (RN-03).

### Fondo y capas (`src/app/layout.tsx`, `globals.css`)

- **El fondo de la página pasa a `<html>`** (`bg-background`) y `<body>` queda transparente. Así la
  capa de fondo fija (`z-index: -1`) se pinta entre los dos: si `<body>` tuviera fondo, la taparía.
- **`<div aria-hidden className="garage">`** como primer hijo de `<body>`:
  - una trama de puntos de 22 px que se desvanece con una máscara;
  - un resplandor arriba, en el acento;
  - grano con un SVG en línea;
  - quieto (RN-02), en sus versiones clara y oscura (CA-02).
- **`THEME_COLORS`** (`theme-color` y el manifiesto) pasan a `#e9ebef` y `#050506`.

### Acento (`globals.css`)

- Variables por modo: `--accent` y `--accent-ink`, acero en claro y plata en oscuro.
- `--accent-on-dark` y `--accent-on-dark-ink`: plata en los dos modos, para el bloque oscuro de
  «Órdenes» (CA-01).

### Estilos globales (`globals.css`, sección «Estilo automotriz, spec 019»)

Van fuera de las capas de Tailwind, con su porqué, porque tienen que ganar a las utilidades de
HeroUI y de Tailwind:

- **Títulos (`main h1`):** tamaño `clamp`, interletrado apretado, degradado cromado con
  `background-clip: text`, oscuro en claro y claro en oscuro. Las paradas del degradado se eligen
  con contraste AA contra el fondo (CA-03, RN-01).
- **Tablero (`.tabular-nums`):** fuente mono. **`thead th`:** mono, mayúsculas y espaciado (CA-04).
- **Foco de luz en `.bg-content1`:** un degradado radial en `--mx` y `--my`, con el acento al 12–14 %;
  en oscuro, además, el canto de luz arriba (CA-05).
- **Borde con el acento:** `a.bg-content1:hover` y `button.bg-content1:hover`. Lo que se ilumina
  sigue siendo clicable y lleva la mano.
- **Botón principal en píldora** (`.bg-primary.rounded-medium`, CA-06).
- **Placa:** `[data-plate]` con capas de brillo, veta y base amarilla, `text-shadow` en relieve,
  `::before` con el destello quieto y `::after` con el destello que cruza en `transition` al pasar
  el ratón por la placa o su fila. La transición va solo con `prefers-reduced-motion:
  no-preference` (CA-12, CA-13, RN-02).

### Componentes

- **`core/components/spotlight.component.tsx`** (nuevo, cliente): escucha `pointermove` en el
  documento y escribe `--mx` y `--my` en la `.bg-content1` bajo el puntero, relativos a ella.
  Va en el layout raíz (CA-05).
- **`auth/components/organisms/app-header.component.tsx`:** píldora flotante (`sticky top-3`,
  `rounded-full`, borde, fondo translúcido con desenfoque, ancho `min(72rem, 100% − 1,5rem)`). En
  el teléfono, las mismas tres columnas (CA-07).
- **`auth/components/molecules/nav-links.component.tsx`:** la sección actual va con
  `bg-primary text-primary-foreground rounded-full`; los menús «Administración» y «Más» se marcan
  igual (CA-07).
- **`auth/components/organisms/staff-home.component.tsx`:**
  - en escritorio, `lg:grid-cols-4` con «Órdenes» en `md:col-span-2 lg:row-span-2`;
  - cifras `text-5xl md:text-7xl` con `--accent-on-dark` y etiquetas mono en mayúsculas;
  - el ícono de «Órdenes» con `--accent-on-dark`;
  - en el teléfono, como hoy (CA-08, CA-09).
- **`vehicles/components/atoms/plate-label.component.tsx`:** el atributo `data-plate` en sus dos
  tamaños.
- **El selector de acento de la exploración no se lleva** (RF-02).

### Lo que no cambia

Textos, rutas, mensajes, datos y comportamiento (RN-04). Las pruebas de comportamiento siguen igual.

## Estrategia de pruebas

**Nuevas** (`e2e/style.spec.ts`, «Estilo automotriz, spec 019», en claro y en oscuro con los
proyectos `chromium` y `chromium-dark`):

| Criterio | Tipo | Qué asserta |
|---|---|---|
| CA-01 | e2e | Botón principal y sección actual: fondo acero `rgb(63, 63, 70)` y tinta blanca en claro; plata `rgb(212, 212, 216)` y tinta `rgb(10, 10, 10)` en oscuro; contraste tinta/fondo ≥ 4,5. Cifras de «Órdenes» en plata en los dos modos, con contraste ≥ 3 sobre su bloque. |
| CA-02 | e2e | Existe la capa de fondo, está detrás (`z-index` −1), no se puede pulsar y no tiene animaciones. |
| CA-03, RN-01 | e2e | El título de cada pantalla tiene `background-clip: text` y un degradado cuyas paradas cumplen 4,5 contra el fondo (axe no mide texto con degradado). |
| CA-04 | e2e | Precios y celulares en `Geist Mono`; los encabezados de tabla en mayúsculas y mono. |
| CA-05 | e2e + unit | Radio de las tarjetas de 22 px. Al mover el ratón sobre una tarjeta cambian `--mx` y `--my` (unit `spotlight.component.test.tsx` con `pointermove`). Una tarjeta pulsable se ilumina con el acento. |
| CA-06 | e2e | El botón principal tiene radio de píldora. |
| CA-07 | e2e | El encabezado está separado del borde (top > 0), con `rounded-full`, y la sección actual con el acento; en el teléfono, «Menú», logo y avatar como hoy. |
| CA-08 | e2e | Admin y operador a 1280 px: «Órdenes» ocupa 2 × 2 (ancho y alto de dos celdas) y no hay huecos (las filas se llenan). |
| CA-09 | e2e | Prueba existente del inicio en iPhone (spec 009), sin cambios. |
| CA-10, CA-11 | e2e | Fondo de `<html>` `#e9ebef` / `#050506`; tarjetas blancas / `#0d0d10`. |
| CA-12 | e2e | La placa conserva su amarillo y su tinta (prueba existente) y gana `text-shadow` y sus dos destellos. |
| CA-13 | e2e | Al pasar el ratón por la fila, el destello cambia de posición; con «reducir movimiento», `transition` nula. |
| RN-02 | e2e | Ninguna animación infinita en el inicio, «Órdenes» y el acceso (la prueba de la spec 003 se extiende). |
| RF-02 | unit | No existe ningún selector de acento: la búsqueda del componente en `src` da cero. |

**Regresión** (lo que ya estaba bien sigue bien):

- **Suite E2E completa en claro y en oscuro.** Comportamiento de todas las secciones; auditoría
  axe de todas las pantallas que ya audita, con sus formularios con errores; teléfono a 360 px y en
  iPhone sin desplazamiento lateral; «lo que se ilumina lleva la mano»; tarjetas-filtro; avisos;
  esqueletos; sin conexión.
- **Pruebas que cambian a propósito** (la 019 cambia el aspecto que afirman):
  - `theme.spec.ts`: el fondo se lee de `<html>`; `theme-color` y la barra de estado pasan a
    `#050506` y `#e9ebef`.
  - `summary-hover.spec.ts`: el fondo de reposo de las tarjetas en oscuro, si cambia con `content1`.
  - Las demás pruebas visuales (placa, peligro, placeholders, «Órdenes» oscura) no deberían cambiar.
- **Revisión con capturas** de todas las rutas en claro y oscuro, a 1280, 360 y 440 px (táctil):
  - personal: inicio, órdenes, una orden, agenda, «Horario», clientes, una ficha, servicios,
    empleados, reportes, liquidación, solicitudes de datos, marcas y líneas, usuarios;
  - cliente: inicio, reservas, historial, perfil, mis datos;
  - acceso, registro y «Sin conexión».

  Se anotan en `tasks.md`.

## Archivos afectados

**Nuevos**

- `apps/web/src/modules/core/components/spotlight.component.tsx` y su prueba
- `apps/web/e2e/style.spec.ts`

**Modificados**

- En `apps/web/src/app/`: `hero.ts`, `globals.css` y `layout.tsx`
- En `apps/web/src/modules/theme/constants/`: `theme.constants.ts` (`THEME_COLORS`)
- En `apps/web/src/modules/auth/components/`: `organisms/app-header.component.tsx`,
  `molecules/nav-links.component.tsx` y `organisms/staff-home.component.tsx`
- En `apps/web/src/modules/vehicles/components/atoms/`: `plate-label.component.tsx`
- En `apps/web/e2e/`: `theme.spec.ts`, `summary-hover.spec.ts` (si hace falta) y `ui.spec.ts`
  (animaciones)
- `CLAUDE.md`: la sección del sistema visual
- Specs 003, 009 y 010 (historial y lo que cambia)

**Eliminados:** ninguno. La exploración no entra.

## Dependencias nuevas

Ninguna. `Geist_Mono` sale de `next/font/google`, que ya carga Geist.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Bordes y sombras como valores del tema (`hero.ts`). | Sobrescribir `.border-divider` y `.shadow-small` en CSS, como en la exploración. | El tema es la fuente de los tokens; sin pelear con las utilidades. |
| Títulos, números y foco de luz como CSS global fuera de capas. | Un componente `PageTitle` y cambiar cada pantalla. | Unas 30 pantallas con su `h1`: el CSS global llega a todas sin tocarlas; se documenta por qué va sin capa. |
| Fondo en `<html>`, `<body>` transparente. | Capa con `z-index` positivo y el contenido envuelto. | Lo mínimo para que el fondo fijo quede detrás de todo, también de modales y avisos. |
| Foco de luz con un solo `pointermove` en el documento. | Un manejador por tarjeta. | Un único oyente pasivo, sin tocar las decenas de tarjetas. |
| Acento distinto por modo (acero y plata). | Plata en los dos modos. | Contraste AA y la decisión del usuario al verlo (CA-01). |
| Contraste de títulos con degradado medido en E2E. | Confiar en axe. | axe no evalúa el texto con degradado. |
| Texto secundario del claro en `#63636b` (`SECONDARY_ON_SHOWROOM`: `default-500`, `foreground-400/500`). | Fondo de página más claro; zinc-600. | zinc-500 da 4,0:1 sobre el gris de exposición (lo detectó axe en claro); `#63636b` da 5,0 sobre la página y 5,9 sobre una tarjeta, y sigue siendo secundario. |
| Mono solo para cifras solas (`tabular-nums`); `tabular-figures` (cifras alineadas en Geist) para líneas que mezclan palabras y cifras, y para la placa. | Mono en todo `tabular-nums`. | En la revisión con capturas, «Sin celular» o «Sin vehículos» en mono se leían como código y alargaban la línea en el teléfono; la placa reproduce la real (spec 005). |
| La auditoría axe espera a que terminen las animaciones finitas antes de medir. | Esperar solo la entrada de la página y los avisos. | «Ver todos» entra con un desvanecido: medido a medias, su mezcla bajaba de AA sobre el gris nuevo (falló 2 de 5 veces). |

## Ajustes durante la implementación

- El esqueleto del inicio (`page-skeleton`, `home`) toma la forma del bento en escritorio.
- «Reintentar» de «Sin conexión» también es una píldora (CA-06).
- Pruebas existentes ajustadas por lo que la spec cambia a propósito, cada una con su motivo:
  `theme.spec` (fondo en `<html>`, colores y anillo plata de «Órdenes»), `summary-hover.spec`
  (borde con el acento), `pwa-install.spec` y `pwa-offline.spec` (colores), `ui.spec` (bento y
  color del marcador de posición).

## Despliegue

Solo app: sin migraciones ni variables nuevas. La barra de estado de la app instalada toma el nuevo
`theme-color` al volver a cargarla.
