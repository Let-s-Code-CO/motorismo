# CLAUDE.md — @motorismo/supabase

Esquema Postgres de la app (migraciones de Supabase), seeds, pruebas pgTAP y los tipos `Database`
que compila `apps/web`.
Lee esto antes de crear o editar cualquier cosa en `supabase/`.

## Regla: ninguna migración sin pasar por el sandbox

Cada migración llega en el mismo PR con:

1. **Prueba pgTAP** en `supabase/tests/<NN>_<nombre>.test.sql` que asserta lo que la migración
   garantiza (columnas y tipos, constraints, defaults, **RLS activado y políticas**, privilegios),
   no solo «que aplicó». Una migración que cambia permisos o RLS lleva su aserción de privilegios
   (`policies_are`, `table_privs_are`, …): un entorno nuevo nunca puede quedar más abierto que
   producción.
2. **Seeds** en `supabase/seeds/` actualizados si toca una tabla que los seeds pueblan, o una
   línea `-- seeds: unchanged — <motivo>` en la migración.
3. **Versión posterior** a todas las de `origin/develop`: `supabase db push` rechaza versiones
   anteriores a una ya aplicada. Créala con `pnpm --filter @motorismo/supabase migration:new <nombre>`.
4. **`pnpm db:reset` + `pnpm db:test` en verde** (la cadena completa se reaplica desde cero) y
   **`pnpm db:types` ejecutado y versionado** (la CI falla si los tipos están desactualizados).
5. Si transforma datos existentes (`UPDATE`, `DELETE`, `ALTER … TYPE … USING`), una prueba que
   cargue filas «sucias» representativas antes de aplicarla y compruebe el resultado.

Una migración ya aplicada en un entorno remoto **no se edita**: cualquier cambio va en una nueva.

## Comandos (desde la raíz del repo)

```bash
pnpm db:start                                         # sandbox Docker (API 54321, DB 54322, Studio 54323)
pnpm db:reset                                         # reaplica migraciones + seeds desde cero
pnpm db:test                                          # pgTAP de supabase/tests
pnpm db:types                                         # regenera types/database.types.ts
pnpm --filter @motorismo/supabase types:check         # falla si los tipos están desactualizados (CI)
pnpm --filter @motorismo/supabase migration:new <nombre> < /dev/null   # sin stdin interactivo lee el SQL de stdin
pnpm --filter @motorismo/supabase db:diff             # SQL de cambios hechos a mano en el sandbox
pnpm --filter @motorismo/supabase sandbox:status      # URLs y claves locales
pnpm db:stop
```

- El CLI está **fijado** (`supabase` como devDependency, versión exacta) y siempre se invoca con
  estos scripts. Un `supabase` global es otra versión con otras imágenes: no lo uses aquí.
- **Nunca ejecutes `supabase link`** en este directorio: escribe `supabase/.temp/*` que cambian
  en silencio las imágenes del sandbox y el generador de tipos. Para el proyecto remoto se usa
  `SUPABASE_DB_URL` (ver `scripts/db-push.sh` y el workflow `db-deploy`).
- Docker Desktop debe estar corriendo; la primera vez descarga varios GB de imágenes.
- `sandbox:start` excluye los servicios que la app no usa, pero **no Realtime**: las pantallas del
  personal se actualizan solas con él (spec 012, HU-06). Las tablas que escuchan se publican en
  `supabase_realtime` desde una migración.

## Auth local (`config.toml`)

- `[auth] enable_signup = true` (spec 004): los **clientes** se registran solos;
  `[auth.email] enable_confirmations = true`: confirman el correo antes de entrar. **No** pongas
  `[auth.email] enable_signup = false`: en local desactiva el proveedor de correo entero.
- **El personal solo nace de `public.staff_invitations`** (la crea un admin con RLS, o
  `admin:bootstrap`): `handle_new_auth_user()` nunca lee el rol de `raw_user_meta_data`, porque
  con registro público lo escribe cualquiera. Todo alta sin invitación es un cliente.
- `otp_expiry = 86400` (enlaces de 24 h), contraseña mínima de 8, plantillas en español
  (invitación, recuperación y confirmación de registro) en `supabase/templates/`. En local
  `email_sent = 1000` para las pruebas; `max_frequency = 1s` obliga a esperar entre correos a la
  misma dirección. Los cambios de `config.toml` requieren `pnpm db:stop && pnpm db:start`.
- El proyecto remoto **no** lee este archivo: replica estos ajustes en el panel de Supabase.
- Al verificar un enlace de invitación, Auth escribe una contraseña aleatoria en
  `auth.users.encrypted_password`: no uses ese campo para deducir que el usuario eligió contraseña.

## Seeds y primer administrador

- `seeds/01_users.sql`: crea primero las invitaciones del personal y luego `sebastian.pulido@` y
  `carlos.diaz@` (admins), `operador@` y `desactivado@motorismo.test`.
- `seeds/02_customers.sql`: `cliente@` (cuenta de prueba de cliente), `cliente.google@` (con
  foto), `cliente.desactivado@` y dos clientes sin cuenta del punto de atención.
- `seeds/03_vehicles.sql`: vehículos de esos clientes (spec 005), guardados con `save_vehicle`.
- `seeds/04_catalogs.sql`: servicios y empleados de ejemplo (spec 007), solo locales: los reales
  los carga el administrador. Los empleados llevan salario base, se registran hace 90 días y Diego
  se desactiva hace 20 (spec 016): sus periodos activos los llena el *trigger*. Las pruebas pgTAP de catálogos vacían esas tablas en su transacción.
- `seeds/05_work_orders.sql`: órdenes de ejemplo (spec 008), creadas con las mismas funciones que la
  app, como el primer admin. Las pruebas pgTAP de catálogos y órdenes vacían primero las órdenes.
- `seeds/06_reservations.sql`: agenda de ejemplo (spec 012), con fechas relativas a hoy: esta semana
  y la siguiente habilitadas, reservas para mañana y, en la franja de la hora del reset (dentro del
  horario: después de cerrar, la última), una orden que llegó con reserva (Gabriel, con una moto que
  registra el seed) y una reserva por llegar. Las
  pruebas pgTAP de catálogos, órdenes y reservas vacían primero las reservas (apuntan a servicios y
  órdenes).
- `seeds/07_data_requests.sql`: solicitudes de datos de ejemplo (spec 017): una corrección «Recibida» de
  Camila desde la app y una consulta vencida de Valentina en el punto de atención.
- `seeds/08_vehicle_catalog.sql`: entradas «Añadidas» del catálogo para revisar (spec 018): la marca
  «Yamaja» (Motocicleta) con «Fz 2.0», para unir con Yamaha, y la línea «Fz 2.0» bajo Honda, para
  pasar a Yamaha. Sin vehículos, para no cambiar los de los clientes de los seeds.
- **Datos que necesita todo entorno** (p. ej. el catálogo de marcas y líneas de vehículos, o los
  municipios DANE de `municipalities_data`) van en
  una **migración** de datos repetible (`on conflict do nothing`), nunca en un seed: los seeds solo
  corren en local.
- Contraseña de todos: `motorismo-local`. Las pruebas pgTAP no dependen de los seeds.
- Fixtures de pruebas: para crear personal, inserta antes su fila en `staff_invitations`.
- `pnpm --filter @motorismo/supabase admin:bootstrap -- --email … --name …` invita al primer
  admin de un entorno (necesita `SUPABASE_URL` y `SUPABASE_SECRET_KEY`); se niega si ya hay uno.

## Tipos generados

`types/database.types.ts` se genera desde el sandbox —es decir, exactamente desde estas
migraciones— y es la única descripción del esquema contra la que compila la app:

```ts
import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@motorismo/supabase/types';
```

- Todo cliente es `createClient<Database>(…)` / `createServerClient<Database>(…)`.
- No añadas genéricos de resultado explícitos (`.single<Row>()`, `.returns<Row[]>()`): ocultan
  el drift entre código y esquema.
- Las filas que modeles derivan de la tabla: `type Customer = Tables<'customers'>`.

## Estructura

| Ruta | Qué | Lo ejecuta |
|------|-----|------------|
| `supabase/config.toml` | Configuración del sandbox (puertos, auth local) | `db:start` |
| `supabase/migrations/` | La cadena de migraciones, en orden de versión | `db:start`, `db:reset`, `db:push` |
| `supabase/seeds/*.sql` | Datos de ejemplo, aplicados tras cada reset (orden léxico) | `db:reset` |
| `supabase/tests/*.test.sql` | pgTAP | `db:test` |
| `types/` | Tipos generados + punto de entrada `@motorismo/supabase/types` | `db:types` |
| `scripts/` | `types-gen.sh`, `db-push.sh` | los scripts de arriba |

## Entornos remotos

| Entorno | Proyecto Supabase | Cómo recibe migraciones |
|---------|-------------------|-------------------------|
| develop | por crear | workflow `db-deploy` al hacer merge en `develop` (secret `SUPABASE_DB_URL`) |
| producción | por definir | por definir (ver backlog) |
