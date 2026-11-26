---
spec: "024"
estado: aprobado
actualizado: 2026-11-26
---

# Plan técnico — 024 Categoría de moto y precios por categoría

## Resumen

- **Categoría de la moto:**
  - Las ocho categorías son un tipo enumerado de Postgres. Cada línea de moto del catálogo tiene la
    suya, y cada moto puede tener una propia.
  - La categoría efectiva es la propia de la moto o, si no tiene, la de su línea (RN-04).
  - Solo el personal la escribe; lo comprueba la base.
- **Servicios:**
  - El valor de moto de un servicio es único (`price_motorcycle`, como hoy) o uno por categoría (un
    objeto con las ocho, en la misma fila: se guarda de una vez, como hoy).
  - Un servicio puede ser «a convenir» (PPF) y tener una descripción.
- **Órdenes y reservas:** toman el valor según la categoría efectiva. Una moto sin categoría la pide
  en la orden. Una reserva guarda el tiempo de sus servicios «a convenir».
- **Datos:** una migración carga, en todos los entornos, la categoría de las 173 líneas iniciales y la
  lista de precios de la spec.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 024 `aprobada`. Enmienda las 005, 007, 008, 012/014 y 018 al implementarla. |
| II. Qué antes que cómo | ✅ | La spec no nombra tablas ni componentes. |
| III. Criterios verificables | ✅ | Cada CA tiene su prueba (tabla de abajo). |
| IV. Ambigüedad explícita | ✅ | Las dos precisiones se aprobaron con el plan (CA-14 y CA-19 nuevo). |
| V. Simplicidad y stack | ✅ | Sin dependencias. Los servicios se siguen escribiendo como hoy (una fila, con RLS del admin). La categoría es un enum fijo, no una tabla que nadie administra. |
| VI. Seguridad y datos personales | ✅ | La categoría la escribe solo el personal (guardia de la base y funciones `security definer`). Los precios siguen siendo solo del personal (RLS de `services`). |
| VII. Trazabilidad | ✅ | Pruebas y comentarios citan `spec 024, CA-xx`. |
| VIII. Incrementos pequeños | ✅ | Todas las historias son P1 y se apoyan unas en otras; la carga de datos (HU-04) va en la misma migración. |

## Base de datos (packages/supabase)

### Migración `<timestamp>_motorcycle_categories.sql`

**Categorías (RF-01):**
- Tipo `public.motorcycle_category`, con los valores `street`, `sbk`, `scooter`, `maxi_scooter`,
  `trail`, `maxi_trail`, `cruiser` y `maxi_cruiser`, en el orden de la lista.
- Los nombres visibles («Street/Roadster»…) van en `es.json`.

**Líneas (CA-01, CA-18):**
- `vehicle_lines.motorcycle_category`, opcional. Un *trigger* la deja nula en líneas que no son de moto.
- Se añade al `grant select` por columnas: el personal la necesita al registrar una moto y en la orden.
  No es dato personal ni precio.
- `vehicle_catalog(tipo)` devuelve la categoría de cada línea.
- Nueva `set_vehicle_line_category(p_line_id, p_category)`: `security definer`, solo admin, hint
  `catalog_*`. Además da la línea por revisada, como las demás acciones del admin (spec 018, RN-07).
- Unir dos líneas conserva la categoría de la que queda.
- **Datos:** un `update` por marca y nombre clasifica las 173 líneas iniciales, con el mismo
  `(values …)` que la migración del catálogo (`20261119211116`). Si una línea ya no existe, no pasa
  nada.

**Motos (CA-02, CA-03, CA-05, CA-06, RN-04):**
- `vehicles.motorcycle_category`, la propia, opcional. `check`: nula si el vehículo no es moto.
- `private.vehicle_category(p_vehicle_id)` da la propia o la de la línea.
- `vehicles_guard` rechaza (`vehicle_category_staff_only`) que alguien que no es del personal la
  cambie. Así, el cliente que corrige su moto desde la app nunca la toca.
- `save_vehicle` recibe al final, opcionales, `p_motorcycle_category` y `p_set_category` (por
  defecto `false`: no la toca; `true` con nula: vuelve a seguir la de su línea). Esto le sirve al
  formulario del personal y a `register_customer`.
- Nueva `set_vehicle_category(p_vehicle_id, p_category)`: `security definer`, solo personal. La usa la
  orden cuando la moto no tiene categoría (CA-06).

**Servicios (CA-07 a CA-09, CA-12, RF-02, RF-03):**
- `services.motorcycle_prices jsonb`: nulo, o un objeto con las ocho categorías, cada valor de
  1 a 10.000.000. Lo valida un `check` con `private.valid_category_prices(jsonb)`, inmutable:
  - con valores por categoría están las ocho o ninguna (CA-08);
  - nunca a la vez que `price_motorcycle`.
- `services.on_quote boolean default false` («a convenir»). `check`: con `on_quote`, sin valores ni
  tiempo estimado.
- `services_price_required` pasa a exigir algún valor salvo con `on_quote`.
- `services.description text`, opcional, hasta 300 caracteres: lo que incluye un paquete o combo.
- Grants por columnas de `insert` y `update`, para las tres columnas nuevas.
- `private.service_price(p_service, p_vehicle_type, p_category)` da el valor de referencia o nulo:
  - moto: el de la categoría si hay valores por categoría; si no, el único;
  - carro y bicicleta, como hoy.
- `private.service_offered(p_service, p_vehicle_type)`: se ofrece si es «a convenir», si hay algún
  valor para ese tipo o si tiene valores por categoría.

**Órdenes (CA-10, CA-11, CA-13, CA-15, RN-01, RN-02):**
- `private.work_order_write_lines` pasa a recibir el vehículo, con su tipo y su categoría efectiva. Al
  añadir una línea del catálogo:
  - **servicio «a convenir»:** exige el valor enviado (`work_order_price_required`); el tiempo, si
    viene;
  - **servicio con valores por categoría y moto sin categoría:** responde
    `work_order_category_required`;
  - **los demás:** el valor de `service_price`, como hoy.
- `save_work_order` y `correct_work_order` se recrean para llamarla, con su misma firma. Las líneas
  ya guardadas conservan su valor (RN-01).

**Reservas (CA-14 a CA-16):**
- `reservation_services.estimated_minutes`, opcional (5 a 1.440): el tiempo de un servicio «a
  convenir» en esa reserva.
- `save_reservation` recibe al final `p_service_minutes jsonb default null` (`{servicio: minutos}`):
  - el personal debe dar el tiempo de cada servicio «a convenir»
    (`reservation_quoted_minutes_required`);
  - el cliente no puede pedir uno (`reservation_service_quoted`);
  - la disponibilidad por tipo de vehículo usa `service_offered`.
- `bookable_services` deja fuera los «a convenir» (CA-16), y su `motorcycle` cuenta también los valores
  por categoría.
- `reservation_summaries` da, por servicio, el tiempo (el del catálogo o el de la reserva), el tiempo
  estimado total y los servicios sin estimar, como `work_order_summaries`.

**Lista de precios (CA-17):**
- `insert … on conflict (name_key) do nothing` de los servicios de «Fuentes»: Pro Wash, Premium (120
  min), Deluxe (210 min) y Supreme (sin tiempo) con valores por categoría; los cinco de kit, asientos y
  sellador con valor único; y «PPF» a convenir.
- Las descripciones de los paquetes, tomadas de las imágenes.

**Seeds** (solo locales):
- `04_catalogs.sql` deja los servicios de ejemplo de la spec 007 (los de la lista ya llegan por
  migración).
- `05_work_orders.sql` y `06_reservations.sql` usan los nombres nuevos, por ejemplo «Lavado Pro Wash»
  y «Combo de lavado Deluxe».
- Una moto de los seeds queda sin categoría (línea nueva «por revisar»), para probar CA-06; Gabriel
  tiene una moto con categoría propia distinta de la de su línea.

### pgTAP

- **Nuevo `21_motorcycle_categories.test.sql`:**
  - enum y columnas; el `check` de motos; el *trigger* de líneas;
  - privilegios por columna y de las funciones nuevas;
  - `set_vehicle_line_category`, solo admin;
  - herencia y categoría propia (RN-04): cambiar la línea cambia la moto sin propia;
  - el guardia frente a un cliente;
  - `set_vehicle_category`, solo personal;
  - `valid_category_prices`: siete de ocho no; ocho sí; con `price_motorcycle` no;
  - `on_quote` sin valores ni tiempo;
  - en la orden:
    - el valor por categoría;
    - una moto sin categoría responde `work_order_category_required`;
    - un servicio a convenir sin valor responde `work_order_price_required`;
    - una línea guardada no cambia si después cambia la categoría;
  - en la reserva:
    - el tiempo del servicio a convenir;
    - el cliente con un servicio a convenir responde `reservation_service_quoted`;
    - `bookable_services` sin los a convenir;
  - los datos cargados: 173 líneas con categoría, los servicios de la lista y sus valores
    (Pro Wash de Maxi Trail, 52.000).
- **Pruebas a ajustar:** las que crean servicios o usan los de los seeds (`09` a `18`), por las
  columnas nuevas y los nombres nuevos.

## Aplicación (apps/web)

**`vehicles`:**
- `constants/motorcycle-categories.constants.ts`: las ocho, en orden. Textos en
  `vehicles.categories`.
- `utils/vehicle-category.utils.ts` → `vehicleCategory(own, lineCategory)`.
- **Formulario de vehículo** (`vehicle-fields`, solo con `audience="staff"`, CA-05): un `Select`
  «Categoría» que toma la de la línea al elegirla (CA-02). Cambiarla la vuelve propia (CA-03).
- `saveVehicle` envía `p_motorcycle_category` y `p_set_category` solo para el personal.
- **Ficha** (`vehicle-summary`, personal): la categoría junto a la clase (CA-04).
- **«Marcas y líneas»:**
  - cada línea de moto muestra su categoría («Sin categoría» si no tiene);
  - una acción «Categoría» abre `catalog-category-dialog`, con un `Select` y las reglas de modal de
    CLAUDE.md (CA-01);
  - acción `setLineCategory`, con `callAction` y `notify`.

**`services`:**
- **Formulario:**
  - «Valor para moto»: «Único» o «Por categoría» (ocho campos con su categoría por etiqueta);
  - el interruptor «A convenir», que oculta valores y tiempo;
  - «Descripción».
- **Esquema:**
  - con valores por categoría, las ocho (CA-08);
  - con «a convenir», ninguno.
- **Lista:**
  - ocho valores: el rango («$ 42.000 a $ 52.000»), y el detalle al expandir;
  - «A convenir» en lugar de los valores;
  - la descripción bajo el nombre (CA-09).
- Las acciones escriben las columnas nuevas.

**`work-orders`:**
- `referencePrice(service, type, category)` (la categoría, opcional) reemplaza la versión por tipo. Da el valor de la
  categoría, el único, o nulo («a convenir», o moto sin categoría con valores por categoría).
- **Editor:**
  - **servicio con valores por categoría en una moto sin categoría:** abre el diálogo «Categoría de la
    moto» (CA-06). Al elegirla, llama a `setVehicleCategory` y añade la línea con su valor;
  - **servicio «a convenir»:** la línea llega con el valor vacío y obligatorio (`lineSchema`) y el
    tiempo editable (CA-13);
  - la cabecera del vehículo muestra la categoría (CA-04).
- `customer-picker`: la categoría en cada moto del cliente (CA-04).

**`reservations`:**
- **Formulario del personal:**
  - con un servicio «a convenir» marcado, un campo de minutos para él (CA-14);
  - el tiempo estimado total con `BookingEstimate`, que pasa de `customer-area` a `core`.
- **Detalle:** muestra el tiempo estimado.
- `linesFromReservation` lleva a la orden el tiempo de la reserva para los «a convenir» (CA-15).

**`customer-area`:** sin cambios de pantalla. `bookable_services` ya no trae los «a convenir» (CA-16).

**Mensajes:**
- `vehicles.categories` y `vehicles.form.category`;
- `services.form` («Único», «Por categoría», «A convenir», «Descripción»);
- `work-orders.categoryDialog`;
- `reservations.form.quotedMinutes`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | pgTAP + componente + e2e | `21_motorcycle_categories` (solo admin); `vehicle-catalog-screen` / `catalog-category-dialog.component.test`; `vehicle-catalog-admin.spec.ts` |
| CA-02, CA-03 | pgTAP + componente | `21_…` (herencia, propia, cambio de línea); `vehicle-form.component.test` (toma la de la línea; cambiarla la envía como propia) |
| CA-04 | componente | `vehicle-summary`, `order-editor` (cabecera), `customer-picker` |
| CA-05 | pgTAP + componente | `21_…` (guardia frente al cliente); `vehicle-form` con `audience="customer"` sin el campo |
| CA-06 | componente + e2e | `order-editor.component.test` (diálogo, `setVehicleCategory`, línea con su valor); `work-orders.spec.ts` |
| CA-07, CA-08 | unit + componente | `service.schema.test` (ocho o ninguna; nunca con único); `service-form.component.test` |
| CA-09, CA-19 | componente | `services-table.component.test` (rango, «A convenir», descripción); `service-form` (descripción) |
| CA-10 | pgTAP + unit | `21_…` (valor por categoría en la línea); `line-price.utils.test` |
| CA-11 | pgTAP + componente | `21_…` (la línea guardada no cambia); `order-editor` (las nuevas, con la nueva categoría) |
| CA-12 | pgTAP + unit | `21_…` (`check` de `on_quote`); `service.schema.test` |
| CA-13 | pgTAP + componente | `21_…` (`work_order_price_required`); `order-editor` (línea sin valor, obligatorio) |
| CA-14 | pgTAP + componente | `21_…` (minutos guardados, exigidos al personal); `reservation-form.component.test` |
| CA-15 | unit + e2e | `reservation-lines.utils.test` (tiempo de la reserva, sin valor); `reservations.spec.ts` («Llegó» con PPF) |
| CA-16 | pgTAP + componente | `21_…` (`reservation_service_quoted`, `bookable_services`); `my-reservation-form` |
| CA-17, CA-18 | pgTAP + e2e | `21_…` (datos cargados); `services.spec.ts` (la lista con Pro Wash y sus valores) |
| RNF | e2e | `a11y.spec.ts` (formulario de servicio con ocho valores y errores; diálogos de categoría); `ui.spec.ts` (servicio y orden a 360 px e iPhone) |

## Archivos afectados

- **Nuevos:**
  - migración `<timestamp>_motorcycle_categories.sql` y pgTAP `21_motorcycle_categories.test.sql`;
  - constantes y utilidad de categorías (vehículos);
  - `catalog-category-dialog`;
  - el diálogo de categoría de la orden;
  - `BookingEstimate` movido a `core`.
- **Modificados:**
  - base de datos: seeds `04`, `05` y `06`; las pgTAP de servicios, órdenes y reservas; tipos generados;
  - `services`: esquema, formulario, lista, acciones y mensajes;
  - `vehicles`: campos, formulario, resumen, catálogo, acciones, lecturas y mensajes;
  - `work-orders`: `line-price`, editor, línea, `customer-picker`, esquema y lecturas;
  - `reservations`: formulario, detalle, `reservation-lines` y acción;
  - E2E de servicios, órdenes, reservas, catálogo, `a11y` y `ui`;
  - documentación: CLAUDE.md, enmiendas de las specs.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Ocho valores en un objeto `motorcycle_prices` de la misma fila, validado por `check`. | Tabla hija servicio-categoría; ocho columnas. | La app escribe el servicio en una sola operación, como hoy: «las ocho o ninguna» no puede quedar a medias. Una tabla hija obligaría a una función nueva para escribir de forma atómica. |
| Categorías como enum de Postgres. | Tabla de categorías. | La spec las fija en ocho, sin pantalla para administrarlas; un enum las valida en todas partes sin joins. |
| Categoría efectiva = propia ?? de la línea, calculada al leer. | Copiar la de la línea en cada moto al registrarla. | CA-03: cambiar la línea cambia las motos que la siguen; copiarla las congelaría. |
| El guardia de vehículos impide al cliente tocar la categoría. | Solo ocultarla en la app. | La autorización vive en Postgres (CLAUDE.md). |
| El tiempo de un servicio «a convenir» en la reserva, guardado con el servicio de la reserva. | Un tiempo total en la reserva. | La orden trae línea por línea el tiempo de la reserva (CA-15). |
| Los precios llegan por migración en todos los entornos, con `on conflict do nothing`. | Seed solo local. | Decisión del usuario (CA-17). Si el admin ya registró un servicio con el mismo nombre, no se pisa. |

### Precisiones a la spec (aprobadas con el plan: CA-19 nuevo y CA-14)

1. **Descripción de los servicios.** La spec supone que cada paquete tiene una descripción con lo que
   incluye, pero hoy los servicios no tienen descripción. El plan la añade como campo opcional del
   servicio, editable por el admin y visible en «Servicios». Propongo añadir a la spec un CA: «el
   administrador escribe una descripción opcional de un servicio y se ve en la lista».
2. **Tiempo estimado en las reservas del personal.** CA-14 dice que la reserva «suma a su tiempo
   estimado» el del servicio a convenir, pero hoy la reserva del personal no muestra tiempo estimado
   (solo la del cliente, spec 021). El plan lo muestra en el formulario y en el detalle de la reserva
   del personal; propongo dejarlo explícito en CA-14.

## Despliegue

- La migración (datos incluidos) y después la app, en el mismo PR. La lista de precios entra con
  `on conflict do nothing`: no pisa nada que el admin haya registrado con el mismo nombre.
- Sin variables de entorno nuevas.
