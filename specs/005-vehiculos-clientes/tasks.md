---
spec: "005"
actualizado: 2026-11-19
---

# Tareas — 005 Vehículos de los clientes

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`, `RN-xx`) y termina en algo verificable (→).
- Las pruebas se escriben antes que el código y se ven en **rojo**. Si una ya pasa al escribirla,
  se muta el código para verla fallar (ver la Definición de terminado en `CLAUDE.md`).
- Todo va en la rama `feature/005-vehiculos-clientes`. El **bloque A** (P1) deja la app
  desplegable por sí solo; el **bloque B** (P2) completa la spec; el **bloque C** (P2) es el
  cambio HU-07 (placa colombiana y ciudad de la placa).
- Rutas abreviadas: `sb/` = `packages/supabase/supabase/`, `web/` = `apps/web/`,
  `veh/` = `web/src/modules/vehicles/`.

---

## Bloque A — P1: registrar vehículos con catálogo y colores (HU-01 a HU-03)

La base de datos se hace completa en este bloque (también las reglas que usa el bloque B:
retiro, búsqueda por placa y acceso del cliente), igual que en la spec 004.

### Fase A1 — Base de datos

- [x] T001 Crear la rama `feature/005-vehiculos-clientes` desde `develop`. Crear las migraciones
      vacías con `migration:new vehicles < /dev/null` y
      `migration:new vehicle_catalog_data < /dev/null`
      → versiones posteriores a `20261119192651`
- [x] T002 [P] pgTAP `sb/tests/06_vehicles.test.sql`, parte A (esquema y reglas del vehículo):
      - enums `vehicle_type`, `vehicle_class` y `vehicle_color`, este en el orden de RN-05;
      - tablas, columnas, FK compuestas e índices (`vehicles_plate_active_key` parcial);
      - RLS activado en las tres tablas, `policies_are` y privilegios por columna; `anon` sin
        nada; catálogo sin `insert`/`update`/`delete` desde la API;
      - formatos de placa: moto `UIH03D` y `JWJ07` sí; `ABC123` no. Carro `ABC123` sí; `ABC12D`
        no. Bicicleta sin placa. Se normaliza `uih-03d` → `UIH03D` (CA-03, CA-05, CA-06, RN-03);
      - clase obligatoria en carro y bicicleta y con valores de su tipo; cilindraje solo en moto,
        entre 50 y 2.500 (49 y 2.501 rechazados); línea obligatoria salvo en bicicleta
        (CA-07, RN-09, RN-10);
      - la guarda pone en `null` el cilindraje de un carro, la clase de una moto y la placa de
        una bicicleta (CA-09);
      - placa repetida entre vigentes, escrita de otra forma → `vehicle_plate_taken` (CA-08,
        RN-04)

      → `pnpm db:test` **rojo**
- [x] T003 [P] pgTAP `sb/tests/06_vehicles.test.sql`, parte B (catálogo, retiro, acceso y
      búsqueda):
      - `save_vehicle` crea la marca y la línea nuevas; reutiliza «Suzuki» al recibir
        «suzuki» o « SUZUKI » sin crear otra; si la placa falla, la marca nueva no queda
        (CA-13, CA-14, RF-05);
      - una marca de moto no sirve para un carro; una línea de otra marca no sirve (RF-04);
      - retirar: `retired_at` pasa a `now()`, la placa queda libre, un retirado no cambia ni
        vuelve, `customer_id` no cambia (CA-20, CA-21, CA-22, RN-01, RN-07);
      - el cliente lee, crea, edita y retira solo lo suyo, no mueve un vehículo a otra ficha, y
        el personal ve todo (CA-26, RN-01);
      - un cliente desactivado no recibe vehículos ni cambios, ni por el personal (suposición);
      - `customers.vehicle_plates` y `search_text` incluyen las placas vigentes y pierden la
        retirada (CA-17, CA-18)

      → **rojo**
- [x] T004 [P] pgTAP `sb/tests/07_vehicle_catalog.test.sql`:
      - `private.catalog_key` con la tabla de casos compartida con la app («GSX-R600»,
        «gsx r600», «GSXR 600», «Citroën», «  Mazda 2 ») (CA-12, RN-06);
      - catálogo precargado: al menos 20 marcas de moto, 25 de carro y 15 de bicicleta; las
        marcas principales de moto y carro tienen líneas; Suzuki (moto) → GSX-R600; Suzuki
        (carro) no tiene GSX-R600 (CA-10, CA-11, RF-03, RF-04)

      → **rojo**
- [x] T005 Migración `<ts>_vehicles.sql`:
      - enums; `private.catalog_key`; tablas con columnas generadas, checks, FK compuestas e
        índices; `set_updated_at`;
      - `vehicles_guard` completa (normalización, hints, inmutables, retiro);
      - `private.vehicle_plate_taken`, `private.current_customer_id`,
        `private.ensure_vehicle_brand`, `private.ensure_vehicle_line` y `public.save_vehicle`;
      - RLS y privilegios de las tres tablas;
      - `customers.vehicle_plates`, su trigger y `search_text` recreada con su índice

      → T002 y T003 en **verde**
- [x] T006 Migración `<ts>_vehicle_catalog_data.sql`: las 78 marcas y sus líneas del plan, con
      `on conflict do nothing` y la línea `-- seeds: unchanged — catalog data lives in this
      migration` → T004 en **verde**
- [x] T007 Seeds `sb/seeds/03_vehicles.sql`: la GSX-R600 de Camila (`UIH-03D`) y su moto
      retirada (`JWJ-07`), la camioneta de Valentina (`KDM-482`), la bicicleta de Andrés y la
      moto de Daniel (desactivado) → `pnpm db:reset` sin errores y los vehículos visibles en
      Studio
- [x] T008 `pnpm db:types` → `types:check` en verde. Comprobar con una consulta del cliente
      tipado que el embebido `brand:vehicle_brands(name)`, `line:vehicle_lines(name)` funciona
      con las FK compuestas; si es ambiguo, anotar el nombre de la FK en el plan (riesgo del
      plan)

### Fase A2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `veh/utils/plate.utils.test.ts`: `normalizePlate`, `isValidPlate(type, plate)`
      para cada formato y tipo, y `formatPlate` (`uih03d` → `UIH-03D`, `jwj 07` → `JWJ-07`,
      `abc123` → `ABC-123`) (CA-03, CA-05, RN-03) → **rojo**
- [x] T011 [P] `veh/utils/catalog-key.utils.test.ts`: `catalogKey` con la misma tabla de casos
      que T004 y `filterCatalog` (contiene, sin mayúsculas, tildes, espacios ni guiones)
      (CA-10, CA-12) → **rojo**
- [x] T012 [P] `veh/schemas/vehicle.schema.test.ts`: obligatorios por tipo (marca, color, línea
      en moto/carro, placa en moto/carro, clase en carro/bicicleta), cilindraje 49/50/2.500/2.501
      y vacío, placa según tipo, y que los campos ajenos al tipo no se envían
      (CA-05, CA-06, CA-07, RN-09, RN-10) → **rojo**
- [x] T013 [P] `veh/utils/vehicles-errors.utils.test.ts`: cada `hint` a su clave, y
      `vehicle_plate_taken` (y el `23505` del índice) da el mensaje del personal o el del
      cliente según la audiencia (CA-08, CA-25, RN-08) → **rojo**
- [x] T014 [P] `color-select.component.test.tsx`: 16 opciones en el orden de RN-05, cada una
      con su nombre y su muestra; «Multicolor» con muestra de varios colores; se elige con
      teclado (CA-15) → **rojo**
- [x] T015 [P] `vehicle-summary.component.test.tsx`: «Marca Línea», clase o «600 cc», color con
      nombre visible junto a la muestra y placa formateada; bicicleta sin placa
      (CA-03, CA-16) → **rojo**
- [x] T016 `vehicle-form.component.test.tsx`: Motocicleta marcada al abrir; cilindraje
      solo en moto; clase Automóvil/Camioneta en carro y Montaña/Ruta en bicicleta, sin
      preseleccionar; sin placa en bicicleta; cambiar el tipo vacía marca, línea, clase,
      cilindraje y placa; cambiar la marca vacía la línea; errores junto a cada campo
      (CA-02, CA-06, CA-07, CA-09) → **rojo**
- [x] T017 `vehicles-section.component.test.tsx` (bloque A): lista de vigentes o «Este cliente
      aún no tiene vehículos.» y «Agregar vehículo»; sin «Agregar» si el cliente está
      desactivado (CA-01) → **rojo**
- [x] T018 `veh/actions/vehicles.actions.test.ts` (`saveVehicle`): sin sesión de personal ni de
      cliente → `forbidden`; entrada inválida → `invalidInput` con errores por campo; un cliente
      siempre guarda en **su** ficha aunque el input traiga otra (CA-26); traduce los `hint`
      → **rojo**

### Fase A3 — Implementación (verde)

- [x] T020 [P] `veh/utils/plate.utils.ts` y `veh/utils/catalog-key.utils.ts` → T010 y T011 en
      **verde**
- [x] T021 [P] `veh/constants/vehicle-colors.constants.ts` y `veh/schemas/vehicle.schema.ts`
      (objeto plano + `superRefine` por tipo) → T012 en **verde**
- [x] T022 [P] `veh/utils/vehicles-errors.utils.ts` → T013 en **verde**
- [x] T023 `veh/messages/es.json` (tipos, clases, colores, formulario, vacíos, retiro), registrado
      en `web/src/i18n/messages.ts`
- [x] T024 [P] Átomos `color-swatch` y `plate-label`; moléculas `color-select` y
      `vehicle-summary` → T014 y T015 en **verde**
- [x] T025 `veh/api/vehicles.client.ts`, `veh/queries/vehicles.keys.ts` y
      `veh/queries/vehicles.queries.ts` (`brandsQueryOptions(type)`, `linesQueryOptions(brandId)`
      con `staleTime` largo) y la molécula `catalog-autocomplete` (`Autocomplete` de HeroUI con
      `allowsCustomValue`, filtrado con `filterCatalog`) (CA-10, CA-13) → se ve en el navegador
      con «suz» → Suzuki
- [x] T026 Organismo `vehicle-form` (el modal lo abre `vehicles-section`) (React Hook Form + Zod; tipo con `RadioGroup`;
      `NumberInput` con «cc») → T016 en **verde**
- [x] T027 `veh/api/vehicles.server.ts` (`listCustomerVehicles` → vigentes y retirados, del más
      reciente al más antiguo) y `veh/actions/vehicles.actions.ts` (`saveVehicle` con
      `getActiveStaff()`/`getActiveCustomer()` y `rpc('save_vehicle')`; `revalidatePath`)
      (CA-04, RN-01) → T018 en **verde**
- [x] T028 Organismo `vehicles-section` y su uso en `web/src/app/(app)/customers/[id]/page.tsx`
      (solo lectura si el cliente está desactivado) (CA-01, CA-03, CA-04, RF-06) → T017 en
      **verde** y alta de una moto, un carro y una bicicleta en el navegador

### Fase A4 — E2E

- [x] T030 `e2e/support/sandbox.ts`: limpieza de vehículos, marcas y líneas creadas por las
      pruebas (por nombre/placa con etiqueta por worker)
- [x] T031 `e2e/vehicles.spec.ts` (bloque A): ficha vacía → «Agregar vehículo» → moto con 600 cc
      (`uih03d` se ve `UIH-03D`), un segundo vehículo arriba, un carro Camioneta (`ABC-123`), una
      bicicleta de Ruta sin placa, y la placa repetida con su mensaje
      (CA-01, CA-03, CA-04, CA-05, CA-06, CA-08)
- [x] T032 `e2e/vehicle-catalog.spec.ts`: «suz» → Suzuki y «gsx» → GSX-R600; con Carro, Suzuki
      no sugiere GSX-R600; una marca nueva se guarda y aparece como sugerencia en la siguiente
      alta; escrita con otras mayúsculas no se duplica (CA-10, CA-12, CA-13, CA-14)
- [x] T033 `e2e/a11y.spec.ts` (ficha con vehículos y formulario abierto, con el selector de color
      desplegado) y `e2e/ui.spec.ts` (ficha y formulario a 360 px) (CA-16, RNF accesibilidad y
      dispositivos)

### Fase A5 — Definición de terminado del bloque A

- [x] T034 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` ·
      `pnpm db:reset` · `pnpm db:test` · `types:check` en verde; mutaciones de las pruebas nuevas
      anotadas y revertidas (`git diff` + grep del marcador)

---

## Bloque B — P2: búsqueda por placa, corregir y retirar, y Mis vehículos (HU-04 a HU-06)

### Fase B2 — Pruebas de la aplicación (rojo)

- [x] T040 [P] `customers-filter.utils.test.ts`, ampliado: `normalizeSearch` quita espacios y
      guiones cuando el término parece una placa («UIH-03» y «uih 03» → `uih03`) y no toca
      nombres («ana-maría», «José Pérez»); `matchingPlate(plates, q)` devuelve la placa que
      coincide o `null` (CA-17, CA-19) → **rojo**
- [x] T041 [P] `vehicles-section.component.test.tsx`, ampliado: «Editar» y «Retirar» en los
      vigentes; «Vehículos retirados» con la fecha de retiro y sin acciones; con la audiencia
      `customer`, «Mis vehículos», «Aún no tienes vehículos.» y sin retirados
      (CA-20, CA-21, CA-22, CA-23, RF-06) → **rojo**
- [x] T042 [P] `vehicles.actions.test.ts`, ampliado (`retireVehicle`): sin sesión válida →
      `forbidden`; id inválido → `notFound`; traduce `vehicle_retired` → **rojo**
- [x] T043 Sandbox `__test__/sandbox/vehicles-access.sandbox.test.ts`, con la sesión de
      `cliente@`: no lee vehículos de otros; no crea en otra ficha (ni con `save_vehicle`); no
      edita, retira ni mueve vehículos ajenos; no escribe en el catálogo directamente; una placa
      ajena da `vehicle_plate_taken` sin revelar el dueño (CA-25, CA-26) → **rojo** (o verde
      por la base de datos del bloque A; entonces se ve fallar relajando una política)

### Fase B3 — Implementación (verde)

- [x] T044 `customers-filter.utils.ts` (`normalizeSearch` con placas, `matchingPlate`),
      `customers.server.ts` (selecciona `vehicle_plates`) y `customers-table` (placa que
      coincidió bajo el nombre) (CA-17, CA-18, CA-19) → T040 en **verde**
- [x] T045 Editar: `vehicle-form` en modo edición (valores actuales) y `saveVehicle` con
      `vehicle_id` (CA-20) → verificado en el navegador
- [x] T046 Retirar: `retire-vehicle-modal` (confirmación), acción `retireVehicle` y la lista
      plegable «Vehículos retirados» (CA-21, CA-22, RF-06) → T041 (personal) y T042 en **verde**
- [x] T047 «Mis vehículos» en `web/src/app/(app)/profile/page.tsx`: `vehicles-section` con la
      audiencia `customer` (sin retirados; mensaje de placa ocupada del cliente)
      (CA-23, CA-24, CA-25) → T041 (cliente) y T043 en **verde**
- [x] T048 Anotar en `specs/004-registro-clientes/spec.md` que CA-16 busca también por placa y
      que «Mi perfil» incluye «Mis vehículos» (cambios declarados en la 005)

### Fase B4 — E2E

- [x] T050 `e2e/vehicles.spec.ts` (bloque B): editar color y placa; editar con una placa de otro
      vehículo vigente → mensaje; retirar con confirmación → «Vehículos retirados» con fecha y
      sin acciones → la placa se registra en otro cliente (CA-20, CA-21, CA-22)
- [x] T051 `e2e/vehicles-search.spec.ts`: buscar `uih03`, `UIH-03` y `uih 03` encuentra a Camila
      y muestra `UIH-03D`; la placa retirada `JWJ-07` no la encuentra; se combina con las
      tarjetas-filtro (CA-17, CA-18, CA-19)
- [x] T052 `e2e/my-vehicles.spec.ts`: el cliente ve «Mis vehículos», agrega una moto, la corrige
      y la retira (deja de verla), y el personal ve los cambios en su ficha; una placa de otro
      cliente muestra «Ya hay un vehículo registrado con esta placa. Si es tuyo, acércate al
      punto de atención.» (CA-23, CA-24, CA-25)
- [x] T053 `e2e/a11y.spec.ts` y `e2e/ui.spec.ts`: «Mi perfil» con vehículos, «Vehículos
      retirados» desplegado y el modal de retiro

### Fase B5 — Definición de terminado

- [x] T060 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde
- [x] T061 `pnpm db:reset` + `pnpm db:test` + `pnpm --filter @motorismo/supabase types:check` en
      verde
- [x] T062 Mutación aplicada a cada prueba nueva, fallo observado y revertida; `git diff` + grep
      del marcador limpios. Mutaciones anotadas en el Historial del plan
- [x] T063 `CLAUDE.md` (vehículos de los seeds) y `packages/supabase/CLAUDE.md` (catálogo por
      migración, `03_vehicles.sql`); spec en `implementada`, plan y backlog actualizados
- [x] T065 `/verificar`: pruebas de los errores de clase y de cilindraje en `vehicle-form`
      (CA-07) y de un cliente que amplía el catálogo en `06_vehicles.test.sql` (RF-05), vistas
      fallar por mutación; suposición de los nombres nuevos precisada en la spec
- [ ] T064 Despliegue (cuando existan los entornos remotos): migraciones por `db-deploy` y conteo
      de marcas por tipo en el remoto (plan, Despliegue)

## Bloque C — P2: la placa como se ve en la calle (HU-07)

Cambio aprobado el 2026-11-19 (spec HU-07, plan «Cambio HU-07»). Va en la misma rama, antes del
PR. Abreviatura extra: `mun` = municipios.

### Fase C1 — Base de datos

- [x] T070 Crear la migración vacía `migration:new municipalities_data < /dev/null` (versión
      posterior a `20261119211116`). Generar su SQL desde la DIVIPOLA descargada de datos.gov.co
      (`gdxc-w37w`) con un script de un solo uso en el scratchpad, que no se versiona. Entran los
      «Municipio» y la «Isla», sin las «Área no municipalizada». Nombres y departamentos en
      mayúsculas iniciales, con los conectores en minúscula y «D.C.» intacto. Cabecera con la URL,
      la fecha de descarga y `-- seeds: unchanged — municipalities live in this migration`;
      `on conflict (code) do nothing`
      → 1.104 `insert` revisados a mano en una muestra (Bogotá, D.C., La Calera, Funza, Villa de
      San Diego de Ubaté, El Carmen de Viboral) (RF-07)
- [x] T071 [P] pgTAP `sb/tests/08_municipalities.test.sql`:
      - tabla, PK `code` con `check` de 5 dígitos, RLS activado, `policies_are` (solo `select`
        para `authenticated`), `table_privs_are` (sin escritura; `anon` sin nada);
      - 1.104 filas y 33 departamentos; `11001` = «Bogotá, D.C.», `25377` = «La Calera» y `25286`
        = «Funza» (Cundinamarca); «Villa de San Diego de Ubaté» y «El Carmen de Viboral» bien
        escritos; Armenia en dos departamentos; «La Chorrera» no está (RF-07, CA-30)

      → `pnpm db:test` **rojo**
- [x] T072 [P] pgTAP `sb/tests/06_vehicles.test.sql`, ampliado:
      - columna `plate_city_code`, FK a `municipalities`, `check` por tipo y privilegios por
        columna de `insert` y `update`;
      - carro sin ciudad → `vehicle_plate_city_required`; con `99999` →
        `vehicle_plate_city_invalid`;
      - moto y bicicleta enviadas con ciudad → `null`; un carro que pasa a moto pierde la ciudad
        (CA-09, CA-31, RN-11);
      - corregir la ciudad de un carro con `save_vehicle` (CA-20);
      - las altas de carro existentes en la prueba pasan `p_plate_city_code`

      → `pnpm db:test` **rojo**
- [x] T073 Editar `sb/migrations/20261119211115_vehicles.sql`:
      - tabla `public.municipalities` antes de `vehicles`, con RLS, política y `grant select`;
      - `plate_city_code`, su `check`, su índice y la FK;
      - la guarda (anula fuera de carro; los dos `hint`) y los `grant` por columna;
      - `save_vehicle` con `p_plate_city_code` (y su firma en `revoke`/`grant`)

      → T071 y T072 en **verde**
- [x] T074 Seeds `sb/seeds/03_vehicles.sql`: `KDM-482` con `p_plate_city_code => '11001'`.
      `pnpm db:reset`, `pnpm db:test` y `pnpm db:types`
      → `types:check` en verde y la consulta de `vehicles` con `plate_city:municipalities(name)`
      responde desde el cliente tipado

### Fase C2 — Pruebas de la aplicación (rojo)

- [x] T075 [P] `veh/utils/plate-city.utils.test.ts`: `sortPlateCities` (Bogotá, D.C., La Calera
      y Funza primero, en ese orden; luego alfabético con tildes, «Ábrego» entre las «A»; a igual
      nombre, por departamento) y `filterPlateCities` («medellin» y «MEDELLÍN» → Medellín; «la
      cal» → La Calera; vacío → toda la lista en orden) (CA-30)
      → **rojo**
- [x] T076 [P] `plate-label.component.test.tsx` (nuevo):
      - carro `ABC123` con ciudad: una fila `ABC-123` y debajo `BOGOTÁ, D.C.`; texto accesible
        con la placa y la ciudad (CA-27, CA-28);
      - moto `UIH03D`: filas `UIH` y `03D` ocultas a lectores, `UIH-03D` legible, «COLOMBIA»
        decorativo; moto antigua `JWJ07` → `JWJ`/`07` (CA-27, CA-28);
      - `size="sm"`: una línea `UIH-03D` o `ABC-123`, sin ciudad ni «COLOMBIA» (CA-29)

      → **rojo**
- [x] T077 [P] `vehicle-summary.component.test.tsx`, ampliado: un carro muestra la ciudad de su
      placa (CA-27); las pruebas actuales de la placa siguen en verde (CA-03, CA-05)
      → **rojo**
- [x] T078 `vehicle-form.component.test.tsx`, ampliado:
      - «Ciudad de la placa» solo con Carro, con «Bogotá, D.C.» elegida; al editar un carro,
        su ciudad; cada opción con su departamento (CA-02, CA-30);
      - pasar de Carro a Moto quita el campo, y volver a Carro lo trae con Bogotá, D.C. (CA-09);
      - sin ciudad en carro → «Elige la ciudad de la placa.» junto al campo (CA-07)

      → **rojo**
- [x] T079 [P] `vehicle.schema.test.ts` (carro sin `plate_city_code` inválido; moto y bicicleta lo
      ignoran) y `vehicles-errors.utils.test.ts` (`vehicle_plate_city_required` e
      `vehicle_plate_city_invalid` a sus mensajes) (CA-07, CA-31)
      → **rojo**
- [x] T080 [P] `vehicles.actions.test.ts`, ampliado: `saveVehicle` pasa `p_plate_city_code` solo
      en carro, nunca en moto ni bicicleta (CA-31)
      → **rojo**

### Fase C3 — Implementación (verde)

- [x] T081 [P] Constantes `DEFAULT_PLATE_CITY` y `PINNED_PLATE_CITIES`, y
      `veh/utils/plate-city.utils.ts`
      → T075 en **verde**
- [x] T082 [P] Tokens `--color-plate`, `--color-plate-ink` y `--color-plate-edge` en
      `web/src/app/globals.css`, y el átomo `plate-label` (forma deducida de la placa, `city`,
      `size`), con `vehicle-summary` pasando la ciudad y `customers-table` con `size="sm"`
      → T076 y T077 en **verde**
- [x] T083 `vehicles.client.ts` (`fetchMunicipalities`), `vehicleKeys.municipalities()`,
      `municipalitiesQueryOptions` (`staleTime: Infinity`) y `vehicles.server.ts` (incrusta
      `plate_city`; `VehicleView`)
      → `pnpm ts:check` en verde
- [x] T084 Esquema (`plate_city_code`), errores (los dos `hint`), mensajes (`form.plateCity`,
      `form.plateCityPlaceholder`, `errors.plateCityRequired`, `errors.plateCityInvalid`,
      `plate.country`) y acción `saveVehicle`
      → T079 y T080 en **verde**
- [x] T085 Molécula `plate-city-autocomplete` (sin valor libre, sin virtualizar y con máximo 50 opciones, departamento como
      descripción, `portalContainer`) y su uso en `vehicle-form` (solo en Carro, Bogotá, D.C. por
      defecto, al editar la del carro, vaciar al cambiar de tipo)
      → T078 en **verde**; `pnpm test` completo en verde

### Fase C4 — E2E

- [x] T086 `e2e/vehicles.spec.ts`, ampliado: el carro registrado con la ciudad por defecto
      muestra «BOGOTÁ, D.C.» en su placa; elegir «medellin» → Medellín (Antioquia), guardar y ver
      «MEDELLÍN»; editar la ciudad de un carro (CA-20, CA-27, CA-30). `vehicles-search.spec.ts`:
      la placa encontrada se ve en una línea y sin «COLOMBIA» (CA-29).
      `vehicles-access.sandbox.test.ts`: altas de carro con ciudad
      → verde
- [x] T087 [P] `e2e/ui.spec.ts`: la placa tiene el fondo amarillo y los caracteres negros de los
      tokens (CA-27); la ficha con un carro y el formulario con «Ciudad de la placa» sin scroll
      horizontal a 360 px. `e2e/a11y.spec.ts`: la ficha con un carro y la moto, y el formulario
      con la lista de ciudades abierta (CA-28)
      → verde; si la lista virtualizada falla en axe o va lenta, aplicar el plan B del plan y
      anotarlo

### Fase C5 — Definición de terminado

- [x] T088 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` ·
      `pnpm --filter web test:sandbox` en verde; `pnpm db:reset` + `pnpm db:test` +
      `pnpm --filter @motorismo/supabase types:check` en verde
- [x] T089 Mutación para cada prueba nueva que no se vio en rojo al escribirla; fallo observado y
      revertido; `git diff` + grep del marcador limpios. Mutaciones anotadas en el Historial del
      plan
- [x] T090 `CLAUDE.md` (excepción del amarillo de la placa en el sistema visual; `KDM-482` con
      Bogotá, D.C.; municipios por migración) y `packages/supabase/CLAUDE.md` (municipios por
      migración, como el catálogo); spec en `implementada`, plan y backlog actualizados
- [x] T091 `/verificar 005` sobre CA-27 a CA-31 y los criterios ajustados (CA-02, CA-03, CA-07,
      CA-09, CA-20)

---

## Cobertura de criterios

| Criterio | Tareas de prueba |
|---|---|
| CA-01 | T017, T031 |
| CA-02 | T016 |
| CA-03 | T002, T010, T015, T031 |
| CA-04 | T031 |
| CA-05 | T002, T010, T012, T031 |
| CA-06 | T002, T012, T016, T031 |
| CA-07 | T002, T012, T016, T065 |
| CA-08 | T002, T013, T031 |
| CA-09 | T002, T016 |
| CA-10 | T004, T011, T032 |
| CA-11 | T004 |
| CA-12 | T004, T011, T032 |
| CA-13 | T003, T032 |
| CA-14 | T003, T032 |
| CA-15 | T014 |
| CA-16 | T015, T033 |
| CA-17 | T003, T040, T051 |
| CA-18 | T003, T051 |
| CA-19 | T040, T051 |
| CA-20 | T003, T041, T050 |
| CA-21 | T003, T041, T050 |
| CA-22 | T003, T041, T050 |
| CA-23 | T041, T052 |
| CA-24 | T052 |
| CA-25 | T013, T043, T052 |
| CA-26 | T003, T018, T043 |
| CA-27 | T076, T077, T086, T087 |
| CA-28 | T076, T087 |
| CA-29 | T076, T086 |
| CA-30 | T071, T075, T078, T086 |
| CA-31 | T072, T079, T080 |
| RF-07 | T070, T071 |
| CA-02, CA-07, CA-09, CA-20 (ajustados) | T072, T078, T079, T086 |
