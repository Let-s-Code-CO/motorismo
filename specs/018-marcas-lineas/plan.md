---
spec: "018"
estado: aprobado
actualizado: 2026-11-24
---

# Plan técnico — 018 Administrar marcas y líneas de vehículos

## Resumen

Una migración añade al catálogo de la spec 005 su origen (precargada o añadida) y la memoria de
nombres unidos. También añade cinco funciones `security definer`, solo para el administrador:
renombrar marca o línea, unir marcas, unir líneas y pasar una línea a otra marca. Unir y pasar
mueven los vehículos (también los retirados) en una sola transacción. La app suma una sección
«Marcas y líneas» bajo «Administración» (`/admin/vehicle-catalog`): tipo, tarjetas-filtro y
búsqueda en la dirección (`useUrlFilters`), y diálogos para cada acción. Las sugerencias del
formulario de vehículo reconocen los nombres unidos. Todo lo que muestra una marca o línea ya la lee
del catálogo en el momento (órdenes, reservas, reportes, área del cliente), así que los cambios se
ven en todas partes sin tocar esas pantallas. En el menú de escritorio, «Administración ▾» gana
«Servicios», «Empleados» y «Marcas y líneas», y la barra suma «Más ▾» según el ancho: mide lo que cabe y saca
por el final lo que no (HU-05).

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | La spec ya recoge los ajustes del usuario al planificar (renombres recordados, «Servicios» y «Empleados» en «Administración», «Más ▾»); la 009 se enmienda. |
| II. Qué antes que cómo | ✅ | La spec no nombra tablas ni componentes; este plan sí. |
| III. Criterios verificables | ✅ | Cada CA con su prueba (pgTAP, Vitest o Playwright), ver la tabla. |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas; reutiliza `useUrlFilters`, `SummaryFilterCards`, `FilterBar`, `ConfirmDialog`, `notify`, `callAction`. |
| VI. Seguridad y datos personales | ✅ | Escrituras solo por funciones `security definer` que exigen admin; el origen y la fecha dejan de ser legibles desde la API salvo por el admin (privilegios por columna). Sin datos personales nuevos. |
| VII. Trazabilidad | ✅ | Rama `feature/018-marcas-lineas`; pruebas con la spec en su cabecera. |
| VIII. Incrementos pequeños | ✅ | P1 (revisar, renombrar, unir y el menú «Más») se puede desplegar sola; P2 (pasar línea) es una función y un diálogo más. |

## Base de datos (packages/supabase)

### Migración `<timestamp>_vehicle_catalog_admin.sql`

**Columnas nuevas (RF-02)**

- `vehicle_brands.preloaded boolean not null default false`.
- `vehicle_lines.preloaded boolean not null default false`.
- Una fila nueva nace «añadida». `created_at` es la fecha en que se añadió.
- `private.mark_preloaded_vehicle_catalog()` marca como precargadas las filas que llegaron con la
  carga inicial (migración `…_vehicle_catalog_data`).
  - Se reconocen porque comparten la hora exacta de esa transacción, la `min(created_at)` de las
    marcas: una añadida por `save_vehicle` nunca la tiene.
  - La migración la llama una vez. Al ser una función, la prueba la puede llamar sobre filas
    «sucias» (regla 5 del paquete).

**Nombres recordados (RF-03, CA-16 y el ajuste de spec)**

- `vehicle_brand_aliases` (`id`, `vehicle_type`, `brand_id`, `name`, `name_key` generada con
  `private.catalog_key`).
  - `unique (vehicle_type, name_key)`.
  - Su FK compuesta `(brand_id, vehicle_type)` apunta a `vehicle_brands (id, vehicle_type)`, con
    `on delete cascade`.
- `vehicle_line_aliases` (`id`, `brand_id`, `line_id`, `name`, `name_key`).
  - `unique (brand_id, name_key)`.
  - Su FK `(line_id, brand_id)` apunta a `vehicle_lines (id, brand_id)`, con `on update cascade
    on delete cascade`: si la línea pasa a otra marca, sus nombres recordados van con ella.
- Invariante, que mantienen las funciones: la clave de un nombre recordado nunca coincide con la de
  una marca viva del mismo tipo (ni con la de una línea viva de la misma marca).

**Claves foráneas**

- `vehicles_line_fk` pasa a `deferrable initially immediate`.
- Así, pasar una línea a otra marca cambia `vehicle_lines.brand_id` y `vehicles.brand_id` en la
  misma transacción (`set constraints … deferred`) sin romper la FK compuesta.

**`vehicles_guard`**

- Con `motorismo.recataloging = on` (lo activa solo una función de esta spec, `set_config(…, true)`,
  para su transacción), un `UPDATE` que cambia **solo** `brand_id` o `line_id` pasa también en un
  vehículo retirado. Así no se reinicia `retired_at` (CA-12, CA-17).
- Cualquier otro cambio sigue rechazado.
- Se reescribe partiendo de la versión de la spec 017, que conserva la excepción `motorismo.erasing`.

**Resolver nombres (CA-16)**

- `private.ensure_vehicle_brand` y `private.ensure_vehicle_line` buscan primero por clave viva,
  luego entre los nombres recordados y solo después añaden.
- `save_vehicle` no cambia.

**Funciones `security definer`, solo admin**

Todas exigen `private.require_admin_for_vehicle_catalog()` (`42501`, hint `catalog_admin_only`) y
bloquean las filas que tocan (`for update`):

| Función | Qué hace | Errores (hint) |
|---|---|---|
| `vehicle_catalog(p_type)` | Lectura del admin: cada marca del tipo con `preloaded`, `created_at`, número de vehículos (vigentes y retirados) y sus líneas (`jsonb`, con los mismos datos). | `catalog_admin_only` |
| `rename_vehicle_brand(p_brand_id, p_name)` | Normaliza como `ensure_*` (recorta, un espacio). Si la clave cambia, guarda el nombre viejo como recordado. Rechaza un nombre tomado por otra marca o por un recordado de otra marca; si el recordado es suyo, lo borra. Conserva `preloaded`. | `catalog_name_required`, `catalog_name_too_long`, `catalog_name_taken`, `catalog_not_found` |
| `rename_vehicle_line(p_line_id, p_name)` | Lo mismo, dentro de la marca. | ídem |
| `merge_vehicle_brands(p_from, p_into)` | Mismo tipo, distintas. Pasa los vehículos sin línea. Por cada línea de `p_from`: si `p_into` tiene una igual (clave), une (vehículos y recordados) y la borra; si no, la pasa. Recuerda el nombre de `p_from` y sus recordados para `p_into`, y borra `p_from`. Devuelve los vehículos movidos. | `catalog_type_mismatch`, `catalog_same_item`, `catalog_not_found` |
| `merge_vehicle_lines(p_from, p_into)` | Misma marca, distintas. Vehículos y recordados a `p_into`; recuerda el nombre; borra `p_from`. | `catalog_brand_mismatch`, `catalog_same_item`, `catalog_not_found` |
| `move_vehicle_line(p_line_id, p_brand_id)` | Marca del mismo tipo, distinta de la suya. Si el destino tiene una línea igual, une como `merge_vehicle_lines`. Si no, la pasa con sus vehículos (FK diferida). | `catalog_type_mismatch`, `catalog_same_item`, `catalog_not_found` |

Unir y pasar descartan los recordados del origen que choquen con uno del destino. Dos recordados
iguales que apuntan a la misma marca sobran.

**RLS y privilegios (RN-01, RN-06, CA-05, CA-06)**

- `vehicle_brands` y `vehicle_lines`:
  - se cambia `grant select` de tabla por `grant select (id, vehicle_type, name, name_key)` y
    `(id, brand_id, name, name_key)` a `authenticated`;
  - `preloaded` y `created_at` solo se leen con `vehicle_catalog()`;
  - el código actual ya selecciona solo esas columnas (`vehicles.client.ts`, `vehicles.server.ts`,
    `work-orders.client.ts`).
- Tablas de recordados:
  - RLS activado y política `select` para `authenticated` (las sugerencias las leen, también el
    cliente);
  - `grant select (brand_id, name)` y `(line_id, name)`;
  - nadie las escribe desde la API.
- Las funciones `revoke … from public, anon` y `grant execute … to authenticated, service_role`.

**Seeds**

- `seeds/08_vehicle_catalog.sql`, solo local: la marca «Yamaja» con «Fz 2.0» y la línea «Fz 2.0»
  bajo Honda, añadidas como lo hace `save_vehicle`, sin vehículos (los clientes de los seeds
  conservan los suyos: uno solo viene preseleccionado, spec 008, RN-10).

**pgTAP `tests/17_vehicle_catalog_admin.test.sql`**

- Columnas, defaults y `mark_preloaded` sobre filas sucias.
- Privilegios por columna: un cliente y un operador no leen `preloaded` ni `created_at`.
- RLS y políticas de los recordados.
- Las cinco funciones, rechazadas para el operador y el cliente.
- Cada criterio de base de datos (tabla de pruebas).
- `06_vehicles` y `07_vehicle_catalog` se revisan: siguen leyendo marcas y líneas como
  `postgres`, no deberían cambiar.

## Aplicación (apps/web)

- **Módulo:** `src/modules/vehicles/`. El catálogo es de los vehículos y reutiliza `catalogKey`,
  tipos y mensajes.
- **Ruta:** `src/app/(app)/admin/vehicle-catalog/page.tsx`.
  - Pide `getStaffForPage()`; el operador recibe `NoPermission`.
  - Lee los filtros con `vehicleCatalogFiltersSchema` (`?type=motorcycle|car|bicycle&status=added|preloaded&q=`;
    lo inválido vuelve a Motocicleta sin filtros).
  - Lleva `loading.tsx` con `PageSkeleton` `list`.
- **Navegación, entradas:**
  - `NAV_LINKS` suma
    `{ href: '/admin/vehicle-catalog', key: 'vehicleCatalog', icon: CarFront, audiences: ['admin'], group: 'admin' }`
    entre «Habeas data» y «Usuarios» (RF-04), con sus textos en `auth.header` y `auth.home`.
  - «Servicios» y «Empleados» pasan a `group: 'admin'`, al principio del grupo: el grupo solo se
    aplica a quien tiene «Administración» (el administrador), así que el operador los sigue viendo
    en la barra (CA-21).
- **Navegación, «Más ▾» (HU-05, RF-05):**
  - **Entradas de la barra:** las secciones sueltas, en su orden, y el menú «Administración» como
    una entrada más, en el sitio de su primera sección. El orden es la prioridad: lo que no cabe
    sale por el final.
  - **Cuánto cabe:** `auth/utils/nav-overflow.utils.ts` tiene `visibleCount(widths, available,
    moreWidth, gap)`, una función pura. Devuelve cuántas entradas caben en línea: todas si caben
    sin «Más»; si no, las que caben junto a «Más»; nunca menos de una (Inicio).
  - **Medición:** `nav-links` dibuja una fila oculta de medición (`aria-hidden`, `invisible`,
    absoluta) con todas las entradas y «Más». Un `ResizeObserver` sobre el contenedor recalcula al
    cambiar el ancho (CA-24).
  - **Menús:** las entradas que no caben van en un `Dropdown` «Más ▾». «Administración», si pasa,
    va dentro como `DropdownSection` titulada. Los disparadores llevan `aria-expanded:opacity-100`
    y `onAction → router.push`.
  - **Estado actual:** cada menú lleva `data-current` cuando la sección actual está dentro (CA-23).
  - **Primer dibujo:** antes de medir (servidor e hidratación), van en línea las cuatro primeras y
    el resto en «Más». Es el mismo HTML en servidor y navegador, y no desborda a 1024 px. Al medir,
    entran las que quepan (hoy, todas).
  - **Teléfono:** el panel «Menú» y el inicio no cambian; listan todas las secciones.
- **API:**
  - `api/vehicle-catalog.server.ts`: `getVehicleCatalog(type)` (RPC `vehicle_catalog`, `jsonb` de
    líneas parseado con Zod).
  - `api/vehicles.client.ts`: `fetchBrands` y `fetchLines` piden también
    `aliases:vehicle_brand_aliases(name)` y `aliases:vehicle_line_aliases(name)`.
- **Acciones** (`actions/vehicle-catalog.actions.ts`, `getActiveAdmin()` y RPC):
  - `renameVehicleBrand`, `renameVehicleLine`, `mergeVehicleBrands`, `mergeVehicleLines`,
    `moveVehicleLine`;
  - devuelven `{ ok } | { ok: false, error }` con los hints traducidos
    (`utils/vehicle-catalog-errors.utils.ts`).
- **Utilidades puras:**
  - `utils/vehicle-catalog-filter.utils.ts` aplica tarjetas y búsqueda (marca o alguna de sus
    líneas, `catalogKey`) y cuenta «Añadidas» / «Precargadas»; una marca con alguna línea añadida
    cuenta como añadida.
  - `catalog-key.utils.ts`: `filterCatalog` y `findInCatalog` también comparan los nombres
    recordados (CA-16).
- **Componentes:**
  - `organisms/vehicle-catalog-screen`:
    - título, pestañas de tipo (enlaces, como `reports-tabs`);
    - `SummaryFilterCards` «Añadidas» / «Precargadas», buscador con espera, `FilterBar` («3 de 41
      marcas · Añadidas»);
    - lista de marcas: nombre, insignia «Añadida · 3 nov.», «12 vehículos», menú de acciones;
    - cada marca se despliega con sus líneas, con los mismos datos y su menú;
    - navega con `useUrlFilters`.
  - `molecules/catalog-rename-dialog` (React Hook Form + `catalogNameSchema`, de 1 a 60
    caracteres; el error junto al campo).
  - `molecules/catalog-merge-dialog`:
    - `Autocomplete` de destino con `portalContainer` y `scrollBehavior="outside"`;
    - excluye la propia y las de otro tipo o marca (CA-15, CA-20);
    - frase del efecto, «2 vehículos pasan a Suzuki. No se puede deshacer.»;
    - en el paso de una línea, si en el destino hay una igual, «Se unirá con la línea «FZ 2.0» de
      Yamaha.» (CA-19).
  - Las acciones van con `callAction`; el éxito con `notify` y `router.refresh()`; el error se queda
    dentro del diálogo.
- **Mensajes:** `vehicles.catalog.*` en `modules/vehicles/messages/es.json`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | `vehicle-catalog-screen.component.test.tsx` (orden, conteos, pestañas en la dirección); `e2e/vehicle-catalog-admin.spec.ts` (abrir desde «Administración», recargar) |
| CA-02 | componente | `vehicle-catalog-screen.component.test.tsx` (líneas desplegadas, conteos) |
| CA-03 | unit + componente + pgTAP | `vehicle-catalog-filter.utils.test.ts`; insignias y tarjetas en la pantalla; pgTAP `mark_preloaded` |
| CA-04 | unit + componente | `vehicle-catalog-filter.utils.test.ts` (nombre, línea, tildes, vacío); «sin coincidencias» en la pantalla |
| CA-05 | pgTAP + e2e + componente | pgTAP (5 funciones y `vehicle_catalog` rechazadas para operador y cliente); e2e (operador sin «Marcas y líneas», «No tienes permiso»); `nav-links.component.test.tsx` |
| CA-06 | pgTAP + e2e | pgTAP (el cliente no lee `preloaded` ni `created_at`); e2e (área del cliente sin «Añadida») |
| CA-07, CA-08 | pgTAP + e2e | pgTAP (renombrar marca y línea, se lee en vehículos, órdenes, reservas y `report_lines`); e2e (renombrar y verlo en la ficha del cliente) |
| CA-09 | pgTAP + componente | pgTAP (nombre tomado, tomado por un recordado, solo cambio de escritura permitido); diálogo con el error |
| CA-10 | unit + componente | `vehicle-catalog.schema.test.ts`; diálogo con errores junto al campo |
| CA-11 | componente + pgTAP | aviso flotante (`inToasts`); pgTAP (conserva `preloaded`) |
| CA-12, CA-13 | pgTAP + componente + e2e | pgTAP (vehículos vigentes y retirados movidos, `retired_at` intacto, líneas movidas y unidas, la marca borrada); diálogo con la pregunta y el conteo; e2e (unir «Yamaja» con Yamaha) |
| CA-14 | pgTAP + componente | pgTAP `merge_vehicle_lines`; diálogo |
| CA-15 | pgTAP + componente | pgTAP (otro tipo y la misma, rechazadas); el diálogo no las ofrece |
| CA-16 | pgTAP + unit | pgTAP (`save_vehicle` con «Suzuky» deja «Suzuki», también la línea); `catalog-key.utils.test.ts` (sugerencias por nombre recordado) |
| CA-17 | pgTAP | `report_lines`, `payroll_lines_live` y `work_order_summaries` con el nombre nuevo y los mismos totales |
| CA-18, CA-19, CA-20 | pgTAP + componente + e2e | pgTAP `move_vehicle_line` (con y sin una igual, otro tipo rechazado); diálogo (destinos y la frase de unión); e2e (pasar «Fz 2.0» de Yamaha… a Honda) |
| RN-02 | pgTAP | después de cada función, sin duplicados ni recordados que choquen |
| CA-21 | componente + e2e | `nav-links.component.test.tsx` (admin: barra y «Administración» con Servicios y Empleados primero; operador: los dos en la barra); `auth-ui.component.test.tsx`; e2e (`openSection`) |
| CA-22, CA-25 | unit + componente + e2e | `nav-overflow.utils.test.ts` (todo cabe sin «Más», sale por el final, límite exacto, nunca menos de Inicio); `nav-links.component.test.tsx` con anchos simulados («Administración» dentro de «Más» como sección); e2e `ui.spec.ts` (admin y operador a 1024 y 1440 px: sin desbordar, sin «Más» con las secciones de hoy) |
| CA-23 | componente | `nav-links.component.test.tsx` («Más» y «Administración» marcados con una sección de dentro; elegir navega) |
| CA-24 | componente | `nav-links.component.test.tsx` (al encoger el ancho simulado, la última entrada pasa a «Más»; al crecer, vuelve). En E2E, con las secciones de hoy, no hay ancho de escritorio en que falte sitio. |
| No funcionales | e2e | `a11y.spec.ts` (pantalla, diálogos con errores, oscuro); `ui.spec.ts` (iPhone y 360 px sin desplazamiento lateral; «lo que se ilumina lleva la mano») |

## Archivos afectados

**Nuevos**

- `packages/supabase/supabase/migrations/<ts>_vehicle_catalog_admin.sql`
- `packages/supabase/supabase/tests/17_vehicle_catalog_admin.test.sql`
- `packages/supabase/supabase/seeds/08_vehicle_catalog.sql`
- `apps/web/src/app/(app)/admin/vehicle-catalog/{page,loading}.tsx`
- En `apps/web/src/modules/vehicles/`:
  - `api/vehicle-catalog.server.ts`
  - `actions/vehicle-catalog.actions.ts`
  - `schemas/vehicle-catalog.schema.ts`
  - `utils/vehicle-catalog-{filter,errors}.utils.ts`
  - `types/vehicle-catalog.types.ts`
  - `components/organisms/vehicle-catalog-screen.component.tsx`
  - `components/molecules/catalog-{rename,merge}-dialog.component.tsx`
- Sus pruebas en `__test__/…`
- `apps/web/e2e/vehicle-catalog-admin.spec.ts`
- `apps/web/src/modules/auth/utils/nav-overflow.utils.ts` y su prueba

**Modificados**

- `packages/supabase/types/database.types.ts` (generado)
- `packages/supabase/CLAUDE.md` (seed 08)
- En `apps/web/src/modules/`:
  - `vehicles/api/vehicles.client.ts`
  - `vehicles/utils/catalog-key.utils.ts`
  - `vehicles/types/vehicles.types.ts`
  - `vehicles/messages/es.json`
  - `auth/constants/nav.constants.ts` (entrada nueva; «Servicios» y «Empleados» en el grupo)
  - `auth/components/molecules/nav-links.component.tsx` («Más ▾» medido)
  - `auth/messages/es.json` (`header.more`, `header.vehicleCatalog`, `home.vehicleCatalog*`)
- En `apps/web/__test__/`: `nav-links.component.test.tsx` y `auth-ui.component.test.tsx`
- En `apps/web/e2e/`:
  - `a11y.spec.ts` y `ui.spec.ts`;
  - `support/nav.ts`: `openAdminSection` sigue igual; las E2E que abren «Servicios» o «Empleados»
    como admin desde la barra pasan a usarla.
- `CLAUDE.md` (sección de la spec 018)
- `specs/005-vehiculos-clientes/spec.md` (historial: el catálogo ya se administra)
- `specs/009-experiencia-movil/spec.md` (ya enmendada: «Más ▾»)

**Eliminados:** ninguno.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Al unir, la marca o línea absorbida se borra; sus vehículos pasan a la que queda. | Marcarla «unida» y ocultarla. | La spec la hace desaparecer de lista y sugerencias. Nada más apunta a ella, y su nombre queda como recordado. |
| Pasar una línea con FK diferida. | Crear una línea nueva y borrar la vieja. | Conserva la identidad, el origen y la fecha de la línea. |
| Excepción del guardián con un ajuste de sesión, solo para `brand_id` y `line_id`. | Desactivar el *trigger* o permitir editar retirados. | Mismo patrón que la supresión (spec 017), y más estrecho: cualquier otro cambio sigue rechazado. |
| Origen por la hora de la carga inicial. | Volver a listar los nombres precargados. | La carga es una sola transacción con una sola `now()`. La lista se desalinearía con la migración de datos. |
| Privilegios por columna en el catálogo. | Dejarlo legible y solo no mostrarlo. | RN-06 y la constitución (VI): la autorización vive en Postgres. |
| Recordar también los renombres (CA-16, decidido con el usuario). | Recordar solo lo unido. | Las sugerencias se guardan 30 min en cada navegador. Quien tenga la lista vieja enviaría «Royal Enfiel» y la volvería a crear. |
| «Más ▾» medido con `ResizeObserver` y una fila oculta. | Puntos de corte fijos en CSS por sección; ítems ocultos con CSS dentro del menú. | Los anchos dependen del texto y del rol, y cambiarían con cada sección nueva. Un ítem oculto con CSS dentro de un menú de React Aria sigue recibiendo el foco del teclado. |
| Primer dibujo con cuatro entradas en línea y el resto en «Más». | Todas en línea hasta medir. | Sin medir no se sabe si caben. Con cuatro fijas, el HTML del servidor coincide con el del navegador y no desborda a ningún ancho; al medir crece (en cargas completas; al navegar, el encabezado persiste). |

## Despliegue

- Primero la migración (workflow `db-deploy` al entrar en `develop`), luego la app.
- Sin variables nuevas.
- La migración marca las precargadas del entorno y deja todo lo demás como «Añadida».

## Detalles de la implementación

Lo que cambió respecto a lo planeado, durante la implementación:

- **Revisión en vez de origen** (pedido del usuario, spec RN-07):
  - la columna es `reviewed` y no `preloaded`;
  - `private.mark_initial_vehicle_catalog_reviewed()` marca revisada la carga inicial;
  - renombrar, unir y pasar dejan revisada la que queda; al unir marcas, las líneas que pasan
    conservan su estado;
  - las tarjetas son «Por revisar» / «Revisadas» (`?status=pending|reviewed`).
- **Registrar y dar por revisada** (HU-06): funciones `add_vehicle_brand`, `add_vehicle_line`,
  `mark_vehicle_brand_reviewed` y `mark_vehicle_line_reviewed`, solo admin.
  - El diálogo de renombrar pasó a ser `catalog-name-dialog`: renombra o registra.
  - «Dar por revisada» actúa al momento desde el menú, con aviso flotante.
- **Diálogos con estado simple y Zod**, sin React Hook Form: un solo campo, como el diálogo de
  registrar solicitudes de la spec 017.
- **La fila entera despliega una marca:** su botón se estira sobre la fila (`after:inset-0`) y el menú
  de acciones queda encima (`relative z-10`).
- **Menú «Más»:**
  - en el primer dibujo todo va en línea, porque con las secciones de hoy cabe desde 1024 px; así el
    servidor nunca pinta «Más» para quitarlo al medir;
  - la copia de medición es `inert`, sin elementos enfocables;
  - la barra ocupa el espacio libre del encabezado (`lg:flex-1`).
- **Seed 08 sin vehículos:** a Andrés, con dos vehículos, ya no se le preseleccionaría su bicicleta
  (spec 008, RN-10).
- **Contraste de las tarjetas-filtro** (estándar de la spec 003): la auditoría de esta pantalla, con
  una tarjeta elegida, mostró que atenuar las demás con opacidad dejaba su etiqueta por debajo de AA.
  Ahora se atenúan sin opacidad: sin sombra, con la cifra en gris y el punto apagado. El arreglo
  alcanza también a Usuarios y Clientes.
- **`Autocomplete` del diálogo de unir sin botón de borrar:** en HeroUI no tiene nombre accesible,
  como en los demás campos de este tipo del proyecto.
