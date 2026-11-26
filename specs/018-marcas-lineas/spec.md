---
id: "018"
titulo: "Administrar marcas y líneas de vehículos"
estado: verificada
creada: 2026-11-24
actualizada: 2026-11-24
---

# 018 — Administrar marcas y líneas de vehículos

## Contexto y problema

Desde la spec 005, la marca y la línea de un vehículo se eligen de un catálogo precargado que crece
solo: si alguien (personal o cliente) escribe una marca o línea que no existe, queda añadida para
todos. El catálogo ya evita los duplicados que solo cambian en mayúsculas, tildes, espacios o
guiones, pero no los errores de escritura: «Suzuky» junto a «Suzuki», «Royal Enfiel», o una
línea puesta bajo la marca equivocada («FZ 2.0» bajo Honda). Hoy nadie puede corregirlos.

Esos errores se ven en las sugerencias que usan todos al registrar un vehículo, en la ficha del
cliente, en las órdenes, en las reservas y en los reportes, y parten en dos lo que es una sola
marca. El administrador necesita revisar lo que se ha ido añadiendo y corregirlo: renombrar,
unir duplicados y pasar una línea a la marca correcta.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Administrador | Ver el catálogo, encontrar lo que la gente añadió y está por revisar, y corregirlo: renombrar, unir, mover líneas, registrar las que falten y dar por revisadas las que están bien. |
| Operador | Nada nuevo: sigue eligiendo y ampliando el catálogo al registrar un vehículo, y ve los nombres corregidos. |
| Cliente | Nada nuevo: sigue eligiendo y ampliando el catálogo al registrar su vehículo. Nunca ve si una marca o línea está por revisar. |

## Historias de usuario

### HU-01 (P1) — Revisar el catálogo

Como administrador, quiero ver las marcas y líneas de cada tipo, cuántos vehículos usan cada una y
cuáles se han añadido al registrar vehículos y están por revisar, para encontrar lo que hay que corregir.

**Criterios de aceptación**

- **CA-01** — Dado un administrador, cuando abre «Administración» → «Marcas y líneas», entonces ve
  las marcas de Motocicleta en orden alfabético, cada una con cuántos vehículos la usan (vigentes y
  retirados), y puede pasar a las de Carro o de Bicicleta. La elección del tipo queda en la
  dirección (sobrevive a recargar y a «atrás»).
- **CA-02** — Dada una marca, cuando el administrador la abre, entonces ve sus líneas en orden
  alfabético, cada una con cuántos vehículos la usan.
- **CA-03** — Dado el catálogo de un tipo, cuando se muestra, entonces cada marca y cada línea
  que alguien escribió al registrar un vehículo y nadie ha revisado lleva la marca «Por revisar»
  con la fecha en que se añadió; las revisadas (las precargadas y las que el administrador
  registró, corrigió o dio por revisadas, RN-07) no llevan marca. Sobre la lista, las
  tarjetas-filtro «Por revisar» y «Revisadas» (estándar del proyecto) cuentan las marcas de ese
  tipo y filtran la lista al pulsarlas. Una marca revisada con alguna línea por revisar aparece
  también con «Por revisar», y dice cuántas líneas lo están.
- **CA-04** — Dado el catálogo, cuando el administrador escribe en el buscador, entonces la lista
  muestra las marcas cuyo nombre o el de alguna de sus líneas contiene lo escrito, sin distinguir
  mayúsculas ni tildes; si nada coincide, lo dice.
- **CA-05** — Dado un operador o un cliente, cuando busca «Marcas y líneas» en su menú o abre su
  dirección, entonces no la encuentra o se le dice que no tiene permiso; y el sistema rechaza
  cualquier cambio del catálogo que intente por su cuenta.
- **CA-06** — Dado un cliente, cuando registra o ve sus vehículos (su área, su perfil, el
  formulario), entonces ve solo los nombres de marca y línea, nunca si están por revisar ni
  cuántos vehículos las usan.

### HU-02 (P1) — Renombrar

Como administrador, quiero corregir el nombre de una marca o línea, para que se vea bien en todas
partes.

**Criterios de aceptación**

- **CA-07** — Dada la marca «Royal Enfiel» con vehículos, cuando el administrador la renombra a
  «Royal Enfield», entonces la lista muestra el nombre nuevo y todos sus vehículos lo muestran:
  en la ficha del cliente, en el área del cliente, en las órdenes (abiertas y cerradas), en las
  reservas y en los reportes; las sugerencias al registrar un vehículo ofrecen «Royal Enfield».
- **CA-08** — Dada una línea, cuando el administrador la renombra, entonces ocurre lo mismo que en
  CA-07 con la línea.
- **CA-09** — Dado un nombre que ya tiene otra marca del mismo tipo (o otra línea de la misma
  marca), comparado como en el catálogo (sin mayúsculas, tildes, espacios ni guiones), cuando el
  administrador intenta renombrar a él, entonces no se guarda y se le dice que ya existe y que, si
  son la misma, las una (HU-03). Cambiar solo cómo se escribe el mismo nombre («Ktm» → «KTM») sí
  se permite.
- **CA-10** — Dado el formulario de renombrar, cuando el nombre queda vacío o pasa de 60
  caracteres, entonces no se guarda y el error se ve junto al campo.
- **CA-11** — Dado un renombre guardado, cuando se completa, entonces se avisa con un aviso
  flotante (spec 013) y la marca o línea queda revisada (RN-07).

### HU-03 (P1) — Unir duplicados

Como administrador, quiero unir una marca o línea repetida con la correcta, para que sus vehículos
queden juntos y la repetida desaparezca.

**Criterios de aceptación**

- **CA-12** — Dada la marca «Suzuky» (Motocicleta) con 2 vehículos, cuando el administrador elige
  unirla con «Suzuki», entonces antes se le pregunta, diciendo cuántos vehículos pasan a «Suzuki» y
  que no se puede deshacer; al confirmar, los 2 vehículos quedan con «Suzuki», «Suzuky» deja de
  estar en la lista y en las sugerencias, y se avisa con un aviso flotante.
- **CA-13** — Dada una marca que se une con otra, cuando tiene líneas, entonces sus líneas pasan a
  la marca que queda; si la que queda ya tiene una línea con el mismo nombre (comparado como en el
  catálogo), las dos se unen en la que ya tenía, con sus vehículos.
- **CA-14** — Dada una línea repetida de una marca («CBR 250» y «CBR250R» de Honda), cuando el
  administrador une una con la otra, entonces sus vehículos pasan a la que queda y la otra
  desaparece, con la misma pregunta previa y el mismo aviso de CA-12.
- **CA-15** — Dada la elección de con qué unir, cuando el administrador busca la marca que queda,
  entonces solo se ofrecen marcas del mismo tipo (y, para una línea, líneas de la misma marca), y
  nunca la misma que se está uniendo.
- **CA-16** — Dada «Suzuky» unida con «Suzuki» (o «Royal Enfiel» renombrada a «Royal Enfield»),
  cuando alguien (personal o cliente) escribe el nombre viejo al registrar o editar un vehículo de
  ese tipo, entonces se le sugiere el que quedó y, si lo envía así, el vehículo queda con él: lo
  unido o renombrado no vuelve a crearse.
- **CA-17** — Dada una unión, cuando se completa, entonces las órdenes, reservas y reportes de los
  vehículos que pasaron muestran la marca o línea que queda, y los totales de los reportes y de la
  liquidación no cambian.

### HU-04 (P2) — Pasar una línea a otra marca

Como administrador, quiero pasar una línea que quedó bajo la marca equivocada a la correcta, con
sus vehículos, para no corregir vehículo por vehículo.

**Criterios de aceptación**

- **CA-18** — Dada la línea «FZ 2.0» bajo Honda (Motocicleta) con 3 vehículos, cuando el
  administrador la pasa a Yamaha, entonces antes se le pregunta, diciendo que 3 vehículos pasan a
  ser Yamaha FZ 2.0; al confirmar, la línea está bajo Yamaha, sus 3 vehículos son Yamaha FZ 2.0 en
  todas partes (como en CA-07) y se avisa con un aviso flotante.
- **CA-19** — Dado que la marca de destino ya tiene una línea con el mismo nombre (comparado como
  en el catálogo), cuando el administrador pasa la línea, entonces las dos se unen en la que ya
  estaba, con sus vehículos, y la pregunta previa lo dice.
- **CA-20** — Dada la elección de la marca de destino, cuando el administrador la busca, entonces
  solo se ofrecen marcas del mismo tipo, distintas de la actual.

### HU-05 (P1) — Un menú que no desborda

Como persona del personal en un escritorio, quiero ver en la barra todas las secciones que caben y
encontrar las demás en un solo lugar, para que añadir «Marcas y líneas» no rompa el encabezado.

**Criterios de aceptación**

- **CA-21** — Dado un administrador en un escritorio, cuando mira la barra, entonces ve Inicio,
  Órdenes, Agenda, Clientes y el menú «Administración ▾», que contiene Servicios, Empleados,
  Reportes, Habeas data, Marcas y líneas y Usuarios, en ese orden. El operador, que no tiene
  «Administración», ve Servicios y Empleados en la barra.
- **CA-25** — Dado un escritorio, cuando las entradas de la barra no caben, entonces se muestran en
  línea, en su orden, las que caben, y las demás pasan, en el mismo orden, a un menú «Más ▾» al
  final de la barra; si pasa «Administración», va dentro de «Más» como una sección con ese título y
  sus secciones. La barra no desborda a ningún ancho de escritorio. «Inicio» está siempre en línea.
- **CA-22** — Dado que todas caben (p. ej. el operador), cuando se muestra la barra, entonces no hay
  menú «Más».
- **CA-23** — Dada una sección que está dentro de «Más» o de «Administración», cuando el usuario
  está en ella, entonces ese menú se marca como la sección actual; al elegir una sección de un
  menú, se va a ella.
- **CA-24** — Dado un cambio de ancho de la ventana, cuando cabe una sección más o una menos,
  entonces pasa de «Más» a la barra o al revés, sin recargar.

### HU-06 (P2) — Registrar lo que falta y dar por revisado lo que está bien

Como administrador, quiero registrar una marca o una línea que aún no está en el catálogo y dar por
revisada una añadida que está bien escrita, para que el catálogo esté completo y «Por revisar» se
vacíe a medida que lo limpio.

**Criterios de aceptación**

- **CA-26** — Dado el catálogo de un tipo, cuando el administrador registra la marca «Voge»,
  entonces aparece en la lista, revisada y sin vehículos, y se ofrece en las sugerencias al
  registrar un vehículo de ese tipo; se avisa con un aviso flotante.
- **CA-27** — Dada una marca, cuando el administrador le registra la línea «525 DSX», entonces
  aparece entre sus líneas, revisada y sin vehículos.
- **CA-28** — Dado un nombre que ya tiene (o recuerda) otra marca del tipo, u otra línea de la
  marca, comparado como en el catálogo, cuando el administrador intenta registrarlo, entonces no
  se guarda y se le dice que ya existe; un nombre vacío o de más de 60 caracteres tampoco (como en
  CA-09 y CA-10).
- **CA-29** — Dada una marca o línea por revisar que está bien escrita, cuando el administrador la
  da por revisada, entonces deja de llevar «Por revisar» y de contar en esa tarjeta.

## Requisitos funcionales

- **RF-01** — Renombrar, unir y pasar líneas se reflejan en todo lugar donde se muestra la marca o
  la línea de un vehículo: sugerencias, formulario y listas de vehículos, ficha del cliente, área
  del cliente, órdenes, reservas, reportes y sus archivos de Excel.
- **RF-02** — El catálogo sabe si cada marca y línea está revisada o por revisar, y cuándo se
  añadió. *Enmendado por la spec 024:* cada línea de moto tiene su categoría, que el administrador
  elige en «Marcas y líneas» (y la deja revisada).
- **RF-03** — El catálogo recuerda los nombres unidos y los nombres anteriores a un renombre de
  cada marca y línea, para resolverlos como la que quedó (CA-16).
- **RF-04** — «Marcas y líneas» es una sección del menú principal del administrador, en
  «Administración ▾» después de «Habeas data» y antes de «Usuarios» (CA-21); en el teléfono, en el
  panel «Menú»; y como mosaico de su inicio.
- **RF-05** — «Administración ▾» (spec 017) gana «Servicios» y «Empleados» para el administrador
  (catálogos que cambian poco), y la barra suma «Más ▾» para lo que no quepa según el ancho (HU-05).

## Reglas de negocio

- **RN-01** — Solo el administrador renombra, une y pasa líneas. Se comprueba en el servidor, no
  solo ocultando la pantalla.
- **RN-02** — Después de cualquier cambio sigue sin haber dos marcas iguales en un tipo ni dos
  líneas iguales en una marca, comparadas como en el catálogo (spec 005, RN-06).
- **RN-03** — Unir y pasar una línea no se deshacen; por eso se pregunta antes, con el número de
  vehículos afectados.
- **RN-04** — No se borra nada del catálogo: la marca o línea que se une con otra desaparece de la
  lista, pero sus vehículos siguen, con la que queda.
- **RN-05** — Una marca no cambia de tipo; se une solo con marcas de su tipo, y una línea se pasa
  solo a marcas del tipo de la suya.
- **RN-06** — Si una marca o línea está por revisar (con su fecha) y el número de vehículos solo los
  ve el administrador.
- **RN-07** — Está revisado lo que vino en la carga inicial del catálogo y lo que el administrador
  registra, renombra, da por revisado o deja como la que queda al unir o pasar una línea. Lo que
  la gente escribe al registrar un vehículo (spec 005) entra por revisar. Al unir marcas, las
  líneas que pasan conservan su estado.

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Marca | tipo, nombre, revisada o por revisar, fecha en que se añadió | Única por tipo (spec 005, RN-06). |
| Línea | marca, nombre, revisada o por revisar, fecha en que se añadió | Única por marca. Puede pasar a otra marca del mismo tipo (HU-04). |
| Nombre recordado | marca o línea que quedó, nombre unido o anterior a un renombre | Para que lo unido o renombrado no vuelva a crearse (CA-16). |

## Requisitos no funcionales

- **Accesibilidad**: la pantalla y sus diálogos (renombrar, unir, pasar línea) cumplen WCAG 2.1 AA y
  entran en la auditoría automática, también con los errores a la vista y en modo oscuro.
- **Móvil**: se usa también desde el teléfono, sin desplazamiento lateral (360 px e iPhone). En el
  teléfono el menú sigue siendo el panel «Menú» con todas las secciones (spec 009).
- **Coherencia**: una unión o un paso de línea es todo o nada: si algo falla, nada cambia.

## Fuera de alcance

- Borrar marcas o líneas (decisión del usuario: no se borra nada).
- Que los clientes dejen de ampliar el catálogo: siguen pudiendo (spec 005, RF-05).
- Deshacer una unión o un paso de línea.
- Cambiar el tipo de una marca o añadir tipos de vehículo.
- Detectar solas las marcas parecidas («Suzuky» y «Suzuki»): el administrador las encuentra con el
  filtro «Por revisar» y el buscador.
- Un historial de quién renombró o unió qué.
- Los colores y los municipios, que son listas fijas (spec 005).

## Suposiciones

- Solo el administrador tiene la pantalla. El operador no la necesita, porque no puede corregir: la
  marca «Por revisar» es solo para el administrador (RN-06) y nunca la ve un cliente (CA-06).
- Lo que había en el catálogo antes de esta spec y no vino en la carga inicial entra por revisar,
  con la fecha en que se añadió.
- Una marca o línea revisada no vuelve a «Por revisar»: lo que la gente escriba después y coincida
  con ella (o con un nombre recordado) la reutiliza, como hoy.
- Al unir, se conserva el nombre de la que queda tal como está; si hace falta, se renombra antes o
  después.
- El número de vehículos cuenta los vigentes y los retirados (los retirados siguen en el historial).
- Un renombre también se recuerda (CA-16): quien tenga en su navegador la lista de antes y elija el
  nombre viejo queda con el nuevo, en vez de volver a crearlo.
- El orden del menú (spec 009) es el de prioridad: lo que no cabe sale por el final. Con las
  entradas de hoy, la barra del administrador y la del operador caben desde 1024 px: «Más» queda
  para cuando lleguen secciones nuevas o el texto crezca.

## Preguntas abiertas

Ninguna.

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes.
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba.
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar (revisar, renombrar y unir).

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-24 | Creación. Decisiones del usuario: solo el administrador corrige el catálogo; no se borra nada; una línea se puede pasar a otra marca con sus vehículos; la lista distingue las añadidas de las precargadas, y eso nunca lo ve un cliente. |
| 2026-11-24 | Aprobada por el usuario, con el operador sin la pantalla y con «lo unido no vuelve» (CA-16). |
| 2026-11-24 | Ajustes del usuario al planificar: los renombres también se recuerdan (CA-16, RF-03); «Administración ▾» se mantiene y gana «Servicios» y «Empleados» para el administrador, y la barra suma «Más ▾» según el ancho (HU-05, RF-04, RF-05). |
| 2026-11-24 | Plan aprobado: estado `planificada`. |
| 2026-11-24 | Durante la implementación, a petición del usuario: la fila entera de una marca la despliega; el administrador registra marcas y líneas y da por revisadas las añadidas (HU-06, CA-26 a CA-29); las tarjetas pasan a «Por revisar» / «Revisadas» y renombrar, unir o pasar deja revisada la que queda (RN-07). |
| 2026-11-24 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-24 | Implementada: estado `implementada`. Las tarjetas-filtro del proyecto atenúan sin opacidad (la etiqueta bajaba de AA con una tarjeta elegida). |
| 2026-11-24 | Verificada. Correcciones aprobadas por el usuario: E2E de punta a punta de las sugerencias con un nombre unido (CA-16); pgTAP de reservas e historial del cliente tras renombrar (CA-07, RF-01); E2E del cliente en «Marcas y líneas» (CA-05); historias en orden. |
| 2026-11-26 | Enmienda de la spec 024: la categoría de cada línea de moto, en la lista y en su menú («Categoría»). |
