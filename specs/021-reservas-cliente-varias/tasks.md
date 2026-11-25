---
spec: "021"
actualizado: 2026-11-25
---

# Tareas — 021 Reservas del cliente: varias por vehículo y tiempo estimado

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`, `s/` = `w/src/`,
  `db/` = `packages/supabase/supabase/`, `ca/` = `s/modules/customer-area/`.
- Rama `feature/021-reservas-cliente-varias` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 pgTAP en rojo, en `db/tests/13_customer_area.test.sql` (CA-01 a CA-04, RN-03).
  - Las dos aserciones de CA-15 de la spec 014 pasan a «el mismo día».
  - Nuevas:
    - el mismo vehículo, otro día: dos pendientes (CA-01);
    - el mismo día, a otra hora: `reservation_customer_limit` (CA-02);
    - «Sin vehículo»: otro día sí, el mismo día no (CA-03);
    - cambiar una reserva a un día ocupado por ese vehículo, y cambiar solo el vehículo en la misma
      franja: `reservation_customer_limit`, con la reserva intacta (CA-04);
    - el personal sí puede hacerle dos el mismo día (spec 012).
  - `bookable_services` con `estimated_minutes` (uno nulo); `services` sigue cerrado al cliente
    (RN-03).
  - Verificable: `pnpm db:test` falla en esas aserciones.
- [x] T002 Migración `db/migrations/<timestamp>_customer_reservations_per_day.sql` (RF-01, RF-02).
  - `save_reservation`: el día siempre calculado y bloqueado en las dos ramas; la regla del
    cliente, por vehículo y día, después del bloqueo.
  - `bookable_services`: `drop` + `create` con `estimated_minutes` y los mismos permisos.
  - Línea `-- seeds: unchanged — …`.
  - Verificable: `pnpm db:reset` + `pnpm db:test` en verde (T001).
- [x] T003 Regenerar tipos (`pnpm db:types`) y `types:check` en verde.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/src/modules/customer-area/components/booking-estimate.component.test.tsx`
  (CA-06 a CA-08).
  - 30 + 90 min = «Tiempo estimado: ≈ 2 h».
  - Uno sin tiempo: «Sin estimar: Micropulido».
  - Ninguno con tiempo: «Sin tiempo estimado».
  - Sin servicios: nada.
  - La región `aria-live` siempre montada.
- [x] T011 [P] `my-reservation-form.component.test.tsx` (CA-06): marcar y desmarcar servicios
  actualiza el estimado; un servicio no ofrecido para el vehículo elegido no suma.
- [x] T012 [P] `customer-area-errors.utils.test.ts` (CA-02): `reservation_customer_limit` dice
  «ese día».
- [x] T013 [P] `my-reservations-screen.component.test.tsx` y `customer-home.component.test.tsx`
  (CA-05).
  - Dos pendientes del mismo vehículo, cada una con «Cambiar» y «Cancelar».
  - El inicio muestra la más próxima.
  - Son pruebas de comportamiento existente: se ven fallar con una mutación.

## Fase 3 — Implementación (verde)

- [x] T020 `ca/types/customer-area.types.ts`: `BookableService` con `estimated_minutes: number |
  null` (`WithNulls`).
- [x] T021 `ca/components/molecules/booking-estimate.component.tsx` con `orderEstimate` y
  `useDuration`; textos `form.estimate`, `form.estimateMissing` y `form.estimateNone` en
  `ca/messages/es.json` (verde T010).
- [x] T022 `ca/components/organisms/my-reservation-form.component.tsx`: `useWatch` de
  `service_ids` y `BookingEstimate` bajo los servicios, solo con los ofrecidos (verde T011).
- [x] T023 `ca/messages/es.json`: `errors.customerLimit` con «ese día» (verde T012).

## Fase 4 — E2E

- [x] T030 `w/e2e/customer-area.spec.ts` (CA-01, CA-02, CA-06).
  - Camila reserva su Suzuki otro día (además de la del seed): «Mis reservas» muestra las dos.
  - Reservarla el mismo día de la del seed, a otra hora: el mensaje «ese día», sin crearla.
  - Al marcar servicios, el tiempo estimado.
- [x] T031 [P] `w/e2e/a11y.spec.ts`: el formulario de reserva del cliente con el estimado a la
  vista, en claro y oscuro.
- [x] T032 [P] Teléfono: el formulario con el estimado en `ui.spec.ts` «on an iPhone» (sin
  desplazamiento lateral); capturas a 360 y 440 px.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` + `test:sandbox` en verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` limpio);
  tabla de mutaciones aquí.
- [x] T093 Documentación.
  - Enmienda de la spec 014 (RN-03, CA-15) en su texto e historial.
  - `CLAUDE.md` («Área del cliente»: una por vehículo y día; tiempos en `bookable_services`).
  - Spec en `implementada`, plan y backlog al día.

## Registro de la implementación

- **T001:** las pruebas pgTAP de la spec 021 van en `tests/18_customer_reservations_per_day.test.sql`
  (15 aserciones); en `13_customer_area` solo cambian las descripciones de CA-15.
- **T013:** el inicio toma la primera pendiente de `my_reservations`, ya ordenadas por pgTAP (spec 014,
  CA-17). La E2E comprueba que muestra la más próxima.
- **T032:** en el iPhone, el aviso «Instalar» (spec 006) puede tapar la lista de servicios; la prueba
  marca las casillas con el teclado. Capturas a 360 y 440 px, claro y oscuro: el estimado se lee
  bajo los servicios, sin desbordes.
- **Añadida:** una prueba de concurrencia en `__test__/sandbox/reservations.sandbox.test.ts`.
- **Resultados:**
  - lint, tipos y build en verde;
  - 1478 unitarias, pgTAP 767, tipos al día y sandbox 55;
  - E2E contra producción: 252 de 253. Falló una vez `vehicle-catalog.spec.ts` (spec 018), que
    después pasó 3 de 3 aislada; queda anotada en el backlog con las otras intermitentes.

## Mutaciones (T092)

| Prueba | Mutación | Resultado |
|---|---|---|
| pgTAP 18 · CA-01, CA-03, CA-04 | sin la condición del día (una por vehículo, como antes) | falla |
| pgTAP 18 (y 11) · el personal no tiene el límite | la regla también para el personal | falla |
| pgTAP 18 · RF-02 | `bookable_services` sin el tiempo (`null`) | falla |
| sandbox · cuatro a la vez dejan una | la regla antes de bloquear el día | falla |
| `booking-estimate` · CA-08 | mostrar algo sin servicios elegidos | falla |
| `booking-estimate` · CA-07 (faltan) | sin nombrar los que no tienen tiempo | falla (también las 3 E2E nuevas) |
| `booking-estimate` · CA-07 (ninguno) | sin «Sin tiempo estimado» | falla |
| `my-reservation-form` · CA-06 | sumar lo no ofrecido para el vehículo | falla |
| `my-reservation-form` · CA-02 | el mensaje sin «ese día» | falla |
| `my-reservations-screen` · CA-05 | una sola pendiente por vehículo | falla |
| `my-reservation-form` · CA-06 al cambiar (en `/verificar`) | sin estimado al cambiar una reserva | falla |

Al final, `git diff` y `grep` (`{false &&`, `{true &&`, `null::smallint` en la migración) sin restos.

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T001, T030 |
| CA-02 | T001, T012, T030 |
| CA-03 | T001 |
| CA-04 | T001 |
| CA-05 | T013 |
| CA-06 | T010, T011, T030 |
| CA-07 | T010 |
| CA-08 | T010 |
| RF-01 | T001, T002 |
| RF-02 | T001, T011 |
| RN-01 | T001 |
| RN-02 | T010 (solo muestra; no cambia franjas ni tolerancia) |
| RN-03 | T001 |
