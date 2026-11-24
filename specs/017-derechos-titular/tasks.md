---
spec: "017"
actualizado: 2026-11-24
---

# Tareas — 017 Derechos del titular de datos

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `sb/` = `packages/supabase/supabase/`, `w/` = `apps/web/`, `t/` = `apps/web/__test__/`,
  `d/` = `w/src/modules/data-rights/`.
- Rama `feature/017-derechos-titular` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 `sb/tests/16_data_rights.test.sql`, primera parte (rojo): días hábiles y solicitudes.
  - **Festivos:** la lista completa de 2026 (18 días) y un año con Pascua en marzo (RN-03).
  - **Días hábiles:** `add_business_days` cruzando un fin de semana y un festivo.
  - **Solicitudes:**
    - `request_data_change`: corrección con descripción obligatoria y supresión con motivo
      opcional, canal `app`, plazo de 15 días hábiles (CA-04, CA-05);
    - una abierta por tipo: `data_request_open` (CA-06);
    - retirar (CA-08);
    - `register_data_request`: consulta a 10 días y reclamo a 15 (CA-16);
    - `resolve_data_request` y `reject_data_request`, con respuesta o motivo obligatorios (CA-11,
      CA-14);
    - una sola vez a un estado final, con quién y cuándo (CA-19).
  - **Vista:** `data_request_summaries` con días hábiles restantes y vencidas (CA-09).
- [x] T002 `16_data_rights.test.sql`, segunda parte (rojo): datos y supresión.
  - **`my_data` / `customer_data`:** perfil, autorización, vehículos (también retirados), órdenes
    (también anuladas), reservas, solicitudes; sin empleados, personal ni notas de órdenes; solo lo
    suyo (CA-01, CA-03, CA-17).
  - **`erase_customer_data`:**
    - con orden abierta → `data_erasure_open_order` (CA-13, RN-07);
    - ejecutada → «Cliente suprimido», sin contacto ni foto, desactivado y `erased_at`;
    - cuenta borrada de `auth.users`;
    - vehículos retirados y sin placa (también los ya retirados);
    - notas vacías y reservas pendientes canceladas;
    - órdenes cerradas intactas y el total de `service_report` igual;
    - solicitudes del cliente sin descripción ni respuesta, y la de supresión «Datos suprimidos»
      (CA-12, CA-20, RN-05, RN-06).
- [x] T003 `16_data_rights.test.sql`, tercera parte (rojo): permisos.
  - El operador no lee solicitudes ni datos (`data_request_admin_only`).
  - El cliente solo ve y retira las suyas.
  - `anon` sin funciones y sin escritura directa en la tabla.
  - RLS activado (CA-15, RN-01).
- [x] T004 Migración `<ts>_data_rights.sql` (con `migration:new`):
  - días hábiles;
  - enums y `data_requests` (RLS, índice parcial) y la vista;
  - `customers.erased_at`;
  - la excepción de `vehicles_guard`;
  - las funciones.

  → T001 a T003 en verde.
- [x] T005 Seeds `sb/seeds/07_data_requests.sql` (Camila, corrección recibida; Valentina,
  consulta vencida); `pnpm db:reset`, `pnpm db:test` y `pnpm db:types`; mutaciones de la
  migración.
- [x] T006 Sandbox `t/sandbox/data-rights.sandbox.test.ts` (rojo y luego verde): por la API real,
  un cliente suprimido por el administrador ya no puede entrar y su correo se puede registrar de
  nuevo (CA-12, RN-05).

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/…/data-rights/schemas/data-rights.schema.test.ts`: descripción (obligatoria, hasta
  1000), motivo opcional de supresión, respuesta y motivo de rechazo obligatorios, correo
  normalizado (CA-04, CA-05, CA-11, CA-14).
- [x] T011 [P] `t/…/data-rights/actions/data-rights.actions.test.ts`:
  - el cliente pide y retira con `getActiveCustomer()`;
  - el administrador registra, atiende, rechaza y suprime con `getActiveAdmin()`;
  - los *hints* se traducen;
  - `correctCustomerEmail`: la API de administración y `customers.email`; una cuenta de Google
    responde `googleEmail` (RN-08).

  (CA-04 a CA-08, CA-11 a CA-16)
- [x] T012 [P] `t/…/data-rights/components/my-data-screen.component.test.tsx`:
  - cada sección de CA-01;
  - «Descargar mis datos» (CA-02);
  - diálogo de corrección con descripción obligatoria (CA-04);
  - diálogo de supresión con la explicación y botón destructivo (CA-05);
  - el tipo abierto deshabilitado con su mensaje (CA-06);
  - estados, respuesta y «Retirar» (CA-07, CA-08).
- [x] T013 [P] `t/…/data-rights/components/data-requests-screen.component.test.tsx`: pendientes
  primero por fecha límite, días hábiles restantes, vencidas marcadas, cerradas aparte, canal
  (CA-09).
- [x] T014 [P] `t/…/data-rights/components/data-request-detail.component.test.tsx`:
  - corrección: enlace a la ficha, «Cambiar correo» solo para una cuenta con contraseña,
    «Marcar atendida» con respuesta (CA-11, RN-08);
  - «Rechazar» con motivo (CA-14);
  - supresión: «Suprimir datos» confirmado, o la orden abierta que lo impide (CA-12, CA-13);
  - una cerrada, solo lectura (CA-19).
- [x] T015 [P] `t/…/data-rights/components/register-data-request-dialog.component.test.tsx`: tipo,
  canal y descripción obligatorios; el plazo que tendrá (CA-16).
- [x] T016 [P] `t/src/app/data-rights/*.route.test.ts`:
  - `/my/data/export`: solo el cliente, su archivo `mis-datos-AAAA-MM-DD.json` (CA-02);
  - `/customers/[id]/data/export`: solo el administrador; 403 a los demás (CA-15, CA-17).
- [x] T017 [P] Navegación e inicio:
  - el administrador ve «Solicitudes de datos» en el menú, y su mosaico con «N pendientes · M
    vencidas» o «Sin solicitudes pendientes»;
  - el operador y el cliente no la ven;
  - «Mi perfil» enlaza a «Mis datos».

  (CA-10, CA-15, RF-01)

## Fase 3 — Implementación (verde)

- [x] T030 `d/`: tipos, esquemas, mensajes (`dataRights`, registrados en `src/i18n/messages.ts`) y
  `api/data-rights.server.ts` → T010 en verde.
- [x] T031 `d/actions/data-rights.actions.ts` (con el cliente admin solo en `correctCustomerEmail`)
  → T011 en verde.
- [x] T032 Componentes `my-data-screen` y sus diálogos → T012 en verde.
- [x] T033 Componentes `data-requests-screen`, `data-request-detail` y
  `register-data-request-dialog` → T013 a T015 en verde.
- [x] T034 Rutas, cada pantalla con su `loading.tsx`:
  - `/my/data` y `/my/data/export`;
  - `/admin/data-requests` y `[id]`;
  - `/customers/[id]/data/export`.

  Además, el enlace en «Mi perfil» y el diálogo en la ficha del cliente.
  `loading-coverage.test.ts` incluye las rutas nuevas → T016 en verde.
- [x] T035 `NAV_LINKS` (`dataRequests`), textos de `auth.header` y `auth.home`, resumen en
  `staff-home` y la página de inicio → T017 en verde.
- [x] T036 Política de privacidad (numeral 6): las solicitudes también desde «Mis datos».

## Fase 4 — E2E

- [x] T040 `w/e2e/data-rights.spec.ts`:
  - **cliente** (uno propio, creado por la prueba):
    - abre «Mis datos» desde «Mi perfil» y ve su perfil y su vehículo;
    - descarga el JSON (CA-01, CA-02);
    - pide una corrección y la ve «Recibida» con su fecha límite (CA-04, CA-07);
    - pide la supresión (CA-05);
  - **administrador:**
    - ve ambas en «Solicitudes de datos» y el conteo del inicio (CA-09, CA-10);
    - atiende la corrección con respuesta, y el cliente la ve «Atendida» (CA-11);
    - suprime: el cliente sale en su siguiente acción y la ficha dice «Cliente suprimido» (CA-12);
    - registra una consulta de un cliente sin cuenta y descarga sus datos (CA-16, CA-17);
  - **operador:** no ve la sección, recibe «No tienes permiso» y la descarga le responde 403
    (CA-15).
- [x] T041 `w/e2e/a11y.spec.ts` («Mis datos» con el diálogo de supresión, la lista y el detalle, en
  claro y oscuro) y `w/e2e/ui.spec.ts` («Mis datos» y las solicitudes en el iPhone, sin
  desplazamiento lateral).

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
  `pnpm build` · `pnpm test:e2e`, también contra el build de producción construido sin cachés.
- [x] T091 `pnpm db:reset` · `pnpm db:test` · `pnpm --filter @motorismo/supabase types:check` en
  verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado y revertida (`git diff` + grep);
  tabla de mutaciones en este archivo.
- [x] T093 Revisión en el teléfono: capturas a 360 px y en iPhone de 440 px táctil, en claro y
  oscuro.
- [x] T094 `CLAUDE.md` (sección de los derechos del titular), spec, plan, tareas y backlog al día.

## Cobertura de criterios

| Criterio | Tareas |
|---|---|
| CA-01 | T002, T012, T040 |
| CA-02 | T012, T016, T040 |
| CA-03 | T002 |
| CA-04 | T001, T010, T011, T012, T040 |
| CA-05 | T001, T010, T011, T012, T040 |
| CA-06 | T001, T012 |
| CA-07 | T012, T040 |
| CA-08 | T001, T011, T012 |
| CA-09 | T001, T013, T040 |
| CA-10 | T017, T040 |
| CA-11 | T001, T010, T011, T014, T040 |
| CA-12 | T002, T006, T014, T040 |
| CA-13 | T002, T014 |
| CA-14 | T001, T010, T011, T014 |
| CA-15 | T003, T011, T016, T017, T040 |
| CA-16 | T001, T011, T015, T040 |
| CA-17 | T002, T016, T040 |
| CA-18 | T011, T014, T040 |
| CA-19 | T001, T014 |
| CA-20 | T002 |

## Mutaciones aplicadas (T092)

Cada una se aplicó, se vio fallar la prueba indicada y se revirtió; `git diff` y `grep` confirman
que no quedó ninguna, y la base local tiene las funciones originales.

| Código mutado | Prueba que falló |
|---|---|
| Festivos sin trasladar al lunes; sin Jueves Santo | pgTAP 1 y 2 |
| Fines de semana como hábiles; contar desde el mismo día; consulta a 15 días | pgTAP 3, 4, 6, 8, 11, 19 |
| Varias abiertas por tipo; corrección sin descripción | pgTAP 7; pgTAP 5 |
| Una cerrada se puede atender; una supresión se atiende con respuesta | pgTAP 15; pgTAP 17 |
| Suprimir con orden abierta | pgTAP 27 |
| La cuenta, las placas, las notas, las reservas o el texto de las solicitudes se conservan | pgTAP 31, 32, 34, 33, 36; sandbox (la cuenta sigue entrando) |
| `my_data` con notas de órdenes, o de otro cliente; total sin descuento | pgTAP 23, 24, 22 |
| Sin la guarda del administrador; retirar la de otro | pgTAP 26 y 39; pgTAP 41 |
| Esquemas: descripción vacía, motivo vacío como texto, correo sin minúsculas, canal «app», consulta a 15 días | `data-rights.schema` (4, 2, 1, 1, 1) |
| Acciones: sin guarda del cliente; motivo vacío enviado; correo de Google cambiado; «correo en uso» como genérico; ficha sin refrescar; «ya abierta» como genérico | `data-rights.actions` (1 cada una) |
| «Mis datos»: sin «Retirado»; «Retirar» siempre; tipo abierto ignorado; sin la explicación de la supresión; corrección sin validar | `my-data-screen` (1 cada una) |
| Lista: sin ordenar; sin «Vencida» | `data-requests-screen` (2 y 1) |
| Detalle: correo de Google ofrecido; atender sin respuesta; suprimir sin preguntar; orden abierta ignorada; una cerrada editable | `data-request-detail` (1 cada una) |
| Registro: plazo fijo de 15 días | `register-data-request-dialog` (1) |
| Descargas: sin guarda del cliente o del administrador; JSON sin sangría | `export.route` (1 cada una) |
| Inicio: sin «vencidas»; sin el conteo | `staff-home` (1 y 3) |
| El operador ve «Habeas data» | navegación (3) |
| Esqueleto `list` en el detalle | `loading-coverage` (1) |
| «Mi perfil» sin el enlace; la ficha sin «Registrar solicitud de datos» | E2E `data-rights` (las dos pruebas que los usan) |

### Verificación (`/verificar 017`)

Correcciones aprobadas por el usuario y lo que se arregló al revisar la app en el navegador. Cada
prueba nueva se vio fallar con su mutación y se revirtió:

| Mutación | Prueba que falla |
|---|---|
| `customers_guard` sin la guarda de cliente suprimido | pgTAP `16_data_rights` (37 y 38: editar y reactivar a Camilo) |
| Sin `updateUserById` al corregir el correo | sandbox `data-rights` (CA-11: el correo viejo sigue entrando) |
| La ficha ofrece «Editar datos» a un suprimido | `customer-contact-card` (1) |
| La lista ofrece acciones a un suprimido | `customers-table` (1) |
| Secciones del admin en línea (sin `group: 'admin'`) | `nav-links` (3) |
| «Administración» no navega al elegir | `nav-links` (1) |
| «Administración» sin marcar en `/admin/users` | `nav-links` (1) |
| Fila del reporte sin el enlace estirado | E2E `ui` «whatever lights up…» (40 celdas sin mano) |
| El brillo de la marca vuelve a ser infinito | E2E `ui` «nothing moves forever» (`shine ends at Infinity ms`) |
| El recuadro del correo con `cursor-default` | E2E `ui` «a text field shows the text cursor…» |
