---
name: desglosar
description: Convierte el plan aprobado de una spec SDD en tareas pequeñas, ordenadas y verificables (tasks.md). Úsala cuando el usuario pida las tareas o el desglose de una spec.
argument-hint: <NNN>
---

# /desglosar — tareas de una spec

Spec: $ARGUMENTS

## Precondiciones

- `plan.md` de la spec existe y está `aprobado`. Si no, detente.

## Pasos

1. Lee `spec.md` y `plan.md` de la spec.
2. Copia `specs/_templates/tasks.md` a `specs/NNN-slug/tasks.md` y genera las tareas:
   - Orden: base de datos → pruebas en rojo → implementación → E2E → Definición de terminado.
   - Cada tarea es pequeña (≤ ~1 hora), nombra los archivos que toca y termina en algo
     verificable.
   - Cada tarea indica los `CA-xx` / `RF-xx` que cubre. Todo `CA-xx` debe aparecer al menos
     en una tarea de prueba; si alguno queda huérfano, añade la tarea.
   - Marca con `[P]` las que pueden hacerse en paralelo.
3. Presenta el resumen (número de tareas por fase, cobertura de criterios) y pide aprobación.
4. Al aprobarse: `estado: lista` en la spec. Siguiente paso: `/implementar NNN`.
