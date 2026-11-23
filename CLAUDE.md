# CLAUDE.md — Motorismo Detailing

Aplicación web para un negocio de lavado y detailing de motos: los clientes se registran y
mantienen sus datos; el personal gestiona clientes, órdenes de trabajo y reportes. Se despliega en **Vercel** con base de datos
**Supabase**.

Este proyecto se desarrolla con **Spec Driven Development (SDD)**. Antes de tocar código de
producto, lee [specs/constitution.md](specs/constitution.md) y [specs/README.md](specs/README.md).

## Idioma

- Respuestas al usuario, specs, `CLAUDE.md` y documentación: **español**.
- Código, identificadores, comentarios de código, nombres y descripciones de tests: **inglés**.
- Commits y PRs: **inglés** (título y cuerpo), Conventional Commits.
- Textos visibles de la UI: **español**, siempre vía `messages/es.json` (nunca en el JSX).

## Monorepo

pnpm 12 (workspaces, `nodeLinker: isolated`) + Turborepo. Node 24 (`.nvmrc`).

| Workspace | Qué es |
|---|---|
| `apps/web` | App Next.js 16 (App Router, React 19). Puerto 3000. |
| `packages/supabase` | `@motorismo/supabase`: migraciones, seeds, pgTAP y tipos `Database` generados. Lee su [CLAUDE.md](packages/supabase/CLAUDE.md) antes de tocar la base de datos. |
| `packages/eslint-config` | ESLint 9 (flat config) compartido: `base` y `next`. |
| `packages/typescript-config` | `base.json` y `nextjs.json`. |
| `packages/prettier-config` | Prettier con orden de imports. |

## Stack de `apps/web`

- Next.js 16 + React 19, TypeScript estricto.
- UI: HeroUI 2.8 + Tailwind CSS 4. HeroUI usa contexto de React: los componentes que lo usan
  llevan `'use client'`.
- Sistema visual (spec 003): Geist, base zinc con primario casi negro, radios 8/12/16 px, sombras
  suaves; tema en `src/app/hero.ts` y animaciones en `globals.css` (siempre `motion-safe:`).
  Iconos con `lucide-react`, decorativos (`aria-hidden`); los botones solo-icono llevan
  `aria-label`. Todo lo clicable muestra la «manito»: `globals.css` la restaura para
  `button` y `[role=button]` (Tailwind 4 ya no lo hace); un enlace o elemento clicable de otro tipo
  necesita `cursor-pointer`. Nada de colores llamativos (salvo la placa amarilla de los vehículos, que reproduce la placa
  colombiana: tokens `--color-plate*` en `globals.css`, spec 005 HU-07): los semánticos solo para estados y para
  las acciones destructivas, que son un botón sólido `danger` con fondo `bg-danger-600` (el
  `danger-500` por defecto no da contraste AA con texto blanco), como «Desactivar cliente».
- **Carga y transiciones (spec 011).**
  - **Esqueletos:** toda pantalla nueva con datos lleva su `loading.tsx`, con un `PageSkeleton`
    de `core` (`home`, `list`, `detail`, `form` o `profile`). Aparece a los 300 ms solo con
    CSS, se anuncia una vez como «Cargando…» y sus formas van ocultas al lector de pantalla.
  - **Transición:** el contenido entra con `(app)/template.tsx`, `page-in` de 200 ms y
    `motion-safe`.
  - **Barra:** `NavigationProgress` arranca al tocar un enlace interno o ir atrás, y termina al
    cambiar la ruta.
  - **Inicio de sesión:** `signIn` devuelve el destino (no redirige) para mostrar `BrandMoment`
    mientras se navega.
  - **Pruebas con red lenta:** `e2e/loading.spec.ts` la simula con CDP
    (`Network.emulateNetworkConditions`), después de `waitForLoadState('networkidle')`.
  - **Título de la pestaña:** `next.config.ts` lleva `htmlLimitedBots: /.*/`, que pone los
    metadatos en el `<head>` desde el principio. Así la pestaña tiene título también mientras se
    ve el esqueleto (WCAG 2.4.2).
- **Modo oscuro (spec 010).**
  - **Temas:** claro y oscuro en `src/app/hero.ts`, con «Sistema» por defecto.
  - **Dónde se guarda:** en la cookie del dispositivo `motorismo-theme`. El layout raíz pinta
    «Claro» u «Oscuro» desde el servidor, y un script en `<head>` resuelve «Sistema» antes de
    pintar (`modules/theme`).
  - **Colores:** nunca un color fijo que no tenga su variante: usa tokens (`bg-content1`,
    `text-default-500`, `bg-primary`…) o añade su `dark:`.
  - **Botones destructivos:** `bg-danger-600 dark:bg-danger-300` (en oscuro HeroUI invierte las
    escalas semánticas).
  - **Disparadores de menú:** el de un `Dropdown` lleva `classNames={{ trigger:
    'aria-expanded:opacity-100' }}`; HeroUI lo baja al 70 % y en oscuro pierde contraste.
  - **Pruebas:** `a11y.spec.ts` corre también en oscuro (proyecto `chromium-dark`).
- El tema conserva la escala de `foreground` de HeroUI (`src/app/hero.ts`): sus componentes pintan
  placeholders y textos de ayuda con ella. `danger` usa por defecto el tono 600 de la escala roja
  (spec 007): así los errores de los campos (`text-danger`) y los botones `danger` cumplen AA. Turbopack no recarga `hero.ts` en caliente, y a veces
  sirve una versión vieja de `globals.css` (p. ej. tras deshacer un cambio enseguida): si un cambio
  de estilos no se ve, borra `apps/web/.next` y reinicia `pnpm dev`.
- Radios: con Geist, el texto de un radio queda ~0,5 px por encima del centro del círculo;
  `globals.css` lo corrige para todos. Las tarjetas de rol (`invite-user-form`) bajan el círculo
  (`wrapper: 'mt-[1.75px]'`) para centrarlo en el nombre del rol.
- **Avisos de resultado (spec 013, estándar).**
  - **Qué:** lo que una acción hizo (guardar, crear, desactivar, cerrar…) se dice con
    `notify({ tone, text })` de `core/lib/toast.lib.ts`, nunca con un `Alert` dentro de la página.
  - **Dónde:** `ToastRegion` (layout raíz) lo pinta abajo a la derecha desde `md` y abajo a lo ancho
    en el teléfono. Una confirmación se va a los 5 s (en pausa con el ratón o el foco encima); un
    error no se va solo.
  - **Errores:** los de una acción suelta (desactivar, «Empezar», «+5 min») van a `notify` con
    `tone: 'danger'`; los de un formulario o un diálogo se quedan dentro, debajo de su botón.
  - **Al navegar:** si la acción lleva a otra pantalla, `notify({ …, after: ruta })`, nunca
    `?saved=1`: recargar no lo repite.
  - **Banners de abajo:** un banner fijo abajo usa `useBottomBanner` (`core/hooks`) para que los
    avisos suban por encima.
  - **Pruebas:** `renderWithProviders` monta la pila de avisos; se buscan con `inToasts()`.
- **Tarjetas de resumen = filtros (estándar).** En cualquier listado con tarjetas que resumen por
  estado o categoría, cada tarjeta filtra la lista al pulsarla y se desmarca con otro clic. El
  filtro vive en la URL (`?status=…`, sobrevive a recargar y al botón «atrás»), las tarjetas son
  botones con `aria-pressed` y la elegida se marca (borde y anillo; el resto se atenúa). Al pasar el
  ratón la tarjeta se ilumina y nunca se mueve: en claro crecen la sombra y el borde; en oscuro, donde
  la sombra no se ve, se aclaran el fondo y el borde (`e2e/summary-hover.spec.ts`). Sobre la
  lista va una línea de conteo («1 de 4 usuarios · Invitados», `aria-live`) con un botón fantasma
  «Ver todos» (no un chip). Si una tarjeta es la suma de otras (p. ej. «Activos» = «Con cuenta»
  + «Sin cuenta»), se dibuja como un panel que las contiene (`parts`) y cada una sigue filtrando
  sola. Componentes compartidos en `core`: `summary-filter-cards`,
  `filter-bar` y `status-filter.utils` (specs 003 CA-09 y 004 CA-17; los usan Usuarios y Clientes).
- Accesibilidad: `e2e/a11y.spec.ts` audita con axe (WCAG 2.1 AA) y debe seguir en verde; las
  pantallas nuevas se añaden a esa auditoría.
  Audita también los formularios con sus errores a la vista.
- **Selector con una sola opción = ya elegida (spec 008, RN-10, estándar).** El único vehículo de un
  cliente, el único empleado activo… vienen preseleccionados (`core/utils/selection.utils.ts`,
  `singleOption`); nadie despliega una lista para elegir lo único que hay.
- Un botón con texto visible y algo más para lectores de pantalla («Añadir …») lleva ese extra en un
  `sr-only` delante del texto, no en `aria-label`: el nombre accesible debe contener el visible
  (WCAG 2.5.3; axe `label-content-name-mismatch`). Una `<dl>` solo contiene pares `dt`/`dd`.
- Horas para el negocio en 12 horas, como se leen en Colombia («4:15 p. m.»), siempre con
  `core/hooks/clock.hook.ts` (`useClock`): Node y el navegador ponen espacios distintos en «p. m.» y
  sin normalizarlos la hidratación falla. Las fechas relativas («hace 40 minutos») con `useNow`,
  nunca sin un «ahora» de referencia: `src/i18n/request.ts` fija `now` por petición y el navegador
  lo hereda. Fecha y hora juntas se formatean por separado (fecha + `useClock`), nunca con
  `dateStyle` + `timeStyle` (Node y el navegador las unen distinto).
- **Móvil siempre.** Toda pantalla nueva o cambiada se revisa en teléfono (capturas en 360 px y en
  iPhone de 440 px con modo táctil) y se añade a la prueba «on an iPhone» de `e2e/ui.spec.ts`, que
  exige cero desplazamiento lateral. El contenedor de la app lleva `overflow-x-clip` como red de
  seguridad, no como sustituto de arreglar lo que desborde.
- **Encabezado e inicio en el teléfono (spec 009).**
  - **Una sola lista de secciones:** `auth/constants/nav.constants.ts` (`NAV_LINKS`, con ícono y
    audiencias) alimenta el menú de escritorio (`nav-links`), el panel del teléfono y el inicio del
    personal (`staff-home`). Una sección nueva se añade ahí, con sus textos en `auth.header` y
    `auth.home`.
  - **Encabezado:** por debajo de `md` hay tres columnas: «Menú» (`mobile-nav`, un `Drawer` desde
    la izquierda), el logo centrado y el avatar (`account-menu`). El avatar abre un menú con nombre
    y rol como cabecera, «Instalar app» y «Cerrar sesión». Desde `md`, el encabezado de siempre.
    Los dos se dibujan y el CSS muestra uno según el ancho.
  - **Inicio:** «Órdenes» va destacada y oscura con los números; el resto son mosaicos en dos
    columnas y el inicio queda centrado en el teléfono.
  - **Acceso:** por debajo de `lg` lleva la franja de marca (`brand-band`), que comparte los adornos
    con el panel (`brand-ornaments`, `brand-ring-logo`).
- i18n: next-intl 4, **solo español**, sin segmento de idioma en la URL.
- Estado de servidor: TanStack Query 5. Formularios: React Hook Form + Zod 4.
- Supabase: `@supabase/ssr` con clientes tipados (`createClient<Database>`).
- Entorno validado con `@t3-oss/env-nextjs` en `src/modules/core/config/env.config.ts`.
- Pruebas: Vitest 4 + Testing Library (unitarias) y Playwright (E2E).
- Next 16 tiene cambios incompatibles con versiones anteriores: consulta la documentación incluida
  en `apps/web/node_modules/next/dist/docs/` (lo recuerda `apps/web/AGENTS.md`, que genera
  `next dev`; versiónalo, se recrea si se borra) y la skill `next-best-practices`.

## Comandos (desde la raíz)

```bash
nvm use                 # Node 24
corepack enable         # activa pnpm 12.15.0 (packageManager)
pnpm install

pnpm db:start           # Supabase local en Docker (API 54321, DB 54322, Studio 54323)
cp apps/web/.env.example apps/web/.env.local   # y pega la publishable key de `pnpm db:start`
pnpm dev                # http://localhost:3000

pnpm lint | pnpm lint:fix
pnpm ts:check
pnpm test               # Vitest (unitarias, sin servicios)
pnpm --filter web test:sandbox   # Vitest contra el Supabase local real (Auth, RLS, correos)
pnpm test:e2e           # Playwright contra el Supabase local (levanta el servidor solo)
pnpm build

pnpm db:reset           # reaplica migraciones + seeds desde cero
pnpm db:test            # pgTAP
pnpm db:types           # regenera packages/supabase/types/database.types.ts
pnpm db:stop
```

Un test concreto: `pnpm --filter web exec vitest run ruta/al/archivo.test.tsx`.

Usuarios locales (seeds), todos con la contraseña `motorismo-local`:

- Personal: administradores `sebastian.pulido@motorismo.test` y `carlos.diaz@motorismo.test`,
  `operador@motorismo.test` y `desactivado@motorismo.test`.
- Clientes: **`cliente@motorismo.test`** (cuenta de prueba para usar la app como cliente: entra a
  su «Inicio», `/my`), `cliente.desactivado@motorismo.test`; `cliente.google@motorismo.test` (origen
  Google, con foto, sin contraseña) y dos clientes sin cuenta del punto de atención.
- Vehículos (spec 005): Camila tiene la Suzuki GSX-R600 `UIH-03D` (y la `JWJ-07` retirada),
  Valentina la camioneta `KDM-482` (placa de Bogotá, D.C.) y Andrés una bicicleta. El catálogo de
  marcas y líneas y los 1.104 municipios (ciudad de la placa) llegan por migración (existen en
  todos los entornos), no por seed.
- Órdenes (spec 008, solo en local): Valentina #1 cerrada; Camila #2 cerrada (dos medios de pago y
  descuento), #3 anulada y #4 abierta («Limpieza de cadena» sin tiempo estimado).
- Agenda (spec 012, solo en local): esta semana y la siguiente habilitadas de 9:00 a. m. a 6:00 p. m.
  (2 puestos, 15 min de tolerancia); mañana a las 10:00, Camila (Suzuki, «Lavado detallado»; la reservó ella desde la app, spec 014) y
  Valentina (sin vehículo) llenan la franja; mañana a las 11:00, Andrés, cancelada. Hoy, en la
  franja de la hora en que se hizo el reset (antes de abrir, la primera; después de cerrar, la
  última, la de las 5:00 p. m., y Camila ya pasó su tolerancia): Gabriel (su Yamaha `GGM-45F`, registrada por el seed)
  llegó con su reserva y su orden #6 espera en la cola con «Reserva …»; Camila está «por llegar»
  unos 25 minutos tras el reset (con «+5 min» disponible); Lina llegó tarde y Sofía antes (van por
  llegada), Mateo sin reserva y Valentina «No asistió».
- Catálogos (spec 007, solo en local): servicios «Lavado sencillo», «Lavado detallado»,
  «Micropulido» y «Recubrimiento cerámico» («Polichado» desactivado); empleados Elkin Estrada
  (CC 1020304050, 35 %), Paula Pineda (CC 52123456, 30 %) y Diego Desactivado. En cada entorno real
  los carga el administrador.

Los correos (invitaciones, confirmación de registro, recuperación) se ven en Mailpit:
http://127.0.0.1:54324.

### Git hooks (Husky)

- **pre-commit**: `pnpm lint`
- **commit-msg**: commitlint (Conventional Commits)
- **pre-push**: `pnpm ts:check`, `pnpm test`, `pnpm build`

## Estructura de `apps/web`

```
src/
  app/                       # rutas (App Router): layout, page, route handlers
  i18n/                      # next-intl: request.ts y registro de mensajes por módulo
  modules/{feature}/
    api/                     # {feature}.client.ts / {feature}.server.ts
    components/              # atoms/ molecules/ organisms/
    constants/  hooks/  types/  utils/
    messages/es.json         # textos del módulo, bajo el namespace {feature}
    queries/                 # {feature}.keys.ts, {feature}.queries.ts, {feature}.mutations.ts
    schemas/                 # {feature}.schema.ts (Zod, fuente de verdad de los tipos de formularios)
__test__/                    # espejo de src/ (p. ej. __test__/src/modules/core/...)
__test__/test-utils/         # renderWithProviders (mensajes reales en español)
e2e/                         # Playwright
```

- Nombres de archivo en kebab-case con sufijo: `*.component.tsx`, `*.hook.ts`, `*.schema.ts`,
  `*.types.ts`, `*.queries.ts`, `*.mutations.ts`, `*.keys.ts`, `*.utils.ts`, `*.lib.ts`,
  `*.provider.tsx`, `*.config.ts`, `*.actions.ts` (Server Actions), `*.server.ts` (solo servidor,
  con `import 'server-only'`), `*.test.ts(x)`, `*.sandbox.test.ts`, `e2e/*.spec.ts`.
- Componentes con **export default**; early returns.
- Alias: `@web/*` → `src/*`, `@tests/*` → `__test__/*`, `@motorismo/supabase/types`.
- Cada módulo nuevo registra su `messages/es.json` en `src/i18n/messages.ts`.
- Datos: query key factories + `queryOptions` (TanStack Query 5); tipos de filas derivados de
  `Tables<'tabla'>`, sin genéricos explícitos que oculten drift.
- Autorización en Postgres (RLS), nunca solo ocultando elementos en la UI.
- Desplegables de HeroUI (`Autocomplete`, `Select`) dentro de un `Modal`: pásales
  `popoverProps={{ portalContainer }}` con un elemento del modal; si no, el modal los oculta a los
  lectores de pantalla (`aria-hidden`). Y ese `Modal` lleva `scrollBehavior="outside"`: con
  `normal` (por defecto) o `inside` la tarjeta del modal recorta la lista abierta. Ver
  `vehicle-form` y `vehicles-section` (spec 005).

## App instalable y sin conexión (spec 006)

- La app se instala (manifiesto en `src/app/manifest.ts`, íconos en `public/icons/` y
  `src/app/apple-icon.png`). **No funciona sin conexión** y no guarda datos en el dispositivo.
- `public/sw.js` (escrito a mano) solo guarda la página «Sin conexión» (`src/app/offline/route.ts`,
  HTML autocontenido) y su ícono, y la muestra cuando falla una navegación. **Nunca** caches de
  páginas, de `_next/static` ni de datos (RN-02). Si cambia lo que guarda, sube el nombre de la
  caché (`motorismo-offline-vN`).
- **Toda llamada nueva a una Server Action desde un componente va con `callAction`**
  (`modules/pwa/utils/call-action.utils.ts`): si la red se cae al enviar, la app pasa a «sin
  conexión» y devuelve `null`, que la pantalla trata como «no pasó nada» (sin éxito ni error
  propio, el formulario intacto). Sin él, el error desmonta el formulario.
  `call-action-coverage.test.ts` falla si un componente llama a una Server Action sin él.
- Sin red, `ConnectionGate` pone `inert` en todos los hijos de `<body>` (también modales abiertos
  después) y muestra el aviso; su contenedor lleva `data-react-aria-top-layer` para que un modal
  abierto no lo oculte a los lectores de pantalla.
- `/api/version` responde la versión del despliegue (`NEXT_PUBLIC_APP_VERSION`, la fija
  `next.config.ts` al construir): sirve para el aviso «Hay una versión nueva» y como sonda de
  conexión. El `matcher` de `src/proxy.ts` excluye esas rutas **exactas** (`offline$`, …), sin
  sesión: `manifest.webmanifest`, `sw.js`, `offline` y `api/version` (`__test__/src/proxy.test.ts`).
- E2E: `context.setOffline` también corta la red del service worker; `page.route` no ve las
  peticiones que pasan por él, así que esas pruebas usan `test.use({ serviceWorkers: 'block' })`.
  Chromium sin ventana no informa errores de instalabilidad (`Page.getInstallabilityErrors`
  siempre vacío): se prueba el manifiesto con `Page.getAppManifest`.

## Órdenes de trabajo (spec 008)

- Una orden (`work_orders` + líneas, participación de empleados y pagos) **solo se escribe por
  funciones** `security definer` que comprueban rol y estado: `save_work_order`, `close_work_order`,
  `correct_work_order` y `void_work_order`. Nadie tiene `insert/update/delete` sobre esas tablas.
  Totales, estimado y nombres del personal salen de la vista `work_order_summaries`.
- Cada línea copia el nombre, el valor y el tiempo del servicio al añadirse: cambiar el catálogo no
  altera ninguna orden. Las utilidades del editor (`order-totals`, `order-estimate`, `shares`) son
  puras y probadas; el editor solo las muestra.

## Agenda y reservas (spec 012)

- **Reservan el personal y el cliente** (el cliente desde su área, spec 014). Toda la lógica vive en
  Postgres: `save_reservation`, `cancel_reservation`, `mark_reservation_no_show`,
  `set_reservation_tolerance` (solo admin), `save_agenda_week` y `save_agenda_settings` (solo
  admin), todas `security definer`; las tablas solo se leen (staff) y nadie las escribe ni borra
  directamente. Franjas y puestos libres salen de `agenda_slots(día)`; cada reserva, de la vista
  `reservation_summaries` (tolerancia efectiva, `grace_until`, «Fuera del horario», «Sobrecupo»).
- **Semanas:** el admin habilita cada semana (lunes a domingo) desde «Agenda» → «Horario»; se propone
  de 9:00 a. m. a 6:00 p. m. todos los días y se cierra o ajusta cada día. Sin semana habilitada no
  se reserva. Una sola configuración: duración de franja, puestos y tolerancia general.
- **Cupo:** `save_reservation` bloquea la fila del día (`for update`) antes de contar: dos reservas a
  la vez nunca superan los puestos (`__test__/sandbox/reservations.sandbox.test.ts`).
- **Hora de turno (RN-04):** la cola de «Órdenes» va por `turn_at` (la llegada, o la hora reservada
  si llegó dentro de su tolerancia; ante empate, primero la reserva) y muestra las «Reserva por
  llegar» (`work-orders/utils/queue.utils.ts`). `save_work_order(…, p_reservation_id)` fija el turno
  y marca la reserva atendida en la misma transacción.
- **«Llegó»** abre `/orders/new?reservation=…` (cliente fijo, vehículo y servicios ya puestos); si el
  vehículo ya tenía su orden abierta, `/orders/{id}?reservation=…` la enlaza al guardar.
  `CustomerPicker` tiene `purpose="reservation"` (vehículo opcional, «Registrar cliente») y
  `customerLocked`.
- **Al día sin recargar (HU-06):** `core/components/realtime-refresh` (en el layout con sesión, solo
  personal) escucha por Realtime los cambios de órdenes, reservas y agenda (publicadas en
  `supabase_realtime`; Realtime respeta RLS) y hace `router.refresh()` agrupando ráfagas, solo en
  inicio, «Órdenes» y «Agenda» (en otras pantallas costaría peticiones sin mostrar nada nuevo); también al
  volver a la pestaña. Lo que depende de la hora usa `useNow` (cuenta regresiva de la «Reserva por
  llegar», franjas que empiezan, «Pasó su tolerancia»). «+5 min» (`extend_reservation_tolerance`)
  lo usa cualquier miembro del personal, hasta 60, y queda registrado (`reservation_extensions`: el
  detalle lo lista, la cola y la agenda lo resumen). El sandbox local arranca con Realtime.
- **El reloj en pgTAP:** todo lo que mira la hora llama a `private.agenda_now()`; la prueba la
  sustituye por una hora fija (`test.now`) dentro de su transacción. Las E2E escriben las reservas
  que dependen de la hora con la clave secreta, relativas a ahora.

## Área del cliente (spec 014)

- **Rutas:** el cliente con cuenta entra a `/my` («Inicio»): su vehículo en el lavadero y su próxima
  reserva. También tiene `/my/history` (historial con todo el detalle, de 10 en 10 con `?before=`),
  `/my/reservations` (reservar, cambiar, cancelar) y «Mi perfil». `access.utils` (`CUSTOMER_HOME`)
  y `NAV_LINKS` lo reflejan.
- **Lecturas:** todo lo que lee el cliente sale de funciones `security definer` que devuelven solo
  sus filas y campos permitidos: `my_shop_orders` («Van N antes» con la regla del turno),
  `my_order_history`, `my_reservations`, `bookable_day` y `bookable_services`. Las tablas y vistas
  del personal siguen cerradas para él (sin nombres de empleados ni del personal).
- **Reservas:** el cliente usa `save_reservation` y `cancel_reservation`, que tienen una rama para
  él: solo lo suyo, una reserva pendiente por vehículo y una «Sin vehículo» (RN-03); nunca la
  tolerancia. Las reservas registran `booked_by_customer`, `updated_by_customer` y
  `cancelled_by_customer`, y el rastro del personal lo dice.
- **Al día:** `PollRefresh` (`core`) refresca cada 15 s mientras la pestaña está visible en `/my` y
  `/my/reservations`. No usa Realtime: el cliente no puede leer las filas y la cola depende de
  órdenes de otros.
- **Tipos:** el generador marca no nulas todas las columnas que devuelve una función;
  `customer-area.types.ts` dice cuáles pueden ser nulas (`WithNulls`, en `core/types`).

## Reporte de servicios (spec 015)

- **Solo el administrador.** «Reportes» (`/reports`, que lleva a `/reports/services`) sale en su menú y
  en su inicio. La página responde `NoPermission` a los demás; la descarga, 403; y las funciones
  `service_report` y `service_report_totals` (`security definer`) lo exigen en la base
  (`report_admin_only`).
- **Un solo conjunto filtrado:** filas, totales y Excel salen de `private.report_lines`: servicios de
  órdenes cerradas, por día de cierre en Colombia, empleado y placa entera normalizada. Sin
  `p_limit` devuelve todas las filas (el Excel); la pantalla va de 50 en 50. Con filtro de empleado,
  descuentos y total son nulos (el descuento es de la orden).
- **Filtros en la dirección:** `reportFiltersSchema(hoy)` los lee (lo inválido vuelve al mes en curso);
  `reportHref` y `exportHref` los escriben, siempre con el periodo, para que un enlace copiado abra
  los mismos días.
- **Excel:** `services-workbook.lib` arma las celdas (fecha como fecha, valores como número con
  formato de pesos) y el *route handler* las escribe con `write-excel-file/node`.
- **Un `Select` que se pinta en el servidor** (no dentro de un modal) lleva un `id` fijo: si no, el
  `<select>` oculto de React Aria cambia de id al hidratar. Los empleados desactivados van aparte, al
  final, en un `SelectSection` «Desactivados».
- Un enlace con aspecto de botón (descargar, «Quitar filtros») es un `<a>`/`Link` con
  `button(…)` de `@heroui/theme`: `Button as={Link}` conserva el rol «button».

## Autenticación y permisos (specs 002 y 004)

- Dos tipos de cuenta, nunca ambos a la vez: **personal** en `public.profiles` (rol
  `operator`/`admin`, estado `invited`/`active`/`disabled`) y **clientes** en `public.customers`
  (con cuenta, sin cuenta del punto de atención o desactivados). Rol y estado **no** se leen del
  JWT: se consultan en cada petición (`current_account()` en el proxy).
- **Registro público solo para clientes**: el personal nace únicamente de una invitación
  pendiente (`public.staff_invitations`, que solo crea un admin); nunca de los metadatos del alta,
  que escribe cualquiera (spec 004, RN-11). El cliente existe al confirmar su correo.
- Tres capas: `src/proxy.ts` (`decideAccess`, en cada petición) → en páginas `requireAccount()`,
  `getStaffForPage()` (un cliente recibe «No tienes permiso») o `requireCustomer()`, y en Server
  Actions `getActiveStaff()` / `getActiveAdmin()` / `getActiveCustomer()`
  (`modules/auth/api/auth.server.ts`) → RLS y guardas en Postgres.
- Clientes Supabase: `supabase-server.lib.ts` (sesión del usuario, por defecto),
  `supabase-proxy.lib.ts` (solo el proxy) y `supabase-admin.lib.ts` (secret key, solo servidor y
  solo para lo que la sesión del usuario no puede hacer, tras comprobar permisos).
- Los errores de Auth se traducen con `mapAuthError`; los mensajes no revelan si un correo existe.
- Componentes HeroUI llevan `'use client'`. Las tablas de HeroUI se exponen como `grid` (ARIA).

## Los tests son documentación (obligatorio)

1. Cada archivo de test abre con un comentario: unidad bajo prueba, su papel en el negocio, las
   reglas que protege y la spec/criterio que cubre (`spec 003, CA-02`).
2. `describe`/`it` se leen como especificación: «hace X cuando Y (porque Z)».
3. Casos no obvios llevan el porqué; las expectativas numéricas muestran la cuenta.
4. Cubre la matriz: camino feliz, cada variante, límites (0, vacío, negativo) e invariantes.
5. Fixtures con builders con valores por defecto + `overrides`.
6. Deterministas: sin red real, reloj real ni aleatoriedad.
7. Las descripciones dicen exactamente lo que se asserta.

## Definición de terminado (obligatoria antes de dar algo por terminado)

1. **Tests** escritos/ampliados para el comportamiento cambiado y en verde. Cada test nuevo se
   ha **visto fallar** (escrito antes del código, o mutando el código, observando el fallo y
   revirtiendo). Reporta qué mutación se aplicó y comprueba con `git diff` + grep que no quedó.
2. **E2E** (Playwright) para funcionalidades nuevas o cambios grandes.
3. **Tipos**: `pnpm ts:check`.
4. **Build**: `pnpm build`.
5. **Migraciones**: `pnpm db:reset`, `pnpm db:test` y `types:check` en verde (ver
   `packages/supabase/CLAUDE.md`).
6. La spec, el plan y las tareas reflejan lo implementado.

Si algo no se puede ejecutar en el entorno, dilo explícitamente y nombra el comando pendiente.

## Flujo SDD

1. `/especificar <descripción>` → `specs/NNN-slug/spec.md` (qué y por qué).
2. El usuario **aprueba** la spec.
3. `/planificar NNN` → `plan.md` (cómo, con este stack).
4. `/desglosar NNN` → `tasks.md`.
5. `/implementar NNN` → ejecuta las tareas en una rama `feature/NNN-slug` desde `develop`.
6. `/verificar NNN` → contrasta el código con cada criterio de aceptación.

No escribas código de producto sin una spec `aprobada` o posterior (excepciones en la
constitución). Si la spec es ambigua o incorrecta, detente y propón el cambio de spec.

## Despliegue

- **Vercel**: proyecto con *Root Directory* `apps/web`; pnpm y Turborepo se detectan solos.
  Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` por entorno.
- **Supabase**: las migraciones llegan al proyecto remoto con el workflow `db-deploy` al entrar
  en `develop` (secret `SUPABASE_DB_URL`). Nunca se edita el esquema desde el dashboard.
- **CI** (`.github/workflows/ci.yml`): lint, tipos, unit, build, E2E y validación de Supabase en
  cada PR.

## No hacer

- No hagas commits ni push salvo que el usuario lo pida.
- No uses `supabase link` ni un `supabase` global: usa los scripts del paquete (CLI fijado).
- No edites `packages/supabase/types/database.types.ts` a mano.
- No añadas funcionalidades fuera de la spec.
