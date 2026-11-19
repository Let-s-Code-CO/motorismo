# Especificaciones (SDD)

Esta carpeta es la fuente de verdad del comportamiento de la aplicación.

## Archivos base

| Archivo | Propósito |
|---|---|
| [constitution.md](constitution.md) | Principios no negociables del proyecto. |
| [product.md](product.md) | Contexto de negocio, roles y glosario. |
| [backlog.md](backlog.md) | Funcionalidades y deuda técnica pendientes de especificar. |
| [_templates/](_templates/) | Plantillas de `spec.md`, `plan.md` y `tasks.md`. |

## Estructura de una funcionalidad

```
specs/
  003-registro-clientes/
    spec.md    # qué y por qué (negocio, sin tecnología)
    plan.md    # cómo (arquitectura, datos, pruebas)
    tasks.md   # pasos ejecutables con checkboxes
```

- El número `NNN` es correlativo y nunca se reutiliza.
- El `slug` es corto, en minúsculas y con guiones.

## Ciclo de vida

```
borrador ──(usuario aprueba)──▶ aprobada ──/planificar──▶ planificada
   ──/desglosar──▶ lista ──/implementar──▶ en-progreso ──▶ implementada ──/verificar──▶ verificada
```

| Estado | Significado | Quién lo cambia |
|---|---|---|
| `borrador` | Spec en redacción o con aclaraciones abiertas. | `/especificar` |
| `aprobada` | El usuario validó el qué. Se puede planificar. | El usuario (o Claude cuando el usuario lo pide explícitamente) |
| `planificada` | `plan.md` aprobado. | `/planificar` tras aprobación |
| `lista` | `tasks.md` generado y aprobado. | `/desglosar` tras aprobación |
| `en-progreso` | Implementación en curso. | `/implementar` |
| `implementada` | Todas las tareas marcadas y el build pasa. | `/implementar` |
| `verificada` | Cada `CA-xx` comprobado. | `/verificar` |
| `descartada` | Ya no se hará. Se conserva como registro. | El usuario |

El estado vive en el frontmatter de `spec.md`. Para ver el estado de todas las specs:

```bash
grep -H "^estado:" specs/*/spec.md
```

## Comandos de Claude Code

| Comando | Qué hace |
|---|---|
| `/especificar <descripción>` | Crea una spec nueva en `borrador` y pregunta lo ambiguo. |
| `/planificar <NNN>` | Genera `plan.md` para una spec aprobada. |
| `/desglosar <NNN>` | Genera `tasks.md` a partir del plan. |
| `/implementar <NNN>` | Ejecuta las tareas en orden y las marca. |
| `/verificar <NNN>` | Revisa implementación vs. criterios de aceptación y detecta drift. |

## Cambios sobre funcionalidades existentes

- Si el cambio altera el comportamiento descrito en una spec `implementada`/`verificada`, se edita
  esa spec (añadiendo una entrada en su sección «Historial») y se vuelve a pasar por plan y tareas.
- Si es una funcionalidad nueva, se crea una spec nueva aunque toque el mismo código.
