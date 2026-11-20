---
id: "007"
titulo: "Catálogos de servicios y empleados"
estado: implementada
creada: 2026-11-20
actualizada: 2026-11-20
---

# 007 — Catálogos de servicios y empleados

## Contexto y problema

La orden de trabajo (próxima spec) registra qué servicios se hicieron a un vehículo, quién los hizo
y cuánto costaron. Para armarla, el personal necesita elegir de dos listas que hoy no existen en la
app: los **servicios** que ofrece el negocio, con su valor de referencia, y los **empleados** que
los ejecutan. Hoy los precios viven en la cabeza del encargado o en un papel, y cambian según el
tipo de vehículo: no cuesta lo mismo lavar una moto que un carro.

Además, para liquidar más adelante a los empleados, el negocio necesita tener sus datos básicos y
el porcentaje de comisión que gana cada uno.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Administrador | Crear, corregir, desactivar y reactivar servicios y empleados; fijar precios y comisiones. |
| Operador | Consultar los servicios y sus precios (para informar al cliente y, luego, armar órdenes) y saber qué empleados están activos. No cambia nada. |
| Cliente | Nada: los catálogos son internos. |

## Historias de usuario

### HU-01 (P1) — Catálogo de servicios con precio por tipo de vehículo

Como administrador, quiero registrar los servicios del negocio con su valor de referencia para
cada tipo de vehículo, para que el personal los consulte y, luego, los elija en las órdenes.

**Criterios de aceptación**

- **CA-01** — Dado un administrador en «Servicios», cuando registra un servicio con nombre y al
  menos un valor de referencia (moto, carro o bicicleta), entonces el servicio aparece en la
  lista con sus valores en pesos («$ 25.000») y se anuncia el resultado.
- **CA-02** — Dado un servicio sin valor para un tipo de vehículo, cuando se ve en la lista,
  entonces ese tipo aparece como «No disponible» (el servicio no se ofrece para ese tipo).
- **CA-03** — Dado el formulario de servicio, cuando falta el nombre, no hay ningún valor, o un
  valor no es un número entero de pesos mayor que cero y hasta $ 10.000.000, entonces se indica
  el problema junto a cada campo y no se guarda nada.
- **CA-04** — Dado un servicio con el nombre «Lavado sencillo», cuando se intenta registrar otro
  como «lavado  SENCILLO» (sin distinguir mayúsculas ni espacios de más), entonces se rechaza
  diciendo que ya existe, también si el existente está desactivado (y en ese caso sugiere
  reactivarlo).
- **CA-05** — Dado un servicio, cuando el administrador corrige su nombre o sus valores, entonces
  la lista muestra los nuevos datos; las mismas reglas de CA-03 y CA-04 aplican.
- **CA-06** — Dado que no hay servicios, cuando se abre «Servicios», entonces se ve un estado
  vacío que invita al administrador a registrar el primero.

### HU-02 (P2) — Empleados con sus datos y su comisión

Como administrador, quiero registrar a los empleados con su documento, su celular y su porcentaje
de comisión, para elegirlos en las órdenes y, más adelante, liquidarlos.

**Criterios de aceptación**

- **CA-07** — Dado un administrador en «Empleados», cuando registra un empleado con nombre
  completo, tipo y número de documento, porcentaje de comisión y, si quiere, celular, entonces
  aparece en la lista y se anuncia el resultado.
- **CA-08** — Dado el formulario de empleado, cuando falta el nombre, el documento o la comisión,
  el celular no es un móvil colombiano válido, o la comisión no es un número entero de 0 a 100,
  entonces se indica el problema junto a cada campo y no se guarda nada.
- **CA-09** — Dado un empleado con «CC 1.020.304.050», cuando se intenta registrar otro con el
  mismo tipo y número de documento (sin importar puntos ni espacios), entonces se rechaza diciendo
  que ya existe, también si el existente está desactivado (y en ese caso sugiere reactivarlo).
- **CA-10** — Dado un empleado, cuando el administrador corrige sus datos o su comisión, entonces
  la lista muestra los nuevos datos; las mismas reglas de CA-08 y CA-09 aplican.
- **CA-11** — Dado que no hay empleados, cuando se abre «Empleados», entonces se ve un estado
  vacío que invita al administrador a registrar el primero.

### HU-03 (P2) — Desactivar y reactivar

Como administrador, quiero desactivar un servicio que ya no se ofrece o un empleado que ya no
trabaja, sin perder su información, y poder reactivarlos.

**Criterios de aceptación**

- **CA-12** — Dado un servicio o un empleado activo, cuando el administrador lo desactiva (tras
  confirmar), entonces sale de la lista de activos y aparece aparte, en «Desactivados», con la
  fecha; se anuncia el resultado.
- **CA-13** — Dado un servicio o un empleado desactivado, cuando el administrador lo reactiva,
  entonces vuelve a la lista de activos con sus datos intactos.
- **CA-14** — Dado un servicio o un empleado, cuando cualquiera intenta borrarlo por cualquier vía,
  entonces el sistema lo impide: solo se desactiva.

### HU-04 (P2) — Consulta del personal y permisos

Como operador, quiero consultar los servicios con sus precios y los empleados activos, sin poder
cambiarlos, para informar al cliente y armar las órdenes.

**Criterios de aceptación**

- **CA-15** — Dado un operador, cuando abre «Servicios», entonces ve los servicios activos con
  sus valores por tipo de vehículo, sin opciones para registrar, corregir ni desactivar.
- **CA-16** — Dado un operador, cuando abre «Empleados», entonces ve solo el nombre de los
  empleados activos: ni el documento, ni el celular, ni la comisión, ni los desactivados.
- **CA-17** — Dado un operador, cuando intenta registrar, corregir, desactivar o reactivar un
  servicio o un empleado por cualquier vía, o leer el documento, el celular o la comisión de un
  empleado, entonces el sistema lo rechaza.
- **CA-18** — Dado un cliente, cuando intenta abrir «Servicios» o «Empleados» o consultarlos por
  cualquier vía, entonces no puede («No tienes permiso»), y no ve la opción en el menú.
- **CA-19** — Dado un miembro del personal, cuando mira el menú principal o las tarjetas de su
  página de inicio, entonces encuentra «Servicios» y «Empleados» (el administrador, también
  «Usuarios»); el resto de opciones no cambia.

## Requisitos funcionales

- **RF-01** — El sistema guarda un catálogo de servicios: nombre y valor de referencia para moto,
  carro y bicicleta (cada uno opcional, al menos uno).
- **RF-02** — El sistema guarda un catálogo de empleados: nombre completo, tipo y número de
  documento, celular (opcional) y porcentaje de comisión.
- **RF-03** — Servicios y empleados se desactivan y reactivan; nunca se borran.
- **RF-04** — Las listas se ordenan por nombre, con los desactivados aparte.

## Reglas de negocio

- **RN-01** — Solo el administrador registra, corrige, desactiva y reactiva servicios y empleados.
  La regla vale por cualquier vía, no solo en las pantallas.
- **RN-02** — Servicios y empleados nunca se borran: las órdenes pasadas los seguirán mostrando.
- **RN-03** — El nombre de un servicio es único sin distinguir mayúsculas ni espacios de más,
  también frente a los desactivados.
- **RN-04** — Un empleado se identifica por su tipo y número de documento, únicos también frente a
  los desactivados.
- **RN-05** — Los valores son pesos colombianos enteros, mayores que cero y hasta $ 10.000.000. Un
  tipo de vehículo sin valor significa que el servicio no se ofrece para ese tipo.
- **RN-06** — La comisión es un porcentaje entero de 0 a 100. Cómo se aplica (sobre qué valor, cómo
  se reparte entre varios empleados) se decide en la spec de liquidación.
- **RN-07** — El documento, el celular y la comisión de un empleado son datos personales y de
  nómina: solo los ve el administrador. El operador solo ve el nombre de los activos.
- **RN-08** — Cambiar el valor de referencia de un servicio no cambia lo ya cobrado: la orden de
  trabajo guardará su propio valor (regla para la spec de órdenes).

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Servicio | nombre, valor moto, valor carro, valor bicicleta, desactivado (fecha) | Cada valor es opcional; al menos uno. |
| Empleado | nombre completo, tipo de documento, número de documento, celular, comisión (%), desactivado (fecha) | No inicia sesión. Documento único por tipo. |

## Requisitos no funcionales

- Accesibilidad: las pantallas y formularios nuevos cumplen WCAG 2.1 AA y se suman a la auditoría
  automática.
- Dispositivos: celular (desde 360 px), tablet y escritorio, sin desplazamiento horizontal.
- Privacidad: RN-07; los datos de los empleados se recogen solo los necesarios (constitución VI).
- Sin conexión: como el resto de la app (spec 006), no se opera sin red.

## Fuera de alcance

- La orden de trabajo y el servicio «otro» con descripción y valor libres (spec de órdenes).
- La liquidación de empleados y cómo se aplica la comisión.
- Administrar marcas y líneas de vehículos (renombrar, unir duplicados).
- Historial de precios, duración de los servicios, descripciones o fotos de los servicios.
- Que un empleado inicie sesión, o enlazar un empleado con una cuenta del personal.
- Importar o exportar los catálogos.

## Suposiciones

- Tipos de documento: Cédula de ciudadanía (CC), Cédula de extranjería (CE), Permiso por
  protección temporal (PPT) y Pasaporte. El número se guarda sin puntos ni espacios (solo dígitos,
  salvo el pasaporte, que admite letras).
- El celular sigue la misma regla que el de los clientes (móvil colombiano de 10 dígitos que
  empieza por 3).
- «Servicios» y «Empleados» son dos opciones del menú principal del personal, junto a «Clientes».
- Un operador que también lava se registra además como empleado: son listas independientes.
- El negocio informa a sus empleados del tratamiento de sus datos fuera de la app (contrato o
  autorización laboral); la app no pide un consentimiento como el de los clientes.

## Preguntas abiertas

Ninguna. Resueltas con el usuario el 2026-11-20: solo el administrador administra los catálogos;
un valor de referencia por tipo de vehículo; del empleado se guardan nombre, celular (opcional),
documento y % de comisión; lo que ya no se usa se desactiva, nunca se borra.

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes.
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba.
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-20 | Creación. |
| 2026-11-20 | Aprobada por el usuario. |
| 2026-11-20 | Al planificar: CA-19 incluye las tarjetas de «Servicios» y «Empleados» en la página de inicio del personal (pedido por el usuario). Plan aprobado: estado `planificada`. |
| 2026-11-20 | Tareas aprobadas: estado `lista`. |
| 2026-11-20 | Implementada (bloques A y B). |
