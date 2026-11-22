---
spec: "014"
actualizado: 2026-11-21
---

# Tareas — 014 Experiencia del cliente con cuenta

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `sb/` = `packages/supabase/supabase/`, `w/` = `apps/web/`, `t/` = `apps/web/__test__/`.
- Rama `feature/014-experiencia-cliente` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 `sb/tests/13_customer_area.test.sql` (rojo), con el reloj fijo como en la 11.
  - **Columnas y checks:** `created_by` opcional; `booked_by_customer`, `updated_by_customer` y
    `cancelled_by_customer`; los checks de creación y de cancelación (CA-16, CA-19).
  - **`my_shop_orders`:** solo las órdenes abiertas del cliente de la sesión; `ahead` según el
    turno, con la reserva primero si empatan; líneas con su tiempo; vacío para otro cliente y para
    el personal (CA-01, CA-03, CA-06).
  - **`my_order_history`:** cerradas, sin anuladas, la corregida con sus valores, también de
    vehículos retirados; detalle de líneas, descuento, total y pagos; paginación por `p_before` y
    `p_limit` (CA-07 a CA-11).
  - **`my_reservations`:** pendientes y las de los últimos 30 días; `grace_until` efectiva; quién
    la hizo o canceló, sin nombres (CA-17, CA-22).
  - **`bookable_day`:** estado `open`, `closed` o `unenabled`, con sus franjas y puestos, para un
    cliente (CA-12, CA-13).
  - **`save_reservation` (cliente):**
    - reserva lo suyo y queda `booked_by_customer`;
    - nunca para otro cliente (`reservation_customer_only`);
    - con un vehículo ajeno, rechazo;
    - límite RN-03 (`reservation_customer_limit`) para el mismo vehículo y para una segunda «Sin
      vehículo», sin contar la que cambia;
    - franja llena (`reservation_slot_full`);
    - cambia lo suyo pendiente (`updated_by_customer`) sin tocar la tolerancia
      (CA-12, CA-14, CA-15, CA-18, RN-05).
  - **`cancel_reservation` (cliente):** lo suyo pendiente, con motivo opcional y
    `cancelled_by_customer`; lo de otro o no pendiente, rechazo (CA-19, CA-20, CA-21).
  - **Lecturas:** un cliente no lee `work_orders`, `work_order_summaries` ni `reservations`
    (CA-06, RN-01).
  - **Servicios:** se leen los activos y no los desactivados.
  - **Privilegios:** `anon` sin ejecutar nada; `reservation_summaries` con las columnas nuevas.
- [x] T002 Migración `<ts>_customer_area.sql` (con `migration:new`), con todo lo del plan →
  T001 en verde. `pnpm db:reset`, `pnpm db:test` (las 11 y 12 siguen en verde) y `pnpm db:types`.
- [x] T003 [P] Seed `06_reservations.sql`: una reserva pendiente para mañana hecha por
  `cliente@motorismo.test` desde la app. `packages/supabase/CLAUDE.md` y `CLAUDE.md` (usuarios
  locales).
- [x] T004 [P] `t/sandbox/customer-area.sandbox.test.ts` (rojo → verde con T002): por la API real
  (`safeupdate`), el cliente reserva y cancela lo suyo y no lo de otro (CA-19, CA-21).
  - pgTAP 13: 53 comprobaciones. La 11 cambia dos: un cliente no reserva ni cancela **para otro**
    (`reservation_customer_only`); la de sandbox de la 012, igual.
  - Mutaciones vistas fallar:
    - **pgTAP:** «Van N antes» sin la prioridad de la reserva, sin el límite de la app, anuladas en
      el historial, reservas de todos, cancelar las de cualquiera, la tolerancia propia ignorada;
    - **sandbox:** cancelar las de cualquiera, y el inicio sin órdenes.
  - Desvío del plan: en vez de abrir los servicios activos a los clientes (rompía el CA-18 de la
    spec 007, «un cliente no lee servicios»), `bookable_services()` devuelve los activos con su
    nombre y para qué vehículos se ofrecen, sin precios ni tiempos.
  - En la prueba de sandbox, Camila registra una moto propia para reservar: los seeds ya le dan
    una reserva por vehículo y una sin vehículo (límite RN-03).

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/src/modules/auth/utils/access.utils.test.ts`: el cliente entra a `/my`;
  `/my…` y `/profile` son suyos tras iniciar sesión; `/` lo lleva a `/my` (RF-01, cambia spec 004).
- [x] T011 [P] `t/src/modules/core/components/poll-refresh.component.test.tsx` (reloj falso):
  refresca cada 15 s solo con la pestaña visible, y al volver a ella (CA-05, CA-22).
- [x] T012 [P] `t/src/modules/customer-area/components/shop-order-card.component.test.tsx`:
  - «En cola», «Van 2 antes», servicios y desde qué hora (CA-01);
  - «En proceso» y «Lista hacia las 4:30 p. m.» con estimado completo; «Sin hora estimada» si
    falta alguno (CA-02).
- [x] T013 [P] `t/…/customer-home.component.test.tsx`: una tarjeta por vehículo (CA-03); sin
  vehículos, el mensaje y los accesos (CA-04); la próxima reserva con «Puedes llegar hasta…»
  (RF-01).
- [x] T014 [P] `t/…/history-screen.component.test.tsx`: detalle completo con servicios y valores,
  descuento, total y medios de pago, la más reciente primero (CA-07); vacío (CA-10); «Ver
  anteriores» con `?before=` (CA-11).
- [x] T015 [P] `t/…/my-reservation-form.component.test.tsx`:
  - sus vehículos y «Sin vehículo»; día y franjas (con `SlotPicker`); servicios del tipo de
    vehículo; observación; envía lo elegido y avisa «Reserva guardada.» en su reserva (CA-12);
  - día cerrado o semana sin habilitar (CA-13);
  - franja llena → mensaje y franjas al día (CA-14);
  - límite → mensaje (CA-15);
  - al cambiar, empieza con lo de la reserva (CA-18).
- [x] T016 [P] `t/…/my-reservations-screen.component.test.tsx`: pendientes primero con día, hora,
  vehículo, servicios y «Puedes llegar hasta…»; pasadas con su estado (CA-17); «Cambiar» y
  «Cancelar» solo en pendientes (CA-20); cancelar con motivo opcional → aviso (CA-19).
- [x] T017 [P] `t/src/modules/reservations/components/reservation-detail.component.test.tsx`: el
  rastro dice «Reservó el cliente desde la app», «Cambió el cliente desde la app» y «Cancelada por
  el cliente» con el motivo (CA-16, CA-19).
- [x] T018 [P] `t/…/customer-area-errors.utils.test.ts`: `customerLimit` y `customerOnly`, además
  de los de la agenda.

## Fase 3 — Implementación (verde)

- [x] T020 Acceso y navegación: `access.utils.ts` (`CUSTOMER_HOME = '/my'`, páginas del cliente),
  `nav.constants.ts` («Inicio», «Mis reservas», «Historial», «Mi perfil» para `customer`) y sus
  textos → T010 en verde.
- [x] T021 `core/components/poll-refresh.component.tsx` → T011 en verde.
- [x] T022 Módulo `customer-area`: `api/customer-area.server.ts`, `types`, `schemas`, `utils`
  (errores), `messages/es.json` (registrado en `src/i18n/messages.ts`) → T018 en verde.
- [x] T023 Inicio: `shop-order-card`, `customer-home` y la ruta `/my` con `loading.tsx` y
  `PollRefresh` → T012 y T013 en verde.
- [x] T024 Historial: `history-order-card`, `history-screen` y la ruta `/my/history` con
  `loading.tsx` → T014 en verde.
- [x] T025 Reservas: `actions/customer-area.actions.ts` (con `callAction` en los componentes),
  `my-reservation-form`, `my-reservations-screen`, `cancel-my-reservation-dialog`, y las rutas
  `/my/reservations`, `/new` y `/[id]` con `loading.tsx` y `PollRefresh` → T015 y T016 en verde.
- [x] T026 Personal: rastro de `reservation-detail` y tipos de `reservations` → T017 en verde.
- [x] T027 `loading-coverage.test.ts` con las rutas nuevas; `call-action-coverage.test.ts` en
  verde.
  - Mutaciones vistas fallar (una o más por prueba):
    - **acceso:** `/my` como prefijo marcaba «Inicio» en «Historial»;
    - **refresco:** cada 30 s, sigue con la pestaña oculta, no se detiene;
    - **errores:** sin `customerLimit`;
    - **tarjeta:** hora con estimado incompleto, «Van N» ignorado, desde cuándo ignorado;
    - **inicio:** sin la próxima reserva, sin tarjetas;
    - **historial:** descuento siempre, páginas desde la primera;
    - **formulario:** todos los servicios, sin preelegir el único vehículo, sin refrescar si se
      llenó, sin el id al cambiar;
    - **«Mis reservas»:** quién canceló invertido, sin motivo, sin refrescar.
  - Dos pruebas se reforzaron porque una mutación sobrevivió: las páginas del historial con dos
    órdenes, y quién canceló, mirado fila por fila.
  - Los tipos que genera Supabase marcan no nulas todas las columnas de una función; el módulo dice
    cuáles pueden ser nulas (`WithNulls`).
  - Con varios vehículos no se elige ninguno por el cliente: tiene que escoger uno o «Sin vehículo»
    (`vehicleRequired`).

## Fase 4 — E2E

- [x] T030 `w/e2e/customer-area.spec.ts`:
  - **Inicio:** el cliente entra a `/my`; ve su orden abierta «En cola» con «Van N antes»; el
    personal la empieza y el inicio cambia a «En proceso» sin recargar (CA-01, CA-05).
  - **Historial:** con el detalle de una orden cerrada y sin la anulada (CA-07, CA-08).
  - **Reservar:** desde la app, con «Puedes llegar hasta…»; el personal la ve en la agenda con
    «Reservó el cliente desde la app» (CA-12, CA-16).
  - **Tolerancia:** el personal da «+5 min» y «Mis reservas» muestra la nueva hora sin recargar
    (CA-22).
  - **Cancelar:** el cliente cancela con motivo; el personal ve «Cancelada por el cliente»
    (CA-19).
- [x] T031 `w/e2e/a11y.spec.ts`: las cuatro pantallas del cliente y el diálogo de cancelar, en
  claro y oscuro. `w/e2e/ui.spec.ts`: las rutas `/my…` en la prueba del iPhone, sin
  desplazamiento lateral.
- [x] T032 E2E existentes que esperan «Mi perfil» al entrar como cliente (`customer-access`,
  `sign-up`, `my-profile`…): ahora `/my`.
  - Las dos E2E «sin recargar» (CA-05 y CA-22) se vieron fallar quitando `PollRefresh` de las dos
    pantallas.
  - La auditoría de accesibilidad destapó «Cancelar la reserva del…» como nombre de un botón que
    dice «Cancelar reserva» (WCAG 2.5.3): ahora es «Cancelar reserva del…».
  - Las E2E de la 012 que buscaban la reserva de Camila por su nota («Pidió turno por WhatsApp»)
    usan la nueva («Llego en la moto»).

## Enmienda CA-23

- [x] T040 Prueba (rojo) y componente `arrive-by`: «Puedes llegar hasta…» o, pasada esa hora, «Ya
  pasó la hora para conservar tu turno; si llegas, entras por orden de llegada», con el reloj de la
  pantalla (`useNow`); en el inicio y en «Mis reservas» (CA-23).
  - Mutaciones vistas fallar: siempre la hora; la pantalla sin reloj.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
  `pnpm build` · `pnpm test:e2e`, también contra el build de producción, construido sin cachés.
- [x] T091 `pnpm db:reset` · `pnpm db:test` · `pnpm --filter @motorismo/supabase types:check` en
  verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado y revertida (`git diff` + grep).
- [x] T093 Revisión en el teléfono: capturas a 360 px y en iPhone de 440 px táctil, en claro y
  oscuro, de las cuatro pantallas.
- [x] T094 Spec 004 (CA-08 y CA-12) y spec 012 (RN-05 y RN-06) anotan el cambio; `CLAUDE.md`
  (sección del cliente), spec, plan, tareas y backlog al día.
  - Definición de terminado: pgTAP 556/556, tipos al día, lint, `ts:check`, 1.139 unitarias, 52 de
    sandbox, build sin cachés y E2E contra producción 178/180. Las dos que fallaron (contraste del
    esqueleto y el menú de fila de «Usuarios») pasan al repetirlas: inestabilidad conocida.
  - Capturas a 360 px en claro y en iPhone en oscuro de las cuatro pantallas, sin desplazamiento
    lateral. Ajuste: el nombre del vehículo en el inicio ya no se corta (se perdía la placa).

## Cobertura de criterios

| Criterio | Tareas |
|---|---|
| CA-01 | T001, T012, T030 |
| CA-02 | T012 |
| CA-03 | T001, T013 |
| CA-04 | T013 |
| CA-05 | T011, T030 |
| CA-06 | T001 |
| CA-07 | T001, T014, T030 |
| CA-08 | T001, T030 |
| CA-09 | T001 |
| CA-10 | T014 |
| CA-11 | T001, T014 |
| CA-12 | T001, T015, T030 |
| CA-13 | T001, T015 |
| CA-14 | T001, T015 |
| CA-15 | T001, T015 |
| CA-16 | T001, T017, T030 |
| CA-17 | T001, T016 |
| CA-18 | T001, T015 |
| CA-19 | T001, T004, T016, T017, T030 |
| CA-20 | T001, T016 |
| CA-21 | T001, T004 |
| CA-22 | T001, T011, T030 |
| CA-23 | T040 |

## Verificación

- [x] T095 CA-15: el mensaje del límite dice «para ese vehículo (o sin vehículo)».
- [x] T096 CA-16: pgTAP comprueba que la reserva del cliente ocupa su puesto (10:00 con 1 de 2
  ocupados); vista fallar haciendo que `taken_seats` no contara las reservas del cliente.
