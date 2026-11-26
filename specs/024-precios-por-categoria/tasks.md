---
spec: "024"
actualizado: 2026-11-26
---

# Tareas — 024 Categoría de moto y precios por categoría

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`, `m/` = `w/src/modules/`,
  `db/` = `packages/supabase/supabase/`.
- Rama `feature/024-precios-por-categoria` desde `develop`.

## Fase 0 — Datos de la lista

- [x] T000 Clasificar las 173 líneas de moto del catálogo inicial (CA-18).
  - Cada línea con su categoría según la ficha del fabricante.
  - Tabla en este archivo con los casos fronterizos (scooters medianos, *scrambler*, motos de trabajo)
    para que el usuario los revise.
  - Verificable: ninguna línea de moto sin categoría en la lista.
- [x] T001 Transcribir la lista de precios de las imágenes (CA-17): nombres, valores por categoría y
  únicos, tiempos y descripciones.
  - Verificable: tabla aquí, cotejada con las cuatro imágenes.

### Registro de T000

- **Clasificadas:** las 173 líneas de moto de la migración del catálogo (`20261119211116`); en la base
  local hay 175 porque el seed añade «Fz 2.0» bajo Honda y Yamaja (por revisar, spec 018).
- **Por categoría:** Street/Roadster 73, SBK/SSP 21, Scooter 16, Maxi Scooter 3, Trail 23, Maxi Trail 19, Cruiser/Clásica 13, Maxi Cruiser 5.
- **Casos dudosos (32), para que el usuario los revise:**

| Elegida | Líneas | Por qué |
|---|---|---|
| Street/Roadster | AKT Special 110, Bajaj Boxer CT 100, Bajaj Boxer S, Bajaj Platino 100, Honda Wave 110, Yamaha Crypton FI, Suzuki Viva R 115, Suzuki Best 125, Suzuki AX4, Suzuki GN 125, TVS Sport 100, TVS Ronin 225, Hero Splendor Plus, Hero Eco Deluxe, Victory One, Victory Combat 100, Royal Enfield Hunter 350 | Motos de trabajo, *underbone* y retro pequeñas: no tienen categoría propia; la más cercana. |
| Scooter | Honda Navi 110, Honda PCX 160, Honda ADV 160, Yamaha NMAX 155 | Scooters medianos (125–160 cc): Scooter, no Maxi Scooter. |
| Maxi Scooter | Vespa GTS 300 | Scooter de 300 cc de carrocería grande. |
| Trail | Royal Enfield Scram 411, CFMoto 450MT, Voge 500DS | *Adventure* de cilindrada media (400–500 cc). |
| Maxi Trail | Kawasaki KLR 650, Voge 525DSX | *Adventure* o *dual sport* de 525 cc o más. |
| Cruiser/Clásica | Ducati Scrambler Icon, Triumph Scrambler 400 X, Benelli Leoncino 500 | *Scrambler* y retro: como Clásica. |
| Maxi Cruiser | Royal Enfield Super Meteor 650, Harley-Davidson Sportster S | Cruiser de más de 650 cc. |

### Registro de T001

Valores en el orden Street/Roadster, SBK/SSP, Scooter, Maxi Scooter, Trail, Maxi Trail, Cruiser/Clásica
y Maxi Cruiser; cotejados con las cuatro imágenes.

| Servicio | Valor de moto | Tiempo | Descripción |
|---|---|---|---|
| Lavado Pro Wash | 44.000 · 46.000 · 42.000 · 46.000 · 48.000 · 52.000 · 44.000 · 48.000 | — | Shampoo alcalino en las partes bajas y de pH neutro en las zonas altas; sellador en las zonas negras. |
| Paquete de lavado Premium | 99.000 · 101.000 · 97.000 · 101.000 · 103.000 · 107.000 · 99.000 · 103.000 | 2 h | Pro Wash, limpieza completa de kit con tapa piñón, sellador acrílico y limpieza de asientos. |
| Combo de lavado Deluxe | 170.000 · 182.000 · 178.000 · 180.000 · 175.000 · 182.000 · 170.000 · 180.000 | 3 h 30 min | Pro Wash, desengrasado y lubricado de cadena y micropulido al 60 % (no aplica a pintura mate). |
| Combo de lavado Supreme | 700.000 · 850.000 · 750.000 · 800.000 · 830.000 · 900.000 · 700.000 · 750.000 | — (2 días hábiles) | Pro Wash, kit con tapa piñón, asientos, micropulido al 90 % y recubrimiento cerámico por 3 años. |
| Limpieza de asientos | 16.000 | — | Se retiran los asientos para limpiar la zona e hidratar el cuero. |
| Sellador | 15.000 | — | Sellador acrílico en pintura mate o brillante: protección e hidrorrepelencia. |
| Desengrasado de cadena | 7.000 | — | |
| Lubricado de cadena | 9.000 | — | |
| Desengrasado y lubricado de cadena | 16.000 | — | |
| Limpieza completa de kit con tapa piñón | 26.000 | — | |
| Limpieza completa de kit con tapa piñón y cubrecadena | 46.000 | — | |
| PPF | a convenir | a convenir | Película de protección de pintura: valor y tiempo según el vehículo. |

- Los servicios de valor único son solo para moto (la lista es de motos); carro y bicicleta, sin valor.
- El «ahorro de $ 2.000» del Premium no se calcula (fuera de alcance).

## Fase 1 — Base de datos

- [x] T002 pgTAP en rojo: `db/tests/21_motorcycle_categories.test.sql` (CA-01 a CA-03, CA-05, CA-06,
  CA-08, CA-10 a CA-14, CA-16 a CA-19, RN-01 a RN-04).
  - **Esquema:** enum y columnas, `check` de motos, *trigger* de líneas, privilegios por columna y de
    las funciones.
  - **Categoría:** `set_vehicle_line_category` solo admin; herencia y categoría propia (cambiar la
    línea cambia la moto sin propia); el guardia frente a un cliente; `set_vehicle_category` solo
    personal.
  - **Servicios:** `valid_category_prices` (7 de 8 no, 8 sí, con valor único no); `on_quote` sin
    valores ni tiempo; descripción de hasta 300.
  - **Orden:**
    - el valor por categoría;
    - una moto sin categoría responde `work_order_category_required`;
    - un servicio a convenir sin valor responde `work_order_price_required`;
    - una línea guardada no cambia si cambia la categoría.
  - **Reserva:**
    - minutos de un servicio a convenir, exigidos al personal;
    - el cliente con uno responde `reservation_service_quoted`;
    - `bookable_services` sin ellos;
    - `reservation_summaries` con el tiempo total.
  - **Datos:** 173 líneas con categoría, los servicios de la lista con sus valores (p. ej. Pro Wash de
    Maxi Trail, $ 52.000) y el PPF a convenir.
  - Verificable: falla contra el esquema actual.
- [x] T003 Migración `db/migrations/<timestamp>_motorcycle_categories.sql`, creada con
  `migration:new` (RF-01 a RF-03).
  - Enum; columnas de línea, moto y servicio; `check` y *trigger*.
  - Funciones: `private.vehicle_category`, `service_price`, `service_offered`,
    `valid_category_prices`; `set_vehicle_line_category`, `set_vehicle_category`.
  - `vehicles_guard`, `save_vehicle` (con `p_motorcycle_category` y `p_set_category`) y
    `vehicle_catalog`, desde su última versión.
  - `work_order_write_lines`, `save_work_order`, `correct_work_order`, `save_reservation`,
    `bookable_services` y `reservation_summaries`, desde su última versión.
  - Datos: categorías de las líneas (T000) y lista de precios (T001).
  - Verificable: `pnpm db:reset` + `pnpm db:test` en verde (T002).
- [x] T004 Seeds `04`, `05` y `06` con los servicios nuevos.
  - Una moto sin categoría (línea por revisar) y otra con categoría propia.
  - Las pgTAP existentes (`09` a `18`) ajustadas a las columnas y los nombres nuevos.
  - Verificable: `db:reset` + `db:test` en verde.
- [x] T005 `pnpm db:types` y `types:check` en verde.

### Registro de la fase 1

- **Migración** `20261126160457_motorcycle_categories.sql`; pgTAP `21_motorcycle_categories` con 44
  aserciones (866 en total, en verde). Ajustes que salieron al probar:
  - `private.valid_category_prices` necesita `execute` para `authenticated`: el `check` corre con los
    permisos de quien escribe el servicio (el admin);
  - la lista de precios se inserta filtrando los nombres existentes, no con `on conflict`: el guardia de
    servicios rechaza un nombre repetido con un error antes de insertar;
  - `work_order_write_lines` lee la categoría de la moto desde la orden y conserva su firma, así que
    `save_work_order` y `correct_work_order` no se recrean.
- **Seeds:** las motos usan la lista (Camila, SBK/SSP: #2 = 46.000 + 182.000 − 5.000 = 223.000). Quedan
  cuatro servicios de ejemplo sin valor de moto para el carro y la bicicleta. Gabriel (UIH-58E) tiene
  categoría propia (Trail, la de su línea es Street/Roadster). Tomás Torres, en el punto de atención,
  tiene una Kawasaki KLX 300 de una línea nueva, sin categoría.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] Servicios (CA-07 a CA-09, CA-12, CA-19).
  - `service.schema.test`: único o por categoría (ocho o ninguna, nunca los dos); a convenir sin
    valores ni tiempo; descripción.
  - `service-form.component.test`: «Único» / «Por categoría»; ocho campos con su categoría; «A
    convenir» oculta valores y tiempo; errores junto a cada campo.
  - `services-table.component.test`: el rango; «A convenir»; la descripción bajo el nombre.
- [x] T011 [P] Vehículos (CA-01 a CA-05).
  - `vehicle-category.utils.test`: propia ?? línea.
  - `vehicle-form.component.test`:
    - al elegir la línea toma su categoría;
    - cambiarla la envía como propia;
    - con `audience="customer"`, sin el campo.
  - `vehicle-summary.component.test`: la categoría para el personal, no para el cliente.
  - `vehicle-catalog-screen` / `catalog-category-dialog.component.test`: categoría de cada línea;
    cambiarla con `callAction` y `notify`.
- [x] T012 [P] Órdenes (CA-04, CA-06, CA-10, CA-11, CA-13).
  - `line-price.utils.test`: el valor por categoría, el único, nulo para a convenir y para moto sin
    categoría.
  - `order-editor.component.test`:
    - la categoría en la cabecera;
    - diálogo de categoría y `setVehicleCategory`, luego la línea con su valor;
    - una línea a convenir sin valor no se guarda;
    - después de cambiar la categoría, las nuevas líneas traen la nueva.
  - `customer-picker.component.test`: la categoría en cada moto.
- [x] T013 [P] Reservas (CA-14 a CA-16).
  - `reservation-form.component.test`: minutos de un servicio a convenir, obligatorios; tiempo
    estimado total.
  - `reservation-detail`: el tiempo estimado.
  - `reservation-lines.utils.test`: lleva a la orden el tiempo de la reserva, sin valor.
  - `my-reservation-form`: no ofrece los a convenir.

## Fase 3 — Implementación (verde)

- [x] T020 `m/services`: esquema, formulario, lista, acciones y mensajes (verde T010).
- [x] T021 `m/vehicles`: constantes y utilidad de categorías, campos y formulario, resumen, lecturas
  (`line:vehicle_lines(…, motorcycle_category)`), `saveVehicle` y mensajes.
- [x] T022 «Marcas y líneas»: categoría por línea, `catalog-category-dialog` y `setLineCategory`
  (verde T011).
- [x] T023 `m/work-orders`: `referencePrice(service, vehicle)`, editor con el diálogo de categoría y las
  líneas a convenir, `setVehicleCategory`, `customer-picker` (verde T012).
- [x] T024 `m/reservations`: minutos de los a convenir en el formulario, `BookingEstimate` en `core`,
  detalle y `linesFromReservation` (verde T013).
  - Verificable: `pnpm ts:check` y `pnpm test` en verde; se mira en el navegador, en claro y oscuro,
    en escritorio y en el teléfono.

## Fase 4 — E2E y regresión

- [x] T030 `w/e2e/services.spec.ts`: la lista con Pro Wash y sus ocho valores; registrar un servicio por
  categoría y uno a convenir (CA-07 a CA-09, CA-12, CA-17, CA-19).
- [x] T031 `w/e2e/vehicle-catalog-admin.spec.ts`: cambiar la categoría de una línea y verla en una moto
  que la sigue (CA-01, CA-03, CA-18).
- [x] T032 `w/e2e/work-orders.spec.ts`: una moto sin categoría pide la categoría; el valor de su
  categoría; el PPF con valor escrito (CA-06, CA-10, CA-13).
- [x] T033 `w/e2e/reservations.spec.ts`: el personal reserva con PPF y su tiempo; «Llegó» lo lleva a la
  orden; el cliente no lo ve (CA-14 a CA-16).
- [x] T034 [P] `a11y.spec.ts` (formulario de servicio con ocho valores y errores; diálogos de
  categoría) y `ui.spec.ts` (servicio, orden y reserva a 360 px y en el iPhone) (RNF).
- [x] T035 Regresión: las E2E de órdenes, reservas, reporte, liquidación y área del cliente con los
  servicios nuevos.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` + `test:sandbox` en verde.
- [x] T092 Mutación aplicada a cada prueba nueva que no se escribió en rojo, fallo observado y revertida
  (`git diff` limpio); tabla de mutaciones aquí.
- [x] T093 Documentación.
  - Enmiendas de las specs 005, 007, 008, 012/014 y 018.
  - `CLAUDE.md`: categorías, valores por categoría, servicios a convenir; seeds con los servicios
    nuevos.
  - Spec en `implementada`, plan y backlog al día.

### Registro de las fases 2 a 4

- **Reservas:** `service_minutes` en el formulario (un campo por servicio a convenir marcado, de 5 a
  1.440), en el esquema y en la acción (`p_service_minutes`). `BookingEstimate` pasa a `core` (textos
  en `core.estimate`) y se ve en el formulario del personal; el detalle de la reserva muestra
  «Tiempo estimado» (`estimated_minutes`, `unestimated`). `ReservationSummary.service_minutes` se
  tipa con elementos nulos (el generador los marca no nulos).
- **Orden desde una reserva:** `linesFromReservation` lleva el tiempo de la reserva a los a convenir
  (CA-15). El diálogo de categoría atiende en cola todos los servicios por categoría que trae la
  reserva (antes solo el último) y «omitidos» se calcula en vez de guardarse en estado.
- **Buscador de clientes:** la categoría de cada moto como descripción del radio (CA-04).
- **«Servicios» en tarjetas** (a pedido del usuario: la tabla «parecía un documento de Word»): tres
  grupos —«Paquetes por categoría» (de menor a mayor), «Valor único», «A convenir»—; cada paquete
  con su rango (Geist con cifras alineadas) y sus ocho valores en dos columnas, etiqueta sobre valor;
  un tipo de vehículo al que no se ofrece no se nombra (enmienda de la spec 007, CA-02). Revisado en
  escritorio claro y oscuro, a 360 px y en el iPhone de 440 px, sin desplazamiento lateral.
- **Fallos reales que encontraron las E2E:**
  - el formulario de servicio envía a la acción sus valores ya transformados, sin
    `motorcycle_mode`; al validarlos de nuevo se tomaba «Único» y se rechazaba un servicio por
    categoría. Ahora el modo se deduce de los valores (prueba «accepts its own output again»);
  - `catalogLinesSchema` descartaba la `category` que devuelve `vehicle_catalog`: la línea seguía
    «Sin categoría» después de elegirla;
  - `forEach(addService)` pasaba el índice como categoría conocida.
- **Regresión:** las E2E usan los servicios nuevos (una moto ya no toma «Lavado sencillo»); el reporte
  y las órdenes de los seeds cambian de valores. «Servicios» se busca por tarjeta (`article`). La
  auditoría de «Servicios» reintenta el menú de la tarjeta (la lista es larga y el desplazamiento lo
  cerraba), como ya hacía `services.spec`. `loading.spec` «signing in…» se marca `test.slow()`: espera
  dos veces hasta 30 s con un límite total de 30 s.

### Definición de terminado

- `pnpm lint`, `pnpm ts:check`, `pnpm build`: en verde. `pnpm test`: 167 archivos, 1.734 pruebas.
- `pnpm db:reset` + `pnpm db:test`: 22 archivos, 866 pruebas. `types:check`: al día. `test:sandbox`:
  11 archivos, 55 pruebas.
- `pnpm test:e2e` desde un reset: 266 en verde y 4 fallos de carga en paralelo que pasan solos: el
  esqueleto con red lenta (`loading.spec` «a slow screen…» y `a11y.spec` «a screen still loading…»,
  claro y oscuro) y un desplegable de `vehicle-catalog.spec`. Los del esqueleto fallan igual sobre el
  código de `develop` con la misma carga: no son de esta spec.

### Mutaciones

Las pruebas escritas antes del código se vieron fallar en rojo (fases 1 y 2, el esquema de reservas,
el formulario y el detalle de la reserva, las tarjetas de servicios, el modo deducido del servicio y
`catalogLinesSchema`). A las demás se les aplicó una mutación, revertida después (`git diff` limpio):

| Código mutado | Mutación | Pruebas que fallan |
|---|---|---|
| `vehicle-summary` | sin la línea de categoría | 3 |
| `vehicle-catalog-screen` | sin el chip ni «Categoría» en el menú | 3 |
| `reservation-lines.utils` | sin el tiempo de la reserva para los a convenir | 1 (y 1 del editor) |
| `reservation-lines.utils` | `isOffered` → `referencePrice(…) !== null` | 5 |
| `reservations.schema` | sin descartar los minutos de un servicio desmarcado | 1 |
| `reservation-form` | el estimado ignora los minutos escritos | 1 |
| `reservation-form` | sin los minutos de la reserva al cambiarla | 1 |
| `reservations-errors.utils` | sin `reservation_quoted_minutes_required` | 1 |
| `reservation-detail` | sin la fila del tiempo estimado | 3 |
| `customer-picker` | sin la categoría en el radio | 1 |
| `order-editor` | la cola del diálogo guarda solo el último servicio | 1 |
| `line-price.utils` | `referencePrice` con el valor único en vez del de la categoría | 3 |
| `line-price.utils` | `isOffered` sin los a convenir | 1 |
| `service-cards` | los paquetes sin ordenar por valor | 1 |
| `order-detail` (verificación) | sin la categoría en la tarjeta de la orden | 2 |
| `service-combination.utils` | sin herencia de incluidos | 2 |
| `service-combination.utils` | sin el corte de bucle | la prueba del ciclo no termina |
| `service-combination.utils` | sin la regla de un paquete | 1 |
| `service-combination.utils` | sin la regla de cruce | 2 |
| `service-combination.utils` | marca los elegidos como no disponibles | 1 |
| `service-form` | ofrece los que ya lo incluyen | 1 |
| `reservation-form`, `my-reservation-form` | sin deshabilitar los no disponibles | 1 y 1 |
| `order-editor` | sin deshabilitar «Añadir» | 1 |
| `order-editor` | la línea sin «Incluye» | 1 |
| `order-editor` | el servicio añadido no se quita (vuelve a «Añadir») | 1 |
| `service-groups` | todo en «Servicios adicionales» | 3 |
| `reservation-lines.utils` (verificación) | sin omitir un servicio que ya se cruza | 1 |
| `reservation-form`, `order-editor` (verificación) | sin ordenar los paquetes por valor | 1 y 1 |

Dos guardas de `line-price.utils` (`on_quote` en `referencePrice` y `needsCategory`) sobrevivieron a
su mutación: eran redundantes (un servicio a convenir no tiene valores, lo exige la base) y se
quitaron.

### Verificación

- CA-04: la tarjeta de la orden guardada muestra la categoría de la moto (o «Sin categoría»); la orden
  y su editor comparten `vehicleCategoryQueryOptions` (`orderKeys.category`), así que lo que elige el
  diálogo se ve en ambos.
- RN-03 precisada en la spec: la app nunca muestra la categoría al cliente y la base le impide
  cambiarla; leerla no se bloquea (no es un dato personal ni un precio).
- `ui.spec` («on an iPhone»): el diálogo de categoría de una orden y el tiempo del PPF en una reserva,
  sin desplazamiento lateral.

## Fase 6 — Enmienda HU-05: paquetes e incluidos

- [x] T100 pgTAP en rojo (`21_motorcycle_categories`): `service_inclusions` (RLS, privilegios),
  `set_service_inclusions` (solo admin, ciclo), cierre heredado, datos de la lista, reservas del
  personal y del cliente y orden con dos paquetes o con cruce, «Otro» fuera, `bookable_services` con
  `includes` (CA-20, CA-22, CA-26).
- [x] T101 Migración (la misma, aún sin desplegar): tabla, funciones, la regla en `save_reservation`
  y `work_order_write_lines`, `bookable_services` y los incluidos de la lista. Seed de la orden #2.
  `db:reset`, `db:test`, `db:types`.
- [x] T102 [P] `service-combination.utils` en rojo y luego en verde (CA-23 a CA-25).
- [x] T103 Servicios: lecturas con `includes`, «Incluye» en el formulario y en la tarjeta, acciones
  con `set_service_inclusions` (CA-20, CA-21).
- [x] T104 Reservas del personal y del cliente: servicios no disponibles con su motivo; errores
  nuevos (CA-23 a CA-26).
- [x] T105 Órdenes: «Añadir X» no disponible con su motivo; «Incluye» en la línea del editor y del
  detalle; errores nuevos (CA-23 a CA-27).
- [x] T105b Grupos «Paquetes» y «Servicios adicionales» al elegir servicios en las dos reservas y en la
  orden (CA-28). En la orden, el botón de un servicio añadido lo quita («−», CA-29).
- [x] T106 E2E: reserva del personal y orden con Premium (Pro Wash y Sellador no disponibles, otro
  paquete tampoco); `services.spec` con «Incluye»; regresión por el seed de la orden #2 (reporte,
  órdenes); `a11y` y `ui` de los formularios con servicios no disponibles.
- [x] T107 Definición de terminado, mutaciones, documentación (`CLAUDE.md`, spec y plan) y
  `/verificar`.

### Registro de la fase 6 (HU-05)

- **Base:** `service_inclusions` (RLS: la lee el personal; nadie la escribe directo),
  `private.service_closure`, `set_service_inclusions` (solo admin, sin ciclos),
  `private.check_service_combination` en `save_reservation` y `work_order_write_lines`;
  `bookable_services` con `package`, `includes` (heredado) y los paquetes de menor a mayor valor (sin
  enviar el precio); los incluidos de la lista. pgTAP: 63 en el archivo 21 (885 en total).
- **Seeds:** la orden #2 de Camila pasa a Deluxe + Limpieza de asientos (193.000; 150.000 + 43.000).
  La prueba de CA-11 deja de repetir el mismo servicio (RN-06 lo impide): conserva la línea y luego
  la vuelve a añadir.
- **App:**
  - `service-combination.utils` (`closureOf`, `unavailableServices`, `combinableOf`, `byLowestPrice`);
  - `ServiceGroups` (CA-28) en las dos reservas y en la orden; el motivo («Incluido en …», «Ya hay
    un paquete: …», «Se cruza con …») va en la etiqueta de la casilla o en el botón, porque el
    `Checkbox` de HeroUI no pasa `aria-describedby`;
  - en la orden, el botón de un servicio añadido lo quita («−», «Quitar X de la orden», CA-29);
  - «Incluye» en el formulario, la tarjeta, la línea del editor y el detalle.
- **E2E:** órdenes (Deluxe deja a Pro Wash y Premium no disponibles; «Quitar … de la orden»),
  reserva del personal (grupos y paquete no disponible), cliente (un paquete), «Servicios» (Incluye);
  regresión del reporte y de las órdenes por el seed #2.
- **Definición de terminado:**
  - lint, tipos y build en verde; 1.778 unitarias; 885 pgTAP; tipos al día; sandbox 55;
  - E2E completa: 266 en verde y 5 que fallan solo en paralelo y pasan solas (las dos del
    esqueleto con red lenta, como en `develop`; dos de `vehicles.spec` y la búsqueda por placa de
    `work-orders.spec`).

### Verificación de la enmienda

- «Llegó» con una reserva cuyos servicios ya se cruzan: `linesFromReservation` deja fuera, en
  «omitidos», el que ya no va con los anteriores (el plan lo pedía y faltaba). La prueba del diálogo
  de categoría desde una reserva usa un paquete y un adicional: dos paquetes ya no pueden ir juntos.
- CA-28: prueba del orden de menor a mayor valor en la reserva del personal y en la orden.
- `a11y.spec` (claro y oscuro) y `ui.spec` (iPhone): una orden con un paquete añadido y los demás no
  disponibles.
- Comprobaciones: lint, tipos y build en verde; 1.781 unitarias; E2E de órdenes y reservas (17),
  accesibilidad e iPhone (5).

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T002, T011, T031 |
| CA-02, CA-03 | T002, T011, T031 |
| CA-04 | T011, T012 |
| CA-05 | T002, T011 |
| CA-06 | T002, T012, T032 |
| CA-07, CA-08 | T002, T010, T030 |
| CA-09 | T010, T030 |
| CA-10 | T002, T012, T032 |
| CA-11 | T002, T012 |
| CA-12 | T002, T010, T030 |
| CA-13 | T002, T012, T032 |
| CA-14 | T002, T013, T033 |
| CA-15 | T013, T033 |
| CA-16 | T002, T013, T033 |
| CA-17 | T001, T002, T030 |
| CA-18 | T000, T002, T031 |
| CA-19 | T002, T010, T030 |
| RF-01 a RF-03 | T002 |
| RN-01 a RN-04 | T002 |
| RNF | T034 |
| CA-20 a CA-22 | T100, T103 |
| CA-23 a CA-25 | T102, T104, T105, T106 |
| CA-26 | T100, T104, T105 |
| CA-27 | T105 |
| CA-28 | T105b, T106 |
| CA-29 | T105b, T106 |
