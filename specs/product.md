# Contexto de producto

> Documento vivo. Lo marcado como **[POR CONFIRMAR]** son inferencias a partir del código y deben
> validarse con el negocio antes de usarse en una spec.

## Visión

Motorismo Detailing es un negocio de lavado y detailing de motos. La aplicación sustituye el
registro manual de clientes y servicios, permite saber al instante el historial de un cliente y
da al administrador reportes para liquidar el trabajo de los empleados.

## Roles

| Rol | Descripción | Acceso previsto |
|---|---|---|
| Operador | Persona en el punto de atención que registra clientes y crea órdenes. Inicia sesión. | Registro de clientes, crear orden de trabajo |
| Administrador | Dueño o encargado. Consulta reportes, exporta liquidaciones y gestiona usuarios. | Todo lo anterior + reportes + usuarios |
| Empleado | Persona que ejecuta el servicio. Se asocia a cada orden. **No inicia sesión**: solo aparece en listas. | — |

No hay registro público: el administrador invita a cada usuario desde la app. Se entra con correo y
contraseña o con Google (solo si el correo ya fue invitado). Ver spec 002.

## Necesidades conocidas

Origen: lista de deseos anotada en `SideBar.jsx` de la versión anterior de la app (React + Firebase,
consultable en el historial de git antes de la spec 001).

**Operación**

- Registro de clientes: nombre, placa, celular, correo y tipo de moto.
- Si el cliente ya existe: mostrar sus datos, número total de lavadas y las dos últimas lavadas.
- Lista de servicios precargados para elegir, más una opción «otro» con descripción y valor libres.
- Lista de empleados para asociarlos al servicio realizado.
- (Deseable) enviar un mensaje de WhatsApp al cliente confirmando el servicio y su valor.

**Administración**

- Listado de clientes.
- Listado de servicios con filtros por fecha, empleado y placa.
- Exportar los servicios hechos por un empleado en un rango de fechas, con el total al final.

## Glosario

| Término | Definición |
|---|---|
| Cliente | Persona dueña de una o más motos que recibe servicios. **[POR CONFIRMAR]** si un cliente puede tener varias motos. |
| Moto / vehículo | Se identifica por su **placa**. Tiene un tipo (p. ej. scooter, deportiva...). **[POR CONFIRMAR]** catálogo de tipos. |
| Servicio | Tipo de trabajo ofrecido (lavado sencillo, detailing...) con un valor de referencia. |
| Orden de trabajo / lavada | Registro de uno o más servicios hechos a una moto en una fecha, por uno o más empleados, con su valor final. |
| Liquidación | Suma de los servicios realizados por un empleado en un periodo. |

## Preguntas abiertas de negocio

- ¿El identificador principal del cliente es la placa, el celular o ambos?
- ¿Una orden puede tener varios servicios y varios empleados?
- ¿El valor final puede diferir del valor de referencia del servicio (descuentos)?
- ¿Quién administra el catálogo de servicios, tipos de moto y empleados?
- ¿Qué formato de exportación se necesita (Excel, PDF, CSV)?
