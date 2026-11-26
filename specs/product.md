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
- Vehículos con marca, línea y color de catálogo y la placa colombiana, dibujada según la norma; el
  catálogo de marcas y líneas crece al registrar vehículos y el administrador lo revisa y corrige
  (specs 005, 018 y 023). Cada moto tiene una categoría (Street/Roadster, SBK/SSP, Scooter, Maxi
  Scooter, Trail, Maxi Trail, Cruiser/Clásica o Maxi Cruiser): la de su línea o una propia, que solo
  ve y elige el personal (spec 024).
- Órdenes de trabajo: varios servicios y varios empleados por orden, con su participación; valores
  que pueden diferir del de referencia, descuento, varios medios de pago; cola del lavadero por
  turno (specs 008 y 012). La línea de una moto trae el valor de su categoría (si no tiene, la orden
  la pide); un servicio «a convenir», como el PPF, llega sin valor para escribirlo; una orden lleva
  como mucho un paquete y nada de lo que este ya incluye (spec 024). Un cliente nuevo y su primer
  vehículo se registran sin salir de la orden (spec 022).
- Agenda: semanas habilitadas por el administrador, franjas con puestos, reservas del personal y del
  cliente, tolerancia de llegada (specs 012 y 014). El cliente reserva varias veces el mismo vehículo
  en días distintos y ve el tiempo estimado de lo que elige (spec 021); los servicios «a convenir»
  solo los reserva el personal, con su tiempo (spec 024).

**Administración**

- Catálogos de servicios y de empleados (comisión y salario base) (specs 007 y 016). Un servicio
  tiene un valor por tipo de vehículo; en las motos, uno único o uno por categoría; puede ser «a
  convenir» y tener descripción; un paquete dice qué servicios incluye. La lista de precios del
  negocio llega cargada (spec 024).
- Reporte de servicios con filtros por fecha, empleado y placa, exportable a Excel (spec 015).
- Liquidación de empleados por quincena o por rango de fechas: comisiones y salario base por días
  activos, por mes comercial o por días reales, con cierre de cada quincena y Excel (specs 016 y
  020).
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
| Servicio | Tipo de trabajo ofrecido (Lavado Pro Wash, Sellador, PPF…) con un valor de referencia por tipo de vehículo; en las motos, único o por categoría (specs 007 y 024). |
| Categoría de moto | Una de ocho (Street/Roadster, SBK/SSP, Scooter, Maxi Scooter, Trail, Maxi Trail, Cruiser/Clásica, Maxi Cruiser). Define el valor de los paquetes; viene de la línea o el personal la cambia en una moto (spec 024). |
| Paquete | Servicio con valores por categoría (Pro Wash o un combo: Premium, Deluxe, Supreme). Una orden o reserva lleva como mucho uno, y lo que incluye no se elige aparte (spec 024). |
| «A convenir» | Servicio sin valor ni tiempo de referencia (el PPF): se escriben en cada orden o, el tiempo, en la reserva del personal (spec 024). |
| Orden de trabajo / lavada | Registro de uno o más servicios hechos a un vehículo, por uno o más empleados, con su valor final, descuento y pagos (spec 008). |
| Reserva | Cita en una franja de la agenda para un cliente (y su vehículo), con tolerancia de llegada (spec 012). |
| Liquidación | Lo que gana cada empleado en una quincena o un rango de fechas: comisiones de las órdenes cerradas más el salario base de sus días activos (specs 016 y 020). |
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

Abiertas: ninguna.
