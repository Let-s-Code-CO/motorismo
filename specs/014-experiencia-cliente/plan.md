---
spec: "014"
estado: aprobado
actualizado: 2026-11-21
---

# Plan técnico — 014 Experiencia del cliente con cuenta

## Resumen

- **Datos del cliente, por funciones:** lo que ve el cliente sale de funciones `security definer`
  que solo devuelven sus filas y solo los campos permitidos: su vehículo en el lavadero, su
  historial y sus reservas. No se abren las tablas ni las vistas del personal a los clientes, porque
  llevan nombres de empleados y del personal (RN-01, CA-06).
- **Reservar con las mismas reglas:** el cliente usa las mismas funciones `save_reservation` y
  `cancel_reservation` que el personal, con una rama para el cliente. Las reglas de la agenda viven
  en un solo sitio (RN-02).
- **Pantallas nuevas:** un módulo `customer-area` con su inicio (`/my`), su historial y sus
  reservas. Se mantienen al día refrescándose cada 15 s mientras están a la vista (CA-05, CA-22).

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 014 aprobada; anota lo que cambia de las specs 004 y 012. |
| II. Qué antes que cómo | ✅ | Funciones, rutas y refresco se deciden aquí. |
| III. Criterios verificables | ✅ | pgTAP para cada regla de datos y permisos; componente y E2E para las pantallas (tabla abajo). |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas. Refresco por consulta periódica en vez de Realtime (ver «Riesgos y decisiones»). |
| VI. Seguridad y datos personales | ✅ | RLS de órdenes y reservas sin cambios para clientes; todo lo suyo pasa por funciones que comprueban `auth.uid()` y devuelven solo sus filas y campos. Sin nombres de empleados ni de otros clientes. |
| VII. Trazabilidad | ✅ | Rama `feature/014-experiencia-cliente`; pruebas con su CA. |
| VIII. Incrementos pequeños | ✅ | P1 (inicio e historial) se despliega sola; P2 (reservas) se apoya en ella. Si el PR crece demasiado, P2 va en otro. |

## Base de datos (packages/supabase)

Una migración: `<ts>_customer_area.sql`.

### Reservas hechas o cambiadas por el cliente

- **`reservations.created_by`** pasa a ser opcional, y se añaden:
  - `booked_by_customer boolean not null default false`;
  - `updated_by_customer boolean not null default false`;
  - `cancelled_by_customer boolean not null default false`.
- **Checks:**
  - `created_by is not null or booked_by_customer`;
  - el de «cancelada» acepta `cancelled_by is not null or cancelled_by_customer`.
- **`reservation_summaries`** (vista del personal) añade esas tres columnas al final, para el
  rastro: «Reservó el cliente desde la app» y «Cancelada por el cliente» (CA-16, CA-19).

### `save_reservation`

Rama nueva para el cliente: si quien llama no es del personal, debe ser el cliente activo
(`private.current_customer_id()`) y `p_customer_id` debe ser él (`reservation_customer_only`).

- **Mismas validaciones:** franja, día, semana, puestos con el bloqueo del día y vehículo suyo,
  activo y no repetido en la franja (RN-02).
- **Límite de la app (RN-03):** no puede tener otra reserva pendiente del mismo vehículo, ni otra
  «Sin vehículo», sin contar la que cambia (`reservation_customer_limit`, CA-15).
- **Al crear:** `created_by` nulo y `booked_by_customer`.
- **Al cambiar:** solo una reserva suya pendiente; `updated_by` nulo y `updated_by_customer`. Nunca
  toca la tolerancia (RN-05).

### `cancel_reservation`

Rama para el cliente: solo una reserva suya pendiente (RN-04, CA-20); motivo opcional; marca
`cancelled_by_customer`.

### Lecturas del cliente

Todas `security definer`, para `authenticated`. Exigen un cliente activo; si no lo es, devuelven
vacío.

- **`my_shop_orders()` → filas** (CA-01 a CA-04, CA-06): sus órdenes abiertas, con id, número,
  vehículo (tipo, marca, línea y placa), `opened_at` y `started_at`, y las líneas (nombre y tiempo,
  en `jsonb`). Para una orden en cola, `ahead`: cuántas órdenes en cola van antes. Usa la misma
  regla que la cola del personal: por turno, la reserva primero si empatan, luego por llegada (spec
  012, RN-04). No devuelve nombres de nadie.
- **`my_order_history(p_before timestamptz default null, p_limit int default 10)` → filas**
  (CA-07 a CA-11): sus órdenes cerradas, sin anuladas, las más recientes primero, paginadas por
  `closed_at < p_before`. Cada una con número, `closed_at`, vehículo, líneas (nombre y valor),
  subtotal, descuento, total y pagos (medio y valor), en `jsonb`. Incluye vehículos retirados.
- **`my_reservations(p_since date)` → filas** (CA-17): sus reservas pendientes y las demás desde
  `p_since` (30 días). Devuelve número, estado, franja, vehículo, servicios (ids y nombres),
  observación, `grace_until` (tolerancia efectiva, spec 012 RN-11) y quién la hizo o canceló (el
  cliente o el personal, sin nombres).
- **`bookable_day(p_day date)` → `jsonb`** `{ state, slots }`, con los mismos estados y franjas que
  ve el personal (`open`, `closed`, `unenabled`; franjas con puestos y ocupados). Para el cliente o
  el personal: cuenta puestos, sin datos de nadie (CA-12, CA-13).

### Servicios

`bookable_services()` (`security definer`): los servicios activos, con su nombre y para qué tipos de
vehículo se ofrecen, sin precios ni tiempos, para elegirlos al reservar (CA-12). El catálogo sigue
cerrado a los clientes (spec 007, CA-18). *Cambio al implementar: el plan abría la tabla, lo que
rompía esa regla.*

### Seeds y pruebas

- **Seeds:** en `06_reservations.sql`, una reserva pendiente para mañana hecha por
  `cliente@motorismo.test` desde la app (Camila). Así se ven «Mis reservas» y el rastro «Reservó el
  cliente desde la app». Camila ya tiene órdenes cerradas, una anulada y una abierta (#4): sirve
  para el inicio y el historial.
- **pgTAP:** `13_customer_area.test.sql`, con el reloj fijo como en la 11:
  - cada función devuelve solo lo del cliente de la sesión y vacío para otro cliente;
  - `ahead` con la regla del turno;
  - el historial sin anuladas, con valores corregidos y retirados, y su paginación;
  - el cliente reserva, cambia y cancela lo suyo, con el límite RN-03, y nunca lo de otro;
  - no cambia la tolerancia;
  - las columnas y checks nuevos;
  - privilegios: `anon` sin ejecutar nada.

## Aplicación (apps/web)

### Rutas (App Router)

Cada una con su `loading.tsx` (spec 011).

| Ruta | Qué es |
|---|---|
| `/my` | Inicio del cliente (HU-01): sus vehículos en el lavadero, su próxima reserva y accesos. |
| `/my/history` | Historial (HU-02); `?before=` para ver los anteriores. |
| `/my/reservations` | Mis reservas (HU-04). |
| `/my/reservations/new` | Reservar (HU-03). |
| `/my/reservations/[id]` | Cambiar una reserva suya. |

### Acceso

- `access.utils.ts`: `CUSTOMER_HOME = '/my'`, y las páginas del cliente son `/my…` y `/profile`.
  Se ajustan `destinationAfterSignIn` y su prueba.
- Cada página usa `requireCustomer()`: el personal va a su inicio.
- `NAV_LINKS` añade «Inicio», «Mis reservas» e «Historial» para la audiencia `customer`, con
  «Mi perfil» al final.

### Módulo `src/modules/customer-area/`

- **`api/customer-area.server.ts`:** `getMyShopOrders`, `getMyHistory(before)`,
  `getMyReservations`, `getBookableDay(date)`. Tipos derivados de las funciones
  (`Database['public']['Functions'][…]['Returns']`).
- **`actions/customer-area.actions.ts`:** `saveMyReservation` y `cancelMyReservation` con
  `getActiveCustomer()`. El cliente lo pone el servidor, nunca el navegador. Los errores, con un
  mapa como `fromReservationError` más `customerLimit` y `customerOnly`.
- **`schemas/customer-area.schema.ts`:** reserva del cliente (vehículo o nulo, franja, servicios,
  observación) con Zod.
- **Componentes:**
  - `shop-order-card`: estado, «Van N antes», servicios y «Lista hacia…» con `orderEstimate`; solo
    `complete` da hora, si no «Sin hora estimada» (CA-02).
  - `customer-home`.
  - `history-screen` y `history-order-card`: servicios con valor, descuento, total y pagos.
  - `my-reservations-screen`.
  - `my-reservation-form`: radios de sus vehículos y «Sin vehículo», `DayNav` y `SlotPicker` de la
    012, servicios y observación.
  - `cancel-my-reservation-dialog`: motivo opcional.
- **Avisos:** `notify` (spec 013), con `after` para «Reserva guardada.».
- **Mensajes:** `messages/es.json` con el namespace `customerArea`, registrado en
  `src/i18n/messages.ts`.

### Al día sin recargar (CA-05, CA-22)

`core/components/poll-refresh.component.tsx` hace `router.refresh()` cada 15 s mientras la pestaña
está visible, y al volver a ella. Va en `/my` y `/my/reservations`.

### Del lado del personal

`reservation-detail` muestra en su rastro «Reservó el cliente desde la app», «Cambió el cliente
desde la app» y «Cancelada por el cliente» (CA-16, CA-19).

## Estrategia de pruebas

| Criterio | Tipo | Prueba |
|---|---|---|
| CA-01 | pgTAP + comp. | `my_shop_orders`: en cola con `ahead` según el turno. `shop-order-card`: «En cola», «Van 2 antes», servicios y desde qué hora. |
| CA-02 | comp. | «En proceso» y «Lista hacia las 4:30 p. m.» con estimado completo; «Sin hora estimada» si falta alguno. |
| CA-03 | pgTAP + comp. | Dos órdenes abiertas → dos tarjetas. |
| CA-04 | comp. | Sin órdenes: el mensaje y los accesos. |
| CA-05 | comp. + e2e | `poll-refresh` con reloj falso (15 s, solo visible). E2E: el personal empieza la orden y el inicio del cliente cambia sin recargar. |
| CA-06 | pgTAP | Otro cliente recibe vacío; ninguna columna lleva nombres; un cliente no lee `work_orders` ni `work_order_summaries`. |
| CA-07 | pgTAP + comp. | Detalle completo; orden más reciente primero. |
| CA-08 | pgTAP | Sin anuladas; la corregida con sus valores. |
| CA-09 | pgTAP | Órdenes de un vehículo retirado. |
| CA-10 | comp. | Historial vacío. |
| CA-11 | pgTAP + comp. | Paginación por `p_before`; «Ver anteriores» con `?before=`. |
| CA-12 | pgTAP + comp. + e2e | El cliente reserva lo suyo; el formulario envía vehículo, franja, servicios y observación. E2E: reserva y ve «Puedes llegar hasta…». |
| CA-13 | comp. | Día cerrado o semana sin habilitar (`SlotPicker`, ya probado), en el formulario del cliente. |
| CA-14 | pgTAP + comp. | `reservation_slot_full` → mensaje y franjas al día. |
| CA-15 | pgTAP + comp. | `reservation_customer_limit` (mismo vehículo, segunda «Sin vehículo») → mensaje. |
| CA-16 | pgTAP + comp. | `booked_by_customer` en la vista; rastro «Reservó el cliente desde la app» en el detalle del personal. |
| CA-17 | pgTAP + comp. | Pendientes primero, pasadas recientes con su estado. |
| CA-18 | pgTAP + comp. | Cambiar lo suyo, con las mismas reglas. |
| CA-19 | pgTAP + comp. + e2e | Cancelar con motivo opcional; «Cancelada por el cliente». |
| CA-20 | pgTAP + comp. | No pendiente → rechazo; sin «Cambiar» ni «Cancelar». |
| CA-21 | pgTAP + sandbox | Otro cliente no cambia ni cancela (por la API real, con `safeupdate`). |
| CA-22 | e2e | El personal da «+5 min» y «Mis reservas» del cliente muestra la nueva hora sin recargar. |

Además:

- **Accesibilidad:** `a11y.spec.ts` añade las cuatro pantallas del cliente, en claro y oscuro.
- **Móvil:** `ui.spec.ts` añade sus rutas a la prueba del iPhone, sin desplazamiento lateral.
- **Esqueletos:** `loading-coverage.test.ts` cubre las rutas nuevas.
- **Acceso:** `access.utils` con el nuevo inicio, y E2E de que el cliente entra a `/my`.

Cada prueba nueva se ve fallar con una mutación, que se anota en `tasks.md`.

## Archivos afectados

- **Nuevos:**
  - la migración y `13_customer_area.test.sql`;
  - el módulo `customer-area`;
  - las rutas `/my…` con sus `loading.tsx`;
  - `core/components/poll-refresh.component.tsx`;
  - sus pruebas y `e2e/customer-area.spec.ts`.
- **Modificados:**
  - `06_reservations.sql` y `database.types.ts` (generado);
  - `access.utils.ts`, `nav.constants.ts` y `messages.ts`;
  - `reservation-detail` (rastro) y `reservations` (tipos y errores);
  - E2E: `a11y`, `ui` y las de acceso del cliente (`customer-access.spec.ts`, que espera
    «Mi perfil» al entrar);
  - `CLAUDE.md` (sección del cliente) y `packages/supabase/CLAUDE.md` (seed);
  - spec 004 (anotar el cambio) y spec 012 (RN-05 y RN-06).
- **Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Funciones `security definer` con solo los campos permitidos. | Abrir RLS de `work_orders`, `reservations` y sus vistas a los clientes. | Las vistas llevan nombres del personal y de empleados (fuera de alcance mostrarlos) y la cola necesita contar órdenes de otros sin verlas. Con funciones, la superficie es explícita y probada. |
| Refresco cada 15 s mientras se ve, solo en `/my` y `/my/reservations`. | Realtime (`postgres_changes`). | Realtime solo envía filas que el cliente puede leer: habría que abrirle las tablas (con `created_by`, notas…), y aun así no sabría cuándo se mueve la cola, porque depende de órdenes de otros. Por eso tampoco se usa Realtime Broadcast, que exigiría disparadores y canales privados. 15 s cumple «en pocos segundos» con un costo acotado: unas 4 peticiones por minuto por cliente con la pantalla abierta. |
| `save_reservation` y `cancel_reservation` con rama para el cliente. | Funciones aparte para el cliente. | RN-02: las reglas de la agenda en un solo sitio. Las pruebas de la 012 siguen protegiendo la rama del personal. |
| El límite RN-03 cuenta cualquier reserva pendiente del vehículo, la haya hecho quien la haya hecho. | Contar solo las que hizo el cliente. | El límite evita ocupar puestos de más con un mismo vehículo; para más, el personal. |
| Rutas en `/my…`, inicio del cliente en `/my`. | Reusar `/` con dos inicios. | `/` es el inicio del personal y el proxy ya distingue por audiencia; `/my` mantiene las reglas simples (prefijo). |

## Despliegue

Primero la migración (`db-deploy` al entrar en `develop`), después la app. Sin variables nuevas.
