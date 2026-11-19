---
spec: "005"
estado: aprobado
actualizado: 2026-11-19
---

# Plan técnico — 005 Vehículos de los clientes

## Resumen

Tres tablas nuevas en Postgres:

- `vehicle_brands`: marcas por tipo de vehículo;
- `vehicle_lines`: líneas por marca;
- `vehicles`: los vehículos de cada cliente.

Las reglas de la spec viven en la base de datos, con RLS, `check` y un trigger de guarda:

- formato de placa por tipo;
- placa única entre los vehículos vigentes;
- clase y cilindraje según el tipo;
- retiro sin vuelta atrás;
- el cliente solo toca lo suyo.

El vehículo se guarda con una sola función, `save_vehicle`. Recibe la marca y la línea **por
nombre**, las busca en el catálogo por una clave normalizada y, si no existen, las crea. Todo
ocurre en la misma transacción que el vehículo: si el vehículo no se guarda, tampoco queda la
marca nueva.

El catálogo inicial llega por **migración**, no por seed, porque tiene que existir también en los
entornos remotos.

En la app hay un módulo nuevo, `vehicles`:

- la sección «Vehículos» de la ficha del cliente;
- «Mis vehículos» dentro de «Mi perfil»;
- el formulario, con sugerencias de marca y línea (HeroUI `Autocomplete`) y selector de color.

La búsqueda por placa reutiliza la de «Clientes» (spec 004): las placas vigentes se copian a la
ficha del cliente y entran en su `search_text`.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Los cambios a la spec 004 (CA-16 con placa; «Mis vehículos» en HU-03) se anotan en la 004 en este mismo cambio. |
| II. Qué antes que cómo | ✅ | La tecnología solo aparece en este plan. |
| III. Criterios verificables | ✅ | Los 26 CA están mapeados a pruebas (tabla abajo). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas. Las suposiciones de la spec se aplican tal cual: la línea es opcional en bicicleta, el cilindraje es opcional, la clase no viene preseleccionada y un cliente desactivado queda de solo lectura. |
| V. Simplicidad y stack | ✅ | Sin dependencias nuevas. Usa `unaccent` (ya instalada en la 004) y componentes de HeroUI. El catálogo se carga entero por tipo (decenas de marcas) y se filtra en el navegador, sin búsqueda en el servidor. TanStack Query solo para el catálogo, que se lee desde el navegador. |
| VI. Seguridad y datos personales | ✅ | RLS en las tres tablas. El catálogo es de solo lectura desde la API y solo crece a través de `save_vehicle`. Las placas solo las ve el personal o su dueño. La placa repetida se comprueba con una función privada que no dice de quién es (RN-08). |
| VII. Trazabilidad | ✅ | Rama `feature/005-vehiculos-clientes`. Cada test cita su CA. |
| VIII. Incrementos pequeños | ✅ | Dos bloques en la misma rama. **Bloque A** (P1, HU-01 a HU-03): toda la base de datos y la sección «Vehículos» de la ficha para registrar; se puede desplegar sola. **Bloque B** (P2, HU-04 a HU-06): búsqueda por placa, corregir y retirar, y «Mis vehículos». |

## Base de datos (`packages/supabase`)

Dos migraciones nuevas, creadas con `migration:new`, con versión posterior a
`20261119192651_customers`.

### Migración `<ts>_vehicles.sql`

**Tipos**

| Enum | Valores | Notas |
|---|---|---|
| `vehicle_type` | `motorcycle`, `bicycle`, `car` | RF-02 |
| `vehicle_class` | `automobile`, `utility`, `mountain`, `road` | Automóvil, Camioneta (SUV, pickup o van), Montaña, Ruta (RN-10) |
| `vehicle_color` | `black`, `white`, `gray`, `silver`, `red`, `burgundy`, `blue`, `green`, `yellow`, `orange`, `brown`, `beige`, `gold`, `purple`, `pink`, `multicolor` | RN-05, en el mismo orden que la spec |

**Clave de catálogo** (RN-06): `private.catalog_key(text)`, `immutable`.
- Calcula `lower(immutable_unaccent(regexp_replace(name, '[[:space:]-]', '', 'g')))`.
- Así, «GSX-R600», «gsx r600» y «GSXR 600» dan `gsxr600`.
- La app usa la misma regla en `catalogKey()` para filtrar sugerencias. Una prueba unitaria y
  una pgTAP comparan los mismos casos.

**Tabla `public.vehicle_brands`**

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `vehicle_type` | `vehicle_type not null` | |
| `name` | `text not null` | 1–60 caracteres, sin espacios al principio ni al final |
| `name_key` | `text` | **generada**: `private.catalog_key(name)` |
| `created_at` | `timestamptz not null` | `default now()` |

Además:

- `unique (vehicle_type, name_key)`: RN-06;
- `unique (id, vehicle_type)`, para la FK compuesta desde `vehicles`.

**Tabla `public.vehicle_lines`**

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` PK | |
| `brand_id` | `uuid not null` | `references vehicle_brands(id)` |
| `name` | `text not null` | 1–60 caracteres |
| `name_key` | `text` | **generada**: `private.catalog_key(name)` |
| `created_at` | `timestamptz not null` | |

Además:

- `unique (brand_id, name_key)`;
- `unique (id, brand_id)`, para la FK compuesta.

**Tabla `public.vehicles`**

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` PK | |
| `customer_id` | `uuid not null` | `references customers(id)`, inmutable (RN-01) |
| `vehicle_type` | `vehicle_type not null` | |
| `vehicle_class` | `vehicle_class null` | `check`: carro → `automobile`/`utility`; bicicleta → `mountain`/`road`; moto → `null` (RN-10) |
| `brand_id` | `uuid not null` | FK compuesta `(brand_id, vehicle_type) → vehicle_brands(id, vehicle_type)`: la marca es del tipo del vehículo (RF-04) |
| `line_id` | `uuid null` | FK compuesta `(line_id, brand_id) → vehicle_lines(id, brand_id)`. Obligatoria salvo en bicicleta (suposición de la spec). |
| `displacement_cc` | `smallint null` | `check (between 50 and 2500)`; solo en moto (RN-09) |
| `color` | `vehicle_color not null` | |
| `plate` | `text null` | Guardada en mayúsculas y sin separadores. `check` por tipo: moto `^[A-Z]{3}[0-9]{2}[A-Z]?$`; carro `^[A-Z]{3}[0-9]{3}$`; bicicleta `null` (RN-02, RN-03). |
| `retired_at` | `timestamptz null` | Vigente si es `null` (RN-07). |
| `created_at`, `updated_at` | `timestamptz not null` | `set_updated_at` |

Además:

- índice único parcial `vehicles_plate_active_key on (plate) where retired_at is null and plate
  is not null` (RN-04);
- índice `(customer_id, created_at desc)`.

**Guarda `vehicles_guard`** (`before insert or update`, `security invoker`; errores con `hint`)
- **Normaliza**:
  - la placa: mayúsculas y sin espacios, guiones ni puntos;
  - y, para que no se guarde nada que no corresponda al tipo (CA-09), pone en `null`:
    - el cilindraje si no es moto;
    - la clase si es moto;
    - la placa si es bicicleta.
- **Valida**, con un `hint` legible por la app:
  - `vehicle_plate_invalid`;
  - `vehicle_class_required`;
  - `vehicle_line_required`.

  Los `check` quedan como respaldo.
- **Placa ocupada**: `private.vehicle_plate_taken(plate, id)` (`security definer`; mira los
  vehículos vigentes de **todos** los clientes) da `hint = 'vehicle_plate_taken'`. Si dos altas
  compiten, el índice único hace de respaldo y la app traduce también su error `23505`.
- **Inmutables**: `customer_id` y `created_at` (RN-01).
- **Retiro** (RN-07, CA-22):
  - `retired_at` solo pasa de `null` a `now()`;
  - un vehículo retirado ya no cambia (`hint = 'vehicle_retired'`).

**Función `public.save_vehicle(...)`** (`security invoker`, `returns uuid`)
- **Parámetros**: `p_vehicle_id uuid` (`null` para un vehículo nuevo), `p_customer_id`, `p_type`,
  `p_class`, `p_brand_name`, `p_line_name`, `p_displacement_cc`, `p_color` y `p_plate`.
- **Busca o crea la marca y la línea** con `private.ensure_vehicle_brand(type, name)` y
  `private.ensure_vehicle_line(brand_id, name)`:
  - son `security definer` y hacen `insert … on conflict (…, name_key) do nothing` seguido de un
    `select`;
  - el vehículo queda enlazado a la que ya existía, con su forma escrita (CA-13, CA-14).
- **Guarda el vehículo con la sesión del usuario**: `insert` o `update` sobre `vehicles`, sujeto a
  RLS y a la guarda.
- **Si el vehículo no se guarda, no queda nada**: la marca nueva tampoco, porque todo va en la
  misma transacción.
- Si la línea viene vacía, en bicicleta queda `null` y en moto o carro da
  `vehicle_line_required`.

**RLS**
- **`vehicle_brands` y `vehicle_lines`**:
  - `select` para `authenticated` (`using (true)`): el catálogo no es un dato personal;
  - sin `insert`, `update` ni `delete` desde la API: solo crece por `save_vehicle`;
  - `anon` no tiene nada.
- **`vehicles`**:
  - `select`: `is_staff()` o el vehículo es de la ficha propia
    (`customer_id = private.current_customer_id()`);
  - `insert` y `update`: la ficha existe, **no está desactivada** (suposición de la spec) y es
    visible para quien escribe. Se comprueba con
    `exists (select 1 from customers c where c.id = customer_id and c.disabled_at is null)`;
    con RLS en `customers`, el personal ve todas las fichas y el cliente solo la suya;
  - sin `delete` (RN-07).
- **Privilegios por columna**:
  - `insert (customer_id, vehicle_type, vehicle_class, brand_id, line_id, displacement_cc,
    color, plate)`;
  - `update (vehicle_type, vehicle_class, brand_id, line_id, displacement_cc, color, plate,
    retired_at)`.
- `private.current_customer_id()` (`security definer`, `stable`): el `id` de la ficha de
  `auth.uid()`.

**Búsqueda por placa en «Clientes»** (CA-17, CA-18)
- **Columna nueva** `customers.vehicle_plates text not null default ''`:
  - contiene las placas vigentes del cliente, separadas por espacio;
  - la mantiene un trigger `after insert or update` sobre `vehicles` (`security definer`);
  - al retirar un vehículo, su placa sale (CA-18).
- **`search_text`** se vuelve a crear (`drop` + `add` de la columna generada, junto con su índice
  GIN) para incluir `vehicle_plates`.
- **Lo que la API puede escribir no cambia**: `vehicle_plates` no está entre las columnas que la
  API puede insertar ni actualizar. La guarda de `customers` ya deja pasar los triggers
  `security definer` (no vienen de la API).

**Seeds** (`seeds/03_vehicles.sql`)
- **Camila** (`cliente@`): una Suzuki GSX-R600 de 600 cc, negra, `UIH-03D`; y una moto retirada
  `JWJ-07`, para ver «Vehículos retirados».
- **Valentina** (sin cuenta): una camioneta Mazda CX-30 gris, `KDM-482`.
- **Andrés**: una bicicleta GW de montaña, sin placa.
- **Daniel** (desactivado): una moto, para la suposición de solo lectura.

**pgTAP**
- `06_vehicles.test.sql`:
  - esquema, enums, RLS, políticas y privilegios;
  - cada regla de la guarda;
  - formatos de placa por tipo;
  - placa única entre vigentes y liberada al retirar;
  - inmutables y retiro sin vuelta atrás;
  - cliente propio contra ajeno;
  - cliente desactivado;
  - `save_vehicle`: crea o reutiliza marca y línea, y no deja la marca si el vehículo falla;
  - `vehicle_plates` y `search_text`.
- `07_vehicle_catalog.test.sql`:
  - `catalog_key` con los casos compartidos;
  - el catálogo precargado: cada tipo tiene marcas, y las marcas principales tienen líneas;
  - Suzuki en motocicleta → GSX-R600.

### Migración `<ts>_vehicle_catalog_data.sql`: catálogo inicial (RF-03)

Solo `insert` en `vehicle_brands` y `vehicle_lines`, con `on conflict do nothing` para que se
pueda repetir sin duplicar. Comentario `-- seeds: unchanged — catalog data lives in this
migration`.

**Fuentes**: rankings de matrículas de 2025, el de motos de ANDI y Fenalco y el de carros de
Andemos, publicados en prensa (El Carro Colombiano, Valora Analitik, Portafolio). Para
bicicletas, la oferta de las grandes superficies y de la prensa colombiana. Las líneas son las
que se venden hoy o circulan con frecuencia.

**Motocicleta.** 26 marcas. Las que llevan línea:

| Marca | Líneas |
|---|---|
| AKT | NKD 125, CR4 125, CR4 162, CR5 180, TT 125, TTR 200, TT DS 200, Dynamic Pro 125, Special 110, Flex 125, Jet 5R, RTX 150 |
| Bajaj | Boxer CT 100, Boxer S, Platino 100, Discover 125, Pulsar NS 125, Pulsar NS 160, Pulsar NS 200, Pulsar N160, Pulsar N250, Pulsar RS 200, Dominar 250, Dominar 400 |
| Honda | Wave 110, Dio 110, Navi 110, CB 125F, CB 160F, CB 190R, XR 150L, XR 190L, XRE 300, CB 300F, CB 300R, PCX 160, ADV 160, CB 650R, CBR 650R, NC 750X, Africa Twin |
| Yamaha | Crypton FI, BWS FI, YBR 125, XTZ 125, XTZ 150, XTZ 250, FZ 150, FZ 25, NMAX 155, XMAX 300, R15, R3, MT-03, MT-07, MT-09, R6, R1, Ténéré 700 |
| Suzuki | Viva R 115, Best 125, AX4, GN 125, DR 150, Gixxer 150, Gixxer 250, GSX-S150, GSX-R150, V-Strom 250, V-Strom 650, V-Strom 800DE, GSX-8S, GSX-S750, GSX-S1000, GSX-R600, GSX-R750, GSX-R1000, Hayabusa, Burgman Street 125 |
| TVS | Sport 100, Raider 125, NTORQ 125, Apache RTR 160 4V, Apache RTR 200 4V, Apache RR 310, Ronin 225 |
| Hero | Splendor Plus, Eco Deluxe, Ignitor 125, Hunk 160R, Xpulse 200, Xoom 110 |
| Victory | One, Bomber 125, Nitro 125, MRX 150, Combat 100 |
| KTM | Duke 200, Duke 250, Duke 390, Duke 790, Duke 890, RC 200, RC 390, 390 Adventure, 890 Adventure |
| Kawasaki | Ninja 400, Ninja 650, Ninja ZX-6R, Z400, Z650, Z900, Versys 650, KLR 650, Vulcan S |
| Royal Enfield | Hunter 350, Classic 350, Meteor 350, Bullet 350, Scram 411, Himalayan 450, Interceptor 650, Continental GT 650, Super Meteor 650 |
| BMW | G 310 R, G 310 GS, F 800 GS, F 900 R, F 900 GS, R 1250 GS, R 1300 GS, S 1000 RR |
| Ducati | Monster, Scrambler Icon, Panigale V2, Panigale V4, Multistrada V2, Multistrada V4, Diavel |
| Harley-Davidson | Iron 883, Sportster S, Nightster, Fat Boy, Street Glide, Pan America |
| Triumph | Speed 400, Scrambler 400 X, Trident 660, Street Triple, Tiger 900, Bonneville T120 |
| Benelli | TNT 135, 180S, 302S, Leoncino 500, TRK 502, Imperiale 400 |
| CFMoto | 300NK, 450NK, 650NK, 450SR, 450MT, 800MT |
| Voge | 300R, 300 Rally, 500DS, 525DSX |
| Kymco | Agility 125, Like 125, AK 550 |
| Vespa | Primavera 150, Sprint 150, GTS 300 |

Sin líneas: Husqvarna, Keeway, Piaggio, SYM, UM y Zontes.

**Carro.** 32 marcas. Las que llevan línea:

| Marca | Líneas |
|---|---|
| Kia | Picanto, Soluto, Rio, K3, Sonet, Seltos, Sportage, Sorento, Niro |
| Renault | Kwid, Logan, Sandero, Stepway, Kardian, Duster, Arkana, Koleos, Oroch |
| Toyota | Yaris, Corolla, Corolla Cross, RAV4, Fortuner, Hilux, Prado, Land Cruiser |
| Chevrolet | Spark, Joy, Onix, Sail, Tracker, Captiva, Equinox, Colorado |
| Mazda | Mazda 2, Mazda 3, CX-3, CX-30, CX-5, CX-50, CX-90, BT-50 |
| BYD | Seagull, Dolphin Mini, Dolphin, Yuan Plus, Song Plus, Seal, Shark, Tang |
| Suzuki | Swift, Dzire, Baleno, Fronx, Vitara, Grand Vitara, S-Cross, Jimny, Ertiga |
| Nissan | March, Versa, Sentra, Kicks, Qashqai, X-Trail, Frontier |
| Hyundai | Grand i10, Accent, Venue, Creta, Tucson, Santa Fe |
| Volkswagen | Gol, Polo, Virtus, Nivus, T-Cross, Tiguan, Amarok |
| Ford | Territory, Escape, Bronco Sport, Explorer, Ranger |
| Honda | City, Civic, HR-V, CR-V |
| Mitsubishi | ASX, Outlander, Montero Sport, L200 |

Sin líneas: Audi, BMW, Changan, Chery, Citroën, DFSK, Fiat, Foton, GWM, JAC, Jeep, Jetour,
Land Rover, Mercedes-Benz, MG, Peugeot, Porsche, Subaru y Volvo.

**Bicicleta.** 20 marcas. Las que llevan línea:

| Marca | Líneas |
|---|---|
| Specialized | Rockhopper, Epic, Stumpjumper, Allez, Tarmac, Roubaix |
| Trek | Marlin, Procaliber, Fuel EX, Domane, Émonda, Madone |
| Giant | Talon, Anthem, Defy, TCR |
| Scott | Scale, Spark, Speedster, Addict |

Sin líneas: GW, Optimus, Strongman, Venzo, Cannondale, Orbea, Merida, BMC, Pinarello, Cervélo,
Bianchi, Santa Cruz, Canyon, Polygon, BH y Fuji.

## Aplicación (`apps/web`)

### Módulo nuevo `vehicles`

```
modules/vehicles/
  api/vehicles.server.ts          # listCustomerVehicles(customerId) → { active, retired }
  api/vehicles.client.ts          # fetchBrands(type), fetchLines(brandId) con el cliente del navegador
  queries/vehicles.keys.ts        # vehicleKeys.brands(type), vehicleKeys.lines(brandId)
  queries/vehicles.queries.ts     # brandsQueryOptions / linesQueryOptions (staleTime largo)
  actions/vehicles.actions.ts     # saveVehicle(input), retireVehicle(id)
  schemas/vehicle.schema.ts       # vehicleFormSchema (objeto plano + superRefine por tipo)
  constants/vehicle-options.constants.ts # tipos, clases por tipo, rango de cilindraje, colores (orden de RN-05) y su muestra
  utils/plate.utils.ts            # normalizePlate, isValidPlate(type, plate), formatPlate
  utils/catalog-key.utils.ts      # catalogKey (igual que private.catalog_key), filterCatalog
  utils/vehicles-errors.utils.ts  # hint → clave de mensaje (placa ocupada según audiencia)
  components/
    atoms/color-swatch, plate-label
    molecules/catalog-autocomplete, color-select, vehicle-summary
    organisms/vehicles-section (con el modal del formulario), vehicle-form, retire-vehicle-modal
  messages/es.json
```

- **Lecturas de vehículos**: RSC con la sesión del usuario (RLS). El select incrusta
  `brand:vehicle_brands(name)` y `line:vehicle_lines(name)` y ordena por `created_at desc`
  (CA-04).
- **Catálogo**:
  - lo lee el navegador con TanStack Query (`queryOptions` + key factory, como pide `CLAUDE.md`);
  - todas las marcas de un tipo y todas las líneas de una marca, filtradas en memoria con
    `catalogKey`, así que las sugerencias son instantáneas (requisito de rendimiento);
  - una marca escrita que no está en el catálogo no carga líneas: la línea queda en texto libre.
- **Mutaciones**: Server Actions con la sesión del usuario.
  - `saveVehicle` autoriza con `getActiveStaff()` o con `getActiveCustomer()`; en el segundo
    caso usa siempre **la ficha propia** y nunca la que llegue en el input.
  - Después llama a `rpc('save_vehicle')`; RLS y la guarda deciden al final.
  - `retireVehicle` hace un `update` de `retired_at`.
  - Ambas hacen `revalidatePath` de la ficha, de `/customers` y de `/profile`.
- **Mensajes de error**: el `hint` se traduce a texto. `vehicle_plate_taken` da un mensaje
  distinto para el personal (CA-08) y para el cliente (CA-25).

### Formulario (`vehicle-form`, dentro del modal de `vehicles-section`)

- **Tecnología**: React Hook Form + Zod 4, con `vehicleFormSchema` como única fuente de los
  tipos.
- **Tipo**: un grupo de opciones (`RadioGroup` horizontal) con Motocicleta, Bicicleta y Carro;
  Motocicleta viene marcada (CA-02).
- **Campos que dependen del tipo**:
  - moto: cilindraje (`NumberInput`, opcional, sufijo «cc»);
  - carro: clase Automóvil o Camioneta;
  - bicicleta: clase Montaña o Ruta.

  La clase no viene preseleccionada. La placa no aparece en bicicleta (CA-06).
- **Al cambiar el tipo** se vacían marca, línea, clase, cilindraje y placa; **al cambiar la
  marca**, la línea (CA-09).
- **Marca y línea**: `Autocomplete` de HeroUI con `allowsCustomValue`, que sugiere mientras se
  escribe y acepta un nombre nuevo (CA-10 a CA-13). Se envían **nombres**, no ids.
- **Color**: `Select` de HeroUI con una muestra y el nombre en cada opción; «Multicolor» lleva
  una muestra de varios colores (CA-15).
  - Las muestras son datos del vehículo, no colores de la interfaz, así que no rompen la regla
    de «nada de colores llamativos».
  - El blanco y el beige llevan borde para que se vean.
- **Placa**: la entrada se muestra en mayúsculas. Al validar se aplica `isValidPlate(type, …)` y
  la vista previa se formatea con guion.

### Pantallas

- **Ficha** (`/customers/[id]`):
  - debajo de los datos, `VehiclesSection` con la lista, «Agregar vehículo», editar y retirar;
  - la lista plegable «Vehículos retirados» muestra la fecha de retiro (CA-01, CA-20 a CA-22,
    RF-06);
  - si el cliente está desactivado, la sección es de solo lectura.
- **«Mi perfil»** (`/profile`): `VehiclesSection` con la audiencia `customer`. Muestra «Mis
  vehículos», los textos en segunda persona y nunca los retirados (CA-23, CA-24).
- **Cada vehículo** (`vehicle-summary`) muestra:
  - un icono del tipo, decorativo;
  - «Marca Línea»;
  - la clase o el cilindraje;
  - el color, con nombre y muestra;
  - la placa formateada (CA-03, CA-16).

### Búsqueda por placa (módulo `customers`)

- **`normalizeSearch`**: si el término parece una placa (tres letras seguidas de un separador
  opcional y al menos un número), quita los espacios y guiones. Así «UIH-03» y «uih 03» buscan
  `uih03` (CA-17).
- **`listCustomers`**: selecciona también `vehicle_plates`.
- **`matchingPlate(plates, q)`**: devuelve la placa que coincide, y la tabla la muestra
  formateada bajo el nombre (CA-19).
- **Spec 004**: se anota en su CA-16 que también busca por placa (cambio declarado en la 005).

### Mensajes

- `vehicles` (namespace nuevo), con estas partes:
  - tipos, clases y colores;
  - etiquetas y errores del formulario;
  - los textos de vacío;
  - el retiro y su confirmación.
- Se registra en `src/i18n/messages.ts`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | componente + e2e | `vehicles-section.component.test.tsx` (vacío y lista), `e2e/vehicles.spec.ts` |
| CA-02 | componente | `vehicle-form.component.test.tsx` (Motocicleta marcada; campos según tipo) |
| CA-03 | unit + e2e | `plate.utils.test.ts` (`uih03d` → `UIH-03D`, `jwj 07` → `JWJ-07`), `e2e/vehicles.spec.ts` (moto con «600 cc») |
| CA-04 | e2e | `e2e/vehicles.spec.ts` (dos vehículos, el más reciente primero) |
| CA-05 | unit + pgTAP | `plate.utils.test.ts`, `vehicle.schema.test.ts`, `06_vehicles.test.sql` (moto con `ABC123` y carro con `ABC12D` rechazados; clase) |
| CA-06 | componente + pgTAP | `vehicle-form.component.test.tsx` (sin placa ni cilindraje en bicicleta), `06_vehicles.test.sql` (bicicleta sin placa ni línea) |
| CA-07 | unit + componente | `vehicle.schema.test.ts` (cada campo obligatorio y cilindraje de 49 y 2.501), `vehicle-form.component.test.tsx` (error junto al campo) |
| CA-08 | pgTAP + e2e | `06_vehicles.test.sql` (`uih-03d` contra `UIH03D` vigente → `vehicle_plate_taken`), `e2e/vehicles.spec.ts` (mensaje) |
| CA-09 | componente + pgTAP | `vehicle-form.component.test.tsx` (cambiar tipo o marca vacía los campos), `06_vehicles.test.sql` (la guarda pone en `null` el cilindraje de un carro y la clase de una moto) |
| CA-10 | e2e | `e2e/vehicle-catalog.spec.ts` («suz» → Suzuki, «gsx» → GSX-R600; Suzuki de carro sin líneas de moto) |
| CA-11 | pgTAP | `07_vehicle_catalog.test.sql` (marcas por tipo y líneas de las marcas principales) |
| CA-12 | unit + pgTAP | `catalog-key.utils.test.ts` y `07_vehicle_catalog.test.sql`, con la misma tabla de casos |
| CA-13 | pgTAP + e2e | `06_vehicles.test.sql` (`save_vehicle` crea la marca; no la deja si falla la placa), `e2e/vehicle-catalog.spec.ts` (la nueva aparece en el siguiente alta) |
| CA-14 | pgTAP | `06_vehicles.test.sql` («suzuki» → la marca «Suzuki» existente, sin crear otra) |
| CA-15 | componente | `color-select.component.test.tsx` (16 opciones en el orden de RN-05, con nombre y muestra) |
| CA-16 | componente + e2e | `vehicle-summary.component.test.tsx` (nombre visible junto a la muestra), auditoría axe |
| CA-17 | unit + pgTAP + e2e | `customers-filter.utils.test.ts` (normalización de placa), `06_vehicles.test.sql` (`search_text` con placas), `e2e/vehicles-search.spec.ts` |
| CA-18 | pgTAP + e2e | `06_vehicles.test.sql` (la placa retirada sale de `vehicle_plates`), `e2e/vehicles-search.spec.ts` |
| CA-19 | unit + e2e | `customers-filter.utils.test.ts` (`matchingPlate`), `e2e/vehicles-search.spec.ts` |
| CA-20 | pgTAP + e2e | `06_vehicles.test.sql`, `e2e/vehicles.spec.ts` (editar) |
| CA-21 | pgTAP + e2e | `06_vehicles.test.sql` (placa libre tras retirar), `e2e/vehicles.spec.ts` (retirar → «Vehículos retirados» → la placa se registra de nuevo) |
| CA-22 | pgTAP + componente | `06_vehicles.test.sql` (un retirado no cambia ni vuelve), `vehicles-section.component.test.tsx` (sin acciones en los retirados) |
| CA-23 | e2e | `e2e/my-vehicles.spec.ts` |
| CA-24 | e2e | `e2e/my-vehicles.spec.ts` (el cliente agrega y retira; el personal lo ve en la ficha) |
| CA-25 | unit + e2e | `vehicles-errors.utils.test.ts` (mensaje según audiencia), `e2e/my-vehicles.spec.ts` |
| CA-26 | pgTAP + sandbox + unit | `06_vehicles.test.sql` (RLS), `__test__/sandbox/vehicles-access.sandbox.test.ts` (peticiones directas con sesión de cliente: leer, crear, cambiar, retirar y mover vehículos ajenos), `vehicles.actions.test.ts` (la acción usa la ficha propia) |

Más:

- **Auditoría axe** (`e2e/a11y.spec.ts`): la ficha con vehículos, el formulario abierto y «Mi
  perfil» con vehículos.
- **Ancho de 360 px** (`e2e/ui.spec.ts`): las mismas pantallas.

## Archivos afectados

**Nuevos**
- `packages/supabase`:
  - migraciones `<ts>_vehicles.sql` y `<ts>_vehicle_catalog_data.sql`;
  - `seeds/03_vehicles.sql`;
  - pruebas `tests/06_vehicles.test.sql` y `tests/07_vehicle_catalog.test.sql`.
- `apps/web/src/modules/vehicles/**`.
- Pruebas:
  - `__test__/src/modules/vehicles/**`;
  - `__test__/sandbox/vehicles-access.sandbox.test.ts`;
  - `e2e/{vehicles,vehicle-catalog,vehicles-search,my-vehicles}.spec.ts`.

**Modificados**
- `types/database.types.ts`: regenerado.
- Páginas: `app/(app)/customers/[id]/page.tsx` y `app/(app)/profile/page.tsx`.
- Módulo `customers`:
  - `customers.server.ts` (selecciona `vehicle_plates`);
  - `customers-filter.utils.ts` (`normalizeSearch` con placas, `matchingPlate`);
  - `customers-table` (muestra la placa que coincidió);
  - `messages`.
- `src/i18n/messages.ts`.
- `e2e/support/sandbox.ts`: limpieza de vehículos y marcas de prueba.
- Pruebas existentes: `e2e/a11y.spec.ts` y `e2e/ui.spec.ts`.
- `CLAUDE.md` y `packages/supabase/CLAUDE.md`: vehículos de los seeds y catálogo por migración.
- Specs: `specs/004-registro-clientes/spec.md` (nota en CA-16 y HU-03).

**Eliminados**: ninguno.

## Dependencias nuevas

Ninguna. `Autocomplete`, `Select`, `RadioGroup` y `NumberInput` vienen en `@heroui/react` 2.8;
`unaccent` ya está instalada.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| **1.** Marca y línea se envían por **nombre** y `save_vehicle` las resuelve en una transacción | Crear la marca desde la app y luego el vehículo (dos llamadas). Dar `insert` sobre el catálogo a `authenticated`. | Atómico: si la placa falla, no queda una marca huérfana. El catálogo no se escribe directamente desde la API. La deduplicación (RN-06) vive en un único sitio. |
| **2.** El catálogo inicial va en una **migración** de datos | Ponerlo en un seed. | Los seeds solo corren en local; el catálogo tiene que existir en develop y en producción. |
| **3.** Placas copiadas en `customers.vehicle_plates` y en `search_text` | Una RPC `search_customers` con `join`. Dos consultas (ids por placa + `in`). | Reutiliza la paginación, el conteo, el índice trigram y las tarjetas de la 004 sin duplicar la lista. El coste es un trigger. |
| **4.** FK compuestas `(brand_id, vehicle_type)` y `(line_id, brand_id)` | Comprobarlo en la guarda. | La coherencia «marca del tipo, línea de la marca» queda garantizada por el esquema, sin código. |
| **5.** Catálogo completo por tipo, filtrado en el navegador | Búsqueda en el servidor con `ilike` a cada tecla. | Son decenas de marcas y como mucho una veintena de líneas por marca: una sola petición y respuesta instantánea. |
| **6.** Cliente desactivado: vehículos de solo lectura, comprobado en RLS | Solo ocultarlo en la UI. | La autorización vive en Postgres (constitución, VI). |
| **7.** La placa se guarda sin separadores y se formatea al mostrarla | Guardarla con guion. | Una sola forma canónica para el índice único y la búsqueda; el guion es presentación. |

**Riesgo**: el embebido de PostgREST con FK compuestas
(`vehicles → vehicle_brands` por `(brand_id, vehicle_type)`) se comprueba al empezar, en la
primera tarea de la app. Si da ambigüedad, se nombra la FK en el `select`
(`brand:vehicle_brands!vehicles_brand_fk(name)`).

## Despliegue

1. **Migraciones**, por `db-deploy` al entrar en `develop`: primero `vehicles` y después
   `vehicle_catalog_data`. No hay variables de entorno nuevas.
2. Sin cambios en la configuración de Auth.
3. Tras desplegar, comprobar en el entorno remoto que el catálogo trae marcas de los tres tipos:
   un `select count(*)` por tipo desde el panel de SQL, solo lectura.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación y aprobación por el usuario (al pedir `/desglosar 005`). |
| 2026-11-19 | Implementación. Ajustes respecto al plan: el formulario es `vehicle-form` y su modal vive en `vehicles-section`; las constantes están en `vehicle-options.constants.ts`. T008: el embebido de PostgREST con las FK compuestas funciona sin nombrarlas, así que el riesgo queda descartado. |
| 2026-11-19 | Durante las E2E aparecieron dos fallos de accesibilidad y uno de comportamiento. **Accesibilidad**: (1) dentro de un `Modal`, los desplegables de HeroUI se pintaban fuera de él y el modal los ocultaba (`aria-hidden`), así que ahora se pintan dentro del formulario (`portalContainer`); (2) el botón «×» del `Autocomplete` no tenía nombre accesible y se quitó (`isClearable={false}`); además se corrigió el contraste del «cc» y de la lista de retirados. **Comportamiento**: (3) la caché del catálogo se invalida al guardar, para que una marca nueva se sugiera enseguida (CA-13). |
| 2026-11-19 | Mutaciones (todas revertidas). Base de datos, en vivo y con `db:reset` después: sin la comprobación de placa ocupada fallan CA-08, CA-20, CA-25 y la marca que no debe quedar; con la política de alta abierta falla el alta en un cliente desactivado; con un retiro reversible falla CA-22 (×2); con las políticas de lectura y actualización abiertas falla la prueba sandbox de acceso (3 de 6). App: si el cliente se trata como personal fallan 5 pruebas de la sección; si los retirados se muestran al cliente falla CA-24; si `retireVehicle` acepta una fila invisible o no traduce el error fallan sus pruebas; si el cliente puede elegir la ficha falla CA-26; si la placa conserva sus separadores en la búsqueda fallan 4 pruebas de CA-17. Las demás pruebas se escribieron antes que el código y se vieron en rojo. |
