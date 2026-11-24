# Contexto de producto

> Documento vivo: resume qué es el producto y qué hace hoy. El detalle de cada parte está en su spec
> (`specs/NNN-*/spec.md`). Lo marcado como **[POR CONFIRMAR]** son inferencias que deben validarse
> con el negocio antes de usarse en una spec.

## Visión

Motorismo Detailing («Motorismo PPF y Detailing») es un negocio especializado en PPF y detailing:
lavado especializado, micropulidos y recubrimientos cerámicos. Instagram: @motorismodetail.
Atiende motocicletas, bicicletas y carros (spec 005). La aplicación sustituye el registro manual de
clientes y servicios: el personal registra órdenes y reservas, ve al instante el historial de cada
cliente y el administrador obtiene reportes y la liquidación de los empleados. Los clientes con
cuenta reservan y siguen sus servicios desde la app.

## Roles

| Rol | Descripción | Qué hace en la app |
|---|---|---|
| Operador | Persona del punto de atención. Inicia sesión. | Órdenes, agenda y reservas, clientes y sus vehículos; consulta servicios y empleados. |
| Administrador | Dueño o encargado. Inicia sesión. | Todo lo del operador, y además: catálogos (servicios, empleados, marcas y líneas), reportes y liquidación, solicitudes de datos (habeas data) y usuarios. |
| Empleado | Persona que ejecuta el servicio. **No inicia sesión**: aparece en las órdenes y en la liquidación. | — |
| Cliente | Dueño de uno o más vehículos. Se registra solo (correo y contraseña, o Google) o lo registra el personal en el punto de atención, sin cuenta. | Con cuenta: su inicio (su vehículo en el lavadero y su próxima reserva), reservar, su historial, su perfil y vehículos, y sus datos personales (consultar, descargar, pedir corrección o supresión). |

El personal no se registra: el administrador lo invita (spec 002). Los clientes crean su cuenta con
confirmación de correo (spec 004).

## Qué hace hoy

**Operación**

- Clientes: registro desde la app o en el punto de atención, búsqueda (nombre, correo, celular,
  placa) y ficha con vehículos e historial (specs 004 y 005).
- Vehículos con marca, línea y color de catálogo y la placa colombiana; el catálogo de marcas y
  líneas crece al registrar vehículos y el administrador lo revisa y corrige (specs 005 y 018).
- Órdenes de trabajo: varios servicios y varios empleados por orden, con su participación; valores
  que pueden diferir del de referencia, descuento, varios medios de pago; cola del lavadero por
  turno (specs 008 y 012).
- Agenda: semanas habilitadas por el administrador, franjas con puestos, reservas del personal y del
  cliente, tolerancia de llegada (specs 012 y 014).

**Administración**

- Catálogos de servicios (con valor por tipo de vehículo) y de empleados (comisión y salario base)
  (specs 007 y 016).
- Reporte de servicios con filtros por fecha, empleado y placa, exportable a Excel (spec 015).
- Liquidación mensual de empleados (comisiones y salario base por días activos), con cierre y Excel
  (spec 016).
- Derechos del titular de datos: solicitudes con plazos de ley y supresión (spec 017).

**Experiencia**

- App instalable, modo oscuro, pensada para el teléfono, con avisos flotantes y estados de carga
  (specs 003, 006, 009, 010, 011 y 013).

## Glosario

| Término | Definición |
|---|---|
| Cliente | Persona dueña de uno o más vehículos que recibe servicios. Con cuenta o sin ella (registrado en el punto de atención) (specs 004 y 005). |
| Vehículo | Motocicleta, bicicleta o carro de un cliente, con marca, línea y color de catálogo. Motos y carros se identifican por su **placa** colombiana; las bicicletas no tienen (spec 005). |
| Marca / línea | Catálogo por tipo de vehículo. Lo que alguien escribe al registrar un vehículo entra **por revisar** hasta que el administrador lo revisa, corrige o une (spec 018). |
| Servicio | Tipo de trabajo ofrecido (lavado sencillo, micropulido…) con un valor de referencia por tipo de vehículo (spec 007). |
| Orden de trabajo / lavada | Registro de uno o más servicios hechos a un vehículo, por uno o más empleados, con su valor final, descuento y pagos (spec 008). |
| Reserva | Cita en una franja de la agenda para un cliente (y su vehículo), con tolerancia de llegada (spec 012). |
| Liquidación | Lo que gana cada empleado en un mes: comisiones de las órdenes cerradas más el salario base de sus días activos (spec 016). |
| Solicitud de datos | Consulta, corrección o supresión que un cliente pide sobre sus datos personales, con su plazo legal (spec 017). |

## Preguntas de negocio

Resueltas:

| Pregunta | Respuesta |
|---|---|
| ¿El identificador principal del cliente es la placa, el celular o ambos? | El cliente es un registro propio (nombre y contacto); se encuentra por nombre, correo, celular o placa. La placa identifica al vehículo vigente (specs 004 y 005). |
| ¿Una orden puede tener varios servicios y varios empleados? | Sí: varios servicios, cada uno con uno o más empleados y su participación (spec 008). |
| ¿El valor final puede diferir del valor de referencia? | Sí: cada línea copia el valor del servicio y se puede cambiar; la orden admite descuento (spec 008). |
| ¿Quién administra los catálogos de servicios, marcas y líneas y empleados? | El administrador (specs 007 y 018); el personal y los clientes amplían marcas y líneas al registrar vehículos. |
| ¿Qué formato de exportación se necesita? | Excel (specs 015 y 016). |

Abiertas:

- ¿Cómo se confirma un servicio o se recuerda una reserva por WhatsApp: la API de WhatsApp
  Business, un proveedor de mensajes o un enlace que el personal abre y envía? (backlog)
