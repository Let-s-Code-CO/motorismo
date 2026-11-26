# Backlog

Candidatos a especificar. Cuando uno se convierte en spec, se mueve a la tabla «Especificadas»
con su ID. El orden sugerido tiene en cuenta dependencias.

## Pendientes de especificar

Ninguno por ahora. (La confirmación por WhatsApp se descartó el 2026-11-26.)

## Deuda técnica y tareas de plataforma

- Definir la rama de producción y su entorno en Vercel/Supabase (hoy solo existe `develop`).
- Crear los proyectos de Vercel y Supabase y cargar variables y secrets (ver spec 001, plan).
- Modo sin conexión y notificaciones push: descartados por ahora (spec 006).
- Accesibilidad (WCAG 2.4.2): al navegar entre pantallas con la red lenta, la pestaña queda
  alrededor de un segundo sin `<title>`. Next 16 quita los metadatos de la pantalla anterior al
  mostrar el esqueleto y pone los nuevos cuando llegan. Medido el 2026-11-26 con 800 ms de latencia y
  30 KB/s; la auditoría del esqueleto (`loading.spec.ts`) espera a que vuelva el título. Decidir si se
  corrige en la app.

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
| [020](020-liquidacion-quincenal/spec.md) | Liquidación quincenal y por rango de fechas | verificada |
| [021](021-reservas-cliente-varias/spec.md) | Reservas del cliente: varias por vehículo y tiempo estimado | verificada (falta despliegue) |
| [022](022-cliente-desde-orden/spec.md) | Registrar cliente y su primer vehículo desde «Nueva orden» | verificada (falta despliegue) |
| [023](023-placa-norma/spec.md) | Placa según la norma colombiana | verificada |
| [024](024-precios-por-categoria/spec.md) | Categoría de moto y precios por categoría | verificada |
