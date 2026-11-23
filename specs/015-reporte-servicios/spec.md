---
id: "015"
titulo: "Reporte de servicios"
estado: implementada
creada: 2026-11-23
actualizada: 2026-11-23
---

# 015 — Reporte de servicios

## Contexto y problema

Las órdenes de trabajo (spec 008) guardan cada servicio que se hizo, su valor y qué empleados
participaron. Pero el administrador no tiene cómo verlo junto: para saber qué se hizo en una
semana, qué hizo un empleado o qué se le ha hecho a una moto, tiene que abrir orden por orden.
Tampoco puede llevar esos datos a Excel para sus cuentas.

Se quiere un reporte de los servicios hechos, con filtros por fecha, empleado y placa, para
consultarlo en la app y exportarlo a Excel. Es la base de la liquidación de los empleados, que
queda para otra spec (backlog: «Exportar liquidación por empleado»).

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Administrador | Ver y exportar los servicios hechos en un periodo, por empleado o por vehículo. |
| Operador | Nada: el reporte lleva valores e ingresos del negocio y no lo ve. |
| Cliente | Nada. |

## Historias de usuario

### HU-01 (P1) — Consultar los servicios hechos

Como administrador, quiero ver los servicios hechos en un periodo, filtrados por empleado o por
placa, para saber qué se hizo y cuánto se cobró.

**Criterios de aceptación**

- **CA-01** — Dado un administrador, cuando abre «Reportes» → «Servicios», entonces ve los
  servicios de las órdenes cerradas este mes (del día 1 a hoy), el más reciente primero. Cada fila
  dice la fecha de cierre, el número de orden, el cliente, el vehículo y su placa, el servicio, su
  valor y los empleados que participaron con su porcentaje.
- **CA-02** — Dado el reporte, cuando el administrador elige un rango de fechas, entonces ve los
  servicios de las órdenes cerradas entre esas dos fechas, ambas incluidas, en la hora de Colombia.
- **CA-03** — Dado el reporte, cuando elige un empleado (también uno desactivado), entonces ve solo
  los servicios en que participó. En la lista, los desactivados van aparte, al final, para no hacer
  ruido entre el equipo de hoy.
- **CA-04** — Dado el reporte, cuando escribe una placa (con o sin guion, en mayúsculas o
  minúsculas), entonces ve solo los servicios hechos a ese vehículo.
- **CA-05** — Dados varios filtros a la vez, entonces se aplican todos juntos. Los filtros viven en
  la dirección: sobreviven a recargar la página y al botón «atrás», y un enlace copiado abre el
  mismo reporte.
- **CA-06** — Dado el reporte, entonces al final dice cuántos servicios son y la suma de sus
  valores. Sin filtro de empleado dice además los descuentos de esas órdenes y el total (suma menos
  descuentos). Con filtro de empleado no los dice: el descuento es de la orden completa, no de los
  servicios de un empleado (RN-03).
- **CA-07** — Dadas órdenes abiertas o anuladas, entonces sus servicios no aparecen. Una orden
  corregida aparece con sus valores y empleados corregidos.
- **CA-08** — Dado un periodo o filtros sin servicios, entonces lo dice y ofrece quitar los
  filtros.
- **CA-09** — Dado un operador o un cliente, entonces «Reportes» no aparece en su menú, y si abre
  la dirección del reporte se le dice que no tiene permiso; el servidor no le entrega los datos.
- **CA-10** — Dada una fila del reporte, cuando el administrador la abre, entonces llega a su orden.
- **CA-11** — Dado un reporte con muchos servicios, entonces se ven por páginas, y los totales
  (CA-06) cuentan todos los servicios del filtro, no solo los de la página.

### HU-02 (P1) — Exportar a Excel

Como administrador, quiero llevarme el reporte a Excel, para hacer mis cuentas y guardarlo.

**Criterios de aceptación**

- **CA-12** — Dado el reporte con sus filtros, cuando el administrador pulsa «Exportar a Excel»,
  entonces descarga un archivo de Excel con todos los servicios del filtro (no solo la página a la
  vista), con las mismas columnas que el reporte y los totales al final. El nombre dice el periodo
  («servicios-2026-11-01-a-2026-11-23.xlsx»).
- **CA-13** — Dado el archivo, cuando se abre en Excel, entonces las fechas son fechas y los
  valores son números (se ordenan y se suman), y los empleados de cada servicio con su porcentaje
  caben en una celda.
- **CA-14** — Dado un operador o un cliente, entonces no puede exportar aunque pida el archivo
  directamente.

## Requisitos funcionales

- **RF-01** — Una sección «Reportes» para el administrador, con el reporte de servicios (la
  liquidación llegará después a la misma sección).
- **RF-02** — El reporte y la exportación usan los mismos filtros y las mismas reglas.

## Reglas de negocio

- **RN-01** — Solo cuentan los servicios de órdenes cerradas; la fecha de un servicio es la fecha de
  cierre de su orden, en la hora de Colombia.
- **RN-02** — El valor de cada servicio es el que tiene en la orden (el cobrado, no el del catálogo
  de hoy); una orden corregida cuenta con sus valores corregidos.
- **RN-03** — El descuento es de la orden completa: se muestra aparte y solo sin filtro de empleado.
  Cómo cuenta en la liquidación de un empleado se decide en esa spec.
- **RN-04** — Solo el administrador ve y exporta el reporte, comprobado en el servidor.
- **RN-05** — Las horas y fechas como en el resto de la app; los valores en pesos colombianos.

## Datos (vista conceptual)

No hay datos nuevos: todo sale de las órdenes cerradas (spec 008), sus servicios, la participación
de los empleados y sus descuentos.

## Requisitos no funcionales

- **Móvil:** en el teléfono cada servicio se ve como una tarjeta, sin desplazamiento lateral.
- **Accesibilidad:** WCAG 2.1 AA en claro y oscuro, con la auditoría automática en verde.
- **Rendimiento:** un mes normal del negocio (cientos de servicios) se ve y se exporta en pocos
  segundos.

## Fuera de alcance

- La liquidación de los empleados (cuánto le toca a cada uno por su comisión): spec aparte.
- Gráficas y comparaciones entre periodos.
- Filtrar por servicio o por cliente.
- Exportar a PDF o CSV.

## Suposiciones

- El periodo por defecto es el mes en curso, del día 1 a hoy.
- Filtrar por placa busca la placa completa (no parte de ella); una bicicleta no tiene placa, así
  que no se encuentra por placa.
- Las páginas son de 50 servicios.
- Con filtro de placa, las órdenes aparecen completas (todas sus líneas son de ese vehículo), así
  que el descuento sí se muestra.

## Preguntas abiertas

Ninguna.

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
| 2026-11-23 | Creación. Decisiones del usuario: solo el administrador; una fila por servicio hecho; valor y descuento aparte; exportar a Excel (.xlsx). |
| 2026-11-23 | Aprobada por el usuario. |
| 2026-11-23 | Plan aprobado: estado `planificada`. |
| 2026-11-23 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-23 | Pedido del usuario durante la implementación: en la lista de empleados, los desactivados van aparte, al final (CA-03). |
| 2026-11-23 | Implementada: estado `implementada`. |
