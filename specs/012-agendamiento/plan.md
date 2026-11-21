---
spec: "012"
estado: aprobado
actualizado: 2026-11-21
---

# Plan técnico — 012 Agendamiento de reservas

## Resumen

Toda la lógica de la agenda vive en Postgres, como en las órdenes (spec 008):
- tablas de configuración, semanas, días, reservas y sus servicios, con RLS de solo lectura para
  el personal;
- funciones `security definer` que comprueban rol, estado, franja y cupo, con un bloqueo por día
  para que dos reservas simultáneas no se lleven el mismo puesto;
- una función que calcula las franjas de un día con sus puestos libres.

La orden gana una **hora de turno**. `save_work_order` acepta la reserva de origen, calcula el turno
(RN-04) y marca la reserva como atendida en la misma transacción.

En la app hay un módulo nuevo, `reservations`, con «Agenda» (día), «Nueva reserva», el detalle y
el «Horario» del administrador. «Llegó» abre «Nueva orden» con la reserva ya puesta. La cola de
«Órdenes» se ordena por turno e intercala las reservas por llegar.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 012 aprobada. Cambia el CA-18 de la 008: se registra como enmienda allí en el mismo PR. |
| II. Qué antes que cómo | ✅ | Tablas, funciones y rutas solo aparecen aquí. |
| III. Criterios verificables | ✅ | Los 32 criterios tienen prueba (tabla de abajo). Cada regla de Postgres va en pgTAP; la concurrencia (CA-06), en una prueba de sandbox con dos peticiones a la vez. |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas. La fecha se elige con el campo de fecha nativo (ver «Riesgos y decisiones»). |
| VI. Seguridad y datos personales | ✅ | RLS en las tablas nuevas, solo lectura para el personal y nada para clientes. Las escrituras solo por funciones que comprueban el rol. No se guarda ningún dato personal nuevo: la reserva apunta al cliente. |
| VII. Trazabilidad | ✅ | Rama `feature/012-agendamiento`; cabeceras de prueba con sus CA. |
| VIII. Incrementos pequeños | ✅ | Tres bloques (A: horario y reservar; B: llegada y cola; C: cambiar, cancelar, no asistió y tolerancia propia), que se pueden revisar por separado en el mismo PR, como la spec 008. |

## Base de datos (packages/supabase)

### Migración nueva: `<timestamp>_reservations.sql`

Se crea con `migration:new reservations`, con versión posterior a `20261120174652_work_orders`.

**Tipo nuevo:** `reservation_status`: `pending`, `attended`, `cancelled` y `no_show`.

**`agenda_settings`** — una sola fila (`id boolean primary key default true check (id)`):
- `slot_minutes smallint not null default 60`, con `check (slot_minutes between 15 and 240 and
  slot_minutes % 15 = 0)`;
- `seats smallint not null default 2 check (seats between 1 and 20)`;
- `tolerance_minutes smallint not null default 15 check (tolerance_minutes between 0 and 60)`;
- `updated_at`, `updated_by`.

La fila por defecto se inserta en la migración (`on conflict do nothing`), porque la necesita todo
entorno.

**`agenda_weeks`** — una fila por semana tocada por el administrador:
- `week_start date primary key`, con `check (extract(isodow from week_start) = 1)` (lunes);
- `enabled boolean not null default false`;
- `updated_at`, `updated_by`.

**`agenda_days`** — siete filas por semana:
- `day date primary key`;
- `week_start date not null references agenda_weeks`, con `check (day between week_start and
  week_start + 6)`;
- `is_open boolean not null default true`;
- `opens_at time not null default '09:00'` y `closes_at time not null default '18:00'`, con
  `check (closes_at > opens_at)`.

Que el día tenga al menos una franja completa depende de `slot_minutes`, que puede cambiar, así que
se comprueba en la función que guarda, no con un `check`.

**`reservations`:**
- `id`, `customer_id` (not null) y `vehicle_id` (nullable) referencian `customers` y `vehicles`;
- `slot_start timestamptz` y `slot_end timestamptz`, con `check (slot_end > slot_start)` (RN-08:
  guardar la franja no la ata a la configuración);
- `notes` (≤ 500) y `tolerance_minutes smallint null check (0..60)`, la tolerancia propia (RN-11);
- `status reservation_status not null default 'pending'`;
- `created_at/by`, `updated_at/by`, `cancelled_at/by`, `cancel_reason` (≤ 200),
  `no_show_at/by` y `attended_at/by`;
- `work_order_id uuid unique references work_orders` (RF-04);
- checks de coherencia como en `work_orders`: atendida ⇔ tiene orden y fecha; cancelada ⇔ tiene
  fecha; etc.

Índices:
- único parcial `(vehicle_id, slot_start) where status = 'pending'` (RN-03, CA-08);
- `(slot_start)` para el día;
- `(customer_id)`.

**`reservation_services`:** `reservation_id`, `service_id` y `position`, con
`primary key (reservation_id, service_id)` y `on delete cascade` desde la reserva (al editarla se
reescriben).

**`work_orders` + 1 columna:** `turn_at timestamptz` (nullable). El enlace entre la orden y su
reserva vive solo en `reservations.work_order_id` (único), y `work_order_summaries` lo expone como
`reservation_id`: guardar el enlace en los dos lados lo duplicaría.

**Número de reserva:** `reservations.number` (identidad, como en las órdenes) da el orden en que se
hicieron las reservas. Desempata «Sobrecupo» (CA-31) aunque dos reservas tengan el mismo
`created_at`.

**El reloj:** todo lo que mira la hora llama a `private.agenda_now()` (que devuelve `now()`). La
prueba pgTAP la sustituye dentro de su transacción por una hora fija, para ser determinista a
cualquier hora.

Las órdenes sin reserva lo dejan vacío y su turno es `coalesce(turn_at, opened_at)`. **No
transforma datos existentes**: ninguna orden cambia de lugar en la cola (ver «Riesgos y
decisiones»).

### Funciones (todas `security definer`, `search_path = ''`, errores con `hint` como en la 008)

**Ayudantes privados:**
- `private.business_today()`: la fecha de hoy en `America/Bogota` (RN-09).
- `private.reservation_turn_at(p_arrival, p_slot_start, p_tolerance) immutable` (RN-04):
  - si `p_arrival ≤ p_slot_start + tolerancia`, devuelve `least(p_arrival, p_slot_start)`
    (CA-16, CA-17);
  - si no, devuelve `p_arrival`.
- `private.reservation_tolerance(r)`: `coalesce(r.tolerance_minutes, settings.tolerance_minutes)`
  (RN-11).
- `private.slot_is_bookable(p_slot_start, p_slot_end)`. La franja tiene que:
  - caer en un día abierto de una semana habilitada;
  - estar alineada con la apertura y la duración actuales;
  - terminar antes o en el cierre;
  - no haber empezado (RN-01).

**Lectura** (`security invoker`, `stable`): `public.agenda_slots(p_day date)` devuelve cada franja
del día con:
- `slot_start` y `slot_end`;
- `seats`;
- `taken`: reservas pendientes o atendidas que se solapan con la franja, así que reservas de otra
  duración también cuentan (RN-02, CA-29);
- `started`: si la franja ya empezó (`slot_start <= now()`).

Un día cerrado o de una semana sin habilitar no devuelve franjas; su estado lo dice la consulta del
día.

**Personal (operador o administrador):**
- `save_reservation(p_customer_id, p_vehicle_id, p_slot_start, p_service_ids uuid[], p_notes, p_id
  default null)` (CA-01 a CA-08, CA-20):
  - comprueba el cliente activo, que el vehículo sea suyo y no esté retirado, la franja reservable
    y los servicios activos (con precio para el tipo, si hay vehículo);
  - **bloquea la fila del día** (`select … from agenda_days where day = … for update`) y después
    cuenta los puestos, así dos reservas simultáneas se ordenan y la segunda ve el cupo lleno
    (`reservation_slot_full`);
  - al editar, solo si está pendiente; el cupo de la franja nueva se cuenta sin la propia reserva.
- `cancel_reservation(p_id, p_reason default null)` (CA-21).
- `mark_reservation_no_show(p_id)` (CA-22): solo si está pendiente y
  `now() ≥ slot_start + tolerancia`.
- `save_work_order(…, p_reservation_id uuid default null)`: se borra y se vuelve a crear con el
  parámetro nuevo, con los mismos permisos (CA-12, CA-13). Con reserva:
  - bloquea la reserva y exige que esté pendiente, que sea de hoy (`slot_start` en
    `business_today()`) y del mismo cliente (CA-19);
  - guarda `turn_at = reservation_turn_at(now(), slot_start, tolerancia)` y `reservation_id`;
  - marca la reserva `attended`, con su `work_order_id`.

  Con `p_id` (el vehículo ya tenía su orden abierta, suposición de la spec), se enlaza a esa orden
  si no está empezada ni tiene reserva, y el turno se calcula con su `opened_at`.

**Solo administrador:**
- `save_agenda_week(p_week_start date, p_days jsonb, p_enabled boolean)` (CA-26 a CA-28, CA-30):
  - crea o actualiza la semana y sus siete días;
  - valida cada día abierto (cierre posterior a la apertura y al menos una franja completa);
  - si falla, el error dice qué día (`agenda_day_invalid`, con la fecha en el `hint`
    `agenda_day_invalid:YYYY-MM-DD`).
- `save_agenda_settings(p_slot_minutes, p_seats, p_tolerance_minutes)` (CA-27, CA-30).
- `set_reservation_tolerance(p_id, p_minutes)` (CA-24, CA-25): `null` vuelve a la general; solo si
  está pendiente.

### Vista `reservation_summaries` (`security_invoker`)

Cada reserva con:
- cliente (nombre y celular), vehículo (tipo, placa, marca y línea) y servicios (`array_agg` de
  nombres en orden);
- `effective_tolerance_minutes` y `grace_until`, que es `slot_start + tolerancia`;
- nombres de quién creó, cambió, canceló, marcó o atendió (`private.staff_name`);
- número de la orden;
- `out_of_hours`: su franja ya no es reservable por horario (día cerrado, semana sin habilitar o
  fuera de la apertura y el cierre);
- `over_capacity`: en alguna franja que toca hay más reservas activas que puestos, y ella no está
  entre las primeras por `created_at` (CA-29).

`work_order_summaries` suma `reservation_id`, `reserved_start` (el `slot_start` de su reserva) y
`turn_at = coalesce(o.turn_at, o.opened_at)`.

### RLS y privilegios

- Tablas nuevas con RLS activado: `select` solo para `is_staff()`; sin `insert`, `update` ni
  `delete` para nadie (`revoke all` + `grant select`). Un cliente no ve nada (RN-06).
- Las funciones públicas: `revoke all from public`, `grant execute to authenticated`. Cada una
  comprueba `is_staff()` o `is_admin()`.

### Seeds y pruebas

**Seeds:** `seeds/06_reservations.sql`, como el primer admin y con las mismas funciones:
- habilita la semana actual y la siguiente, con todos los días de 9:00 a. m. a 6:00 p. m.;
- crea reservas pendientes para mañana: Camila a las 10:00 a. m. con «Lavado detallado» y su
  Suzuki; Valentina a las 10:00 a. m. sin servicios;
- crea una cancelada.

Las fechas son relativas a `current_date`, para que un `db:reset` siempre tenga agenda.

**pgTAP: `tests/11_reservations.test.sql`:**
- estructura, checks, índices, RLS, políticas y privilegios (`table_privs_are` y
  `function_privs_are`);
- matriz de `reservation_turn_at`:
  - temprano → llegada;
  - a la hora → la hora reservada;
  - dentro de la tolerancia → la hora reservada;
  - en el límite exacto → la hora reservada;
  - pasada la tolerancia → llegada;
  - tolerancia 0;
- `agenda_slots` (franjas, alineación, última franja completa, solapes);
- reglas de `save_reservation` (cada rechazo con su `hint`);
- llegada, cancelación, no asistió y tolerancia propia;
- semana y configuración (validaciones y que solo el admin);
- `save_work_order` con reserva (turno, atendida, una sola vez).

Para lo que depende de la hora, la prueba inserta reservas directamente (como `postgres`) con
`slot_start` relativo a `now()`. Así es determinista a cualquier hora.

**pgTAP: `tests/10_work_orders.test.sql`:** se ajusta a la firma nueva de `save_work_order`.

## Aplicación (apps/web)

**Módulo:** `src/modules/reservations/`, con la estructura habitual: `api/`, `actions/`,
`components/`, `constants/`, `queries/`, `schemas/`, `types/`, `utils/` y `messages/es.json`, que
se registra en `src/i18n/messages.ts`.

**Rutas** (cada una con su `loading.tsx` y su variante; se amplía la tabla de
`loading-coverage.test.ts`):

| Ruta | Qué | Variante del esqueleto |
|---|---|---|
| `/agenda?date=YYYY-MM-DD` | El día: franjas, puestos libres y reservas (CA-09, CA-10). Hoy por defecto, en hora de Colombia. | `list` |
| `/agenda/new?date=…&start=…` | «Nueva reserva», con la franja elegida si se llega desde la agenda (CA-01 a CA-05). | `form` |
| `/agenda/[id]` | Detalle (CA-11), con «Editar» (CA-20), «Cancelar», «No asistió», «Llegó» y la tolerancia (admin). | `detail` |
| `/agenda/schedule?week=…` | «Horario» (solo admin): la semana con sus siete días, habilitar o deshabilitar, y la configuración (CA-26 a CA-30). Un operador recibe «No tienes permiso». | `form` |

`/orders/new?reservation=<id>` abre «Nueva orden» con la reserva: cliente, vehículo y servicios
con valores y tiempos del catálogo actual. Los servicios que ya no aplican no se copian y se avisa
(RN-07).

**Componentes:**
- **Átomos:** `reservation-status-chip` (pendiente, atendida, cancelada, no asistió;
  `Fuera del horario` y `Sobrecupo` como avisos).
- **Moléculas:**
  - `slot-picker`: botones por franja con «1 de 2 libres»; los llenos y los empezados,
    deshabilitados;
  - `day-nav`: anterior, «Hoy», siguiente y el campo de fecha nativo;
  - `reservation-row`;
  - `day-schedule-row`: un día de la semana con abierto o cerrado y sus horas.
- **Organismos:**
  - `agenda-screen`;
  - `reservation-form`, que reutiliza `CustomerPicker` de `work-orders` con el vehículo opcional y
    añade servicios, franja y observaciones;
  - `reservation-detail`;
  - `cancel-reservation-dialog`;
  - `tolerance-dialog`;
  - `schedule-screen`.

**Datos:**
- **Servidor** (`reservations.server.ts`), con la sesión del usuario:
  - `getAgendaDay(date)`: estado del día, `agenda_slots` y `reservation_summaries` del día;
  - `getReservation(id)`;
  - `getAgendaWeek(weekStart)`: si no existe, propone los siete días de 9:00 a. m. a 6:00 p. m.
    (RN-10);
  - `getAgendaSettings()`;
  - `listArrivingReservations()`: pendientes con `slot_start ≤ now() ≤ grace_until`, para la cola.
- **Server Actions** (`reservations.actions.ts`), todas llamadas con `callAction` desde los
  componentes, porque lo exige `call-action-coverage`:
  - `saveReservation`, `cancelReservation`, `markNoShow`, `setReservationTolerance`;
  - `saveAgendaWeek`, `saveAgendaSettings`.
- **Órdenes:** `saveWorkOrder` acepta `reservationId`.
- **Recarga:** tras cada acción, `router.refresh()`, como en las órdenes. La agenda se carga en el
  servidor y no hace falta caché de TanStack Query.

**Utilidades puras** (probadas):
- `queue.utils.ts` (en `work-orders`): orden de la cola por turno, primero la reserva ante empate y
  luego por llegada; intercala las «Reserva por llegar» sin número de turno (CA-14, CA-15,
  CA-18).
- `agenda-date.utils.ts`: hoy en Colombia, lunes de una semana, días de la semana, sumar días y
  `date` válida de la URL.
- `reservation-lines.utils.ts`: servicios de una reserva → líneas iniciales de la orden con el
  catálogo actual, separando los que no aplican (RN-07).
- `reservations-errors.utils.ts`: `hint` → clave de mensaje.

**Formularios** (Zod + React Hook Form):
- `reservation.schema.ts`: cliente y franja obligatorios; vehículo, servicios y observaciones
  opcionales.
- `agenda-week.schema.ts`: cada día abierto con cierre posterior a la apertura y una franja
  completa. Recibe `slotMinutes`.
- `agenda-settings.schema.ts`: rangos de CA-27.
- `tolerance.schema.ts`: de 0 a 60 o la general.

**«Órdenes» (spec 008):**
- `listOpenOrders` ordena por `turn_at` y `reservation_id` y sigue con `opened_at`.
- La cola usa `queue.utils`. Las órdenes con reserva muestran «Reserva 9:00 a. m.», y las
  reservas por llegar se dibujan en su lugar, en otro tono y sin turno.
- El detalle de la orden enlaza a su reserva.

**Navegación:**
- `NAV_LINKS` suma `{ href: '/agenda', key: 'agenda', icon: CalendarClock }` después de
  «Órdenes», para el personal.
- Textos en `auth.header.agenda` y `auth.home.agendaTitle` / `agendaText`. El mosaico del inicio
  sale de la misma lista.

**Horas y fechas:**
- Horas con `useClock` («9:00 a. m.»).
- Fechas con next-intl (`dateStyle`) y por separado de la hora, como pide `CLAUDE.md`.
- La zona horaria es la de `TIME_ZONE` (`America/Bogota`).

**Mensajes:** `reservations` en `messages/es.json`, con todo lo visible: estados, avisos, errores
y vacíos («No hay reservas este día», «Cerrado», «Semana sin habilitar»).

## Estrategia de pruebas

Leyenda: **pgTAP** = `tests/11_reservations.test.sql`; **unit/comp.** = Vitest en
`__test__/src/modules/reservations/…`; **e2e** = `e2e/reservations.spec.ts`.

| Criterio | Tipo | Prueba |
|---|---|---|
| CA-01 | comp. + e2e | `reservation-form`: buscar y elegir cliente; un solo vehículo ya elegido; vehículo opcional. e2e: reservar a Camila. |
| CA-02 | comp. | `reservation-form`: registrar un cliente sin cuenta desde la reserva y quedar elegido (reutiliza la prueba del picker de la 008). |
| CA-03 | pgTAP + comp. | `agenda_slots`: franjas del día, última completa, `started`, sin franjas si está cerrado o sin habilitar. `slot-picker`: llenas y en curso deshabilitadas, las terminadas fuera (y aviso si no queda ninguna), «1 de 2 libres», «Cerrado», «Semana sin habilitar». |
| CA-04 | pgTAP + comp. | Rechazo de un servicio inactivo o sin precio para el tipo. Comp.: solo se ofrecen los activos para el tipo. |
| CA-05 | pgTAP + e2e | Queda `pending` con quién y cuándo y ocupa un puesto (`taken`). e2e: aparece en la agenda y se anuncia. |
| CA-06 | sandbox | `reservations.sandbox.test.ts`: dos `save_reservation` simultáneas sobre el último puesto → una sola se guarda; la otra recibe `reservation_slot_full`. |
| CA-07 | pgTAP + comp. | Rechazo de un cliente desactivado o un vehículo retirado. Comp.: no se ofrecen. |
| CA-08 | pgTAP | Segunda reserva pendiente del mismo vehículo en la franja → `reservation_vehicle_taken`; en otra franja, sí. |
| CA-09 | comp. + e2e | `agenda-screen`: franjas en orden, puestos libres, filas con cliente, celular, vehículo, servicios y estado; «En curso», «Ya pasó» y las terminadas sin reservas ocultas, con su conteo. |
| CA-10 | unit + e2e | `agenda-date.utils`: días anterior y siguiente, fecha inválida → hoy. e2e: navegar y recargar conserva la fecha. |
| CA-11 | comp. | `reservation-detail`: todos los campos, la tolerancia general o propia y la trazabilidad. |
| CA-12 | unit + e2e | `reservation-lines.utils`: líneas con el valor actual y los que no aplican separados. e2e: «Llegó» → «Nueva orden» con cliente, vehículo y servicios. |
| CA-13 | pgTAP + e2e | Con reserva: orden abierta, reserva `attended` y enlazada; sin guardar, sigue `pending`. |
| CA-14 | unit + e2e | `queue.utils`: orden por turno. e2e: la orden con reserva muestra «Reserva …». |
| CA-15 | unit + pgTAP | `queue.utils` con el caso de 8:00 y 9:00 (empate → reserva primero, aunque se guardó después). pgTAP: `turn_at` de cada orden. |
| CA-16 | pgTAP | `reservation_turn_at`: 9:10 con 15 min → 9:00; 9:40 → 9:40. |
| CA-17 | pgTAP | `reservation_turn_at`: 8:45 → 8:45. |
| CA-18 | unit + e2e | `queue.utils`: «Reserva por llegar» en su lugar, sin turno; fuera de `grace_until`, no aparece. e2e: reserva insertada en el pasado reciente aparece en la cola. |
| CA-19 | pgTAP + comp. | Llegada de una reserva de otro día o no pendiente → rechazo. Comp.: «Llegó» solo si es de hoy y pendiente. |
| CA-20 | pgTAP + e2e | Editar franja con cupo; la vieja recupera su puesto; editar una no pendiente → rechazo. e2e: mover una reserva. |
| CA-21 | pgTAP + e2e | Cancelar con motivo opcional, libera el puesto y queda visible. |
| CA-22 | pgTAP + comp. | «No asistió» antes de `grace_until` → rechazo; después, sí. Comp.: el botón solo aparece pasado ese momento. |
| CA-23 | pgTAP | Cada transición desde atendida, cancelada o no asistió → rechazo; sin privilegio de `delete`. |
| CA-24 | pgTAP + e2e | Tolerancia propia: cambia `grace_until` y el turno; `null` vuelve a la general. e2e (admin): 30 min. |
| CA-25 | pgTAP + comp. | Operador → `reservation_admin_only`. Comp.: el operador ve la tolerancia sin botón. |
| CA-26 | unit + e2e | `getAgendaWeek` propone los siete días de 9 a 6. e2e: habilitar del 23 al 29 y reservar. |
| CA-27 | pgTAP + comp. | Cerrar el 29 y acortar el 28 sin tocar los demás (pgTAP); formulario del día (comp.). |
| CA-28 | pgTAP | Semana deshabilitada → sin reservas nuevas; las hechas siguen. |
| CA-29 | pgTAP + comp. | Rangos de la configuración (checks y función). Comp.: errores junto al campo. |
| CA-30 | pgTAP + comp. | Día con cierre ≤ apertura o sin franja completa → `agenda_day_invalid:fecha`. Comp.: error junto al día. |
| CA-31 | pgTAP | Cerrar el día, cambiar el horario o los puestos → las reservas conservan la hora; `out_of_hours` y `over_capacity` en la vista. |
| CA-32 | pgTAP + e2e | Operador → `agenda_admin_only` en semana y configuración; e2e: «Horario» le dice «No tienes permiso». |

**Además:**
- `a11y.spec.ts`: agenda, nueva reserva (con errores a la vista), detalle y horario, en claro y en
  oscuro.
- `ui.spec.ts`, «on an iPhone»: agenda, nueva reserva y horario sin desplazamiento lateral, también
  en 360 px.
- `loading-coverage.test.ts`: las cuatro rutas nuevas con su variante.
- `call-action-coverage.test.ts`: lo cubre solo (cuenta los componentes nuevos).
- Pruebas de `nav.constants`: «Agenda» para el personal y no para clientes.

**Hora en las pruebas:** las unitarias usan fechas fijas (builders con `overrides`), sin reloj
real. Las e2e crean las reservas con `adminClient` y `slot_start` relativo a `Date.now()`, para no
depender de la hora a la que corre la CI (de noche no hay franjas reservables).

## Archivos afectados

**Nuevos:**
- `packages/supabase/supabase/migrations/<ts>_reservations.sql`;
- `packages/supabase/supabase/seeds/06_reservations.sql`;
- `packages/supabase/supabase/tests/11_reservations.test.sql`;
- `apps/web/src/modules/reservations/**`;
- `apps/web/src/app/(app)/agenda/{page,loading}.tsx`, `agenda/new/…`, `agenda/[id]/…` y
  `agenda/schedule/…`;
- `apps/web/src/modules/work-orders/utils/queue.utils.ts`;
- `apps/web/e2e/reservations.spec.ts`;
- `apps/web/__test__/src/modules/reservations/**`;
- `apps/web/__test__/src/modules/reservations/reservations.sandbox.test.ts`.

**Modificados:**
- `packages/supabase/types/database.types.ts` (generado) y `tests/10_work_orders.test.sql`;
- `work-orders`:
  - `work-orders.server.ts` (orden de la cola);
  - `work-orders.actions.ts` (`reservationId`);
  - `orders-screen` (cola con turno y reservas por llegar);
  - `new-order-screen` y `order-editor` (valores iniciales desde la reserva);
  - `order-detail` (enlace a la reserva);
  - `messages/es.json`;
- `src/app/(app)/orders/page.tsx` y `orders/new/page.tsx` (cargar reservas por llegar y la
  reserva);
- `auth/constants/nav.constants.ts` y `auth/messages/es.json`;
- `src/i18n/messages.ts`;
- `e2e/a11y.spec.ts`, `e2e/ui.spec.ts` y `__test__/src/app/loading-coverage.test.ts`;
- `CLAUDE.md`: reservas y agenda, la hora de turno y los seeds nuevos;
- `packages/supabase/CLAUDE.md`: seed 06;
- `specs/008-orden-de-trabajo/spec.md`: enmienda de CA-18;
- backlog.

**Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Franjas y cupo calculados en Postgres (`agenda_slots`, `save_reservation`) | Calcularlos en la app | Una sola verdad para mostrar y para aceptar; el cupo se cumple por cualquier vía (RN-02). |
| Bloquear la fila del día (`for update`) antes de contar | Restricción de exclusión, nivel `serializable`, `pg_advisory_xact_lock` | Las reservas de distinta duración se solapan, y una restricción no cuenta «hasta N». El bloqueo por día es simple, ordena las reservas simultáneas del mismo día y no frena otros días. |
| La reserva guarda `slot_start` y `slot_end` | Guardar «día + número de franja» | Cambiar la duración o el horario no mueve ninguna reserva (RN-08, CA-31). |
| `turn_at` nullable en la orden, con turno `coalesce(turn_at, opened_at)` | Columna obligatoria rellenada con `opened_at` | No transforma datos existentes: ninguna orden ya abierta cambia de turno. El turno se fija al llegar, así que cambiar luego la tolerancia no reordena la cola. |
| «Llegó» lleva a «Nueva orden» con la reserva, y al guardar se convierte | Crear la orden directamente al pulsar «Llegó» | La orden necesita empleados y porcentajes por línea (spec 008), y el operador revisa los servicios. Si sale sin guardar, la reserva sigue pendiente (CA-13). |
| `save_work_order` recibe la reserva | Una función aparte que convierte | La orden y la reserva atendida quedan en la misma transacción: nunca hay una sin la otra. |
| Campo de fecha nativo (`<input type="date">` de HeroUI) | `DatePicker` de HeroUI con `@internationalized/date` | Sin dependencia nueva (con `nodeLinker: isolated` habría que declararla), y el selector nativo funciona en el teléfono. Con `color-scheme` ya se adapta al oscuro (spec 010). |
| Sin caché de TanStack Query en la agenda | Consultas cliente con invalidación | Igual que «Órdenes»: datos del servidor por petición y `router.refresh()` tras cada acción. |

**Riesgos:**
- **Zona horaria:** «hoy» y las franjas se calculan en `America/Bogota` (sin cambio de hora). Las
  pruebas fijan la zona; nada usa la del servidor.
- **Firma de `save_work_order`:** cambiarla obliga a borrarla y recrearla en la migración. Las
  pruebas de la 008 cubren que sigue igual sin reserva.
- **Tamaño:** es la spec más grande hasta ahora. Se implementa en tres bloques (A, B y C) con sus
  pruebas en verde al final de cada uno.

## Ajustes durante la implementación

- **Formularios:** los tres esquemas (reserva, semana y configuración) viven en
  `reservations.schema.ts`, como pide la convención `{feature}.schema.ts`. La tolerancia propia se
  valida en el diálogo y en la acción.
- **Cambiar una reserva:** `/agenda/[id]?edit=1&date=…` (la misma ruta y su esqueleto), en vez de una
  ruta aparte. «Nueva reserva» y «Cambiar reserva» comparten `reservation-form`.
- **Cliente nuevo desde la reserva (CA-02):** `createCustomer` devuelve el id y `CustomerForm` entrega
  el cliente creado; `CustomerPicker` gana `purpose="reservation"` (vehículo opcional con «Sin
  vehículo», vehículos con orden abierta elegibles, «Registrar cliente»), `customerLocked` (CA-20),
  `initialVehicleId` (el vehículo de la reserva al llegar) y `openOrderQuery` (enlazar la reserva a la
  orden ya abierta del vehículo, que se abre editando en `/orders/{id}?reservation=…`).
- **Prueba de concurrencia:** `__test__/sandbox/reservations.sandbox.test.ts`, junto a las demás de
  sandbox: 8 reservas simultáneas sobre una franja de 2 puestos → exactamente 2.
- **Pruebas 09 y 10 de pgTAP:** vacían antes las reservas, que apuntan a servicios y órdenes.
- **«Agenda» como tablero de puestos** (pedido del usuario): cada franja es una fila con su hora y
  sus puestos libres, y un recuadro por puesto (la reserva, o «Reservar»); 2 por fila en el
  teléfono y hasta 4 en escritorio. Las canceladas y «No asistió» van aparte («No ocupan puesto»).
  Arriba, un resumen («2 reservas · 16 puestos libres»).
- **La reserva en la cola** (pedido del usuario), sin colores nuevos: etiqueta sólida «Reserva
  9:00 a. m.» y borde oscuro mientras la reserva da el turno (por llegar, punteado; o llegó a
  tiempo, continuo); con contorno y «· llegó tarde» o «· llegó antes» cuando entra por llegada
  (`reservationStanding` en `queue.utils`).
- **Ejemplos locales** (seed 06): en la franja de la hora del reset, una orden que llegó a tiempo,
  una reserva por llegar, una que llegó tarde, una que llegó antes, una sin reserva y una «No
  asistió».
- **Auditoría de accesibilidad:** `audit()` espera a que termine el fundido de entrada de la página
  (spec 011) antes de medir el contraste.

## Enmienda HU-06 — Al día sin recargar (2026-11-21)

- **Migración** `<ts>_reservations_live.sql`:
  - `extend_reservation_tolerance(p_id)` (`security definer`, personal): solo pendiente y antes de su
    `grace_until`; suma 5 minutos a la tolerancia efectiva y la guarda como propia; nunca pasa de 60
    (`reservation_tolerance_max`); pasada su tolerancia, `reservation_tolerance_passed` (CA-34).
  - Publica `work_orders`, `reservations`, `agenda_days`, `agenda_weeks` y `agenda_settings` en
    `supabase_realtime`. Realtime respeta las políticas de lectura: solo el personal recibe cambios.
  - pgTAP `12_reservations_live.test.sql`.
- **App:**
  - `core/components/realtime-refresh.component.tsx`, en el layout con sesión para el personal: se
    suscribe a esos cambios (`postgres_changes`) y hace `router.refresh()` agrupando ráfagas (500 ms);
    también al volver a la pestaña. `router.refresh()` conserva el estado del cliente (lo escrito y
    los diálogos) (CA-35).
  - Lo que depende de la hora usa el reloj de la pantalla (`useNow`): la cuenta regresiva (CA-33), las
    franjas que empiezan (CA-36) y «Pasó su tolerancia» (CA-37).
  - «+5 min» en la fila de la reserva por llegar, con `callAction` (CA-34).
- **Pruebas:** unitarias de la cuenta, el botón, las franjas y la señal; componente de
  `realtime-refresh` con el canal simulado; E2E: un cambio en la base aparece sin recargar, y «+5 min».
- **Registro de «+5 min» (CA-38):** tabla `reservation_extensions` (quién, cuándo, minutos y la
  tolerancia que dejó), solo lectura para el personal y escrita solo por
  `extend_reservation_tolerance`; vista `reservation_extension_summaries`; `reservation_summaries`
  suma `extensions` y `extended_minutes`. Va en la misma migración `reservations_live`, que aún no se
  ha aplicado en ningún entorno remoto.
- **«Volver» (CA-39):** desde la cola, el enlace lleva `?from=orders` y el detalle vuelve a
  «Órdenes».
- **Horas pasadas (CA-03, CA-09):** con el mismo reloj de la pantalla, la agenda no dibuja las
  franjas que terminaron (`slot_end <= ahora`) sin ninguna reserva, de ningún estado, y dice cuántas
  ocultó; las que terminaron con reservas dicen «Ya pasó» y la actual «En curso». `slot-picker` no
  ofrece las terminadas y avisa si no queda ninguna. Sin cambios en la base: `agenda_slots` ya
  rechaza reservar una franja empezada.
- **Sandbox:** `sandbox:start` ya no excluye Realtime.

## Despliegue

Primero la migración, que llega con `db-deploy` al entrar en `develop`; después la app. Sin
variables nuevas. En cada entorno real, el administrador habilita la primera semana desde
«Agenda» → «Horario».
