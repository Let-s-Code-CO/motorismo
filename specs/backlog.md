# Backlog

Candidatos a especificar. Cuando uno se convierte en spec, se mueve a la tabla «Especificadas»
con su ID. El orden sugerido tiene en cuenta dependencias.

## Pendientes de especificar

### Operación

1. **Administrar marcas y líneas de vehículos** — renombrar, unir duplicados (la spec 005 solo
   las precarga y amplía; servicios y empleados pasaron a la spec 007).
2. **Transferir un vehículo a otro cliente** conservando su historial (la spec 005 solo lo
   retira y se registra de nuevo).
3. **Confirmación por WhatsApp** (deseable), también como recordatorio de reservas (spec 012).

### Administración

4. **Reporte de clientes** (la lista con búsqueda está en la spec 004; falta exportarla).
5. **Derechos del titular de datos desde la app** — consulta, corrección y supresión de datos
   personales de los clientes (hoy se atienden por los canales de la política publicada en la
   spec 004).

## Deuda técnica y tareas de plataforma

- Definir la rama de producción y su entorno en Vercel/Supabase (hoy solo existe `develop`).
- Crear los proyectos de Vercel y Supabase y cargar variables y secrets (ver spec 001, plan).
- Clientes (spec 004): si se pulsa una tarjeta-filtro antes de que la búsqueda (con espera de
  300 ms) llegue a la URL, la búsqueda pisa el filtro. Poco probable con una persona; lo destapó
  la E2E de la spec 005 bajo carga.
- E2E de menús de fila (`disable-user.spec.ts`, `customers-disable.spec.ts`): a veces el elemento
  del menú «no está estable» o se despega al pulsarlo, y pasa al repetir (visto el 2026-11-21).
- Banner «Instala Motorismo» (spec 006): en tema oscuro su fondo es semitransparente y, mientras
  flota sobre el contenido, el texto de debajo se lee a través (visto en el iPhone el 2026-11-21).
- E2E `vehicle-catalog.spec.ts` («adds a really new brand and line…», spec 005) agota los 30 s
  a veces en la suite completa y pasa sola: revisar qué espera bajo carga (visto el 2026-11-20).
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
| [011](011-transiciones-carga/spec.md) | Transiciones y estados de carga | verificada |
| [012](012-agendamiento/spec.md) | Agendamiento de reservas | verificada, con enmiendas HU-06 y HU-07 (falta despliegue y revisión a mano en el teléfono) |
| [013](013-avisos-flotantes/spec.md) | Avisos flotantes de confirmación | verificada (falta despliegue) |
| [014](014-experiencia-cliente/spec.md) | Experiencia del cliente con cuenta | verificada (falta despliegue) |
| [015](015-reporte-servicios/spec.md) | Reporte de servicios | verificada |
| [016](016-liquidacion-empleados/spec.md) | Liquidación de empleados | implementada |
