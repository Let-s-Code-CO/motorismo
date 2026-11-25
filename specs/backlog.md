# Backlog

Candidatos a especificar. Cuando uno se convierte en spec, se mueve a la tabla «Especificadas»
con su ID. El orden sugerido tiene en cuenta dependencias.

## Pendientes de especificar

### Operación

1. **Confirmación por WhatsApp** (deseable), también como recordatorio de reservas (spec 012).

## Deuda técnica y tareas de plataforma

- Definir la rama de producción y su entorno en Vercel/Supabase (hoy solo existe `develop`).
- Crear los proyectos de Vercel y Supabase y cargar variables y secrets (ver spec 001, plan).
- Modo sin conexión y notificaciones push: descartados por ahora (spec 006); push se revisará
  con la confirmación por WhatsApp o las reservas.
- Estabilizar dos E2E intermitentes: cada una falló una vez en una corrida completa (2026-11-25)
  y pasa aislada. `reservations.spec.ts` «a reservation moves to another slot…» falló porque
  `check({ force: true })` del radio de las 4:00 p. m. no cambió su estado. `loading.spec.ts`
  «going back finds the list where it was» no recuperó el desplazamiento al volver. También
  `vehicle-catalog.spec.ts` «adds a really new brand and line to the catalog, once» (una vez, en la
  corrida completa de la spec 021).

## Especificadas

| ID | Título | Estado |
|----|--------|--------|
| [001](001-migracion-plataforma/spec.md) | Migración de plataforma a Next.js + Supabase + Vercel | en-progreso (falta aprovisionar Vercel y Supabase remotos) |
| [002](002-autenticacion-roles/spec.md) | Autenticación y roles | implementada (falta despliegue y prueba manual de Google) |
| [003](003-rediseno-visual/spec.md) | Rediseño visual de la interfaz | verificada |
| [004](004-registro-clientes/spec.md) | Registro de clientes y sección Clientes | implementada (falta despliegue y prueba manual de Google) |
| [005](005-vehiculos-clientes/spec.md) | Vehículos de los clientes | verificada (bloques A, B y C); falta despliegue |
| [006](006-app-instalable/spec.md) | App instalable | verificada; falta despliegue y prueba manual en dispositivos |
| [007](007-catalogos-servicios-empleados/spec.md) | Catálogos de servicios y empleados | verificada; falta despliegue |
| [008](008-orden-de-trabajo/spec.md) | Orden de trabajo | verificada, con enmienda (falta despliegue) |
| [009](009-experiencia-movil/spec.md) | Experiencia móvil | verificada; falta despliegue |
| [010](010-modo-oscuro/spec.md) | Modo oscuro | verificada; falta despliegue |
| [011](011-transiciones-carga/spec.md) | Transiciones y estados de carga | verificada |
| [012](012-agendamiento/spec.md) | Agendamiento de reservas | verificada, con enmiendas HU-06 y HU-07 (falta despliegue y revisión a mano en el teléfono) |
| [013](013-avisos-flotantes/spec.md) | Avisos flotantes de confirmación | verificada (falta despliegue) |
| [014](014-experiencia-cliente/spec.md) | Experiencia del cliente con cuenta | verificada (falta despliegue) |
| [015](015-reporte-servicios/spec.md) | Reporte de servicios | verificada |
| [016](016-liquidacion-empleados/spec.md) | Liquidación de empleados | verificada |
| [017](017-derechos-titular/spec.md) | Derechos del titular de datos | verificada |
| [018](018-marcas-lineas/spec.md) | Administrar marcas y líneas de vehículos | verificada |
| [019](019-estilo-automotriz/spec.md) | Estilo automotriz premium con acento plata | verificada (falta despliegue) |
| [020](020-liquidacion-quincenal/spec.md) | Liquidación quincenal y por rango de fechas | borrador (falta decidir el salario base) |
| [021](021-reservas-cliente-varias/spec.md) | Reservas del cliente: varias por vehículo y tiempo estimado | verificada (falta despliegue) |
| [022](022-cliente-desde-orden/spec.md) | Registrar cliente y su primer vehículo desde «Nueva orden» | aprobada |
