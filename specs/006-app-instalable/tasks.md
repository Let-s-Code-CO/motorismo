---
spec: "006"
actualizado: 2026-11-20
---

# Tareas — 006 App instalable

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**. Si una ya pasa al escribirla,
  se muta el código para verla fallar (Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/006-app-instalable`. Cada bloque (A: HU-01, B: HU-02, C: HU-03,
  D: HU-04) deja la app desplegable por sí solo.
- Sin base de datos: no hay migraciones, pgTAP ni tipos que regenerar.
- Rutas abreviadas: `web/` = `apps/web/`, `pwa/` = `web/src/modules/pwa/`,
  `t/` = `web/__test__/`.

---

## Bloque A — P1: instalable (HU-01)

### Fase A1 — Pruebas (rojo)

- [x] T001 Crear la rama `feature/006-app-instalable` desde `develop`. Esqueleto del módulo
      `pwa/` con `messages/es.json` (namespace `pwa`) registrado en `web/src/i18n/messages.ts`
      → `pnpm ts:check` en verde.
- [x] T002 [P] `t/src/app/manifest.test.ts`: nombre «Motorismo Detailing», nombre corto
      «Motorismo», `id` y `start_url` `/`, `display: 'standalone'`, colores `#fafafa`, íconos
      192, 512 y maskable 512 con su `purpose` → rojo (no existe `manifest.ts`).
      (CA-01, CA-02, CA-03, CA-05, RF-01, RF-02)
- [x] T003 [P] `web/e2e/pwa-install.spec.ts`:
      - sin sesión, `/manifest.webmanifest` responde JSON y cada ícono responde `image/png`;
      - la página de acceso tiene `link[rel=manifest]`, `apple-touch-icon` (responde),
        `apple-mobile-web-app-capable`, título de Safari y `meta[name=theme-color]`;
      - Chromium no reporta errores de instalabilidad (CDP `Page.getInstallabilityErrors`).
      → rojo. (CA-01, CA-04, CA-05)

### Fase A2 — Implementación (verde)

- [x] T004 Generar los íconos desde `web/public/logo.png` con `sharp` (script en el scratchpad,
      no versionado; receta en el plan): `web/public/icons/icon-192.png`, `icon-512.png`,
      `icon-maskable-512.png` y `web/src/app/apple-icon.png` (180) → se revisan a ojo (disco
      metálico, logo centrado; el maskable dentro del círculo seguro). (RF-01)
- [x] T005 `web/src/app/manifest.ts` con los textos de `core.brand` vía `getTranslations` → T002
      en verde. (CA-01, CA-02, CA-03, CA-05)
- [x] T006 `web/src/app/layout.tsx`: `metadata.appleWebApp` (`capable`, título «Motorismo»,
      `statusBarStyle: 'default'`); `viewport.themeColor` sigue `#fafafa`. (CA-04, CA-05)
- [x] T007 `web/src/proxy.ts`: el `matcher` excluye `manifest.webmanifest`, `sw.js`, `offline` y
      `api/version`; comprobar que `decideAccess` no cambia → T003 en verde y
      `t/…/proxy` (o `access.utils`) siguen en verde. (CA-01)

---

## Bloque B — P2: sin conexión, sin operar (HU-02)

### Fase B1 — Pruebas (rojo)

- [x] T010 Sonda de viabilidad: ¿`context.setOffline(true)` corta también las peticiones del
      service worker en el Chromium de Playwright? Anotar el resultado aquí. **Resultado: sí**
      (recargar sin red muestra «Sin conexión»). En cambio, `page.route` no ve las peticiones que
      pasan por el SW: las E2E que lo usan llevan `serviceWorkers: 'block'`. Si no, la E2E de
      CA-09 aborta la navegación con `page.route` (riesgo del plan).
- [x] T011 [P] `t/public/sw.test.ts`, que carga `web/public/sw.js` en un `vm` con `fetch` y `caches` falsos:
      - `install` guarda solo `/offline` y el ícono 192;
      - `activate` borra las cachés de otra versión;
      - una navegación que falla responde `/offline`, y una que funciona responde la red;
      - una petición que no es navegación (RSC, POST de acción, Supabase) no se intercepta;
      - el ícono se sirve de la caché.

      → rojo. (CA-09, RF-04, RN-02)
- [x] T012 [P] `t/src/app/offline/route.test.ts`: HTML con título «Sin conexión», explicación,
      botón «Reintentar» que recarga, ícono 192, `lang="es"`; sin ningún dato de persona; sin
      `<script src>` ni hojas externas (autocontenido) → rojo. (CA-09, CA-11, RN-02)
- [x] T013 [P] `t/src/modules/pwa/utils/connection.lib.test.ts`:
      - pasa a `offline` con el evento `offline`, con `navigator.onLine` falso al empezar y con `markOffline()`;
      - vuelve a `online` con el evento `online` o con la sonda a `/api/version` (cada 5 s, relojes falsos);
      - la sonda no corre mientras hay red.

      → rojo. (CA-06, CA-08, CA-10, RF-03)
- [x] T014 [P] `t/src/modules/pwa/utils/call-action.utils.test.ts`:
      - devuelve el resultado de la acción;
      - ante un `TypeError` de red («Failed to fetch», «Load failed», «NetworkError…») devuelve
        `null` y marca `offline`;
      - otro error se relanza y no marca nada.

      → rojo. (CA-10, RN-01)
- [x] T015 [P] `t/src/modules/pwa/components/connection-gate.component.test.tsx`:
      - con red no hay aviso ni `inert`;
      - sin red, el aviso «Sin conexión…» está en un `role=status`;
      - todos los hijos de `body` salvo el aviso llevan `inert`, también un portal añadido después;
      - al volver la red se quita `inert` y un `input` conserva su valor.

      → rojo. (CA-06, CA-07, CA-08)
- [x] T016 [P] `t/src/modules/customers/components/customer-form.component.test.tsx` (ampliar):
      si la acción rechaza con un `TypeError` de red, no hay aviso de éxito ni de error propio,
      `onSaved` no se llama y los campos conservan lo escrito → rojo. (CA-10)

### Fase B2 — Implementación (verde)

- [x] T017 `web/public/sw.js` (funciones puras + listeners; caché `motorismo-offline-v1`) y
      `web/next.config.ts` → `headers()` con `Cache-Control: no-cache, no-store,
      must-revalidate` para `/sw.js` → T011 en verde. (CA-09, RF-04, RN-02)
- [x] T018 `web/src/app/offline/route.ts` (`force-static`, HTML autocontenido con CSS en línea y
      textos de `pwa.offlinePage`) → T012 en verde. (CA-09, CA-11)
- [x] T019 `web/src/app/api/version/route.ts` (`force-dynamic`, `no-store`, `{ version }`) y la
      versión del build: `NEXT_PUBLIC_APP_VERSION` en `web/next.config.ts` (`env`) y en
      `env.config.ts` (cliente, opcional). Se usa ya como sonda; HU-04 la reutiliza.
      → `curl -s localhost:3000/api/version` responde JSON sin sesión. (RF-03, RF-05)
- [x] T020 `pwa/utils/connection.lib.ts`, `pwa/hooks/connection.hook.ts` y
      `pwa/constants/pwa.constants.ts` → T013 en verde. (RF-03)
- [x] T021 `pwa/utils/call-action.utils.ts` → T014 en verde. (CA-10)
- [x] T022 `pwa/components/connection-gate.component.tsx` (portal del aviso, `inert` en los hijos
      de `body`, `MutationObserver`) y montaje en `web/src/app/layout.tsx` → T015 en verde.
      (CA-06, CA-07, CA-08)
- [x] T023 `pwa/components/service-worker-registrar.component.tsx` montado en
      `core/providers/app.provider.tsx` (`register('/sw.js', { scope: '/', updateViaCache:
      'none' })`) → en el navegador, DevTools muestra el SW activo. (CA-09)
- [x] T024 `callAction` en los formularios de customers y vehicles: `customer-form`,
      `my-profile-form`, `customer-manage`, `customers-screen`, `vehicle-form` y
      `retire-vehicle-modal`. Con `null`, no hacen nada → T016 en verde; las pruebas
      existentes de esos componentes, también. (CA-10)
- [x] T025 `callAction` en auth y users: `login-form`, `sign-up-form`, `forgot-password-form`,
      `set-password-form`, `resend-confirmation`, `google-button`, `invite-user-form`,
      `users-screen` y `user-menu`, donde `signOut` pasa a una acción cliente que lo envuelve
      → sus pruebas existentes siguen en verde, y `e2e/auth-logout.spec.ts` también. (CA-10)

### Fase B3 — E2E

- [x] T026 `web/e2e/pwa-offline.spec.ts` (operador, «Clientes»):
      - sin red aparece el aviso y «Nuevo cliente» no responde (CA-06, CA-07);
      - con el modal de nuevo cliente lleno, al cortar y volver la red, lo escrito sigue y
        «Guardar» crea el cliente (CA-08);
      - con el SW activo y sin red, recargar `/customers` muestra «Sin conexión» y ningún nombre
        de cliente (CA-09, RN-02);
      - en esa página, con la red de vuelta, «Reintentar» lleva a `/customers` (CA-11);
      - con el POST de la acción abortado (`page.route`), aparece el aviso, no hay éxito y lo
        escrito sigue (CA-10).

      → verde. Limpieza de los clientes creados en `afterAll`.

---

## Bloque C — P2: «Instalar app» (HU-03)

### Fase C1 — Pruebas (rojo)

- [x] T030 [P] `t/src/modules/pwa/utils/platform.utils.test.ts`: `isIosSafari` (iPhone, iPad,
      iPad que se presenta como Mac con pantalla táctil; no Android ni Mac de escritorio) e
      `isStandalone` (`display-mode: standalone` o `navigator.standalone`) → rojo. (CA-13, CA-14)
- [x] T031 [P] `t/src/modules/pwa/components/install-app-button.component.test.tsx`:
      - con un `beforeinstallprompt` simulado aparece «Instalar app» y al pulsarlo llama a `prompt()` (CA-12);
      - con UA de iPhone, abre el modal con los tres pasos y se cierra (CA-13);
      - en modo `standalone`, tras `appinstalled`, o sin evento y sin iOS, no hay botón (CA-14).

      → rojo.

### Fase C2 — Implementación (verde)

- [x] T032 `pwa/utils/platform.utils.ts` → T030 en verde.
- [x] T033 `pwa/hooks/install-prompt.hook.ts`, con la escucha de `beforeinstallprompt` y
      `appinstalled` en un módulo importado desde `app.provider.tsx`. Luego
      `pwa/components/install-app-button.component.tsx` (solo ícono `Download`, `aria-label` y
      tooltip) y `pwa/components/ios-install-steps.component.tsx` (modal) → T031 en verde.
      (CA-12, CA-13, CA-14)
- [x] T034 Montar el botón en `auth/components/molecules/user-menu.component.tsx`, junto a
      «Cerrar sesión» → las pruebas de `app-header` y `user-menu` siguen en verde. (CA-12)
- [x] T035 (Cambio de spec, CA-18 a CA-20) `t/src/modules/pwa/components/install-banner.component.test.tsx`
      en rojo:
      - el aviso aparece, y «Instalar» pide la instalación o abre los pasos en iPhone;
      - «Ahora no» lo oculta 14 días;
      - cede ante «Sin conexión» y la versión nueva;
      - funciona con el almacenamiento bloqueado.
- [x] T036 `pwa/components/install-banner.component.tsx`, `pwa/utils/install-snooze.utils.ts`,
      `pwa/hooks/has-new-version.hook.ts` (contexto) y `pwa/providers/pwa.provider.tsx` (una sola
      consulta de versión); aviso montado en `src/app/(app)/layout.tsx`; ícono `MonitorSmartphone`
      → T035 y `update-banner` en verde.
- [x] T037 E2E en `pwa-install.spec.ts` (UA de iPhone): aviso, pasos, «Ahora no» y recarga → verde.
      (CA-18, CA-19)

---

## Bloque D — P3: aviso de versión nueva (HU-04)

### Fase D1 — Pruebas (rojo)

- [x] T040 [P] `t/src/modules/pwa/hooks/app-version.hook.test.ts`, con relojes falsos y `fetch`
      simulado:
      - consulta al volver a la ventana y cada 5 min;
      - marca la versión nueva solo si difiere de la del build;
      - no consulta sin red;
      - tras 30 min con versión nueva, `location.reload` no se ha llamado.

      → rojo. (CA-15, CA-17, RN-03)
- [x] T041 [P] `t/src/modules/pwa/components/update-banner.component.test.tsx`: sin versión nueva
      no se pinta; con versión nueva muestra «Hay una versión nueva» y «Actualizar», que recarga;
      sin red cede el sitio al aviso «Sin conexión» → rojo. (CA-15, CA-16)

### Fase D2 — Implementación (verde)

- [x] T042 `pwa/hooks/app-version.hook.ts` → T040 en verde. (CA-15, CA-17)
- [x] T043 `pwa/components/update-banner.component.tsx`, montado en `web/src/app/layout.tsx` →
      T041 en verde. (CA-15, CA-16)

### Fase D3 — E2E

- [x] T044 `web/e2e/pwa-update.spec.ts`:
      - `page.route('/api/version')` responde otra versión;
      - al volver a la ventana aparece el aviso, y lo escrito en el buscador sigue (CA-15, CA-17);
      - «Actualizar» recarga la misma URL y, sin la ruta falsa, el aviso no vuelve (CA-16).

      → verde.

---

## Cierre

- [x] T050 `web/e2e/a11y.spec.ts`: auditar `/offline`, el aviso «Sin conexión» (con
      `setOffline`), el aviso de versión nueva y el modal de pasos de iPhone (UA de iPhone)
      → verde. (RNF accesibilidad)
- [x] T051 `CLAUDE.md`:
      - regla de `callAction` para toda llamada nueva a una Server Action;
      - `inert` sin red;
      - el SW solo guarda la página «Sin conexión» (nada de caché de páginas ni datos);
      - el matcher del proxy y sus exclusiones.
- [x] T052 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde.
- [x] T053 Mutación aplicada a cada prueba nueva que pasó al escribirla; fallo observado,
      revertida (`git diff` + grep sin marcas).
- [x] T054 Spec (`implementada`), plan, tareas y backlog actualizados.
- [x] T056 (Al verificar) `t/src/proxy.test.ts` y el `matcher` de `web/src/proxy.ts` con rutas
      exactas (`offline$`, `api/version$`, …): `/offline-report` sigue pasando por el proxy. (CA-01)
- [x] T057 (Al verificar) `t/src/modules/pwa/call-action-coverage.test.ts`: todo componente que
      importa una Server Action la llama con `callAction` (o un ayudante que lo usa). (CA-10)
- [ ] T055 (Manual, tras el despliegue — usuario)
      - instalar en Android/Chrome y en escritorio;
      - agregar a inicio en iPhone (CA-02, CA-04);
      - cortar el Wi-Fi con la app abierta;
      - publicar un cambio y ver el aviso.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T002, T003, T056 |
| CA-02 | T002, T055 |
| CA-03 | T002 (+ `e2e/roles.spec.ts` existente) |
| CA-04 | T003, T055 |
| CA-05 | T002, T003 |
| CA-06 | T013, T015, T026 |
| CA-07 | T015, T026 |
| CA-08 | T013, T015, T026 |
| CA-09 | T011, T012, T026 |
| CA-10 | T013, T014, T016, T026, T057 |
| CA-11 | T012, T026 |
| CA-12 | T031 |
| CA-13 | T030, T031, T050 |
| CA-14 | T030, T031 |
| CA-15 | T040, T041, T044 |
| CA-16 | T041, T044 |
| CA-17 | T040, T044 |
| CA-18 | T035, T037, T050 |
| CA-19 | T035, T037 |
| CA-20 | T035 |
