---
spec: "018"
actualizado: 2026-11-24
---

# Tareas — 018 Administrar marcas y líneas de vehículos

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `sb/` = `packages/supabase/supabase/`, `w/` = `apps/web/`, `t/` = `apps/web/__test__/`,
  `v/` = `w/src/modules/vehicles/`, `a/` = `w/src/modules/auth/`.
- Rama `feature/018-marcas-lineas` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 `sb/tests/17_vehicle_catalog_admin.test.sql`, primera parte (rojo): esquema y permisos.
  - Columnas `preloaded` (default `false`) en marcas y líneas.
  - Tablas de recordados: claves únicas, FK compuestas, `on update cascade` de la línea.
  - `private.mark_preloaded_vehicle_catalog()` sobre filas sucias: las de la hora de la carga
    inicial son precargadas; una añadida después, no (CA-03, RF-02).
  - `vehicles_line_fk` diferible.
  - **Privilegios por columna:** `authenticated` lee `id`, `vehicle_type`/`brand_id`, `name` y
    `name_key`, pero no `preloaded` ni `created_at` (CA-06, RN-06).
  - **Recordados:** RLS activado, política de lectura y sin escritura desde la API.
  - **Admin:** `vehicle_catalog` y las cinco funciones rechazadas para un operador y un cliente
    (`catalog_admin_only`) (CA-05, RN-01).
- [x] T002 `17_vehicle_catalog_admin.test.sql`, segunda parte (rojo): leer y renombrar.
  - `vehicle_catalog(tipo)`: orden alfabético, conteos de vehículos vigentes y retirados por marca
    y línea, origen y fecha (CA-01, CA-02, CA-03).
  - `rename_vehicle_brand` y `rename_vehicle_line`:
    - el nombre nuevo se lee en vehículos, `work_order_summaries`, `reservation_summaries` y
      `private.report_lines` (CA-07, CA-08, RF-01);
    - nombre tomado → `catalog_name_taken`, también si lo tiene un recordado de otra (CA-09);
    - solo cambiar la escritura («Ktm» → «KTM») sí se permite;
    - vacío o de más de 60 caracteres → `catalog_name_required` / `catalog_name_too_long` (CA-10);
    - conserva `preloaded` (CA-11);
    - recuerda el nombre viejo (CA-16).
- [x] T003 `17_vehicle_catalog_admin.test.sql`, tercera parte (rojo): unir, pasar y recordar.
  - `merge_vehicle_brands`:
    - vehículos vigentes y retirados pasan, y `retired_at` no cambia;
    - las líneas pasan y las iguales se unen, con sus vehículos y recordados;
    - la marca absorbida desaparece y queda recordada;
    - devuelve el número de vehículos (CA-12, CA-13).
  - `merge_vehicle_lines`, en la misma marca (CA-14).
  - Otro tipo, otra marca o la misma → `catalog_type_mismatch` / `catalog_brand_mismatch` /
    `catalog_same_item` (CA-15, CA-20, RN-05).
  - `move_vehicle_line` con y sin una línea igual en el destino (CA-18, CA-19).
  - `save_vehicle` con «Suzuky» (unida) o el nombre viejo (renombrado) deja el que quedó, también
    para la línea (CA-16).
  - `report_lines` y `payroll_lines_live` con los mismos totales después de unir (CA-17).
  - Tras cada función, sin duplicados ni recordados que choquen con una viva (RN-02).
  - El guardián sigue rechazando cualquier otro cambio a un retirado, también con el ajuste
    encendido.
- [x] T004 Migración `sb/migrations/<ts>_vehicle_catalog_admin.sql`
  (`migration:new vehicle_catalog_admin`), hasta poner T001–T003 en verde.
  - Columnas, `mark_preloaded` y su llamada.
  - Tablas de recordados con RLS y privilegios por columna.
  - FK diferible.
  - `vehicles_guard` con `motorismo.recataloging`, partiendo de la versión de la spec 017.
  - `ensure_vehicle_brand` y `ensure_vehicle_line` resuelven recordados.
  - `require_admin_for_vehicle_catalog`, `vehicle_catalog` y las cinco funciones, con sus
    `revoke`/`grant` (RF-02, RF-03).
- [x] T005 [P] Seed `sb/seeds/08_vehicle_catalog.sql`: «Yamaja» con «Fz 2.0», y «Fz 2.0» bajo
  Honda, añadidas como lo hace `save_vehicle`. Sin vehículos: Andrés ya tiene su bicicleta y con
  dos vehículos dejaría de venir preseleccionada (spec 008, RN-10). Actualizado
  `packages/supabase/CLAUDE.md`.
- [x] T006 `pnpm db:reset` + `pnpm db:test` en verde; `pnpm db:types` y `types:check`.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/src/modules/vehicles/utils/vehicle-catalog-filter.utils.test.ts`.
  - **Tarjetas:** «Añadidas» incluye una marca precargada con alguna línea añadida.
  - **Conteos de las tarjetas** (CA-03).
  - **Búsqueda:** por marca o por línea, sin tildes ni mayúsculas; vacío = todo; sin
    coincidencias (CA-04).
- [x] T011 [P] `t/src/modules/vehicles/schemas/vehicle-catalog.schema.test.ts`.
  - `vehicleCatalogFiltersSchema`: lo inválido vuelve a Motocicleta sin filtros (CA-01).
  - `catalogNameSchema`: recorta, vacío, 60 y 61 caracteres (CA-10).
- [x] T012 [P] `t/src/modules/vehicles/utils/catalog-key.utils.test.ts` (ampliar).
  - `filterCatalog` sugiere «Suzuki» al escribir «suzuky» (nombre recordado).
  - `findInCatalog` reconoce un recordado (CA-16).
- [x] T013 [P] `t/src/modules/vehicles/utils/vehicle-catalog-errors.utils.test.ts`: cada hint, a su
  texto; lo desconocido, al genérico.
- [x] T014 `t/src/modules/vehicles/components/vehicle-catalog-screen.component.test.tsx`.
  - Pestañas por tipo en la dirección.
  - Marcas en orden, con conteo e insignia «Añadida · fecha», y sus líneas al desplegar
    (CA-01, CA-02, CA-03).
  - Tarjetas y buscador con `useUrlFilters`; «sin coincidencias» (CA-04).
  - Menús de acciones de marca y de línea.
- [x] T015 `t/src/modules/vehicles/components/catalog-rename-dialog.component.test.tsx`.
  - Errores junto al campo (CA-10).
  - Nombre tomado dentro del diálogo (CA-09).
  - Éxito con aviso flotante y `refresh` (CA-11).
  - `callAction` sin red: nada pasa.
- [x] T016 `t/src/modules/vehicles/components/catalog-merge-dialog.component.test.tsx`.
  - **Destinos:** solo del mismo tipo o marca, nunca la misma (CA-15, CA-20).
  - **Pregunta:** cuántos vehículos pasan y «no se puede deshacer» (CA-12, CA-14, CA-18).
  - **Pasar una línea:** si en el destino hay una igual, la frase de unión (CA-19).
  - **Resultado:** aviso al confirmar; error dentro.
- [x] T017 [P] `t/src/modules/auth/utils/nav-overflow.utils.test.ts` (`visibleCount`).
  - Todo cabe sin «Más» (CA-22).
  - Sale por el final, con el ancho de «Más» contado (CA-25).
  - Límite exacto.
  - Nunca menos de una entrada.
- [x] T018 `t/src/modules/auth/components/nav-links.component.test.tsx` (ampliar).
  - **Administrador:** «Administración» con Servicios, Empleados, Reportes, Habeas data, Marcas y
    líneas y Usuarios (CA-21, RF-04).
  - **Operador:** Servicios y Empleados en la barra, sin «Administración».
  - **Anchos simulados:** entradas a «Más», «Administración» como sección dentro (CA-25); al crecer
    vuelven (CA-24).
  - **Marcas y navegación:** «Más» y «Administración» marcados con una sección de dentro; elegir
    navega (CA-23).
  - Ampliar `auth-ui.component.test.tsx` en lo que cambie.

## Fase 3 — Implementación (verde)

- [x] T020 [P] Tipos, esquemas y utilidades.
  - `v/types/vehicle-catalog.types.ts`.
  - `v/schemas/vehicle-catalog.schema.ts`.
  - `v/utils/vehicle-catalog-{filter,errors}.utils.ts`.
  - `v/utils/catalog-key.utils.ts` y `CatalogItem` con `aliases`.
  - En verde: T010–T013.
- [x] T021 Lecturas.
  - `v/api/vehicle-catalog.server.ts`: `getVehicleCatalog`, con `jsonb` validado con Zod.
  - `v/api/vehicles.client.ts`: `fetchBrands` y `fetchLines` con sus recordados (CA-16).
- [x] T022 `v/actions/vehicle-catalog.actions.ts`: las cinco acciones, con `getActiveAdmin()`, RPC
  y errores traducidos (RN-01).
- [x] T023 Mensajes.
  - `v/messages/es.json`, `vehicles.catalog.*`: pantalla, tarjetas, insignia, conteos, diálogos,
    avisos y errores.
  - `a/messages/es.json`: `header.more`, `header.vehicleCatalog`, `home.vehicleCatalog*`.
- [x] T024 Pantalla.
  - `v/components/organisms/vehicle-catalog-screen.component.tsx`.
  - `w/src/app/(app)/admin/vehicle-catalog/{page,loading}.tsx` (`getStaffForPage`; `NoPermission`
    para el operador; `PageSkeleton` `list`).
  - En verde: T014.
- [x] T025 Diálogos.
  - `v/components/molecules/catalog-rename-dialog.component.tsx` (React Hook Form + Zod).
  - `catalog-merge-dialog.component.tsx`: unir y pasar, `Autocomplete` con `portalContainer`,
    `scrollBehavior="outside"`, `callAction` y `notify`.
  - En verde: T015 y T016.
- [x] T026 Navegación.
  - `a/constants/nav.constants.ts`: «Marcas y líneas» en el grupo, y «Servicios» y «Empleados» en
    el grupo solo para quien tiene «Administración».
  - `a/utils/nav-overflow.utils.ts`.
  - `a/components/molecules/nav-links.component.tsx`: fila de medición, `ResizeObserver`, «Más ▾»
    con «Administración» como sección, primer dibujo con cuatro.
  - Comprobar que el panel del teléfono y el inicio del admin muestran la sección nueva.
  - En verde: T017 y T018.

- [x] T027 Pedidos del usuario durante la implementación.
  - **Revisión:** `reviewed` en vez de `preloaded`; tarjetas «Por revisar» / «Revisadas»; lo que
    queda tras renombrar, unir o pasar sale revisado (RN-07).
  - **HU-06:** registrar marca y línea; «Dar por revisada» (CA-26 a CA-29), en base de datos, acciones,
    `catalog-name-dialog`, pantalla y pruebas.
- [x] T028 La fila entera de una marca la despliega (enlace estirado; el menú de acciones encima).
- [x] T029 Las tarjetas-filtro atenúan sin opacidad: la auditoría de accesibilidad encontró la
  etiqueta bajo AA con una tarjeta elegida (`summary-filter-cards`).

## Fase 4 — E2E

- [x] T030 `w/e2e/vehicle-catalog-admin.spec.ts`, con datos propios por trabajador (`save_vehicle`
  con la clave secreta).
  - El admin abre «Administración» → «Marcas y líneas» (CA-01).
  - Filtra «Añadidas» y busca (CA-03, CA-04).
  - Renombra y lo ve en la ficha del cliente (CA-07).
  - Une una marca añadida con otra, tras la pregunta (CA-12).
  - Pasa una línea a otra marca (CA-18).
  - Recarga y conserva el filtro.
- [x] T031 En el mismo archivo, los permisos.
  - El operador no tiene «Marcas y líneas» y recibe «No tienes permiso» en la dirección (CA-05).
  - El cliente ve sus vehículos sin «Añadida» (CA-06).
- [x] T032 Ajustar las E2E que abren «Servicios» o «Empleados» como admin desde la barra (`openAdminSection`): ninguna lo hacía (entran como operador o van directo a la dirección) y
  las que cuentan los vehículos de Andrés (seed 08).
- [x] T033 `w/e2e/ui.spec.ts`.
  - Admin y operador a 1024 y 1440 px: la barra no desborda y no hay «Más» con las secciones de
    hoy (CA-22, CA-25).
  - «Marcas y líneas» en el iPhone y a 360 px sin desplazamiento lateral.
  - Sus pantallas en «lo que se ilumina lleva la mano».
- [x] T034 `w/e2e/a11y.spec.ts`: la pantalla, el diálogo de renombrar con su error a la vista y el de
  unir, en claro y oscuro.

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` (contra
  producción) en verde.
- [x] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` + `test:sandbox` en verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` limpio);
  tabla de mutaciones aquí.
- [x] T093 Revisión en el teléfono (360 px e iPhone) de la pantalla y los diálogos.
- [x] T094 Documentación.
  - `CLAUDE.md`: sección de la spec 018; «Administración» con Empleados; «Más ▾».
  - Historial de la spec 005: el catálogo ya se administra.
  - Spec en `implementada`, plan y backlog al día.

## Cobertura

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T002, T011, T014, T030 |
| CA-02 | T002, T014 |
| CA-03 | T001, T002, T010, T014, T030 |
| CA-04 | T010, T014, T030 |
| CA-05 | T001, T031 |
| CA-06 | T001, T031 |
| CA-07, CA-08 | T002, T030 |
| CA-09 | T002, T015 |
| CA-10 | T002, T011, T015 |
| CA-11 | T002, T015 |
| CA-12, CA-13 | T003, T016, T030 |
| CA-14 | T003, T016 |
| CA-15 | T003, T016 |
| CA-16 | T002, T003, T012 |
| CA-17 | T003 |
| CA-18 | T003, T016, T030 |
| CA-19 | T003, T016 |
| CA-20 | T003, T016 |
| CA-21 | T018, T032 |
| CA-22 | T017, T018, T033 |
| CA-23 | T018 |
| CA-24 | T018 |
| CA-25 | T017, T018, T033 |
| CA-26, CA-27 | T027 (pgTAP, `catalog-name-dialog`), T030 |
| CA-28 | T027 (pgTAP, `catalog-name-dialog`) |
| CA-29 | T027 (pgTAP, pantalla), T030 |
| RN-01, RN-05, RN-06 | T001, T003 |
| RN-02 | T003 |

## Mutaciones (T092)

Cada prueba nueva se vio fallar con su mutación y se revirtió:

| Mutación | Prueba que falla |
|---|---|
| «Por revisar» ignora las líneas | `vehicle-catalog-filter` (3) |
| La búsqueda no mira las líneas | `vehicle-catalog-filter` (1) |
| Las sugerencias ignoran los nombres recordados | `catalog-key` (2) |
| Se admiten 61 caracteres | `vehicle-catalog.schema` (1) |
| La dirección escribe el tipo por defecto | `vehicle-catalog.schema` (1) |
| `catalog_name_taken` sin traducir | `vehicle-catalog-errors` (1) |
| «Dar por revisada» en una marca revisada | `vehicle-catalog-screen` (1) |
| Sin la insignia de líneas por revisar | `vehicle-catalog-screen` (1) |
| La búsqueda no abre las líneas | `vehicle-catalog-screen` (1) |
| Registrar marca renombra | `catalog-name-dialog` (1) |
| Pasar una línea no avisa de que se une | `catalog-merge-dialog` (1) |
| Unir ofrece la propia marca | `catalog-merge-dialog` (2) |
| «Más» sin su ancho | `nav-overflow` (1) |
| El grupo también para el operador | `nav-links` (1) |
| «Más» nunca marcado | `nav-links` (1) |
| Sin vigilar el ancho | `nav-links` (1); el `ResizeObserver` falso ahora solo avisa a lo observado |
| Renombrar no deja revisada | pgTAP `17_vehicle_catalog_admin` |
| Renombrar olvida el nombre viejo | pgTAP |
| Renombrar ignora los nombres recordados | pgTAP |
| Sin la excepción del guardián (los retirados no pasan) | pgTAP |
| La excepción deja cambiar cualquier columna | pgTAP |
| Unir olvida el nombre unido | pgTAP |
| Unir con otro tipo | pgTAP |
| `ensure_vehicle_brand` ignora los recordados | pgTAP (45, 53, 83) |
| Pasar no une con la igual | pgTAP |
| Registrar ignora los recordados | pgTAP (73, 83) |
| Registrar una línea la deja por revisar | pgTAP |
| «Dar por revisada» no cambia nada | pgTAP |
| El operador pasa la guarda | pgTAP (22, 23, 25–28) |
| La fila de la marca sin el botón estirado | E2E `ui` «whatever lights up…» (el centro de cada fila sin mano) |
| Las tarjetas atenúan con opacidad | E2E `a11y` «Marcas y líneas» (contraste de la etiqueta) |
| `fetchBrands` sin los nombres recordados (verificación) | E2E `vehicle-catalog-admin` «merges a brand…» (el nombre unido no sugiere la que quedó) |
| Renombrar no cambia el nombre (verificación) | pgTAP 35 y 36 (reserva e historial del cliente) |
