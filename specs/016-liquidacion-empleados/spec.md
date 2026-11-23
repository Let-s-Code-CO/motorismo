---
id: "016"
titulo: "Liquidación de empleados"
estado: implementada
creada: 2026-11-23
actualizada: 2026-11-23
---

# 016 — Liquidación de empleados

## Contexto y problema

Cada mes el negocio paga a sus empleados un salario base más una comisión por los servicios en que
participaron. Las órdenes (spec 008) ya guardan quién hizo cada servicio y con qué participación, y
cada empleado tiene su porcentaje de comisión (spec 007). Pero el salario base no está en ninguna
parte, y la cuenta de cada mes se hace a mano, servicio por servicio, con riesgo de errores y sin un
comprobante de lo que se pagó.

Se quiere que el administrador registre el salario base de cada empleado y que la app calcule la
liquidación del mes: el salario base más las comisiones de los servicios de las órdenes cerradas en
ese mes. El administrador revisa el mes, lo cierra para que quede como comprobante de lo pagado,
puede regenerarlo si hizo falta corregir algo y lo exporta a Excel.

Las specs 007 (RN-06), 008 y 015 (RN-03) dejaron para esta spec cómo se aplica la comisión y cómo
afecta el descuento de una orden.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Administrador | Fijar el salario base de cada empleado; ver, cerrar, regenerar y exportar la liquidación de cada mes. |
| Operador | Nada: salarios y comisiones son datos privados de los empleados (spec 007, RN-07). |
| Cliente | Nada. |

Los empleados no inician sesión en la app (spec 007).

## Historias de usuario

### HU-01 (P1) — Salario base en la ficha del empleado

Como administrador, quiero registrar el salario base mensual de cada empleado, para que la
liquidación lo sume.

**Criterios de aceptación**

- **CA-01** — Dado el formulario de un empleado, cuando el administrador lo crea o lo corrige,
  entonces puede escribir su salario base mensual en pesos (un número entero, 0 o más; «0» para
  quien solo gana comisión). La ficha del empleado lo muestra junto a su comisión.
- **CA-02** — Dado un salario base que no es un número entero de 0 o más, cuando el administrador
  guarda, entonces se le dice qué corregir y no se guarda.
- **CA-03** — Dados los empleados que ya existían antes de esta funcionalidad, entonces su salario
  base es 0 hasta que el administrador lo fije.
- **CA-04** — Dado un operador, entonces no ve el salario base de ningún empleado ni puede
  cambiarlo por ninguna vía (como la comisión y el documento, spec 007, RN-07).

### HU-02 (P1) — Ver la liquidación de un mes

Como administrador, quiero ver cuánto le corresponde a cada empleado en un mes, para pagarle sin
hacer la cuenta a mano.

**Criterios de aceptación**

- **CA-05** — Dado un administrador, cuando abre «Reportes» → «Liquidación», entonces ve el mes en
  curso y puede elegir otro mes. Por cada empleado ve su salario base del mes, sus comisiones y el
  total (base más comisiones), y al final el total del mes para todos.
- **CA-06** — Dado un empleado, entonces la comisión de cada servicio en que participó es el valor
  del servicio en la orden, por su porcentaje de participación, por su porcentaje de comisión
  (p. ej. $ 100.000 × 50 % × 30 % = $ 15.000). Sus comisiones del mes son la suma de las de todos
  esos servicios.
- **CA-07** — Dada una orden con descuento, entonces la comisión se calcula sobre el valor de cada
  servicio sin restar el descuento: el descuento lo asume el negocio (RN-03).
- **CA-08** — Dado el mes, entonces solo cuentan los servicios de órdenes cerradas ese mes, por la
  fecha de cierre en hora de Colombia (como el reporte de servicios, spec 015); nunca las abiertas
  ni las anuladas. Una orden corregida cuenta con sus valores y participaciones corregidos.
- **CA-09** — Dado un empleado activo todo el mes, entonces su salario base del mes es el completo.
  Dado uno que empezó o se desactivó a mitad de mes (o se reactivó), entonces es proporcional a los
  días en que estuvo activo, y la liquidación dice cuántos días fueron (RN-04).
- **CA-10** — Dado el mes, entonces aparecen los empleados que estuvieron activos algún día del mes
  o que tienen comisiones en él (también uno ya desactivado). Uno sin días activos ni comisiones no
  aparece.
- **CA-11** — Dado un empleado de la liquidación, cuando el administrador lo abre, entonces ve el
  detalle: cada servicio con su orden, fecha, valor, participación y comisión, y cómo se llegó al
  salario base del mes (días activos de los días del mes).
- **CA-12** — Dado un mes que no se ha cerrado, entonces la liquidación se ve como «Provisional»:
  se calcula con los datos de ese momento y puede cambiar.
- **CA-13** — Dado un mes sin empleados que liquidar, entonces lo dice.

### HU-03 (P1) — Cerrar y regenerar el mes

Como administrador, quiero cerrar la liquidación del mes, para que quede como comprobante de lo que
pagué aunque después cambie algo; y poder regenerarla si tuve que corregir algo.

**Criterios de aceptación**

- **CA-14** — Dado un mes que ya terminó y no se ha cerrado, cuando el administrador pulsa «Cerrar
  liquidación» y lo confirma, entonces quedan guardados, por cada empleado, los días activos, el
  salario base, las comisiones con su detalle y el total, y quién la cerró y cuándo. Un mes que
  aún no termina no se puede cerrar (RN-06).
- **CA-15** — Dado un mes cerrado, cuando después se corrige una orden de ese mes, cambia el
  salario base o la comisión de un empleado, entonces la liquidación cerrada no cambia: muestra lo
  guardado al cerrarla, marcada «Cerrada el … por …».
- **CA-16** — Dado un mes cerrado, cuando el administrador pulsa «Regenerar» y lo confirma (se le
  avisa que los valores pueden cambiar), entonces la liquidación se vuelve a calcular con los datos
  de ese momento y reemplaza a la anterior; queda registrado quién la regeneró y cuándo, y cuál era
  el total antes.
- **CA-17** — Dado un mes cerrado en el que algo cambió después (una orden de ese mes corregida,
  anulada, o un salario base o una comisión distintos), entonces la liquidación lo avisa («Hubo
  cambios después del cierre») para que el administrador decida si la regenera.

### HU-04 (P2) — Exportar a Excel

Como administrador, quiero llevarme la liquidación del mes a Excel, para pagar y archivar.

**Criterios de aceptación**

- **CA-18** — Dada la liquidación de un mes, cuando el administrador pulsa «Exportar a Excel»,
  entonces descarga un archivo con una hoja de resumen (cada empleado con días activos, salario
  base, comisiones y total, y el total del mes) y una hoja con el detalle de las comisiones (cada
  servicio de cada empleado). El nombre dice el mes («liquidacion-2026-11.xlsx») y si es provisional.
- **CA-19** — Dado el archivo, entonces los valores son números y las fechas son fechas (se suman y
  se ordenan), como en el reporte de servicios (spec 015, CA-13).

### Acceso (todas las historias)

- **CA-20** — Dado un operador o un cliente, entonces «Liquidación» no aparece, si abre su
  dirección se le dice que no tiene permiso, y no puede ver, cerrar, regenerar ni exportar una
  liquidación por ninguna vía.

## Requisitos funcionales

- **RF-01** — Un salario base mensual en la ficha de cada empleado, solo para el administrador.
- **RF-02** — Una liquidación por mes en la sección «Reportes», junto al reporte de servicios.
- **RF-03** — Cerrar un mes guarda una copia fija de su liquidación; regenerarla la reemplaza y
  deja rastro.

## Reglas de negocio

- **RN-01** — La comisión de un servicio para un empleado = valor del servicio en la orden ×
  participación del empleado × su porcentaje de comisión.
- **RN-02** — Cuentan los servicios de las órdenes cerradas en el mes, por su fecha de cierre en
  hora de Colombia (spec 015, RN-01).
- **RN-03** — El descuento de una orden no reduce las comisiones: lo asume el negocio (decide lo que
  la spec 015, RN-03, dejó abierto).
- **RN-04** — Salario base del mes = salario base × días activos en el mes ÷ días del mes. Un
  empleado activo todo el mes recibe el salario base completo.
- **RN-05** — Total de un empleado = salario base del mes + comisiones. Los valores se redondean a
  pesos enteros.
- **RN-06** — Solo se cierra un mes que ya terminó. Mientras no se cierra, la liquidación es
  provisional.
- **RN-07** — Una liquidación cerrada no cambia sola: solo cambia si el administrador la regenera.
- **RN-08** — El salario base, como la comisión, es un dato privado del empleado: solo el
  administrador lo ve y lo cambia (spec 007, RN-07). La liquidación entera es solo del
  administrador, comprobado en el servidor.
- **RN-09** — La comisión y el salario base que se usan son los que tiene el empleado al calcular
  la liquidación (al verla provisional, al cerrarla o al regenerarla).

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Empleado | salario base mensual (nuevo) | Privado, como la comisión. |
| Días activos | cuándo se activó y desactivó cada empleado | Para el salario base proporcional. |
| Liquidación de un mes | mes, cerrada por, cerrada el, regenerada por, regenerada el, total anterior | Una por mes. |
| Línea de la liquidación | empleado, días activos, salario base, salario base del mes, comisión (%), comisiones, total | Copia fija al cerrar. |
| Detalle de comisiones | orden, servicio, fecha, valor, participación, comisión | Copia fija al cerrar. |

## Requisitos no funcionales

- **Privacidad:** salarios y comisiones solo para el administrador (constitución VI; spec 007, RN-07).
- **Móvil:** en el teléfono cada empleado se ve como una tarjeta, sin desplazamiento lateral.
- **Accesibilidad:** WCAG 2.1 AA en claro y oscuro, con la auditoría automática en verde.
- **Exactitud:** las cuentas cuadran al peso; las pruebas muestran cada cuenta.

## Fuera de alcance

- Anticipos, bonos, préstamos, deducciones u otros ajustes manuales (otra spec si hacen falta).
- Seguridad social, prestaciones, retenciones o cualquier cálculo de nómina legal.
- Pagar desde la app o marcar pagos individuales.
- Que el empleado vea su liquidación (no tiene cuenta).
- Periodos distintos de un mes calendario (quincenas, rangos libres).
- Historial de todas las versiones regeneradas (se guarda solo la última y el total anterior).

## Suposiciones

- Los días del mes son los del calendario (28 a 31). Ejemplo: activo 15 de 30 días de noviembre →
  la mitad del salario base.
- Los días activos se cuentan desde que el empleado se registró o se reactivó hasta que se
  desactivó. Para los empleados que ya existían, cuentan como activos desde su registro.
- El salario base no se prorratea por cambios a mitad de mes: se usa el que tiene al calcular
  (RN-09).
- Los redondeos se hacen al final, por empleado: comisiones y salario base del mes, cada uno al peso
  más cercano.
- La liquidación de un mes se puede cerrar desde el día 1 del mes siguiente.
- «Liquidación» comparte la sección «Reportes» con el reporte de servicios (spec 015).

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
| 2026-11-23 | Creación. Decisiones del usuario: salario base en la ficha del empleado más comisiones del mes; comisión sin restar el descuento; el mes se cierra y queda fijo, con opción de regenerar; salario base proporcional a los días activos; sin ajustes manuales. |
| 2026-11-23 | Aprobada por el usuario. |
| 2026-11-23 | Plan aprobado: estado `planificada`. |
| 2026-11-23 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-23 | Implementada: estado `implementada`. `save_employee` recibe el salario base al final y opcional (nulo conserva el que había); la navegación del mes se apila en el teléfono. |
