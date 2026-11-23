---
spec: "015"
actualizado: 2026-11-23
---

# Tareas — 015 Reporte de servicios

Convenciones:

- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación); ver la Definición de terminado.
- Rutas: `sb/` = `packages/supabase/supabase/`, `w/` = `apps/web/`, `t/` = `apps/web/__test__/`.
- Rama `feature/015-reporte-servicios` desde `develop`.

## Fase 1 — Base de datos

- [x] T001 `sb/tests/14_service_report.test.sql` (rojo), con datos propios:
  - **Rango:** en hora de Colombia, con los dos extremos incluidos; una orden cerrada a las
    11:30 p. m. del último día entra y una de las 12:10 a. m. siguiente no (CA-02).
  - **Qué entra:** abiertas y anuladas fuera; la corregida con sus valores y empleados corregidos
    (CA-07).
  - **Columnas y orden:** las de una fila, de la más reciente a la más antigua (CA-01).
  - **Empleado:** solo los servicios en que participó, también si está desactivado (CA-03).
  - **Placa:** con guion y en minúsculas; entera, no parte de ella (CA-04).
  - **Combinación:** varios filtros a la vez (CA-05).
  - **Páginas:** `p_limit` y `p_offset`; sin límite, todas las filas (CA-11, CA-12).
  - **Totales:** servicios y suma; descuentos de las órdenes distintas y total sin empleado; nulos
    con empleado (CA-06, CA-11).
  - **Permisos:** el operador y el cliente reciben `report_admin_only`; `anon` no tiene privilegios
    (CA-09, CA-14, RN-04).
- [x] T002 Migración `<ts>_service_report.sql` (con `migration:new`): `private.report_lines`,
  `service_report`, `service_report_totals` y el índice → T001 en verde. `pnpm db:reset`,
  `pnpm db:test` y `pnpm db:types`.

## Fase 2 — Pruebas de la aplicación (rojo)

- [x] T010 [P] `t/src/modules/reports/schemas/reports.schema.test.ts`: por defecto el mes en curso
  hasta hoy; fechas inválidas o `from` después de `to` vuelven a lo de por defecto; la placa
  normalizada; la página por defecto es 1 (CA-02, CA-04).
- [x] T011 [P] `t/…/report-query.utils.test.ts`: la dirección del reporte, de cada página y de la
  descarga desde los mismos filtros; ida y vuelta sin perder nada (CA-05, CA-11, CA-12).
- [x] T012 [P] `t/…/services-workbook.lib.test.ts`:
  - columnas en el orden del reporte;
  - fecha como `Date` y valor como `Number`, con su formato;
  - los empleados en una celda;
  - totales al final, con y sin empleado;
  - el nombre del archivo por el periodo.
  (CA-12, CA-13)
- [x] T013 [P] `t/…/services-report-screen.component.test.tsx`:
  - cada campo de una fila, que enlaza a su orden (CA-01, CA-10);
  - los totales con descuentos, y sin ellos con filtro de empleado (CA-06);
  - el estado vacío con «Quitar filtros» (CA-08);
  - las páginas (CA-11);
  - «Exportar a Excel» con los filtros (CA-12).
- [x] T014 [P] `t/…/report-filters.component.test.tsx`: cambiar fecha o empleado va a la dirección;
  la placa espera 300 ms; la lista incluye empleados desactivados (CA-03, CA-05).
- [x] T015 [P] `t/src/app/reports/export.route.test.ts`: quien no es administrador recibe 403; el
  administrador recibe un `.xlsx` con `Content-Disposition` por el periodo (CA-12, CA-14).
- [x] T016 [P] Navegación: el administrador ve «Reportes» en el menú y en su inicio; el operador y
  el cliente no (`nav-links`, `mobile-nav`, `staff-home`) (RF-01, CA-09).

## Fase 3 — Implementación (verde)

- [x] T020 Dependencia `write-excel-file` en `w/package.json`; módulo `reports` con `schemas`,
  `utils` (`report-query`, `services-workbook`), `api/reports.server.ts`, `types` y
  `messages/es.json` (registrado en `src/i18n/messages.ts`) → T010, T011 y T012 en verde.
- [x] T021 `report-filters` y `services-report-screen` → T013 y T014 en verde.
- [x] T022 Rutas `/reports` (redirige), `/reports/services` (con `loading.tsx` y la guarda del
  administrador) y `/reports/services/export` → T015 en verde; `loading-coverage.test.ts` con la
  ruta nueva.
- [x] T023 `NAV_LINKS` con «Reportes» y sus textos en `auth.header` y `auth.home` → T016 en verde.

## Fase 4 — E2E

- [x] T030 `w/e2e/reports.spec.ts`:
  - el administrador abre «Reportes» y ve los servicios del mes; filtra por la placa de Camila
    (`uih-03d`) y ve solo los suyos; recargar conserva el filtro; una fila lleva a su orden
    (CA-01, CA-04, CA-05, CA-10);
  - «Exportar a Excel» descarga `servicios-…-a-….xlsx`, no vacío (CA-12);
  - el operador no ve «Reportes»; la dirección le dice «No tienes permiso» y la descarga le
    responde 403 (CA-09, CA-14).
- [x] T031 `w/e2e/a11y.spec.ts` (el reporte con filtros, en claro y oscuro) y `w/e2e/ui.spec.ts`
  (el reporte en el iPhone, sin desplazamiento lateral).

## Fase 5 — Definición de terminado

- [x] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm --filter web test:sandbox` ·
  `pnpm build` · `pnpm test:e2e`, también contra el build de producción construido sin cachés.
- [x] T091 `pnpm db:reset` · `pnpm db:test` · `pnpm --filter @motorismo/supabase types:check` en
  verde.
- [x] T092 Mutación aplicada a cada prueba nueva, fallo observado y revertida (`git diff` + grep).
- [x] T093 Revisión en el teléfono: capturas a 360 px y en iPhone de 440 px táctil, en claro y
  oscuro.
- [x] T094 `CLAUDE.md` (sección del reporte), spec, plan, tareas y backlog al día.

## Cobertura de criterios

| Criterio | Tareas |
|---|---|
| CA-01 | T001, T013, T030 |
| CA-02 | T001, T010 |
| CA-03 | T001, T014 |
| CA-04 | T001, T010, T030 |
| CA-05 | T001, T011, T014, T030 |
| CA-06 | T001, T013 |
| CA-07 | T001 |
| CA-08 | T013 |
| CA-09 | T001, T016, T030 |
| CA-10 | T013, T030 |
| CA-11 | T001, T011, T013 |
| CA-12 | T001, T011, T012, T013, T015, T030 |
| CA-13 | T012 |
| CA-14 | T001, T015, T030 |

## Mutaciones aplicadas (T092)

Cada una se aplicó, se vio fallar la prueba indicada y se revirtió; `git diff` y `grep` confirman
que no quedó ninguna, y la base local tiene la función original.

| Código mutado | Prueba que falló |
|---|---|
| Rango por día UTC en vez de Colombia | pgTAP 1, 4, 6, 9, 10, 11 |
| Anuladas incluidas | pgTAP 1, 6, 9–12 |
| Descuentos también con empleado | pgTAP 12 |
| Sin la guarda del administrador | pgTAP 15, 16 |
| Placa parcial (`like … %`) | pgTAP 7 |
| Filtro de empleado ignorado | pgTAP 4, 5, 8, 12 |
| `offset` ignorado | pgTAP 9 |
| Descuento sumado por línea (no por orden) | pgTAP 11, 13 |
| Orden ascendente | pgTAP 1, 4, 6, 9 |
| Participación en 0 | pgTAP 2 |
| `execute` para `anon` | pgTAP 17 |
| `p_limit` por defecto 2 | pgTAP 1, 10 |
| Esquema: `from` > `to` aceptado; placa sin normalizar; el mes desde el día 2 | `reports.schema` (1, 2 y 6 fallos) |
| La descarga con página; el periodo omitido el día 1 | `report-query.utils` (2 y 4) |
| Fecha como texto; día UTC; descuentos siempre; la cuenta como pesos; otro nombre de archivo | `services-workbook.lib` (3, 1, 1, 1, 1) |
| Pantalla: descuentos con empleado; exportar con la página; la fila sin su orden; «Quitar filtros» siempre; páginas de 20; «Siguiente» sin filtros | `services-report-screen` (1, 1, 1, 1, 2, 1) |
| Filtros: placa sin espera; la página se conserva; «Hasta» no se mueve; desactivado sin decirlo; la dirección nueva ignorada; desactivados mezclados con los activos; el campo sin «(desactivado)» | `report-filters` (1, 5, 1, 1, 1, 3, 1) |
| Descarga sin guarda del administrador; caché compartida | `export.route` (1, 1) |
| El operador ve «Reportes» | `nav-links`, `mobile-nav`, `staff-home` (3) |
| Esqueleto `form` en vez de `list` | `loading-coverage` (1) |
| `Select` sin `id` fijo | E2E «no hydration error» (error de hidratación en consola) |
