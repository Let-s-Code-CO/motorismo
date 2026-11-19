---
name: implementar
description: Ejecuta las tareas (tasks.md) de una spec SDD lista, en orden, marcándolas al completarlas y cumpliendo la Definición de terminado. Úsala cuando el usuario pida implementar una spec.
argument-hint: <NNN> [Txxx para empezar o limitarse a una tarea]
---

# /implementar — ejecutar las tareas de una spec

Entrada: $ARGUMENTS

## Precondiciones

- La spec está en `lista` o `en-progreso` y tiene `tasks.md`.
- Estás en una rama `feature/NNN-slug` que sale de `develop`. Si estás en `develop`, crea la
  rama antes de tocar código.

## Reglas

- Sigue las tareas en orden, respetando dependencias; marca `[x]` cada una al terminarla.
- Las pruebas siguen «Los tests son documentación» (`CLAUDE.md`): cabecera que explica la
  unidad y sus reglas de negocio, `it` que describen comportamiento, fixtures con builders.
- Cada prueba nueva debe haberse visto **fallar**: escríbela antes del código o aplica una
  mutación al código, observa el fallo, revierte y confirma verde. Anota la mutación aplicada.
- Si una tarea revela que la spec o el plan están mal o incompletos, **detente** y propón el
  cambio; no improvises comportamiento.
- Migraciones: siguen `packages/supabase/CLAUDE.md` (pgTAP, seeds, `db:reset`, tipos).
- Textos visibles solo vía `messages/es.json`.
- No hagas commits salvo que el usuario lo pida. Si los pide: Conventional Commits en inglés,
  con el ID de la spec como scope o en el cuerpo (p. ej. `feat(web): add customer search (003)`).

## Pasos

1. Lee `spec.md`, `plan.md` y `tasks.md`. Pon la spec en `en-progreso`.
2. Ejecuta las tareas una a una.
3. Al terminar, ejecuta la Definición de terminado completa y reporta la salida real:
   `pnpm lint`, `pnpm ts:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e` y, si hubo
   migraciones, `pnpm db:reset`, `pnpm db:test`, `pnpm --filter @motorismo/supabase types:check`.
4. Comprueba que no quedan mutaciones (`git diff` + grep del marcador usado).
5. Pon la spec en `implementada` y sugiere `/verificar NNN`.
