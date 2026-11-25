---
spec: "021"
estado: aprobado
actualizado: 2026-11-25
---

# Plan técnico — 021 Reservas del cliente: varias por vehículo y tiempo estimado

## Resumen

Una migración cambia dos cosas.
- **La regla del cliente en `save_reservation`:** pasa de «una pendiente por vehículo» a «una por
  vehículo y día». La comprobación ocurre con el día bloqueado, para que dos envíos a la vez no la
  burlen.
- **`bookable_services`:** devuelve también el tiempo estimado de cada servicio.

En la app, el formulario de reserva del cliente suma los tiempos de los servicios marcados con la
utilidad que ya usan las órdenes (`orderEstimate`). Lo muestra en una línea que se anuncia al
cambiar. El mensaje del límite pasa a decir «ese día».

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 021 `aprobada`; enmienda la 014 (RN-03, CA-15) en su historial al implementarla. |
| II. Qué antes que cómo | ✅ | La spec no nombra tecnología; el cómo vive aquí. |
| III. Criterios verificables | ✅ | Cada CA con pgTAP, Vitest o Playwright (tabla abajo). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias; se reutilizan `orderEstimate` y `useDuration`. |
| VI. Seguridad y datos personales | ✅ | La regla vive en Postgres (`security definer`); al cliente se le abre solo el tiempo de los servicios, nunca el precio ni el catálogo (RN-03). |
| VII. Trazabilidad | ✅ | Pruebas citan `spec 021, CA-xx`. |
| VIII. Incrementos pequeños | ✅ | Una migración y un formulario; HU-01 y HU-02 se pueden desplegar por separado. |

## Base de datos (packages/supabase)

- **Migración nueva** `<timestamp>_customer_reservations_per_day.sql` (posterior a todas las de
  `develop`).
- **`public.save_reservation`** (`create or replace`, la misma firma):
  - **Cálculo del día:** `v_day` (día de `p_slot_start` en `America/Bogota`) se calcula siempre, no
    solo cuando cambia la franja.
  - **Bloqueo del día:** la fila de `agenda_days` de ese día se bloquea (`for update`) en las dos
    ramas: en la de franja cambiada ya se hacía; en la de franja igual se añade, porque cambiar
    solo el vehículo también puede chocar.
  - **Regla del cliente** (`not v_staff`), comprobada **después** de bloquear el día: no debe
    existir otra reserva pendiente del mismo cliente, con el mismo vehículo (o las dos sin
    vehículo, `is not distinct from`), en el mismo día de Colombia (`id is distinct from p_id`).
    El *hint* sigue siendo `reservation_customer_limit`.
  - **Personal:** su rama no cambia (spec 012, RN-03: solo la misma franja).
- **`public.bookable_services`:**
  - **Nueva firma:** `drop function` + `create`, porque una función no cambia sus columnas de
    salida con `create or replace`. Devuelve `(id, name, motorcycle, car, bicycle,
    estimated_minutes)`.
  - **Permisos:** los mismos que hoy (`revoke` a `public, anon`; `grant` a `authenticated,
    service_role`).
  - **Comentario:** el de la función se actualiza (spec 021, RN-03: tiempos sí, precios no).
- **Sin tablas, columnas ni políticas nuevas.** Las tablas siguen cerradas al cliente.
- **Seeds:** `-- seeds: unchanged — la regla solo restringe nuevas reservas; los seeds ya cumplen
  una por vehículo y día`.
- **pgTAP** (`tests/13_customer_area.test.sql`, se amplía):
  - CA-01: el mismo vehículo, reservado otro día por el cliente, queda pendiente (dos pendientes).
  - CA-02: el mismo vehículo el mismo día a otra hora → `reservation_customer_limit`.
  - CA-03: «Sin vehículo» otro día sí; el mismo día no.
  - CA-04: cambiar una reserva a un día en que ese vehículo ya tiene otra →
    `reservation_customer_limit`, y la reserva sigue igual. Cambiar solo el vehículo, sin cambiar la
    franja, a uno que ya tiene reserva ese día → lo mismo.
  - Personal: puede hacerle dos el mismo día (franjas distintas) a ese vehículo (spec 012).
  - `bookable_services` devuelve `estimated_minutes` (con un servicio sin tiempo → nulo);
    `function_privs_are` para `anon` sin cambios.
  - Se reescriben las dos aserciones de hoy de CA-15 (spec 014), que pasan a «el mismo día».

## Aplicación (apps/web)

- **Módulo** `src/modules/customer-area/`:
  - `types/customer-area.types.ts`: `BookableService` sale del tipo generado. Con `WithNulls`,
    `estimated_minutes` es `number | null`, porque el generador lo marca no nulo (CLAUDE.md, spec
    014).
  - `components/molecules/booking-estimate.component.tsx` (nuevo): recibe los servicios elegidos y
    muestra el estimado.
    - Con `orderEstimate` (de `work-orders/utils`, como ya hace `shop-order-card`) y `useDuration`.
    - Con estimado: «Tiempo estimado: ≈ 2 h 15 min».
    - Con servicios sin tiempo: añade «Sin estimar: Micropulido»; si ninguno tiene tiempo, «Sin
      tiempo estimado».
    - Sin servicios elegidos: no muestra nada.
    - Va en un contenedor `aria-live="polite"` que siempre está montado.
  - `components/organisms/my-reservation-form.component.tsx`: lee `service_ids` con `useWatch` y
    pinta `BookingEstimate` bajo los servicios con los que estén marcados y ofrecidos para el
    vehículo.
  - `messages/es.json`: `form.estimate` («Tiempo estimado: ≈ {duration}»), `form.estimateMissing`
    («Sin estimar: {names}»), `form.estimateNone` («Sin tiempo estimado»). `errors.customerLimit`
    pasa a «Ese vehículo ya tiene una reserva ese día (o ya tienes una sin vehículo ese día):
    cámbiala si quieres otra hora.».
- **Rutas, Server Actions y esquemas:** sin cambios. `getBookableServices` ya pasa la fila entera.
- **«Mis reservas» e inicio:** sin cambios de código. Ya listan todas las pendientes por fecha y el
  inicio toma la más próxima; se cubren con pruebas (CA-05).

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | pgTAP + e2e | `tests/13_customer_area.test.sql`; `e2e/customer-area.spec.ts` (reservar la Suzuki de Camila otro día además de la del seed) |
| CA-02 | pgTAP + unit + e2e | `13_customer_area.test.sql`; `customer-area-errors.utils.test.ts` (mensaje «ese día»); `customer-area.spec.ts` (mismo día → el mensaje, sin crearla) |
| CA-03 | pgTAP | `13_customer_area.test.sql` |
| CA-04 | pgTAP | `13_customer_area.test.sql` (cambiar día y cambiar vehículo) |
| CA-05 | componente | `my-reservations-screen.component.test.tsx` (dos pendientes del mismo vehículo, cada una con «Cambiar» y «Cancelar»); `customer-home.component.test.tsx` (la más próxima) |
| CA-06 | componente + e2e | `booking-estimate.component.test.tsx` (30 + 90 = «≈ 2 h»); `my-reservation-form.component.test.tsx` (marcar y desmarcar actualiza); `customer-area.spec.ts` |
| CA-07 | componente | `booking-estimate.component.test.tsx` (uno sin tiempo → «Sin estimar: …»; ninguno → «Sin tiempo estimado») |
| CA-08 | componente | `booking-estimate.component.test.tsx` (vacío → nada) |
| RN-03 | pgTAP | `13_customer_area.test.sql`: `bookable_services` sin precio y `services` sigue cerrado al cliente |
| Accesibilidad y móvil | e2e | `a11y.spec.ts` (el formulario con el estimado, claro y oscuro); `ui.spec.ts` «on an iPhone» (sin desplazamiento lateral) |

## Archivos afectados

- **Nuevos:**
  - `packages/supabase/supabase/migrations/<timestamp>_customer_reservations_per_day.sql`
  - `apps/web/src/modules/customer-area/components/molecules/booking-estimate.component.tsx`
  - `apps/web/__test__/src/modules/customer-area/components/booking-estimate.component.test.tsx`
- **Modificados:**
  - `packages/supabase/supabase/tests/13_customer_area.test.sql`
  - `packages/supabase/types/database.types.ts` (generado)
  - `customer-area/types/customer-area.types.ts`
  - `customer-area/components/organisms/my-reservation-form.component.tsx`
  - `customer-area/messages/es.json`
  - Las pruebas de `customer-area` de arriba, `e2e/customer-area.spec.ts`, `e2e/a11y.spec.ts`
  - `specs/014-experiencia-cliente/spec.md` (enmienda), `CLAUDE.md` (sección «Área del cliente»)
- **Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Comprobar el límite después de bloquear el día, en las dos ramas. | Dejarlo antes, como hoy. | Con varias por vehículo, dos envíos a la vez de días iguales podrían colarse; el bloqueo del día ya serializa las reservas de ese día (spec 012, CA-06). |
| Mantener el *hint* `reservation_customer_limit`. | Uno nuevo (`…_day_limit`). | La regla es la misma, con otro alcance; solo cambia el texto. |
| Abrir `estimated_minutes` en `bookable_services`. | Leerlo del catálogo. | El catálogo sigue cerrado al cliente (spec 007); la función ya decide qué ve. |
| Reutilizar `orderEstimate` de `work-orders`. | Copiar la suma en `customer-area`. | Misma regla («mínimo» con servicios sin tiempo, spec 008); `shop-order-card` ya la importa. |

## Ajustes durante la implementación

- Las pruebas pgTAP de la spec 021 van en su propio archivo,
  `tests/18_customer_reservations_per_day.test.sql`. En `13_customer_area` solo cambian las
  descripciones de CA-15, que ya probaban el mismo día. Así no se reordenan sus pendientes.
- Una prueba de concurrencia en `__test__/sandbox/reservations.sandbox.test.ts`: la que hace valer
  la decisión de comprobar con el día bloqueado.
- La región del estimado es `aria-live="polite"` sin `role="status"` (el formulario ya tiene un
  estado para el día cerrado), marcada con `data-booking-estimate`.
- El texto del límite se prueba en `my-reservation-form.component.test.tsx`, donde se muestra; la
  utilidad de errores solo traduce el *hint* a una clave, que no cambia.

## Despliegue

Migración primero (el cambio de `bookable_services` añade una columna: la app de hoy la ignora), luego
la app. Sin variables nuevas.
