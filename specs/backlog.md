# Backlog

Candidatos a especificar. Cuando uno se convierte en spec, se mueve a la tabla «Especificadas»
con su ID. El orden sugerido tiene en cuenta dependencias.

## Pendientes de especificar

### Fundaciones

1. **Navegación principal** — layout autenticado con menú lateral que muestra solo las opciones
   del rol.

### Operación

2. **Vehículos del cliente y búsqueda por placa** — resolver antes si son solo motos o vehículos
   en general; al encontrar al cliente, mostrar sus datos, total de lavadas y las dos últimas
   (el registro y la búsqueda por nombre, correo o celular están en la spec 004).
3. **Catálogos** — servicios (con valor de referencia), tipos de moto y empleados.
4. **Orden de trabajo** — servicios elegidos (incluido «otro» con valor libre), empleados
   asociados y valor final.
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
- `minimatch` < 11 (aviso moderado, solo en desarrollo) llega vía
  `@trivago/prettier-plugin-sort-imports`; revisar cuando el plugin lo actualice.

## Especificadas

| ID | Título | Estado |
|----|--------|--------|
| [001](001-migracion-plataforma/spec.md) | Migración de plataforma a Next.js + Supabase + Vercel | en-progreso (falta aprovisionar Vercel y Supabase remotos) |
| [002](002-autenticacion-roles/spec.md) | Autenticación y roles | implementada (falta despliegue y prueba manual de Google) |
| [003](003-rediseno-visual/spec.md) | Rediseño visual de la interfaz | implementada |
| [004](004-registro-clientes/spec.md) | Registro de clientes y sección Clientes | implementada (falta despliegue y prueba manual de Google) |
