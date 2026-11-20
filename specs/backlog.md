# Backlog

Candidatos a especificar. Cuando uno se convierte en spec, se mueve a la tabla «Especificadas»
con su ID. El orden sugerido tiene en cuenta dependencias.

## Pendientes de especificar

### Fundaciones

1. **Navegación principal** — layout autenticado con menú lateral que muestra solo las opciones
   del rol.

### Operación

2. **Administrar marcas y líneas de vehículos** — renombrar, unir duplicados (la spec 005 solo
   las precarga y amplía; servicios y empleados pasaron a la spec 007).
3. **Agendamiento (reservas)** — guardar un puesto para una fecha y hora, con o sin servicios; al
   llegar el cliente, la reserva pasa a ser una orden en cola (spec 008). Candidata a spec 012.
4. **Transferir un vehículo a otro cliente** conservando su historial (la spec 005 solo lo
   retira y se registra de nuevo).
5. **Confirmación por WhatsApp** (deseable).

### Administración

6. **Reporte de clientes** (la lista con búsqueda está en la spec 004; falta exportarla).
7. **Reporte de servicios** con filtros por fecha, empleado y placa.
8. **Exportar liquidación por empleado** en un rango de fechas, con el total.
9. **Derechos del titular de datos desde la app** — consulta, corrección y supresión de datos
   personales de los clientes (hoy se atienden por los canales de la política publicada en la
   spec 004).

## Deuda técnica y tareas de plataforma

- Definir la rama de producción y su entorno en Vercel/Supabase (hoy solo existe `develop`).
- Crear los proyectos de Vercel y Supabase y cargar variables y secrets (ver spec 001, plan).
- Clientes (spec 004): si se pulsa una tarjeta-filtro antes de que la búsqueda (con espera de
  300 ms) llegue a la URL, la búsqueda pisa el filtro. Poco probable con una persona; lo destapó
  la E2E de la spec 005 bajo carga.
- E2E `vehicle-catalog.spec.ts` («adds a really new brand and line…», spec 005) agota los 30 s
  a veces en la suite completa y pasa sola: revisar qué espera bajo carga (visto el 2026-11-20).
- Ver sus órdenes desde «Mi perfil» (cliente) y estado «lista para entregar»: fuera de la spec 008.
- Modo sin conexión y notificaciones push: descartados por ahora (spec 006); push se revisará
  con la confirmación por WhatsApp o las reservas.
- `minimatch` < 11 (aviso moderado, solo en desarrollo) llega vía
  `@trivago/prettier-plugin-sort-imports`; revisar cuando el plugin lo actualice.

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
| [011](011-transiciones-carga/spec.md) | Transiciones y estados de carga | implementada |
