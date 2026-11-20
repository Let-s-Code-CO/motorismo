---
spec: "006"
estado: aprobado
actualizado: 2026-11-20
---

# Plan técnico — 006 App instalable

## Resumen

La app se vuelve instalable con el manifiesto nativo de Next 16 (`app/manifest.ts`), íconos
generados del logo y los metadatos de Safari. Un service worker mínimo, escrito a mano, **solo**
sirve una página «Sin conexión» cuando una navegación falla: no guarda en caché ninguna página
de la app ni datos. En el cliente, un módulo `pwa` vigila la conexión (eventos del navegador,
envíos fallidos y una sonda), vuelve inerte toda la app mientras no hay red, ofrece «Instalar
app» y avisa de versiones nuevas comparando la versión del build con la que responde
`/api/version`. No hay cambios de base de datos ni dependencias nuevas.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 006 `aprobada`, con el ajuste de redacción hecho al planificar («Instalar app» junto a la cuenta). |
| II. Qué antes que cómo | ✅ | La tecnología vive solo en este plan. |
| III. Criterios verificables | ✅ | Cada CA tiene prueba (tabla). Lo que solo se ve en un dispositivo real (instalar en iPhone, abrir desde el ícono) se cubre con lo que la app declara, más una prueba manual. |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias: manifiesto nativo, service worker de ~60 líneas, React 19 (`inert`). Se descartan next-pwa/Serwist (abajo). |
| VI. Seguridad y datos personales | ✅ | RN-02: la caché del service worker solo contiene la página «Sin conexión» y un ícono, iguales para todos y sin datos. Las peticiones que no son navegaciones no pasan por él. |
| VII. Trazabilidad | ✅ | Rama `feature/006-app-instalable`; tests con cabecera `spec 006, CA-xx`. |
| VIII. Incrementos pequeños | ✅ | Cuatro bloques desplegables por separado: A (HU-01), B (HU-02), C (HU-03), D (HU-04). |

## Base de datos (packages/supabase)

Sin cambios: ni migraciones, ni RLS, ni seeds, ni pgTAP.

## Aplicación (apps/web)

### Módulo nuevo `src/modules/pwa/`

```
pwa/
  components/
    connection-gate.component.tsx     # aviso «Sin conexión» + app inerte (HU-02)
    update-banner.component.tsx       # «Hay una versión nueva» + «Actualizar» (HU-04)
    install-app-button.component.tsx  # «Instalar app» junto a la cuenta (HU-03)
    ios-install-steps.component.tsx   # modal con los pasos de Safari (CA-13)
    service-worker-registrar.component.tsx
  hooks/
    connection.hook.ts                # useConnection(): online | offline
    install-prompt.hook.ts            # useInstallPrompt(): 'prompt' | 'ios' | null
    app-version.hook.ts               # useNewVersion(): boolean
  utils/
    connection.lib.ts                 # almacén externo (useSyncExternalStore) + sonda
    call-action.utils.ts              # callAction(): envíos que fallan por red (CA-10)
    platform.utils.ts                 # isIosSafari(), isStandalone()
  constants/pwa.constants.ts          # intervalos (sonda 5 s, versión 5 min), rutas
  messages/es.json                    # namespace `pwa`
```

### HU-01 — Instalable (bloque A)

- **`src/app/manifest.ts`**: `MetadataRoute.Manifest` con:
  - `name` «Motorismo Detailing» y `short_name` «Motorismo» (`getTranslations({ locale: 'es' })`, mismos textos que `core.brand`);
  - `id` y `start_url` `/`, con `display: 'standalone'`;
  - `background_color` y `theme_color` `#fafafa` (el fondo de `hero.ts`);
  - íconos `/icons/icon-192.png`, `/icons/icon-512.png` y `/icons/icon-maskable-512.png` (`purpose: 'maskable'`).
- **Íconos** (`public/icons/`, más `src/app/apple-icon.png` de 180 px por convención de archivo):
  - Diseño: el logo sobre el disco metálico oscuro de `BrandBadge`, en un cuadrado a sangre.
  - El maskable deja el logo dentro de la zona segura (80 %).
  - Se generan una vez desde `public/logo.png` con `sharp` (ya está en el árbol vía Next) desde un script en el scratchpad, y se versionan los PNG. La receta queda en «Riesgos y decisiones».
- **`layout.tsx` raíz**:
  - `metadata.appleWebApp = { capable: true, title: 'Motorismo', statusBarStyle: 'default' }` (CA-04).
  - `viewport.themeColor` sigue en `#fafafa` (CA-05).
  - Sin `viewport-fit=cover`: con la barra de estado por defecto, iOS no dibuja contenido bajo la muesca (requisito no funcional).
- **`src/proxy.ts`**: el `matcher` excluye `manifest.webmanifest`, `sw.js`, `offline` y `api/version`. El navegador pide el manifiesto sin cookies: si pasara por el proxy, un visitante recibiría una redirección al acceso en vez del JSON. Además, la sonda y la versión no deben consultar la sesión en Supabase cada pocos segundos.

### HU-02 — Sin conexión (bloque B)

- **`public/sw.js`** (JavaScript plano, sin build; es la única pieza que guarda algo en el dispositivo):
  - `install` guarda en la caché `motorismo-offline-v1` solo `/offline` y `/icons/icon-192.png`, y hace `skipWaiting()`.
  - `activate` borra cachés de otra versión y hace `clients.claim()`.
  - `fetch` actúa solo en dos casos:
    1. Si `request.mode === 'navigate'`, va a la red y, si falla, responde con `/offline` bajo la URL pedida. Así «Reintentar» recarga esa misma URL (CA-11).
    2. Si piden el ícono precargado, lo sirve de la caché.
  - Todo lo demás (RSC, Server Actions, Supabase, `_next/static`) **no** pasa por `respondWith` y va a la red como hoy (RN-02).
  - Las funciones del service worker se escriben puras (reciben `fetch` y `caches`) para probarlas en Vitest cargando el archivo con `vm`.
- **`next.config.ts` → `headers()`**: `/sw.js` con `Cache-Control: no-cache, no-store, must-revalidate`, como pide la guía de PWA de Next 16. El navegador siempre trae el service worker nuevo.
- **`service-worker-registrar`**: `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })` al montar, en todos los entornos, porque las E2E corren con `pnpm dev`. Se monta en `AppProvider`.
- **`src/app/offline/route.ts`** (`dynamic = 'force-static'`): devuelve un HTML autocontenido.
  - Lleva CSS en línea con los colores del tema, el ícono 192, un título «Sin conexión», la explicación y un botón «Reintentar» (`onclick="location.reload()"`).
  - Los textos salen de `messages/es.json` (`pwa.offlinePage`) con `getTranslations`.
  - Es un route handler y no una página de React a propósito: no depende de los chunks de JS ni CSS del build, que no están en caché.
- **`connection.lib.ts`**: almacén externo con `subscribe` y `getSnapshot`.
  - **Pasa a `offline`**: con el evento `offline`, con `navigator.onLine === false` al montar, o con `markOffline()` cuando un envío falla por red (CA-10; cubre el Wi-Fi sin internet).
  - **Vuelve a `online`**: con el evento `online`, o cuando la sonda `GET /api/version` (`cache: 'no-store'`, cada 5 s solo mientras está `offline`) responde.
- **`connection-gate`**, en el layout raíz alrededor de `children`:
  - Cuando el estado es `offline`, pone `inert` en todos los hijos directos de `<body>` salvo el suyo. Un `MutationObserver` alcanza también los portales que se abran después: los modales de HeroUI cuelgan de `body`, fuera de cualquier envoltorio, así que envolver no basta.
  - Pinta por portal una barra fija abajo, `Alert` `warning` con `role="status"`: «Sin conexión. No puedes guardar ni consultar nada hasta que vuelva la red.»
  - `inert` no desmonta nada: los formularios conservan lo escrito (CA-08), y lo que está en pantalla sigue visible.
  - Contrapartida: `inert` también saca el contenido del árbol de accesibilidad mientras no hay red. El aviso lo explica (ver Riesgos).
- **`call-action.utils.ts`**: `callAction(() => accion(args))` devuelve el resultado, o `null` si la llamada lanzó un error de red.
  - Error de red = el `TypeError` de `fetch`: «Failed to fetch», «Load failed», «NetworkError…».
  - En ese caso llama a `markOffline()`. Cualquier otro error se relanza.
  - Se aplica en las 15 llamadas a Server Actions de los componentes: auth (login, alta, Google, reenvío, contraseña, cerrar sesión), customers, users y vehicles.
  - Cada sitio trata `null` como «no pasó nada»: no muestra éxito ni error propio (el aviso global ya habla) y el formulario queda como estaba.
  - `user-menu` cambia `<form action={signOut}>` por una acción cliente que envuelve `signOut`. La redirección de la Server Action sigue funcionando.

### HU-03 — «Instalar app» (bloque C)

- **`install-prompt.hook.ts`**:
  - Escucha `beforeinstallprompt` (lo guarda y llama a `preventDefault()`) y `appinstalled`, que lo limpia.
  - El listener se registra en un módulo que se importa desde `AppProvider`, para capturar el evento aunque llegue antes de montar el encabezado.
  - Devuelve:
    - `'prompt'` si hay evento guardado;
    - `'ios'` en Safari de iPhone o iPad (`platform.utils`: UA iPhone/iPad/iPod, o Macintosh con `maxTouchPoints > 1`) sin `navigator.standalone`;
    - `null` si la app ya corre instalada (`matchMedia('(display-mode: standalone)')` o `navigator.standalone`) o si el navegador no permite instalarla (CA-14).
- **`install-app-button`**: botón de solo ícono (`Download`) con `aria-label` y tooltip «Instalar app», en `user-menu` junto a «Cerrar sesión».
  - Con `'prompt'` llama a `prompt()` (CA-12).
  - Con `'ios'` abre `ios-install-steps`, un `Modal` con los tres pasos e iconos de Compartir y «Agregar a inicio» (CA-13).
  - Con `null` no se pinta.

- **Aviso flotante (CA-18 a CA-20, cambio de spec durante la implementación)**:
  `pwa/components/install-banner.component.tsx`, montado en `src/app/(app)/layout.tsx` (solo con
  sesión). Es un `Alert` fijo abajo con «Instalar» (el mismo `promptInstall`, o los pasos en iOS)
  y «Ahora no».
  - «Ahora no» guarda la fecha en `localStorage` (`pwa/utils/install-snooze.utils.ts`, 14 días, con
    `try/catch`: si el navegador bloquea el almacenamiento, el aviso vuelve en la siguiente visita).
  - Cede ante «Sin conexión» y «Hay una versión nueva». La versión se consulta **una sola vez** en
    `pwa/providers/pwa.provider.tsx` y se comparte por contexto (`pwa/hooks/has-new-version.hook.ts`),
    que leen el aviso de versión y el de instalación.
  - El ícono del encabezado pasa de `Download` a `MonitorSmartphone`: no parece una descarga.

### HU-04 — Versión nueva (bloque D)

- **Versión del build**:
  - `next.config.ts` fija `env.NEXT_PUBLIC_APP_VERSION = VERCEL_DEPLOYMENT_ID ?? VERCEL_GIT_COMMIT_SHA ?? Date.now()`, calculado una vez al construir.
  - Next la incrusta igual en el servidor y en el cliente.
  - Se declara en `env.config.ts` (cliente, opcional) para que quede validada y documentada.
- **`src/app/api/version/route.ts`** (`dynamic = 'force-dynamic'`, `Cache-Control: no-store`): `{ version }`.
  - Responde siempre el último despliegue.
  - También sirve de sonda de conexión (HU-02).
- **`app-version.hook.ts`**:
  - Consulta `/api/version` al volver a la ventana (`visibilitychange` → visible) y cada 5 min mientras está abierta (CA-15).
  - Si la versión difiere de la del build, marca `newVersion`.
  - Sin red no consulta.
- **`update-banner`**: `Alert` fijo abajo con «Hay una versión nueva» y el botón «Actualizar», que hace `location.reload()` en la misma URL (CA-16).
  - Nunca recarga solo (RN-03, CA-17).
  - Si a la vez falta la red, manda el aviso «Sin conexión».

### Mensajes (`modules/pwa/messages/es.json`, registrado en `src/i18n/messages.ts`)

`offline.banner`, `offlinePage.{title,body,retry}`, `update.{title,action}`,
`install.{label,iosTitle,iosStep1,iosStep2,iosStep3,close}`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | unit + e2e | `__test__/src/app/manifest.test.ts`: nombre, nombre corto, `standalone`, íconos 192/512/maskable. `e2e/pwa-install.spec.ts`: sin sesión, `/manifest.webmanifest` responde JSON, los íconos responden PNG y Chromium no reporta errores de instalabilidad (CDP `Page.getInstallabilityErrors`). | `__test__/src/proxy.test.ts`: el proxy deja fuera exactamente el manifiesto, `sw.js`, `/offline` y `/api/version`, y nada que solo empiece igual (añadida al verificar).
| CA-02 | unit + manual | `manifest.test.ts` (`display`, `short_name`). Prueba manual al abrir desde el ícono. |
| CA-03 | unit + e2e existente | `manifest.test.ts` (`start_url: '/'`). `e2e/roles.spec.ts` ya cubre que `/` lleva a cada uno a lo suyo. |
| CA-04 | e2e + manual | `pwa-install.spec.ts`: `apple-touch-icon` (180 px, responde), `apple-mobile-web-app-capable` y título. Prueba manual en iPhone. |
| CA-05 | unit + e2e | `manifest.test.ts` (colores). `pwa-install.spec.ts` (`meta[name=theme-color]`). |
| CA-06 | componente + e2e | `connection-gate.component.test.tsx`: el aviso aparece con el evento `offline` y se anuncia (`role=status`). `e2e/pwa-offline.spec.ts` con `context.setOffline(true)`. |
| CA-07 | componente + e2e | `connection-gate.component.test.tsx`: `inert` en los hijos de `body`, también en un portal abierto después. `pwa-offline.spec.ts`: sin red, «Nuevo cliente» no responde al clic. |
| CA-08 | e2e | `pwa-offline.spec.ts`: escribe en el formulario de cliente, corta y devuelve la red; lo escrito sigue y «Guardar» funciona. |
| CA-09 | unit + e2e | `__test__/public/sw.test.ts`: la navegación fallida responde `/offline` y las demás peticiones no se interceptan. `__test__/src/app/offline/route.test.ts`: textos y ningún dato. `pwa-offline.spec.ts`: con el SW activo, sin red, recargar `/customers` muestra «Sin conexión» y ningún nombre de cliente. |
| CA-10 | unit + componente + e2e | `call-action.utils.test.ts`: `TypeError` de red → `null` y `offline`; otro error se relanza. `customer-form.component.test.tsx`: la acción rechaza por red, no hay éxito y los valores siguen. `pwa-offline.spec.ts`: `page.route` aborta el POST de la acción; aparece el aviso y lo escrito sigue. | Además, `call-action-coverage.test.ts` recorre los componentes que importan una Server Action y falla si alguno la llama sin `callAction` (añadida al verificar).
| CA-11 | e2e | `pwa-offline.spec.ts`: en la página «Sin conexión», devuelve la red y pulsa «Reintentar»; llega a `/customers`. |
| CA-12 | componente | `install-app-button.component.test.tsx`: un `beforeinstallprompt` simulado → el botón aparece y llama a `prompt()`. Chromium headless no emite el evento, así que no hay E2E. |
| CA-13 | componente | Mismo archivo: con UA de iPhone, el botón abre los pasos. |
| CA-14 | componente | Mismo archivo: en modo `standalone`, o sin evento y sin iOS, no hay botón. `install-banner.component.test.tsx`: sin opción de instalar, no hay aviso. |
| CA-18 | componente + e2e | `install-banner.component.test.tsx`: el aviso aparece y «Instalar» pide la instalación o abre los pasos en iPhone. `pwa-install.spec.ts` (UA de iPhone): aviso y pasos. |
| CA-19 | componente + e2e | `install-banner.component.test.tsx`: «Ahora no» lo oculta 14 días (a los 13 sigue oculto; a los 14 vuelve), y funciona con el almacenamiento bloqueado. `pwa-install.spec.ts`: tras «Ahora no» y recargar, no vuelve. |
| CA-20 | componente | `install-banner.component.test.tsx`: sin red o con versión nueva, el aviso espera. |
| CA-15 | hook + e2e | `app-version.hook.test.ts` (relojes falsos): consulta al volver a la ventana y cada 5 min; marca solo si difiere. `e2e/pwa-update.spec.ts`: `page.route('/api/version')` con otra versión → aviso. |
| CA-16 | e2e | `pwa-update.spec.ts`: «Actualizar» recarga la misma URL y el aviso desaparece. |
| CA-17 | hook + e2e | `app-version.hook.test.ts`: tras 30 min con versión nueva, `location.reload` no se llamó. `pwa-update.spec.ts`: lo escrito sigue con el aviso visible. |
| RNF a11y | e2e | `a11y.spec.ts` audita `/offline`, el aviso «Sin conexión» (con `setOffline`), el de versión nueva, y en iPhone el aviso de instalación y el modal de pasos. |

## Archivos afectados

- **Nuevos**:
  - El módulo `src/modules/pwa/` completo.
  - En `src/app/`: `manifest.ts`, `apple-icon.png`, `offline/route.ts` y `api/version/route.ts`.
  - En `public/`: `sw.js` y los tres íconos de `icons/`.
  - Pruebas: las unitarias en `__test__/`, más las E2E `pwa-install`, `pwa-offline` y `pwa-update`.
- **Modificados**:
  - `src/app/layout.tsx` (`appleWebApp`, `ConnectionGate`, `UpdateBanner`).
  - `src/modules/core/providers/app.provider.tsx` (registrador del SW y escucha de instalación).
  - `src/proxy.ts` (matcher), `next.config.ts` (headers y versión), `env.config.ts`, `src/i18n/messages.ts`.
  - `user-menu.component.tsx` (botón de instalar y `signOut` con `callAction`).
  - Los 15 componentes que llaman a Server Actions (`callAction`).
  - `e2e/a11y.spec.ts`, `CLAUDE.md` (regla de `callAction` e `inert`) y `specs/backlog.md`.
- **Eliminados**: ninguno.

## Dependencias nuevas

Ninguna. `sharp` solo se usa una vez, fuera del repo, para generar los PNG.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Service worker escrito a mano, solo con la página de respaldo para navegaciones. | `@serwist/next` / `next-pwa`. | Precachean el build y cachean rutas por defecto: es justo lo que RN-02 prohíbe, y suman una dependencia y un paso de build para ~60 líneas. |
| La página «Sin conexión» es un route handler con HTML autocontenido. | Una página de React (`app/offline/page.tsx`). | La página de React depende de chunks de JS y CSS con hash que el SW tendría que precachear (y conocer). El HTML en línea queda autocontenido y estático. |
| Bloqueo con `inert` en los hijos de `body` y `MutationObserver`. | Deshabilitar botón por botón. Envolver solo `children`. Una capa transparente encima. | Botón por botón son decenas de sitios y es fácil olvidar uno. Envolver deja fuera los modales (portales). La capa no bloquea el teclado. |
| `inert` saca el contenido del árbol de accesibilidad mientras no hay red. | Mantenerlo legible para lectores de pantalla con `aria-disabled` en cada control. | Así cumple «no dejar operar nada» con una sola pieza. El aviso, fuera de la parte inerte, dice qué pasa. Es un estado temporal. |
| `callAction` en cada llamada a una Server Action. | Envolver `window.fetch` globalmente. Una frontera de error. | El error de red de una Server Action lanzado dentro de una transición acaba en la frontera de error y desmonta el formulario, con lo que se pierde lo escrito. Hay que atraparlo en el sitio. El wrapper global no evita eso y toca todas las peticiones. |
| La versión es el ID de despliegue de Vercel (o el commit) incrustado al construir, y `/api/version` responde la vigente. | El push del service worker para avisar. Skew protection de Vercel. | Es lo más simple que detecta un despliegue nuevo, y sirve también de sonda de conexión. Push queda fuera de alcance. |
| Íconos PNG versionados, generados una vez. | Generarlos en cada build con `ImageResponse` (`app/icon.tsx`). | Son estáticos y no cambian. `ImageResponse` no admite bien el degradado metálico y añade trabajo al build. |
| Riesgo: Playwright y el SW sin red. | — | `context.setOffline` afecta al SW en Chromium. Si en esta versión no lo hiciera, la E2E de CA-09 cambia a `page.route` abortando la navegación, y la lógica queda cubierta por `sw.test.ts`. Se comprueba al empezar el bloque B. |
| Riesgo: `beforeinstallprompt` antes de la hidratación. | Script en línea en `<head>`. | Se registra en un módulo importado por `AppProvider` (primer JS cliente). Chrome suele emitir el evento después de cargar; si llega antes, el botón aparece en la siguiente visita. |
| Al implementar: el contenedor del aviso «Sin conexión» lleva `data-react-aria-top-layer`. | — | Un modal abierto marca `aria-hidden` en todo lo que queda fuera de él; sin esa marca, el aviso no se anunciaba sobre un modal (lo destapó la E2E). |
| Al implementar: `ConnectionGate`, el aviso de versión y el registro del SW van en `PwaProvider`, dentro de `AppProvider`. | Montarlos en `layout.tsx`. | Comparten la consulta de versión por contexto con el aviso de instalación (CA-20). |
| Al implementar: el aviso «Sin conexión» es `role="alert"` (el `Alert` de HeroUI). | `role="status"`. | Es el que ya usa el resto de avisos de la app. |
| Al implementar: CA-01 se prueba con `Page.getAppManifest`. | `Page.getInstallabilityErrors`. | En Chromium sin ventana siempre devuelve una lista vacía, incluso sin manifiesto: no prueba nada. |
| Riesgo: un SW viejo en los equipos. | — | Con `no-store` en `sw.js`, `skipWaiting` y `clients.claim`, el nuevo toma el control al siguiente arranque. Si hubiera que retirarlo, un `sw.js` que se desregistra lo resuelve. |

Receta de los íconos: el disco de `BrandBadge` (degradado radial `#b4b4b4 → #262626`) a sangre
en un lienzo cuadrado, con el logo al 68 % y subido un 6 %. En el maskable, el logo va al 52 %
para quedar dentro del círculo seguro. Tamaños: 192, 512, maskable 512 y apple 180.

## Despliegue

Solo app: no hay migración ni variables nuevas (Vercel ya expone `VERCEL_DEPLOYMENT_ID` y
`VERCEL_GIT_COMMIT_SHA`). Se exige HTTPS, que Vercel ya da. Tras el despliegue, prueba manual:

- Instalar en Android/Chrome y en escritorio.
- Agregar a inicio en iPhone.
- Abrir desde el ícono.
- Cortar el Wi-Fi.
- Publicar un cambio y ver el aviso.
