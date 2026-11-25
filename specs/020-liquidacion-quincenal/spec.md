---
id: "020"
titulo: "Liquidación quincenal y por rango de fechas"
estado: aprobada
creada: 2026-11-25
actualizada: 2026-11-25
---

# 020 — Liquidación quincenal y por rango de fechas

## Contexto y problema

La liquidación de empleados (spec 016) se calcula y se cierra por mes. El negocio paga cada quince
días, así que el administrador necesita ver y cerrar la liquidación de cada quincena. A veces
también necesita la cuenta de unas fechas cualquiera (p. ej. para un pago a mitad de quincena o un
empleado que se va), con un selector de fechas como el del reporte de servicios (spec 015).

Esta spec cambia el periodo de la liquidación; lo demás de la spec 016 (comisiones, días activos,
privacidad, detalle por empleado, Excel) sigue igual.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Administrador | Ver, cerrar y exportar la liquidación de cada quincena, y consultar la de un rango de fechas cualquiera. |
| Operador, cliente | Nada: la liquidación sigue siendo solo del administrador (spec 016, CA-20). |

## Historias de usuario

### HU-01 (P1) — La liquidación de una quincena

Como administrador, quiero ver la liquidación de cada quincena, para pagar a cada empleado cada
quince días sin hacer la cuenta a mano.

**Criterios de aceptación**

- **CA-01** — Dado un administrador, cuando abre «Reportes» → «Liquidación», entonces ve la
  quincena en curso (del 1 al 15, o del 16 al último día del mes) y puede pasar a la anterior o a la
  siguiente. Por cada empleado ve sus días activos, su salario base de la quincena, sus comisiones
  y el total, y al final el total de la quincena para todos.
- **CA-02** — Dada una quincena, entonces solo cuentan los servicios de las órdenes cerradas en
  ella, por la fecha de cierre en hora de Colombia (spec 016, CA-08); la comisión de cada servicio
  se calcula como hoy (spec 016, CA-06 y CA-07).
- **CA-03** — Dado un empleado activo toda la quincena, entonces recibe el salario base de la
  quincena completo; dado uno que empezó, se desactivó o se reactivó dentro de ella, entonces es
  proporcional a sus días activos en la quincena, y la liquidación dice cuántos fueron (RN-02).
- **CA-04** — Dada una quincena, entonces aparecen los empleados que estuvieron activos algún día de
  ella o que tienen comisiones en ella (spec 016, CA-10), y el detalle de cada uno muestra sus
  servicios y cómo se llegó a su salario base de la quincena.
- **CA-05** — Dada una quincena que no se ha cerrado, entonces se ve como «Provisional» (spec 016,
  CA-12); una quincena sin empleados que liquidar lo dice.

### HU-02 (P1) — Un rango de fechas cualquiera

Como administrador, quiero ver la liquidación entre dos fechas que yo elija, para pagos que no
coinciden con una quincena.

**Criterios de aceptación**

- **CA-06** — Dado un administrador en «Liquidación», cuando elige «Desde» y «Hasta» (como en el
  reporte de servicios), entonces ve la liquidación de esos días, con las mismas columnas, el
  detalle por empleado y el total.
- **CA-07** — Dado un rango, entonces cuentan los servicios de las órdenes cerradas entre «Desde» y
  «Hasta», ambos incluidos, y el salario base es proporcional a los días activos del rango (RN-02).
- **CA-08** — Dado un rango, entonces se ve como «Consulta»: no se puede cerrar (RN-04). Puede
  volver a la quincena en curso con un clic.
- **CA-09** — Dado un rango con «Desde» después de «Hasta», o una fecha que no existe, cuando se
  abre, entonces se muestra la quincena en curso, como el reporte de servicios con sus filtros
  inválidos (spec 015).
- **CA-10** — Dada una liquidación de una quincena o de un rango, cuando el administrador copia la
  dirección y la abre en otro momento, entonces ve el mismo periodo.

### HU-03 (P1) — Cerrar y regenerar una quincena

Como administrador, quiero cerrar la liquidación de cada quincena, para que quede como comprobante
de lo que pagué; y poder regenerarla si tuve que corregir algo.

**Criterios de aceptación**

- **CA-11** — Dada una quincena que ya terminó y no se ha cerrado, cuando el administrador pulsa
  «Cerrar liquidación» y lo confirma, entonces queda guardada como hoy se guarda un mes (spec 016,
  CA-14). Una quincena que no ha terminado no se puede cerrar.
- **CA-12** — Dada una quincena cerrada, entonces se comporta como un mes cerrado hoy: muestra lo
  guardado, «Cerrada el … por …», avisa si hubo cambios después del cierre y se puede regenerar
  (spec 016, CA-15 a CA-17).

### HU-04 (P1) — Elegir cómo se calcula el salario base

Como administrador, quiero calcular el salario base como mes comercial (lo habitual en Colombia) o
por días reales, según lo que necesite al liquidar.

**Criterios de aceptación**

- **CA-13** — Dada la liquidación de una quincena o de un rango, entonces se calcula por «Mes
  comercial» salvo que el administrador elija «Días reales»; la elección se ve en la pantalla y se
  conserva al cambiar de periodo y en la dirección (RN-02).
- **CA-14** — Dado un empleado activo toda la segunda quincena de un mes de 31 días, entonces por
  «Mes comercial» recibe la mitad del salario (15 días de 30), y por «Días reales» salario × 16 ÷ 31.
  Dada la segunda quincena de febrero completa (13 días), entonces por «Mes comercial» también
  recibe la mitad.
- **CA-15** — Dado un empleado activo solo parte de una quincena, entonces por «Mes comercial»
  recibe salario ÷ 30 por cada día activo, como mucho 15 días; por «Días reales», salario × días
  activos ÷ días del mes.
- **CA-16** — Dada una quincena cerrada, entonces guarda con qué método se cerró y lo muestra;
  regenerarla vuelve a calcular con el método que esté elegido al regenerar.

### HU-05 (P2) — Exportar a Excel

Como administrador, quiero llevarme a Excel la liquidación de una quincena o de un rango.

**Criterios de aceptación**

- **CA-17** — Dada la liquidación de una quincena o de un rango, cuando pulsa «Exportar a Excel»,
  entonces descarga el mismo archivo de hoy (hojas «Resumen» y «Detalle», spec 016, CA-18 y CA-19),
  con el periodo en el nombre («liquidacion-2026-11-1a-quincena.xlsx»,
  «liquidacion-2026-11-03-a-2026-11-20.xlsx») y en la hoja, diciendo si es provisional o consulta y
  con qué método se calculó el salario base.

## Requisitos funcionales

- **RF-01** — La liquidación se calcula para un periodo: una quincena (del 1 al 15, o del 16 al
  último día del mes) o un rango de fechas elegido. Por defecto, la quincena en curso.
- **RF-02** — Solo se cierran quincenas; el rango es solo para consultar y exportar.

## Reglas de negocio

- **RN-01** — Las reglas de la spec 016 siguen: comisión = valor × participación × porcentaje
  (RN-01), solo órdenes cerradas por su fecha de cierre en Colombia (RN-02), el descuento no reduce
  comisiones (RN-03), redondeo a pesos (RN-05), privacidad del salario y la comisión (RN-08) y los
  valores de ahora del empleado (RN-09).
- **RN-02** — Salario base de un periodo, por uno de dos métodos que elige el administrador al
  liquidar; por defecto, **mes comercial**:
  - **Mes comercial** (como la nómina en Colombia): cada quincena vale 15 días de 30. Un empleado
    activo toda la quincena recibe la mitad del salario, sea el mes de 28, 30 o 31 días; si estuvo
    activo solo parte, salario ÷ 30 por día activo, como mucho 15 días.
  - **Días reales** (como hoy, spec 016): salario × días activos ÷ días del mes.
  - En un rango, cada quincena (o parte de quincena) que toca aporta lo suyo con el método elegido.
- **RN-03** — Un día activo cuenta como hoy (spec 016, RN-04): el empleado estuvo activo en algún
  momento de ese día, en hora de Colombia.
- **RN-04** — Solo se cierra una quincena que ya terminó (spec 016, RN-06, por quincena); una
  quincena cerrada no cambia sola (RN-07).

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Liquidación cerrada | Quincena (año, mes, primera o segunda), método del salario base, por empleado: días activos, salario base, comisiones con su detalle y total; quién la cerró o regeneró, cuándo, total anterior | Reemplaza al cierre por mes de la spec 016. |

## Requisitos no funcionales

- **Privacidad**: solo el administrador, comprobado en el servidor (spec 016, RN-08).
- **Móvil**: el selector de quincena y el de fechas caben en 360 px y en el iPhone, sin
  desplazamiento lateral.
- **Accesibilidad**: la pantalla con sus selectores y diálogos pasa la auditoría en claro y oscuro.

## Fuera de alcance

- Cerrar un rango personalizado.
- Otras frecuencias de pago (semanal, mensual).
- Deducciones de ley (salud, pensión), horas extra o auxilio de transporte.
- Pagar desde la app.

## Suposiciones

- Todavía no hay liquidaciones mensuales cerradas de verdad (la app no se ha desplegado), así que el
  cierre por mes se reemplaza por el de quincena sin migrar cierres; los de las pruebas locales se
  descartan.
- El selector de fechas del rango es el mismo del reporte de servicios.
- El método se elige en la pantalla de la liquidación (no es una configuración guardada): por
  defecto «Mes comercial», y la elección viaja en la dirección como el periodo.
- Navegar entre quincenas es como hoy entre meses («‹ Quincena anterior», «Quincena siguiente ›»).

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
| 2026-11-25 | Creación, a pedido del usuario: liquidación quincenal por defecto y por rango de fechas. Decisión del usuario: solo se cierran quincenas; el rango es para consultar y exportar. Queda abierto cómo se calcula el salario base. |
| 2026-11-25 | Decisión del usuario sobre RN-02: el administrador elige el método al liquidar, «Mes comercial» por defecto o «Días reales». Nuevos CA-13 a CA-16 (método); el Excel pasa a CA-17. Sin preguntas abiertas. |
| 2026-11-25 | Aprobada por el usuario. |
