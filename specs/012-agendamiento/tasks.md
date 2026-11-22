---
spec: "012"
actualizado: 2026-11-21
---

# Tareas — 012 Agendamiento de reservas

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**. Si una ya pasa al escribirla,
  se muta el código para verla fallar (Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/012-agendamiento`, en tres bloques. Cada uno deja la app desplegable.
  - **Bloque A (P1)**: horario y reservar (HU-01, HU-02, HU-05). La base de datos se hace completa
    aquí.
  - **Bloque B (P1)**: el cliente llega y la cola con turno (HU-03).
  - **Bloque C (P2)**: cambiar, cancelar, no asistió y tolerancia propia (HU-04).
- Rutas abreviadas: `sb/` = `packages/supabase/supabase/`, `web/` = `apps/web/`,
  `t/` = `web/__test__/`, `rs/` = `web/src/modules/reservations/`,
  `wo/` = `web/src/modules/work-orders/`.
- **Hora en las pruebas:**
  - pgTAP inserta reservas (como `postgres`) con `slot_start` relativo a `now()`;
  - Vitest usa fechas fijas;
  - las e2e crean reservas con `adminClient` relativas a `Date.now()`.

  Nada depende de la hora a la que se ejecuten.

---

## Bloque A — P1: horario y reservar (HU-01, HU-02, HU-05)

### Fase A1 — Base de datos (completa: también lo que usan B y C)

- [x] T001 Crear la rama `feature/012-agendamiento` desde `develop` y la migración vacía con
      `pnpm --filter @motorismo/supabase migration:new reservations < /dev/null` → versión
      posterior a `20261120174652_work_orders`.
- [x] T002 `sb/tests/11_reservations.test.sql`, estructura y permisos (rojo):
      - tablas `agenda_settings`, `agenda_weeks`, `agenda_days`, `reservations` y
        `reservation_services`, el tipo `reservation_status` y las columnas nuevas de
        `work_orders`;
      - checks (rangos, lunes, día dentro de su semana, `closes_at > opens_at`, `slot_end >
        slot_start` y coherencia de estados) y el índice único parcial (RN-03);
      - fila por defecto de `agenda_settings`: 60, 2 y 15;
      - RLS activado, `policies_are`, `table_privs_are` (solo `select`, sin `delete`, CA-23) y
        `function_privs_are`; un cliente no ve nada (RN-06).
      → rojo (`pnpm db:test`).
- [x] T003 `sb/tests/11_reservations.test.sql`, funciones de lectura y turno (rojo):
      - matriz de `private.reservation_turn_at`: 8:45 → 8:45 (CA-17); 9:00 → 9:00; 9:10 con 15 →
        9:00 (CA-16); 9:15 con 15 → 9:00 (límite); 9:40 con 15 → 9:40 (CA-16); tolerancia 0;
      - `agenda_slots`:
        - franjas de 9:00 a 18:00 cada 60 min (9 franjas, cuenta en el comentario);
        - de 9:00 a 17:30 → la última termina a las 17:00 (RN-01);
        - `started`, y `taken` con reservas solapadas de otra duración;
        - un día cerrado o una semana sin habilitar → sin franjas (CA-03).
      → rojo.
- [x] T004 `sb/tests/11_reservations.test.sql`, reservar y configurar (rojo):
      - `save_reservation`:
        - queda `pending` con quién y cuándo, y ocupa un puesto (CA-05);
        - rechazos con su `hint`: franja llena (`reservation_slot_full`), empezada, desalineada,
          en día cerrado o en semana sin habilitar (CA-03); cliente desactivado y vehículo
          retirado o ajeno (CA-07); mismo vehículo en la misma franja (CA-08); servicio inactivo
          o sin precio para el tipo (CA-04);
        - cliente sin cuenta del punto de atención: se reserva igual (CA-02);
      - `save_agenda_week`:
        - crea los siete días;
        - cerrar el 29 y acortar el 28 no toca los demás (CA-27);
        - deshabilitar → sin reservas nuevas, y las hechas siguen (CA-28);
        - día inválido → `agenda_day_invalid:YYYY-MM-DD` (CA-30);
      - `save_agenda_settings`: rangos (CA-29);
      - semana y configuración por un operador → `agenda_admin_only` (CA-32);
      - tras cerrar un día, cambiar el horario o bajar los puestos, las reservas conservan la hora
        y la vista las marca `out_of_hours` y `over_capacity` (CA-31).
      → rojo.
- [x] T005 `sb/tests/11_reservations.test.sql`, llegada y transiciones (rojo; lo usan los bloques B
      y C):
      - `save_work_order` con reserva:
        - la orden se abre con `turn_at` y `reservation_id`, y la reserva queda `attended` y
          enlazada (CA-13);
        - caso de las 8:00 y las 9:00: turnos de cada orden (CA-15);
        - rechazo si es de otro día, si no está pendiente o si es de otro cliente (CA-19);
        - con `p_id` de una orden en cola sin reserva → se enlaza (suposición de la spec);
      - `cancel_reservation` (CA-21);
      - `mark_reservation_no_show`: antes de `grace_until` → rechazo, después → sí (CA-22);
      - toda transición desde `attended`, `cancelled` o `no_show` → rechazo (CA-23);
      - `save_reservation` con `p_id`: mover de franja con cupo, la anterior recupera su puesto, y
        una no pendiente → rechazo (CA-20);
      - `set_reservation_tolerance`:
        - el admin pone 30 y cambian `grace_until` y el turno al llegar; `null` vuelve a la
          general (CA-24);
        - el operador → `reservation_admin_only` (CA-25).
      → rojo.
- [x] T006 `sb/tests/10_work_orders.test.sql`: firma nueva de `save_work_order` (con
      `p_reservation_id`), sin cambio de comportamiento sin reserva → rojo hasta T007.
      *Hecho:* la firma se comprueba en `11_reservations` (`has_function`); la 10 sigue en verde
      sin cambios de comportamiento. Las pruebas 09 y 10 vacían antes las reservas, que apuntan a
      servicios y órdenes.
- [x] T007 Escribir la migración `sb/migrations/<ts>_reservations.sql` según el plan: tipo,
      tablas, índices, fila de configuración, columnas de `work_orders`, ayudantes privados,
      `agenda_slots`, `save_reservation`, `cancel_reservation`, `mark_reservation_no_show`,
      `set_reservation_tolerance`, `save_agenda_week`, `save_agenda_settings`, `drop` y `create`
      de `save_work_order` con sus permisos, `reservation_summaries`, `work_order_summaries` con
      turno y reserva, y RLS y privilegios.
      → T002 a T006 en verde (`pnpm db:reset` + `pnpm db:test`). (RF-01 a RF-07, RN-01 a RN-11)
- [x] T008 `sb/seeds/06_reservations.sql`: semana actual y siguiente habilitadas, de 9:00 a 18:00;
      reservas de mañana (Camila 10:00 con «Lavado detallado» y su Suzuki; Valentina 10:00 sin
      servicios) y una cancelada. Fechas relativas a `current_date`.
      → `pnpm db:reset` sin errores y las reservas a la vista en Studio.
- [x] T009 `pnpm db:types` y `pnpm --filter @motorismo/supabase types:check` → tipos versionados.
      *Mutaciones vistas fallar (25):* turno dentro de la tolerancia, puestos ocupados, franja
      parcial, semana deshabilitada en las franjas, tolerancia propia, límite de «No asistió»,
      admin en semana, configuración y tolerancia, día sin franja completa, rangos de la
      configuración, cancelar no pendiente, franja empezada, vehículo repetido, servicio sin
      precio, cliente desactivado, día cerrado, contarse a sí misma al moverse, reserva atendida,
      reserva de hoy, mismo cliente, orden empezada, «Fuera del horario», «Sobrecupo», `insert`
      concedido y política abierta.

### Fase A2 — Pruebas de la app (rojo)

- [x] T010 [P] `t/src/modules/reservations/utils/agenda-date.utils.test.ts`:
      - hoy en Colombia a partir de una fecha fija (también cuando en UTC ya es otro día);
      - lunes de la semana de un día cualquiera y los siete días de una semana;
      - días anterior y siguiente, con cambio de mes y de año;
      - `date` de la URL válida o inválida → hoy (CA-10).
      → rojo.
- [x] T011 [P] `t/src/modules/reservations/schemas/*.test.ts`:
      - `reservation.schema`: cliente y franja obligatorios; vehículo, servicios y observaciones
        (≤ 500) opcionales;
      - `agenda-week.schema`: cierre ≤ apertura, o sin franja completa con `slotMinutes`, → error
        en ese día (CA-30);
      - `agenda-settings.schema`: rangos y múltiplos de 15 (CA-29).
      → rojo.
- [x] T012 [P] `t/src/modules/reservations/utils/reservations-errors.utils.test.ts`: cada `hint`
      de las funciones → su clave de mensaje; `agenda_day_invalid:fecha` → el día; uno
      desconocido → genérico.
      → rojo.
- [x] T013 [P] `t/src/modules/reservations/components/slot-picker.component.test.tsx`:
      - franjas en orden con «1 de 2 libres»;
      - llenas y empezadas a la vista pero deshabilitadas;
      - «Cerrado» y «Semana sin habilitar» sin franjas (CA-03).
      → rojo.
- [x] T014 [P] `t/src/modules/reservations/components/reservation-form.component.test.tsx`:
      - buscar y elegir cliente; un solo vehículo ya elegido; vehículo opcional (CA-01);
      - registrar un cliente sin cuenta y quedar elegido (CA-02);
      - clientes desactivados y vehículos retirados no se ofrecen (CA-07);
      - solo servicios activos con precio para el tipo, o todos los activos sin vehículo (CA-04);
      - guardar llama a la acción con `callAction` y anuncia el resultado (CA-05); `slot_full` →
        mensaje y franjas recargadas (CA-06).
      → rojo.
- [x] T015 [P] `t/src/modules/reservations/components/agenda-screen.component.test.tsx`:
      - franjas en orden con puestos libres;
      - filas con cliente, celular, vehículo (placa o tipo), servicios y estado;
      - «No hay reservas este día» (CA-09);
      - navegación de días que cambia `?date` (CA-10).
      → rojo.
- [x] T016 [P] `t/src/modules/reservations/components/schedule-screen.component.test.tsx`:
      - semana sin habilitar con los siete días de 9:00 a 18:00 propuestos (CA-26);
      - cerrar un día o cambiar sus horas (CA-27);
      - error junto al día (CA-30) y junto al campo de la configuración (CA-29);
      - «Habilitar» y «Deshabilitar» (CA-28).
      → rojo.
- [x] T017 [P] `t/src/modules/auth/constants/nav.constants.test.ts`: «Agenda» después de
      «Órdenes» para administrador y operador, nunca para un cliente → rojo.
      *Hecho:* en las pruebas que ya fijan las secciones de cada rol (`nav-links`, `mobile-nav`,
      `auth-ui` y `staff-home`), que fallaron al añadir la sección y se actualizaron.
- [x] T018 [P] `t/src/app/loading-coverage.test.ts`: añadir `agenda` (`list`), `agenda/new`
      (`form`), `agenda/[id]` (`detail`) y `agenda/schedule` (`form`) a la tabla → rojo.

### Fase A3 — Implementación (verde)

- [x] T020 `rs/` base: `types`, `constants` (propuesta de 9:00 a 18:00, RN-10), `messages/es.json`
      registrado en `src/i18n/messages.ts`, `utils/agenda-date.utils.ts` y
      `utils/reservations-errors.utils.ts`.
      → T010 y T012 en verde.
- [x] T021 `rs/schemas/` (reservation, agenda-week, agenda-settings) → T011 en verde.
- [x] T022 `rs/api/reservations.server.ts`: `getAgendaDay`, `getReservation`, `getAgendaWeek`
      (con la propuesta si no existe) y `getAgendaSettings`. `rs/actions/reservations.actions.ts`:
      `saveReservation`, `saveAgendaWeek` y `saveAgendaSettings`, con `getActiveStaff` o
      `getActiveAdmin` → `pnpm ts:check`.
- [x] T023 Componentes: `reservation-status-chip`, `slot-picker`, `day-nav` (campo de fecha
      nativo), `reservation-row`, `agenda-screen` y `reservation-form` (reutiliza
      `CustomerPicker` con vehículo opcional).
      → T013, T014 y T015 en verde.
- [x] T024 `day-schedule-row` y `schedule-screen` → T016 en verde.
- [x] T025 Rutas `src/app/(app)/agenda/{page,loading}.tsx`, `agenda/new/…` y `agenda/schedule/…`
      (el operador recibe «No tienes permiso»), y `agenda/[id]/…` con el detalle básico (CA-11;
      sus acciones llegan en B y C). Cada una con su `loading.tsx`.
      → T018 en verde.
- [x] T026 `NAV_LINKS` con «Agenda» (`CalendarClock`) y textos en `auth.header` y `auth.home`.
      → T017 en verde, y el mosaico en el inicio del personal.
- [x] T028 (añadida) Cliente nuevo desde la reserva (CA-02): `createCustomer` devuelve el id y
      `CustomerForm` entrega el cliente creado; `CustomerPicker` gana el modo `reservation` (vehículo
      opcional con «Sin vehículo», vehículos con orden abierta elegibles, «Registrar cliente») y
      `customerLocked` para cambiar una reserva (CA-20). Pruebas en `customer-picker`,
      `customer-form` y `customers.actions`.
- [x] T027 [P] `t/src/modules/reservations/components/reservation-detail.component.test.tsx`
      (rojo antes de T025): todos los campos, la tolerancia general o propia y quién y cuándo
      (CA-11) → verde con T025.

### Fase A4 — Sandbox y E2E

- [x] T030 `t/sandbox/reservations.sandbox.test.ts` (junto a las demás de sandbox): dos `save_reservation`
      simultáneas (dos sesiones de personal, `Promise.all`) sobre el último puesto → una sola
      se guarda y la otra recibe `reservation_slot_full` (CA-06) → verde, y visto fallar
      quitando el `for update`.
- [x] T031 `web/e2e/reservations.spec.ts`, bloque A:
      - el admin habilita una semana futura con un día cerrado y otro acortado (CA-26, CA-27);
      - el operador reserva a Camila en una franja de esa semana y la ve en la agenda, anunciada
        (CA-01, CA-05, CA-09);
      - navegar de día y recargar conserva la fecha (CA-10);
      - «Horario» para el operador → «No tienes permiso» (CA-32).
- [x] T032 `e2e/a11y.spec.ts` (agenda, nueva reserva con errores, detalle y horario, en claro y en
      oscuro) y `e2e/ui.spec.ts` «on an iPhone» y 360 px (agenda, nueva reserva y horario) → verde.

---

## Bloque B — P1: el cliente llega y la cola con turno (HU-03)

### Fase B1 — Pruebas (rojo)

- [x] T040 [P] `t/src/modules/work-orders/utils/queue.utils.test.ts`:
      - orden por turno (CA-14);
      - caso de las 8:00 y las 9:00: orden 1, la de la reserva y la sin reserva, aunque esta se
        guardó antes (CA-15);
      - empate → reserva primero, y después por llegada;
      - «Reserva por llegar» en su lugar y sin turno; fuera de `grace_until`, no aparece (CA-18);
      - los turnos (1.º, 2.º…) solo cuentan órdenes.
      → rojo.
- [x] T041 [P] `t/src/modules/reservations/utils/reservation-lines.utils.test.ts`: servicios de la
      reserva → líneas con valor y tiempo del catálogo actual para el tipo; inactivos o sin
      precio aparte, para el aviso (CA-12, RN-07) → rojo.
- [x] T042 [P] `reservation-detail.component.test.tsx`: «Llegó» solo en una reserva de hoy y
      pendiente; enlaza a `/orders/new?reservation=…`; en una atendida, enlace a su orden
      (CA-19, RF-04) → rojo.
- [x] T043 [P] Pruebas de `orders-screen` y `new-order-screen`:
      - la cola muestra «Reserva 9:00 a. m.» y la «Reserva por llegar» (CA-14, CA-18);
      - «Nueva orden» con reserva trae cliente, vehículo y servicios y avisa de los que no se
        copiaron (CA-12);
      - guardar envía `reservationId` (CA-13);
      - `order-detail` enlaza a su reserva (RF-04).
      → rojo.

### Fase B2 — Implementación (verde)

- [x] T044 `wo/utils/queue.utils.ts` y `rs/utils/reservation-lines.utils.ts` → T040 y T041 en
      verde.
- [x] T045 `listOpenOrders` ordenado por turno; `listArrivingReservations`; `orders-screen` con
      `queue.utils`, la marca de reserva y las reservas por llegar; `orders/page.tsx` las carga
      → parte de T043 en verde.
- [x] T046 `orders/new/page.tsx` con `?reservation=`; `new-order-screen` y `order-editor` con
      valores iniciales; `saveWorkOrder` con `reservationId`; errores de la reserva mapeados;
      `order-detail` con el enlace → T042 y T043 en verde.
- [x] T047 Enmienda de la spec 008: CA-18 dice «por hora de turno (spec 012, RN-04)», con su
      entrada en el historial.

### Fase B3 — E2E

- [x] T048 `reservations.spec.ts`, bloque B (reservas creadas con `adminClient` y horas relativas
      a ahora):
      - una reserva de hace 5 minutos aparece como «Reserva por llegar» en la cola (CA-18);
      - «Llegó» → «Nueva orden» con sus datos; al guardar, la orden muestra «Reserva …» en la cola
        delante de una sin reserva que llegó después de su hora, y la reserva queda atendida
        (CA-12, CA-13, CA-14);
      - salir sin guardar deja la reserva pendiente (CA-13).

---

## Bloque C — P2: cambiar, cancelar, no asistió y tolerancia propia (HU-04)

### Fase C1 — Pruebas (rojo)

- [x] T050 [P] `reservation-detail.component.test.tsx`:
      - «Editar» solo pendiente (CA-20) y «Cancelar» con motivo opcional (CA-21);
      - «No asistió» solo pasado `grace_until` (CA-22);
      - nada en atendida, cancelada o no asistió (CA-23);
      - el admin cambia la tolerancia y el operador solo la ve (CA-24, CA-25);
      - en `agenda-screen`, una reserva `out_of_hours` muestra «Fuera del horario» y una
        `over_capacity`, «Sobrecupo» (CA-31).
      → rojo.
- [x] T051 [P] `cancel-reservation-dialog` y `tolerance-dialog` (con `tolerance.schema`): motivo
      ≤ 200; tolerancia de 0 a 60 o «la general» → rojo.

### Fase C2 — Implementación (verde)

- [x] T052 Acciones `cancelReservation`, `markNoShow` y `setReservationTolerance`; edición con
      `reservation-form` sobre una reserva pendiente; los dos diálogos; avisos «Fuera del horario»
      y «Sobrecupo» en la agenda (CA-31) → T050 y T051 en verde.

### Fase C3 — E2E

- [x] T053 `reservations.spec.ts`, bloque C:
      - mover una reserva a otra franja (los puestos se actualizan) (CA-20);
      - cancelarla y verla marcada (CA-21);
      - una reserva de hace 1 hora → «No asistió» (CA-22);
      - el admin le pone 30 min de tolerancia y la ve en el detalle (CA-24).

---

## Bloque D — Enmienda: al día sin recargar (HU-06)

- [x] T060 `sb/tests/12_reservations_live.test.sql` (rojo): `extend_reservation_tolerance` suma 5
      (15 → 20, 55 → 60), rechaza pasar de 60, una no pendiente, pasada su tolerancia y a un cliente
      (CA-34, RN-11); las tablas están en la publicación `supabase_realtime` (CA-35).
- [x] T061 Migración `<ts>_reservations_live.sql` → T060 en verde; `pnpm db:types`.
- [x] T062 [P] Pruebas (rojo): cuenta regresiva y resaltado en la fila por llegar (CA-33); «+5 min»
      llama a la acción (CA-34); franjas que empiezan sin «Reservar» con el reloj (CA-36); «Pasó su
      tolerancia» en la agenda y el detalle (CA-37); `realtime-refresh` refresca al recibir un
      cambio y al volver a la pestaña, agrupando ráfagas (CA-35).
- [x] T063 Implementación → T062 en verde.
- [x] T064 E2E: con «Órdenes» abierta, una reserva escrita en la base aparece sin recargar como
      «Reserva por llegar» (CA-35); «+5 min» alarga la espera (CA-34). Vista fallar quitando
      `RealtimeRefresh` del layout. El sandbox local ya no excluye Realtime (`sandbox:start`).

- [x] T065 (petición del usuario) Registro de «+5 min»: tabla, vista y suma en
      `reservation_summaries` (pgTAP 12, vista fallar quitando el registro); detalle «Más tiempo
      para llegar», cola «Ya se le dio…» y agenda «+N min de espera» (CA-38).
- [x] T066 (petición del usuario) «Volver» a «Órdenes» si la reserva se abrió desde la cola (CA-39);
      E2E del flujo completo.
- [x] T067 (petición del usuario) Horas pasadas: la agenda oculta las franjas terminadas sin
      reservas y dice cuántas, «Ya pasó» y «En curso» (CA-09); el formulario no ofrece las
      terminadas y avisa si no queda ninguna (CA-03). Pruebas de `agenda-screen` y `slot-picker`
      vistas fallar (mutaciones: nota siempre visible, solo las pendientes conservan la franja,
      ninguna franja termina, ofrecer las terminadas, sin aviso, «Llena» en vez de «En curso»).
- [x] T068 (error encontrado por el usuario) Guardar «Puestos por franja» fallaba desde la app:
      `save_agenda_settings` actualizaba sin `where` y las conexiones de la API lo rechazan
      (`safeupdate`); pgTAP corre como superusuario y no lo veía. Prueba de sandbox que guarda 3
      puestos por la API (vista fallar con «UPDATE requires a WHERE clause»). En «Horario», cada
      aviso de guardado sale junto a su botón (prueba vista fallar pintando el de la configuración
      en la tarjeta de la semana). El seed pone los ejemplos de hoy dentro del horario (después de
      cerrar, en la última franja).
- [x] T069 (petición del usuario) El refresco en tiempo real solo en inicio, «Órdenes» y «Agenda»
      con sus detalles (CA-35): pruebas de `realtime-refresh` por ruta, vistas fallar refrescando
      en todas las pantallas.

## Enmienda HU-07 — Agendar desde el cliente

- [x] T070 [P] Pruebas (rojo):
  - `reservation-form` con `initialCustomer` (elegido) e `initialVehicleId` (ese vehículo elegido)
    (CA-40, CA-41);
  - `customer-detail`: «Agendar» → `/agenda/new?customer=…`, nada si está desactivado (CA-40,
    CA-43);
  - `vehicles-section`: «Agendar» por vehículo → `?customer=…&vehicle=…`, nada para el cliente ni
    en solo lectura (CA-41, CA-43);
  - `customers-table`: «Agendar» en el menú de un activo, no en el de un desactivado (CA-42,
    CA-43).
- [x] T071 Implementación: página, pantalla, formulario, ficha, vehículos y fila → T070 en verde.
- [x] T072 E2E: desde la ficha y desde un vehículo; una dirección con un cliente desactivado empieza
  sin cliente (CA-40, CA-41, CA-43).
  - Mutaciones vistas fallar: «Agendar» para un desactivado (ficha y fila), «Agendar» para el
    cliente en sus vehículos, sin el vehículo en el enlace, sin la placa en su nombre, el
    formulario sin el cliente o sin pasar el vehículo.
  - Hallado en la E2E: dos motos de la misma línea daban dos «Agendar Suzuki GSX-R600»
    indistinguibles; el nombre accesible lleva la placa («Agendar Suzuki GSX-R600 · UIH-03D»).
  - E2E completa contra producción: 172/174, y las dos que fallaron (contraste a mitad de la
    transición de un enlace y el centrado del inicio, 0,17 px) pasan al repetirlas.

## Cierre

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
      `pnpm build` · `pnpm test:e2e` en verde. Al cerrar la enmienda, la E2E completa también
      contra el build de producción (165/165), construido sin cachés (`--force` y sin `.next`):
      Turbopack había servido un `globals.css` viejo.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `pnpm --filter @motorismo/supabase types:check` en
      verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado y revertida (`git diff` + grep
      limpio). Se anota cada mutación.
- [ ] T093 (pendiente del usuario, a mano) Revisión en teléfono (440 px táctil y 360 px) y en
      escritorio, en claro y en oscuro: agenda, reservar, horario, llegada y cola.
- [x] T094 `CLAUDE.md` (agenda y reservas, hora de turno, seeds 06 y usuarios locales),
      `packages/supabase/CLAUDE.md` (seed 06), spec, plan, tareas y backlog al día.

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T014, T031 |
| CA-02 | T004, T014 |
| CA-03 | T003, T004, T013, T067 |
| CA-04 | T004, T014 |
| CA-05 | T004, T014, T031 |
| CA-06 | T014, T030 |
| CA-07 | T004, T014 |
| CA-08 | T002, T004 |
| CA-09 | T015, T031, T067 |
| CA-10 | T010, T015, T031 |
| CA-11 | T027 |
| CA-12 | T041, T043, T048 |
| CA-13 | T005, T043, T048 |
| CA-14 | T040, T043, T048 |
| CA-15 | T005, T040 |
| CA-16 | T003 |
| CA-17 | T003 |
| CA-18 | T040, T043, T048 |
| CA-19 | T005, T042 |
| CA-20 | T005, T050, T053 |
| CA-21 | T005, T050, T053 |
| CA-22 | T005, T050, T053 |
| CA-23 | T002, T005, T050 |
| CA-24 | T005, T050, T053 |
| CA-25 | T005, T050 |
| CA-26 | T016, T031 |
| CA-27 | T004, T016, T031 |
| CA-28 | T004, T016 |
| CA-29 | T004, T011, T016, T068 |
| CA-30 | T004, T011, T016 |
| CA-31 | T004, T050 |
| CA-32 | T004, T031 |
| CA-33 | T062 |
| CA-34 | T060, T062, T064 |
| CA-35 | T060, T062, T064 |
| CA-36 | T062 |
| CA-37 | T062 |
| CA-38 | T065 |
| CA-39 | T066 |
| CA-40 | T070, T072 |
| CA-41 | T070, T072 |
| CA-42 | T070, T072 |
| CA-43 | T070, T072 |
