---
spec: "NNN"
actualizado: AAAA-MM-DD
---

# Tareas — NNN <Título>

Convenciones:
- `[P]` = se puede hacer en paralelo con otras `[P]` de la misma fase.
- Cada tarea indica qué cubre (`CA-xx`, `RF-xx`) y termina con algo verificable.
- Las pruebas se escriben antes (o se ven fallar con una mutación) — ver la Definición de terminado.

## Fase 1 — Base de datos

- [ ] T001 Migración … (RF-01)
- [ ] T002 [P] pgTAP … (CA-01)
- [ ] T003 Regenerar tipos (`pnpm db:types`)

## Fase 2 — Pruebas de la aplicación (rojo)

- [ ] T010 [P] Test de … (CA-01)

## Fase 3 — Implementación (verde)

- [ ] T020 …

## Fase 4 — E2E

- [ ] T030 Escenario Playwright … (CA-01, CA-02)

## Fase 5 — Definición de terminado

- [ ] T090 `pnpm lint` · `pnpm ts:check` · `pnpm test` · `pnpm build` · `pnpm test:e2e` en verde
- [ ] T091 `pnpm db:reset` + `pnpm db:test` + `types:check` en verde (si hubo migraciones)
- [ ] T092 Mutación aplicada a cada prueba nueva, fallo observado, revertida (`git diff` limpio)
- [ ] T093 Spec, plan y backlog actualizados
