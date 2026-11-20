---
spec: "010"
estado: aprobado
actualizado: 2026-11-20
---

# Plan técnico — 010 Modo oscuro

## Resumen

- **Tema de HeroUI:** `hero.ts` gana un tema `dark` (base casi negra, primario casi blanco, las
  mismas escalas semánticas sin invertir) y los colores fijos de los componentes pasan a tokens
  del tema o reciben su variante `dark:`.
- **Preferencia:** la elección (Claro, Oscuro o Sistema) vive en una **cookie del dispositivo**.
  Así el servidor dibuja ya la clase correcta para «Claro» y «Oscuro», y el ícono del selector
  sale bien desde el HTML.
- **«Sistema»:** un script mínimo en `<head>`, antes de pintar, consulta `prefers-color-scheme`.
  Sin destello (CA-01).
- **Cambios en vivo:** un proveedor cliente aplica las elecciones y escucha los cambios del
  dispositivo (CA-02).
- **Selector:** «Tema» en el menú de la cuenta del teléfono y un menú propio en el encabezado de
  escritorio.

No hay base de datos ni dependencias nuevas.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 010 aprobada; amplía las specs 003, 006 y 009 (anotado en ellas al terminar). |
| II. Qué antes que cómo | ✅ | La cookie, el script y los tokens están aquí, no en la spec. |
| III. Criterios verificables | ✅ | Cada CA tiene su prueba; la auditoría axe corre en los dos temas. |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas. |
| V. Simplicidad y stack | ✅ | Sin `next-themes`: unas 60 líneas propias resuelven el caso, y el servidor lee la cookie (ver decisiones). |
| VI. Seguridad y datos personales | ✅ | La cookie solo guarda `light`, `dark` o `system`: ni datos personales ni nada en la base de datos (RN-02). |
| VII. Trazabilidad | ✅ | Rama `feature/010-modo-oscuro`; cabeceras de test con «spec 010, CA-xx». |
| VIII. Incrementos pequeños | ✅ | HU-01 (seguir al sistema) se despliega sola; HU-02 (elegir) se apoya en ella. |

## Base de datos (packages/supabase)

Sin cambios (RN-02).

## Aplicación (apps/web)

### Módulo nuevo `src/modules/theme/`

- `constants/theme.constants.ts`:
  - `THEME_COOKIE = 'motorismo-theme'`, que dura un año, `SameSite=Lax`, legible desde el
    navegador;
  - `THEME_CHOICES = ['light', 'dark', 'system']`;
  - `THEME_COLORS = { light: '#fafafa', dark: '#09090b' }` (fondo y barra del sistema).
- `utils/theme.utils.ts` (puro):
  - `parseThemeChoice(value)` devuelve `'system'` si el valor no es válido (CA-12);
  - `resolveTheme(choice, prefersDark)` decide `'light'` o `'dark'`;
  - `themeCookie(choice)` arma la cookie.
- `utils/theme-script.utils.ts`: el script de `<head>` (cadena corta, sin dependencias). Si el
  `<html>` trae `data-theme-choice="system"`, pone `dark` según `matchMedia`. Además actualiza
  `color-scheme` y el `content` de `meta[name=theme-color]`.
- `providers/theme.provider.tsx` (`'use client'`):
  - parte de la elección que manda el servidor;
  - `setChoice` escribe la cookie, cambia la clase `dark` y `color-scheme` del `<html>` y el
    `theme-color`;
  - con «Sistema», escucha `matchMedia('(prefers-color-scheme: dark)')` y aplica los cambios al
    momento, sin recargar (CA-02);
  - expone `useTheme()` → `{ choice, setChoice }`.
- `components/theme-icon.component.tsx`: sol, luna o pantalla según la elección.
- `components/theme-menu.component.tsx` (escritorio, CA-10):
  - un `Dropdown` cuyo disparador es un botón solo-ícono con el ícono de la elección y
    `aria-label` «Tema: {Claro|Oscuro|Sistema}»;
  - `DropdownMenu` con `selectionMode="single"`: tres opciones con ícono y la actual marcada
    (`menuitemradio`, CA-13).
- `messages/es.json` (namespace `theme`), registrado en `src/i18n/messages.ts`:
  - `title`: «Tema»;
  - `light`, `dark`, `system`: «Claro», «Oscuro», «Sistema»;
  - `current`: «Tema: {name}».

### Integración

- `src/app/layout.tsx`:
  - lee la cookie (`cookies()`) y pinta `<html className={dark ? 'dark' : ''}
    data-theme-choice={choice} style={{ colorScheme }} suppressHydrationWarning>`;
  - pone el script en `<head>` y envuelve con `ThemeProvider`;
  - `viewport.themeColor` pasa a dos entradas con `media` (claro y oscuro), que el script y el
    proveedor fijan cuando la elección no es «Sistema» (CA-07).
- `account-menu` (teléfono, CA-09): una sección «Tema» con las tres opciones con ícono, la actual
  marcada, entre la cabecera y «Cerrar sesión».
- `app-header` (escritorio): `ThemeMenu` junto a `UserMenu`.
- `hero.ts`, tema `dark`:
  - `background: '#09090b'`;
  - `content1..4` en la escala zinc oscura;
  - `foreground` con la escala zinc invertida y AA para el texto de ayuda;
  - `primary: { DEFAULT: '#fafafa', foreground: '#18181b' }`;
  - `danger` con la misma escala, pero `DEFAULT` en un tono que cumpla AA sobre fondo oscuro
    (lo confirma axe). `bg-danger-600` + texto blanco sigue igual en los dos temas;
  - `focus` claro.
- Colores fijos (inventario de la exploración: unas 50 apariciones en 13 archivos):
  - los cuadros de ícono negros (`bg-zinc-900 text-white`) del inicio, el avatar y `RoleChip`
    pasan a `bg-primary text-primary-foreground`: en oscuro se ven claros con ícono oscuro,
    siempre con contraste;
  - el panel y la franja de marca y la tarjeta «Órdenes» siguen `bg-zinc-950` en los dos temas
    (CA-06). En oscuro ganan `dark:ring-1 dark:ring-white/10` para separarse del fondo;
  - `color-swatch` (colores reales de un vehículo) no cambia.
- Placa (CA-04): sus tokens `--color-plate*` ya son fijos; no cambian.
- «Sin conexión» (`src/app/offline/route.ts`, CA-08):
  - el HTML autocontenido gana `@media (prefers-color-scheme: dark)` y un script que lee la
    cookie del tema;
  - sube la caché del service worker a `motorismo-offline-v2` (regla de la spec 006).
- `manifest.ts`: `theme_color` y `background_color` siguen claros. El manifiesto no admite dos
  temas; con la app abierta manda el `theme-color` de la página.

### Ajustes durante la implementación

- **Tarjeta «Órdenes» en oscuro:** destaca por relieve y no por ser clara, a petición del
  usuario: degradado carbón un poco más claro que las demás tarjetas, borde plateado (`ring`) y
  resplandor suave, con el brillo animado de la marca. Una versión plateada clara se descartó
  porque encandilaba.
- **Rojo de error en oscuro:** HeroUI conserva sus escalas semánticas oscuras, pero el `DEFAULT`
  de `danger` sube a `#f54180`. El `#f31260` daba 4,27:1 sobre las tarjetas y lo encontró la
  auditoría en oscuro.
- **Botones destructivos:** `bg-danger-600` en claro y `dark:bg-danger-300` en oscuro (el mismo
  rojo en la escala invertida).
- **Disparadores de menú:** HeroUI baja el disparador de un menú abierto al 70 % de opacidad, y
  en oscuro el avatar perdía contraste. Lo dejamos al 100 % (`classNames.trigger`).
- **Menú de la cuenta en el teléfono:** «Tema» va como sección, porque HeroUI no admite selección
  por sección. La opción elegida lleva un ✓ visible y «, elegido» para el lector de pantalla; el
  selector de escritorio sí usa `menuitemradio` con `aria-checked`.
- **Uso con teclado (CA-13):** se prueba en el E2E con un teclado real. jsdom no maneja bien el
  teclado de React Aria.
- **La auditoría axe completa en oscuro:** un proyecto de Playwright `chromium-dark` repite
  `a11y.spec.ts` con `colorScheme: 'dark'`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | unit: `resolveTheme` y `parseThemeChoice`; E2E con `colorScheme: 'dark'`: en `domcontentloaded` el `<html>` ya tiene `dark` y el fondo es oscuro (login, inicio, órdenes); con cookie `dark` el HTML del servidor ya trae la clase | `theme.utils.test.ts`, `e2e/theme.spec.ts` |
| CA-02 | componente: el proveedor reacciona al `change` de `matchMedia` con «Sistema» y lo ignora con «Claro»; E2E: `emulateMedia` cambia con un campo escrito y el texto sigue ahí | `theme.provider.test.tsx`, `e2e/theme.spec.ts` |
| CA-03 | E2E: toda la auditoría axe actual corre dos veces, en claro y en oscuro (`test.use({ colorScheme })`) | `e2e/a11y.spec.ts` |
| CA-04 | E2E oscuro: el color de fondo y de letra de una placa coincide con el de claro | `e2e/theme.spec.ts` |
| CA-05 | axe (contraste) en oscuro con órdenes de los tres estados y «Desactivar cliente»/«Anular orden»; E2E: los tres chips de estado tienen colores distintos | `e2e/a11y.spec.ts`, `e2e/theme.spec.ts` |
| CA-06 | E2E oscuro: el panel de marca y la tarjeta «Órdenes» tienen un fondo distinto al de la página y un borde visible | `e2e/theme.spec.ts` |
| CA-07 | unit: el proveedor fija `theme-color`; E2E: el `meta theme-color` vigente es `#09090b` en oscuro | `theme.provider.test.tsx`, `e2e/theme.spec.ts` |
| CA-08 | E2E sin red (`serviceWorkers` activos): «Sin conexión» con fondo oscuro con `colorScheme: 'dark'` y con la cookie `dark` | `e2e/pwa-offline.spec.ts` |
| CA-09 | componente: «Tema» en el menú de la cuenta con tres opciones, la actual marcada; elegir llama a `setChoice`; E2E iPhone: elegir «Oscuro» oscurece la app | `account-menu.component.test.tsx`, `e2e/theme.spec.ts` |
| CA-10 | componente: el ícono y el nombre «Tema: Oscuro» según la elección, tres opciones y la actual marcada | `theme-menu.component.test.tsx` |
| CA-11 | E2E: elegir «Oscuro», recargar, cerrar sesión, ver el login en oscuro; otro contexto del navegador (otro dispositivo) sigue en «Sistema» | `e2e/theme.spec.ts` |
| CA-12 | unit: `parseThemeChoice(undefined)` → `system`; E2E: sin cookie, sigue al sistema | `theme.utils.test.ts`, `e2e/theme.spec.ts` |
| CA-13 | componente: el menú se abre y se elige con teclado (Enter, flechas) y la elección se anuncia (`aria-checked`); axe con los menús abiertos | `theme-menu.component.test.tsx`, `e2e/a11y.spec.ts` |

Además, todas las capturas del teléfono (360 px y iPhone) y de escritorio se revisan en oscuro.

## Archivos afectados

**Nuevos:**
- `src/modules/theme/`: `constants`, `utils` (dos), `providers`, `components` (dos) y
  `messages`;
- `e2e/theme.spec.ts`;
- las pruebas de unidad y de componente.

**Modificados:**
- `src/app/layout.tsx`, `hero.ts`, `globals.css` (`color-scheme`);
- `app.provider.tsx` (si el proveedor de tema va ahí) y `src/i18n/messages.ts`;
- `account-menu`, `app-header`, `staff-home`, `user-avatar`, `role-chip`;
- `brand-panel`, `brand-band`, `brand-ring-logo` y `site-footer` (si hace falta);
- `offline/route.ts`, `public/sw.js` (nombre de la caché);
- E2E: `a11y`, `pwa-offline`, `ui` (iPhone en oscuro);
- `CLAUDE.md`: los colores, siempre por tokens o con su `dark:`.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Cookie de dispositivo | `localStorage` | El servidor la lee: «Claro» u «Oscuro» salen ya en el HTML (sin destello y sin el script), y el ícono del selector se hidrata sin saltos. `localStorage` solo se lee en el navegador. |
| Script propio en `<head>` + proveedor | `next-themes` | `next-themes` guarda en `localStorage` (mismo problema), su script en un componente cliente da avisos con React 19 y añade una dependencia para unas 60 líneas. |
| `bg-primary` para los cuadros de ícono y el avatar | Mantenerlos negros en oscuro | Un cuadro negro sobre una tarjeta casi negra se pierde; con `primary` siempre contrasta y sigue monocromo (RN-01). |
| La marca (panel, franja, «Órdenes») sigue negra en los dos temas, con borde en oscuro | Invertirla en oscuro | Es la identidad (spec 003); el borde la separa del fondo (CA-06). |
| Escalas semánticas sin invertir en oscuro | Las escalas invertidas de HeroUI | `bg-danger-600` + texto blanco sigue siendo AA en los dos temas sin tocar cada botón. |

Riesgos:
- **Hidratación:** el `<html>` cambia antes de hidratar (script) y lleva
  `suppressHydrationWarning`, solo ahí.
- **Barra de iOS:** en una app instalada en iOS, la barra puede quedarse clara
  (`statusBarStyle: 'default'`); se revisa a mano en el dispositivo (como la spec 006, T055).
- **Paleta oscura:** el contraste real lo decide axe; los tonos de `hero.ts` se ajustan con la
  auditoría en verde.

## Despliegue

Solo app, sin migraciones ni variables nuevas. Al desplegar sube la caché de «Sin conexión»
(`motorismo-offline-v2`).
