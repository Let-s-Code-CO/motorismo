---
spec: "009"
estado: aprobado
actualizado: 2026-11-20
---

# Plan técnico — 009 Experiencia móvil

## Resumen

Solo interfaz, sin base de datos. Por debajo de `md` (el ancho en que hoy el menú se recoge,
spec 007):

- el encabezado pasa a una rejilla de tres columnas (menú · logo · avatar). «Menú» abre un
  `Drawer` de HeroUI desde la izquierda y el avatar abre un `Dropdown` con la cuenta;
- el inicio del personal pasa a una cuadrícula de mosaicos con íconos grandes en el estilo de
  marca. «Órdenes» lleva un resumen («2 en proceso · 1 en cola») que se cuenta en el servidor
  con la sesión del usuario (RLS);
- el layout del acceso gana una franja de marca por debajo de `lg` (donde hoy no se ve el panel).
  Reutiliza los adornos del panel de escritorio.

En escritorio (`md+` en la app, `lg+` en el acceso) nada cambia, salvo el resumen de «Órdenes»
en su tarjeta.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 009 aprobada. Anota lo que cambia de las specs 003 (CA-03), 006 (CA-12) y 007 (menú). |
| II. Qué antes que cómo | ✅ | La spec no nombra componentes; las decisiones técnicas están aquí. |
| III. Criterios verificables | ✅ | Cada CA tiene su prueba (tabla abajo); E2E en teléfono emulado para el diseño y el desplazamiento. |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas; las suposiciones están en la spec. |
| V. Simplicidad y stack | ✅ | Sin dependencias: `Drawer` y `Dropdown` vienen en HeroUI 2.8. Sin estado global: el panel es estado local. |
| VI. Seguridad y datos personales | ✅ | El resumen se lee con la sesión (RLS de `work_orders`, spec 008); el panel solo muestra lo del rol, y la autorización sigue en el proxy y en Postgres. |
| VII. Trazabilidad | ✅ | Rama `feature/009-experiencia-movil`; cabeceras de test con «spec 009, CA-xx». |
| VIII. Incrementos pequeños | ✅ | P1 (encabezado e inicio) se despliega sola; la franja del acceso (P2) es independiente. |

## Base de datos (packages/supabase)

Sin cambios. El resumen cuenta `public.work_orders` con la sesión del usuario: el personal ya lee
esa tabla por RLS (spec 008) y un cliente no ve ninguna orden.

## Aplicación (apps/web)

### Encabezado (HU-01)

- `auth/components/organisms/app-header.component.tsx`:
  - **Por debajo de `md`:** rejilla `grid-cols-[1fr_auto_1fr]` con «Menú» (izquierda), el logo
    centrado y el avatar alineado a la derecha.
  - **Desde `md`:** el diseño actual (logo con nombre, enlaces en línea y `UserMenu`).
  - Los dos se dibujan y cada uno se oculta con `md:hidden` / `hidden md:flex`, como hoy
    `nav-links`. Sin detección de dispositivo en JS, así no hay saltos en la hidratación.
- `auth/constants/nav.constants.ts` (nuevo): `NAV_LINKS` con `href`, clave de texto, **ícono** y
  audiencias. Es una sola lista para el menú de escritorio, el panel y el inicio (RN-01), y sale de
  `nav-links`.
- `auth/components/molecules/nav-links.component.tsx`: solo los enlaces en línea de escritorio. El
  desplegable «Menú» se elimina.
- `auth/components/organisms/mobile-nav.component.tsx` (nuevo, `'use client'`):
  - el botón «Menú» (ícono + texto, 44 px de alto) abre un `Drawer` con `placement="left"`;
  - el `Drawer` tiene el logo y el nombre del negocio en la cabecera, un `<nav aria-label="Menú
    principal">` con los enlaces del rol (ícono + nombre, la actual con `aria-current="page"`) y
    un botón «Cerrar»;
  - al elegir un enlace, el panel se cierra y se navega;
  - Escape, tocar fuera y devolver el foco al botón vienen de React Aria (CA-03);
  - el `Drawer` es un diálogo modal, así que lo de atrás queda fuera del árbol accesible.
- `auth/components/molecules/account-menu.component.tsx` (nuevo, `'use client'`):
  - el avatar es el disparador de un `Dropdown` cuyo nombre accesible es «Tu cuenta»;
  - las opciones son una cabecera (nombre y rol con `RoleChip`, no seleccionable), «Instalar app»
    (solo si `useInstallPrompt()` devuelve una opción) y «Cerrar sesión»;
  - «Instalar app» llama a `promptInstall()`, o en iOS abre `IosInstallSteps`;
  - «Cerrar sesión» llama a `callAction(signOut)` dentro de una transición
    (`call-action-coverage` lo exige).
- `UserMenu` sigue igual para escritorio.

### Inicio (HU-02)

- `work-orders/utils/open-orders-count.lib.ts`:
  - `countOpenOrders(client)` → `{ inProgress, queued }`;
  - hace dos `select('id', { count: 'exact', head: true })` sobre `work_orders` con
    `status = 'open'` y `started_at` no nulo o nulo (RN-03);
  - recibe el cliente para que el sandbox lo pruebe con una sesión real. `work-orders.server.ts`
    lo envuelve con la sesión de la petición (`openOrdersCount()`).
- `src/app/(app)/page.tsx`:
  - pide `countOpenOrders()` en paralelo con la página y delega el dibujo en un organismo;
  - los `SECTIONS` salen de `NAV_LINKS` (sin «Inicio» ni «Mi perfil»);
  - con la descripción que ya tiene cada sección en `auth.home.*`.
- `auth/components/organisms/staff-home.component.tsx` (nuevo, servidor):
  - **Teléfono (`< md`):** `grid-cols-2`, mosaicos cuadrados con el ícono grande (`size-14`) sobre
    negro con un anillo y brillo plateados (los tokens del panel de marca), el nombre y, en
    «Órdenes», el resumen. Sin descripción.
  - **Escritorio:** las tarjetas actuales y, en «Órdenes», la misma línea de resumen.
  - «Próximamente» lleva `hidden md:flex` (CA-08).
  - Es un componente de servidor: sin interacción, solo enlaces.
- `auth/utils/open-orders-summary.utils.ts` (nuevo, puro):
  - `{0,0}` → `{ key: 'none' }`, si no `{ key: 'some', inProgress, queued }`;
  - el texto lo pone `messages` con plural ICU («1 en proceso», «2 en proceso»).

### Acceso (HU-03)

- `core/components/brand-ornaments.component.tsx` (nuevo, el fondo) y
  `core/components/brand-ring-logo.component.tsx` (nuevo, el logo en su anillo): salen del panel
  actual. Agrupa la luz
  ambiente, la rejilla que se desvanece, el barrido de brillo (`motion-safe:animate-shine`) y el
  logo en el anillo plateado con los destellos. Todo es decorativo (`aria-hidden`), salvo el logo,
  que recibe `alt` por props.
- `core/components/brand-band.component.tsx` (nuevo):
  - franja `bg-zinc-950` con `lg:hidden` y altura acotada (~220 px en un teléfono);
  - lleva los adornos, el logo a 96 px y «Especialistas en PPF y Detailing» como texto (`<p>`,
    no un título, para no competir con el `h1` del formulario);
  - es un `<header aria-label="Motorismo Detailing">`, así el nombre se anuncia una vez (CA-12);
  - el logo pequeño que hoy va sobre el formulario en el móvil se quita, porque la franja ya lo
    lleva.
- `brand-panel.component.tsx` usa `BrandOrnaments`; se dibuja igual (CA-13).
- `src/app/auth/layout.tsx`: la `BrandBand` arriba en la columna del formulario. El formulario
  arranca con menos aire en el móvil (`py-8`), para que «Entrar» quede a la vista en 390 × 844
  (CA-11).

### Mensajes

- `auth.header`: `closeMenu`, `accountMenu` («Tu cuenta»), `mainMenu` («Menú principal»).
- `auth.home`:
  - `ordersSummary`: «{inProgress, plural, one {# en proceso} other {# en proceso}} · {queued,
    plural, one {# en cola} other {# en cola}}»;
  - `ordersNone`: «Sin órdenes abiertas».

### Ajustes durante la implementación (pedidos por el usuario)

- Inicio: «Órdenes» primero, a todo el ancho, oscura con `BrandOrnaments` y los números en
  grande, también en escritorio (con su tamaño de tarjeta). Las demás secciones son mosaicos
  iguales con el nombre corto del menú; una sola en la última fila ocupa la fila entera. En el
  teléfono el inicio se centra en vertical: `main` es una columna flexible y el inicio usa
  `max-md:my-auto`.
- Acceso: la franja y la zona del formulario se reparten la altura sobrante (`flex-auto`), así el
  formulario queda centrado.
- Cuenta: el nombre y el rol van en `topContent` del menú, no como opción (axe
  `label-content-name-mismatch`). El avatar se anuncia «CD, tu cuenta» con las mismas iniciales
  que dibuja (`auth/utils/initials.utils.ts`, también en `UserAvatar`).

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | E2E (iPhone 390 y 360 px): solo «Menú», logo y avatar; logo centrado (centro ±2 px); sin desplazamiento lateral | `e2e/ui.spec.ts` |
| CA-02 | componente: el panel lista las secciones del rol (admin, operador y cliente), marca la actual y se cierra al elegir; E2E: navegar desde el panel | `__test__/…/auth/components/mobile-nav.component.test.tsx`, `e2e/roles.spec.ts` |
| CA-03 | componente: Escape y «Cerrar» cierran y el foco vuelve a «Menú»; E2E: tocar fuera cierra; a11y con el panel abierto | `mobile-nav.component.test.tsx`, `e2e/a11y.spec.ts` |
| CA-04 | componente: nombre, rol, «Instalar app» según `useInstallPrompt` (mock) y «Cerrar sesión» llama a la acción; E2E: cerrar sesión desde el avatar en un iPhone | `account-menu.component.test.tsx`, `e2e/auth-logout.spec.ts` |
| CA-05 | E2E escritorio: enlaces en línea, nombre y «Cerrar sesión» visibles, sin «Menú» | `e2e/ui.spec.ts` |
| CA-06 | componente: un mosaico por sección del rol («Usuarios» solo admin) y todo el mosaico es enlace; E2E iPhone: dos columnas (dos mosaicos en la misma fila) | `staff-home.component.test.tsx`, `e2e/ui.spec.ts` |
| CA-07 | unit: `openOrdersSummary` (0/0, 1/0, 2/1); componente: el texto en «Órdenes»; sandbox: `countOpenOrders` contra los seeds (1 en proceso · 1 en cola) | `open-orders-summary.utils.test.ts`, `staff-home.component.test.tsx`, `__test__/sandbox/work-orders-access.sandbox.test.ts` |
| CA-08 | E2E iPhone: «Próximamente» no visible; escritorio: visible | `e2e/ui.spec.ts` |
| CA-09 | componente: descripciones presentes; E2E escritorio: tarjetas con descripción | `staff-home.component.test.tsx`, `e2e/ui.spec.ts` |
| CA-10 | E2E iPhone: en login, registro y recuperar, la franja con el lema visible y el panel lateral oculto | `e2e/ui.spec.ts` |
| CA-11 | E2E 390 × 844: «Entrar» `toBeInViewport()`; 360 px sin desplazamiento lateral | `e2e/ui.spec.ts` |
| CA-12 | componente: adornos `aria-hidden` y un solo nombre accesible del negocio; E2E con `reducedMotion: 'reduce'`: el brillo sin animación (`animation-name: none`) | `brand-band.component.test.tsx`, `e2e/ui.spec.ts` |
| CA-13 | E2E escritorio: el panel lateral visible y la franja oculta (la prueba actual de spec 003 CA-03) | `e2e/ui.spec.ts` |

Se actualizan las pruebas que asumían el desplegable:
- `nav-links.component.test.tsx`;
- `ui.spec.ts` («the menu fits… «Menú»» de la spec 007);
- `a11y.spec.ts` («the «Menú» of a phone»);
- la prueba de la spec 003 CA-03 en teléfono («only the form»), que pasa a comprobar la franja.

Las pantallas nuevas (panel abierto, menú de la cuenta abierto, inicio en teléfono, acceso en
teléfono) se añaden a la auditoría axe y a la prueba «on an iPhone».

## Archivos afectados

**Nuevos:**
- `auth/constants/nav.constants.ts`;
- `auth/components/organisms/mobile-nav.component.tsx`;
- `auth/components/molecules/account-menu.component.tsx`;
- `auth/components/organisms/staff-home.component.tsx`;
- `auth/utils/open-orders-summary.utils.ts`;
- `core/components/brand-ornaments.component.tsx`;
- `core/components/brand-band.component.tsx`;
- sus pruebas.

**Modificados:**
- `app-header`, `nav-links`, `src/app/(app)/page.tsx`, `src/app/auth/layout.tsx`, `brand-panel`;
- `work-orders.server.ts`;
- `auth/messages/es.json`;
- E2E (`ui`, `a11y`, `roles`, `auth-logout`) y el sandbox de órdenes;
- `CLAUDE.md`: la regla del menú móvil pasa a panel lateral y cuenta en el avatar.

**Eliminados:** ninguno (el desplegable sale de `nav-links`).

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| `Drawer` de HeroUI para el panel | Panel propio con CSS; `Dropdown` actual | Trae foco atrapado, Escape, clic fuera, devolución del foco y `aria-modal` probados (CA-03), y combina con el resto de HeroUI. |
| Dos encabezados en el DOM, uno visible por ancho | Detectar el teléfono en JS | Sin saltos de hidratación ni parpadeo; es el patrón que ya usa `nav-links`. |
| Una sola lista de enlaces con ícono (`NAV_LINKS`) | Repetir las secciones en el panel y en el inicio | RN-01: lo que ve cada rol no puede divergir entre el menú, el panel y el inicio. |
| Resumen con dos `count … head: true` | Leer todas las órdenes abiertas; una vista nueva | Barato (sin filas), sin migración y con RLS. |
| Adornos compartidos (`BrandOrnaments`) entre panel y franja | Copiar el marcado | Un solo sitio para el estilo de marca. |
| La franja del acceso sin las tarjetas de servicios | Incluirlas | Lo dice la spec (suposición): empujarían el formulario (CA-11). |

Riesgos:
- El `Drawer` y el `Dropdown` salen en un portal. `ConnectionGate` pone `inert` a todos los hijos
  de `<body>`, también a los portales, así que sin red siguen bloqueados, como los modales de hoy.
- El aviso flotante de instalación (spec 006) no cambia y no tapa el panel: el panel es modal y
  va por encima.

## Despliegue

Solo app, sin migraciones ni variables nuevas.
