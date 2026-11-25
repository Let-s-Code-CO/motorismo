---
spec: "022"
actualizado: 2026-11-25
---

# Tareas — 022 Registrar cliente y su primer vehículo desde «Nueva orden»

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`, `m/` = `w/src/modules/`,
  `db/` = `packages/supabase/supabase/`.
- Rama `feature/022-cliente-desde-orden` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 pgTAP en rojo: `db/tests/19_register_customer.test.sql` (CA-06, CA-07, RN-01, RN-03).
  - El personal registra solo al cliente: un cliente sin vehículos, con su origen, quién lo
    registró y el consentimiento, como un alta de hoy.
  - El personal registra cliente y vehículo: el vehículo es de ese cliente.
  - Placa ya usada → `vehicle_plate_taken` y ningún cliente nuevo (RN-01).
  - Correo ya usado → `customer_email_taken` y ningún vehículo nuevo.
  - Un cliente con cuenta no puede usarla (RN-03); `function_privs_are` sin `anon`.
  - Verificable: `pnpm db:test` falla (la función no existe).
- [x] T002 Migración `db/migrations/<timestamp>_register_customer.sql` (RF-02, RN-01).
  - `register_customer`, `security invoker`: el alta del cliente y, con `p_vehicle_type`, la del
    vehículo con `save_vehicle`.
  - Permisos: sin `anon`. Línea `-- seeds: unchanged — …`.
  - Verificable: `pnpm db:reset` + `pnpm db:test` en verde.
- [x] T003 `pnpm db:types` y `types:check` en verde.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/src/modules/customers/utils/search-prefill.utils.test.ts` (CA-04).
  - «300 123 4567» → celular.
  - «UIH-03D» → placa de moto.
  - «KDM482» → placa de carro.
  - «Camila» → nombre.
  - Vacío → nada.
  - Un número que no es celular → nombre.
- [x] T011 [P] `t/src/modules/customers/components/customer-form.component.test.tsx` (CA-04 a
  CA-07).
  - Sin marcar la casilla, envía solo el cliente.
  - Al marcarla aparecen los campos del vehículo («Primer vehículo»); con un vehículo inválido no
    envía nada.
  - Con vehículo válido, envía los dos.
  - `vehicle` + `plateTaken` de la base → el error bajo «Placa».
  - `initialSearch` llena el campo que corresponde.
- [x] T012 [P] `t/src/modules/work-orders/components/customer-picker.component.test.tsx` (CA-01 a
  CA-03, CA-08, CA-09).
  - En la orden, «Registrar cliente» a la vista; abre «Nuevo cliente» con el texto buscado.
  - Al guardar, el cliente queda elegido y su único vehículo también, en la orden y en la reserva.
  - Al cancelar, la búsqueda sigue.
- [x] T013 [P] `t/src/modules/customers/actions/customers.actions.test.ts` (si existe; si no,
  junto a T011).
  - `createCustomer` llama a `register_customer` con o sin vehículo.
  - Un error `vehicle_*` vuelve como `{ error: 'vehicle', vehicleError }`.

## Fase 3 — Implementación (verde)

- [x] T020 `m/vehicles/components/molecules/vehicle-fields.component.tsx`: extraer los campos de
  `VehicleForm`, que queda igual por fuera. Verificable: `vehicle-form.component.test.tsx` sin
  cambios y en verde.
- [x] T021 `m/customers/utils/search-prefill.utils.ts` (verde T010).
- [x] T022 `m/customers/schemas/customer.schema.ts` (`registerCustomerSchema`) y
  `m/customers/actions/customers.actions.ts` (`createCustomer` con `register_customer` y los
  errores del vehículo) (verde T013).
- [x] T023 `m/customers/components/organisms/customer-form.component.tsx`.
  - La casilla y la parte «Primer vehículo» con `VehicleFields` y su `useForm`.
  - La validación conjunta y los errores en su campo.
  - `initialSearch`.
  - Mensajes en `m/customers/messages/es.json`.
  - Verde T011.
- [x] T024 `m/work-orders/components/organisms/customer-picker.component.tsx`: «Registrar cliente»
  siempre a la vista, con `initialSearch` (verde T012).

## Fase 4 — E2E

- [x] T030 `w/e2e/work-orders.spec.ts` (CA-01, CA-03, CA-08).
  - En «Nueva orden», buscar a alguien que no existe y pulsar «Registrar cliente».
  - Llenarlo con su moto y guardar.
  - La orden queda con ese cliente y esa moto; añadir un servicio y guardar la orden.
- [x] T031 [P] `w/e2e/customers.spec.ts` (CA-10): «Nuevo cliente» con su primer vehículo; la ficha
  muestra la placa.
- [x] T032 [P] `w/e2e/a11y.spec.ts`: «Nuevo cliente» con la parte del vehículo abierta y sus errores
  a la vista, en claro y oscuro.
- [x] T033 [P] Teléfono.
  - «Nueva orden» con el formulario abierto en `ui.spec.ts` «on an iPhone» (sin desplazamiento
    lateral).
  - Capturas a 360 y 440 px.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` + `test:sandbox` en verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` limpio);
  tabla de mutaciones aquí.
- [x] T093 Documentación.
  - Enmiendas de la spec 004 (HU-06) y de la 008 (CA-01).
  - `CLAUDE.md` (clientes: `register_customer` y el primer vehículo).
  - Spec en `implementada`, plan y backlog al día.

## Añadido durante la implementación (pedidos del usuario al verlo)

- **«Registrar cliente» como enlace** dentro de la frase de debajo de la búsqueda: «No se encontró
  ningún cliente activo. Registrar cliente» o «¿Es un cliente nuevo? Registrar cliente». Lo prueban
  `customer-picker.component.test.tsx` y las E2E.
- **CA-11 (HU-03): la placa con la que coincidió la búsqueda**, completa (ciudad del carro o
  «COLOMBIA» de la moto) y a la derecha, solo si coincidió por placa. Partes:
  - `plate-search.utils` (pura, con su prueba);
  - `searchCustomers` (pide las placas activas que contienen lo buscado);
  - el buscador y `e2e/work-orders.spec.ts`.
  - Seed: Gabriel tiene además la AKT `UIH-58E` y el Mazda `KDM-917` de Medellín, para que «UIH» y
    «KDM» den dos resultados.
- **`ColorSelect` con `shouldCloseOnScroll: false`:** lo encontró la E2E de la orden. La lista de
  colores se cerraba al abrirla con el ratón en un modal más alto que la pantalla.
- **Placas con ancho fijo** (pedido del usuario): `PlateLabel` tiene el mismo ancho para cualquier
  placa (116 px, o 80 px en tamaño pequeño), y una ciudad larga reduce su letra en vez de cortarse.
  Es provisional: la spec 023 la rehará con las medidas de la norma colombiana.
- **Resultados finales:**
  - lint, tipos y build en verde;
  - 1518 unitarias, pgTAP 778 y sandbox 55;
  - E2E contra producción: 255 de 257. Las dos que fallaron (`payroll.spec` «sees the month in
    progress…» y `ui.spec` «with a slow network…») pasaron dos veces aisladas desde una base limpia,
    y no tocan esta spec.
- **Pruebas de base de datos en archivo propio:** `tests/19_register_customer.test.sql` (11
  aserciones).

## Mutaciones (T092)

| Prueba | Mutación | Resultado |
|---|---|---|
| pgTAP 19 · CA-07 | sin registrar el vehículo | falla |
| pgTAP 19 · RN-01, RN-03 | `security definer` | falla: el alta pierde la sesión del personal (`customers_counter_has_registrar`), lo que muestra que la función depende de la RLS y la guarda de siempre |
| pgTAP 19 · RN-03 (`anon`) | `grant … to anon` | falla |
| `search-prefill` | sin reconocer el celular / toda placa como moto | falla |
| `customer-form` · CA-07 | no envía el vehículo / envía sin revisarlo / la placa usada fuera de su campo | falla |
| `customer-form` · CA-04 | ignora lo buscado | falla |
| `customers.actions` · CA-07 | errores del vehículo como del cliente / sin el vehículo en la llamada | falla |
| `customer-picker` · CA-01, CA-04 | el enlace solo para reservas / sin pasar lo buscado / sin la frase con resultados | falla |
| `customer-picker` · CA-09 | la reserva no elige al cliente registrado | falla |
| `plate-search` · CA-11 | sin normalizar / cualquier texto como placa / cualquier placa del cliente / sin ciudad | falla |
| `customer-picker` · CA-11 | sin mostrar la placa | falla |
| E2E `work-orders` · CA-11 | la consulta no busca placas | falla |
| E2E `work-orders` · CA-01, CA-08 | `ColorSelect` con su valor por defecto (antes del arreglo) | falla (lista cerrada) |

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T012, T030 |
| CA-02 | T012 |
| CA-03 | T012, T030 |
| CA-04 | T010, T011 |
| CA-05 | T011 |
| CA-06 | T001, T011 |
| CA-07 | T001, T011, T013 |
| CA-08 | T012, T030 |
| CA-09 | T012 |
| CA-10 | T031 |
| RF-01 | T012 |
| RF-02 | T011, T020 |
| RN-01 | T001 |
| RN-02 | T001 (reglas de cliente y vehículo de siempre), T011 |
| RN-03 | T001 |
| CA-11 | `plate-search.utils.test.ts`, `customer-picker.component.test.tsx`, `e2e/work-orders.spec.ts` |
