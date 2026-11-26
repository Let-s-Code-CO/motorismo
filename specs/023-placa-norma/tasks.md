---
spec: "023"
actualizado: 2026-11-25
---

# Tareas — 023 Placa según la norma colombiana

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `w/` = `apps/web/`, `t/` = `apps/web/__test__/`, `m/` = `w/src/modules/`,
  `db/` = `packages/supabase/supabase/`.
- Rama `feature/023-placa-norma` desde `develop`.

## Fase 0 — Fuentes

- [x] T000 Descargar y revisar los documentos de la norma.
  - Res. 3257 de 2018 con sus Anexos 1 y 2 (RUNT): los planos con las cuadrículas de los caracteres.
  - El listado de organismos de tránsito del RUNT.
  - Se guardan en el scratchpad; las láminas usadas se citan en el código. Verificable: una tabla, en
    este archivo, con cada lámina y lo que se tomó de ella.

### Registro de T001

- **Listado del RUNT:** 297 filas, todas cruzadas con su código DANE.
- **Total:** 294 municipios únicos. Cajicá, Pupiales y Villagarzón aparecen dos veces.
- **Comprobaciones:** Bogotá, D.C., Medellín, La Calera y Funza están en la lista.
- **Resueltos a mano** (nombre oficial distinto o cabecera con otro nombre), entre ellos:
  - Cali, Cartagena de Indias, Cúcuta, Mompox, Tumaco, Ubaté, Inírida y Armero;
  - «AMBORCO - PALERMO», que es Palermo.
- **Duda:** la fila 24 (organismo de Sabanagrande con ciudad Baranoa) se tomó por la ciudad, Baranoa.
- **Verificación:** las 296 ciudades transcritas aparecen en el texto del PDF; el script y la
  transcripción quedan en el scratchpad.

## Fase 1 — Base de datos

- [x] T001 Cruzar el listado del RUNT con `municipalities` (nombre y departamento → código DANE).
  - Revisar a mano lo que no cruce solo.
  - Resultado: la lista de códigos que expiden placas, con su total, anotada aquí.
- [x] T002 pgTAP en rojo: `db/tests/20_plate_norm.test.sql` (CA-07, CA-08, CA-10, CA-11, RN-04, RN-05).
  - Columnas `issues_plates` y `plate_legend`, y su `check`.
  - Total que expide placas; Bogotá, D.C. y Medellín, sí.
  - `set_plate_legend`: el admin pone y quita; un operador o un cliente, no; un municipio que no
    expide, no; leyendas inválidas (minúsculas, tildes, 18 caracteres).
  - Guarda: registrar un carro con una ciudad que no expide → `vehicle_plate_city_not_issuing`;
    corregir otro campo de un carro que ya la tenía, sí.
  - `work_order_summaries.plate_city_legend`; privilegios de la función.
- [x] T003 Migración `db/migrations/<timestamp>_plate_norm.sql` (RF-02, RF-03).
  - Columnas, datos (T001), `set_plate_legend`, `vehicles_guard` desde su última versión, y la vista.
  - Seeds: comprobar que las ciudades de los seeds expiden placas.
  - Verificable: `pnpm db:reset` + `pnpm db:test` en verde.
- [x] T004 `pnpm db:types` y `types:check` en verde.

## Fase 2 — El dibujo de la placa (rojo → verde)

- [x] T010 [P] Prueba en rojo: `t/src/modules/vehicles/utils/plate-layout.utils.test.ts` (CA-01,
  CA-02, CA-09).
  - Las cotas horizontales y verticales suman exacto la caja de carro (330 × 160) y de moto
    (235 × 105).
  - Posiciones de los seis caracteres, el círculo central y la leyenda.
  - Marco y radio.
  - Una leyenda que no cabe recibe un factor de escala que la deja justo en su franja.
- [x] T011 [P] Prueba en rojo: `t/src/modules/vehicles/utils/plate-legend.utils.test.ts` (CA-09,
  RN-05).
  - Leyenda propia o nombre en mayúsculas sin tildes («BOGOTA, D.C.»); conserva la Ñ.
- [x] T012 [P] Prueba en rojo: `t/src/modules/vehicles/constants/plate-glyphs.test.ts` (CA-04).
  - Los 36 caracteres de carro y de moto y los de la leyenda existen.
  - Cada trazo cabe en su celda; O y 0 son distintos.
- [x] T013 `m/vehicles/utils/plate-layout.utils.ts` y `plate-legend.utils.ts` (verde T010, T011).
- [x] T014 Glifos de carro: `m/vehicles/constants/plate-glyphs.constants.ts`, A–Z y 0–9 sobre
  la celda de 40 × 80 (Anexo 1).
  - Revisión visual: una lámina de prueba con los 36 caracteres al lado del plano, en capturas.
- [x] T015 Glifos de moto: A–Z y 0–9 sobre la celda de 28 × 54 (Anexo 2), con su revisión visual.
- [x] T016 Glifos de la leyenda: A–Z, Ñ, 0–9 y «. , -» (12 × 22) y los de «COLOMBIA» (5 × 10,5),
  con su revisión visual (verde T012).
- [x] T017 Prueba en rojo, luego verde: `plate-label.component.test.tsx` reescrito (CA-03, CA-06).
  - Mismo ancho y `viewBox` para UIH-03D y WMW-88W.
  - El SVG oculto al lector, con el texto «UIH-03D» y la ciudad.
  - Círculo central y sin logo.
  - Sin versión de una línea.
- [x] T018 `m/vehicles/components/atoms/plate-label.component.tsx` reescrito.
  - SVG con marco, caracteres, círculo y leyenda.
  - Relieve por filtro SVG.
  - Tamaños `md` y `sm` de ancho fijo.
  - En `globals.css`, el bloque de la placa: el radio de la norma; el `text-shadow` sale.
  - Verde T017.

## Fase 3 — Datos en pantalla y ciudades (rojo → verde)

- [x] T020 Las consultas traen la leyenda (CA-09, CA-12).
  - `vehicles.server`, la vista de órdenes, `searchCustomers` y el listado de «Clientes» (con la
    ciudad de la placa que coincidió).
  - Los componentes que dibujan la placa pasan `legend`.
- [x] T021 Prueba en rojo, luego verde: `customers-table` con la placa completa a escala, sin
  «Placa» visible y con `sr-only` (CA-12).
- [x] T022 Prueba en rojo, luego verde: formulario de vehículo (CA-07, CA-08).
  - Solo las ciudades que expiden placas; Bogotá, D.C. por defecto.
  - Un carro con una ciudad fuera de la lista abre el campo vacío y obligatorio.
  - `fetchMunicipalities` filtra `issues_plates`.

## Fase 4 — «Ciudades de placa» (rojo → verde)

- [x] T030 Pruebas en rojo de la pantalla y del diálogo (CA-10, CA-11).
  - Lista con búsqueda y placa de muestra.
  - Poner y quitar la leyenda, con vista previa en vivo.
  - Validación (mayúsculas sin tildes, hasta 17).
  - `notify` y `callAction`.
- [x] T031 Esquema Zod, acción con `getActiveAdmin` y `set_plate_legend`, y el traductor de errores.
- [x] T032 Pantalla y diálogo.
  - Ruta `/admin/vehicle-catalog/plate-cities` con `loading.tsx`: pestaña «Ciudades de placa» dentro
    de «Marcas y líneas» (decisión del usuario), con mensajes en `es.json`.
  - Verde T030.

## Fase 5 — E2E y regresión

- [x] T040 `w/e2e/plate-cities.spec.ts` (CA-10, CA-11).
  - El admin pone «STFE DE BOGOTA» a Bogotá, D.C. y la ficha de Valentina lo muestra.
  - La quita, y vuelve «BOGOTA, D.C.».
  - Un operador no ve la sección.
- [x] T041 [P] `style.spec.ts` y `theme.spec.ts` (CA-03, CA-05).
  - Dos placas miden lo mismo en px.
  - Amarillo y negro en claro y oscuro.
  - Relieve y destello, ajustados al SVG (enmienda spec 019, CA-12).
- [x] T042 [P] `a11y.spec.ts`: «Ciudades de placa» y su diálogo con un error; placas en la ficha y
  en «Clientes» (CA-06).
- [x] T043 [P] Teléfono.
  - «Ciudades de placa», la ficha y «Clientes» en `ui.spec.ts` «on an iPhone».
  - Capturas a 360 y 440 px de todas las pantallas con placa.
- [x] T044 Revisión visual de la placa en cada lugar donde aparece, en claro y oscuro (CA-12, RF-01).
  - Ficha, «Mis vehículos», orden, cola, buscador, «Clientes» y «Ciudades de placa».

## Fase 6 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` + `test:sandbox` en verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` limpio);
  tabla de mutaciones aquí.
- [x] T093 Documentación.
  - Enmiendas de la spec 005 (HU-07, CA-27 a CA-31, RF-07, RN-11) y de la 019 (CA-12).
  - `CLAUDE.md`: placa por norma, «Ciudades de placa».
  - Spec en `implementada`, plan y backlog al día.

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01, CA-02 | T010 |
| CA-03 | T017, T041 |
| CA-04 | T012, T014 a T016 (revisión visual) |
| CA-05 | T041 |
| CA-06 | T017, T042 |
| CA-07 | T002, T022 |
| CA-08 | T002, T022 |
| CA-09 | T010, T011 |
| CA-10 | T002, T030, T040 |
| CA-11 | T002, T030, T040 |
| CA-12 | T021, T043, T044 |
| RF-01 | T044 |
| RF-02 | T002, T022 |
| RF-03 | T002, T030 |
| RN-01 | T010 |
| RN-02 | T012, T014 a T016 |
| RN-03 | T017 |
| RN-04 | T001, T002 |
| RN-05 | T002, T011, T030 |
| RN-06 | T010 (crecer y recentrar), T017, T044 (revisión visual) |

## Registro de la implementación

- **Revisión en el navegador con el usuario (T044):**
  - **M:** el calco la cruzaba; se corrigió contra el plano (V en punta al centro de la base).
  - **Leyenda (RN-06):** a escala, «COLOMBIA» medía ~3,6 px con trazo de 0,3 px. Crece como mucho
    1,4× hacia 5 px, sin quitar el hueco; trazos de al menos 1 px; el relieve, solo en marco,
    caracteres y círculo.
  - **Tamaños:** `md` 80 px (el alto de antes), `sm` 72 px en «Clientes» y en el buscador.
  - **«Clientes»:** la placa, a la derecha del nombre y el correo.
- **Añadido a pedido del usuario:** «Volver a clientes» conserva filtro, búsqueda y página (enmienda de
  la spec 004, CA-33): `customerRecordHref`, `customersListHref`, la tabla y la ficha.

## Mutaciones (T092)

Las pruebas escritas antes del código se vieron en rojo contra el código anterior: `plate-layout`,
`plate-label`, `plate-legend`, `plate-glyphs` (sin módulo), el esquema, la acción, el diálogo, la
pantalla, `vehicles.client`, el formulario (CA-08), `customers-table` y `customers-filter` (CA-33).
Mutaciones aplicadas al código, cada una vista fallar y revertida (`git diff` + grep de `MUTATION`
limpio):

| Mutación | Prueba que falla |
|---|---|
| La M de carro vuelve al calco cruzado | `plate-glyphs.test` (la V se encuentra en el centro) |
| La leyenda crece sin el tope de alto | `plate-layout.utils.test` (nunca más allá del marco) |
| Una leyenda crecida no recentra el bloque | `plate-layout.utils.test` (recentra, hueco intacto) |
| La ficha se abre sin `?list=` | `customers-filter.utils.test` y `customers-table.component.test` (CA-33) |
| «Volver» confía en `?list=` tal cual | `customers-filter.utils.test` (solo el estado de la lista) |
| La placa sin `data-legend` | `plate-label.component.test` (4 pruebas) |
| `sm` del mismo ancho que `md` | `plate-label.component.test` (CA-03) |
| El ancho depende de las letras (`…E` a 6rem) | `style.spec.ts` (CA-03, en px) |
| «Volver a clientes» lleva a `/customers` | `customers.spec.ts` (CA-33) |
