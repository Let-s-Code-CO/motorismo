---
id: "005"
titulo: "Vehículos de los clientes"
estado: verificada
creada: 2026-11-19
actualizada: 2026-11-19
---

# 005 — Vehículos de los clientes

## Contexto y problema

El negocio atiende motocicletas, bicicletas y carros, y hoy de cada cliente solo conoce su nombre
y su contacto (spec 004). Lo que llega al punto de atención es un **vehículo**: el personal
necesita saber de quién es, qué es (tipo, marca, línea, color y, según el tipo, cilindraje o
clase) y reconocerlo por su **placa**.
Sin eso no se pueden registrar después las órdenes de trabajo ni el historial de lavadas.

Un cliente puede tener varios vehículos. Escribir la marca y la línea a mano produce variantes
(«Suzuki», «suzuky», «SUZUKI») que impiden buscar y reportar; por eso se eligen de un catálogo
que ya viene cargado con las marcas y líneas más comunes en Colombia y que crece solo cuando
aparece una de verdad nueva.

La placa es un dato personal (constitución, VI): cada cliente ve solo las suyas.

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Operador | Registrar, corregir y retirar los vehículos de cualquier cliente; encontrar a un cliente por la placa del vehículo que llega. |
| Administrador | Lo mismo que el operador. |
| Cliente con cuenta | Registrar y mantener sus propios vehículos desde «Mi perfil». No ve los de nadie más. |

## Historias de usuario

### HU-01 (P1) — Registrar los vehículos de un cliente

Como operador o administrador, quiero registrar uno o varios vehículos en la ficha de un cliente,
para saber qué vehículos trae y reconocerlos por su placa.

**Criterios de aceptación**

- **CA-01** — Dado un miembro del personal en la ficha de un cliente (spec 004), cuando la abre,
  entonces ve la sección «Vehículos» con los vehículos del cliente (tipo —o la clase, si es un
  carro o una bicicleta—, marca, línea, cilindraje si es una motocicleta, color y placa) o, si no tiene, «Este cliente aún no tiene vehículos.», y la opción «Agregar vehículo».
- **CA-02** — Dado un miembro del personal que elige «Agregar vehículo», cuando se abre el
  formulario, entonces ve tipo (Motocicleta, Bicicleta o Carro), con **Motocicleta** ya elegido,
  marca, línea, cilindraje, color y placa. El cilindraje solo aparece para Motocicleta; al elegir
  Carro aparecen la clase Automóvil o Camioneta y la ciudad de la placa (CA-30), y al elegir
  Bicicleta, Montaña o Ruta.
- **CA-03** — Dado un miembro del personal, cuando registra una motocicleta con marca, línea,
  cilindraje (por ejemplo, 600), color y una placa válida (RN-03), entonces el vehículo aparece en
  la sección «Vehículos» del cliente con el cilindraje como «600 cc» y la placa en mayúsculas,
  dibujada como una placa de moto (CA-27) y leída con guion (por ejemplo, `uih03d` se lee
  `UIH-03D` y `jwj 07`, `JWJ-07`).
- **CA-04** — Dado un cliente que ya tiene un vehículo, cuando el personal le registra otro,
  entonces el cliente queda con los dos, del más reciente al más antiguo.
- **CA-05** — Dado el tipo Carro, cuando se registra como Automóvil o como Camioneta con una placa
  de tres letras y tres números (`ABC123`), entonces se guarda como `ABC-123` y se ve con su clase; y una placa con formato de moto (`ABC12D`) se
  rechaza para un carro, y una de carro (`ABC123`) para una moto.
- **CA-06** — Dado el tipo Bicicleta, cuando se registra como Montaña o como Ruta, entonces no
  aparecen la placa ni el cilindraje, la línea es opcional y la bicicleta se registra sin placa y
  se ve con su clase.
- **CA-07** — Dado un miembro del personal, cuando envía el formulario sin marca, sin color, sin
  línea (en moto o carro), sin placa (en moto o carro), sin clase (en carro o bicicleta), sin
  ciudad de la placa (en carro), con un cilindraje fuera de RN-09 o con una placa que no cumple el
  formato de su tipo, entonces ve el error junto a cada campo y no se registra el vehículo.
- **CA-08** — Dada una placa que ya tiene un vehículo vigente (no retirado, HU-05) de cualquier
  cliente, cuando alguien registra otro vehículo con ella, escrita de cualquier forma
  (`uih-03d`, `UIH 03D`), entonces no se guarda y ve «Ya hay un vehículo registrado con esta
  placa.», sin que se revele de qué cliente es.
- **CA-09** — Dado el formulario con una marca o línea elegidas, cuando se cambia el tipo,
  entonces la marca y la línea se vacían (las de un tipo no sirven para otro) y el vehículo no
  guarda el cilindraje, la clase ni la ciudad de la placa que no corresponden a su tipo; y cuando
  se cambia la marca, la línea se vacía.

### HU-02 (P1) — Marcas y líneas de un catálogo que crece solo

Como persona que registra un vehículo, quiero elegir la marca y la línea de una lista que se
filtra mientras escribo, para no escribirlas de nuevo cada vez ni crear variantes del mismo
nombre.

**Criterios de aceptación**

- **CA-10** — Dado el tipo Motocicleta, cuando se escribe «suz» en la marca, entonces aparece
  «Suzuki» entre las sugerencias; y con Suzuki elegida, al escribir «gsx» en la línea aparece
  «GSX-R600». Solo se sugieren marcas del tipo elegido y líneas de la marca elegida en ese tipo.
- **CA-11** — Dado cualquier tipo, cuando se abre la lista de marcas sin escribir nada, entonces
  ya trae precargadas las marcas más comunes en Colombia para ese tipo, y las principales de ellas
  traen sus líneas más comunes (RF-03).
- **CA-12** — Dado que se escribe una marca o línea, cuando la búsqueda no distingue mayúsculas,
  tildes, espacios ni guiones, entonces «gsxr 600», «GSX R600» y «gsx-r600» encuentran «GSX-R600».
- **CA-13** — Dada una marca o línea que no existe en el catálogo, cuando se escribe y se registra
  el vehículo, entonces el vehículo se guarda con ella y, desde ese momento, aparece como
  sugerencia para cualquiera que registre un vehículo de ese tipo (o de esa marca, si es una
  línea).
- **CA-14** — Dada una marca o línea que ya existe en el catálogo, cuando alguien la escribe con
  otras mayúsculas, tildes, espacios o guiones y registra el vehículo, entonces no se crea una
  nueva: el vehículo queda con la que ya existía, escrita como en el catálogo.

### HU-03 (P1) — Colores

Como persona que registra un vehículo, quiero elegir su color de una lista, para describirlo de la
misma forma siempre.

**Criterios de aceptación**

- **CA-15** — Dado el formulario de vehículo, cuando se abre el selector de color, entonces se ve
  cada color de RN-05 con su nombre y una muestra del color, y la opción «Multicolor».
- **CA-16** — Dado un vehículo registrado, cuando se ve en la lista, entonces su color se muestra
  con el nombre y la muestra (o una muestra de varios colores para «Multicolor»); el color nunca se
  comunica solo con la muestra.

### HU-04 (P2) — Encontrar al cliente por la placa

Como operador o administrador, quiero buscar por la placa del vehículo que llega, para encontrar
al cliente sin preguntarle su nombre.

**Criterios de aceptación**

- **CA-17** — Dado un miembro del personal en «Clientes» (spec 004), cuando escribe una placa
  completa o parte de ella, con o sin guion y en mayúsculas o minúsculas (`uih03`, `UIH-03`),
  entonces la lista muestra el cliente dueño de ese vehículo, junto con las búsquedas por nombre,
  correo y celular que ya existían.
- **CA-18** — Dado un vehículo retirado (HU-05), cuando se busca su placa, entonces su antiguo
  dueño no aparece por ella.
- **CA-19** — Dado un miembro del personal que encuentra a un cliente por placa, cuando mira la
  fila del resultado, entonces ve la placa que coincidió.

### HU-05 (P2) — Corregir y retirar vehículos

Como operador o administrador, quiero corregir los datos de un vehículo o retirarlo cuando ya no
es del cliente o se registró por error, para que la ficha refleje los vehículos actuales sin
perder el historial.

**Criterios de aceptación**

- **CA-20** — Dado un vehículo en la ficha de un cliente, cuando el personal cambia su tipo,
  clase, marca, línea, cilindraje, color, placa o ciudad de la placa con datos válidos y guarda, entonces el vehículo se ve con los datos
  nuevos; con datos inválidos o una placa de otro vehículo vigente se aplican CA-07 y CA-08.
- **CA-21** — Dado un vehículo, cuando el personal lo retira y confirma, entonces deja de verse
  entre los vehículos del cliente, pasa a «Vehículos retirados» de la ficha con su fecha de
  retiro, y su placa queda libre para registrarla en otro (o en el mismo) cliente.
- **CA-22** — Dado un vehículo retirado, cuando se mira en «Vehículos retirados», entonces no se
  puede editar ni volver a poner vigente (si vuelve, se registra de nuevo).

### HU-06 (P2) — Mis vehículos

Como cliente con cuenta, quiero registrar y mantener mis vehículos desde «Mi perfil», para que
el negocio ya los tenga cuando llegue.

**Criterios de aceptación**

- **CA-23** — Dado un cliente con sesión en «Mi perfil», cuando lo abre, entonces ve «Mis
  vehículos» con sus vehículos vigentes (o «Aún no tienes vehículos.») y la opción «Agregar
  vehículo», con el mismo formulario y las mismas reglas de HU-01 a HU-03.
- **CA-24** — Dado un cliente, cuando registra, corrige o retira uno de sus vehículos, entonces el
  personal ve el cambio en su ficha; un vehículo que el cliente retira no se le vuelve a mostrar.
- **CA-25** — Dado un cliente, cuando registra una placa que ya tiene un vehículo vigente de otra
  persona, entonces ve «Ya hay un vehículo registrado con esta placa. Si es tuyo, acércate al
  punto de atención.» y no se guarda (no se revela de quién es).
- **CA-26** — Dado un cliente, cuando intenta leer, crear, cambiar o retirar vehículos de otro
  cliente, o pasar uno suyo a otro cliente, por cualquier vía distinta de la interfaz (por
  ejemplo, peticiones directas con su sesión), entonces el sistema lo rechaza y no entrega ni
  cambia ningún dato.

### HU-07 (P2) — La placa como se ve en la calle

Como persona que reconoce los vehículos que llegan, quiero ver la placa dibujada como una placa
colombiana, con la ciudad donde se expidió en los carros, para identificar el vehículo de un
vistazo, igual que en la calle.

**Criterios de aceptación**

- **CA-27** — Dado un vehículo con placa en «Vehículos» (ficha del cliente) o en «Mis vehículos»,
  cuando se ve, entonces la placa se dibuja como una placa colombiana de servicio particular:
  fondo amarillo, caracteres negros en mayúsculas y un filete negro junto al borde. Carro y moto se
  ven igual: los caracteres en una fila, con guion (`ABC-123`, `UIH-03D`, `JWJ-07`), y debajo la
  ciudad de expedición en la de carro (`BOGOTÁ, D.C.`) o «COLOMBIA» en la de moto.
- **CA-28** — Dada una placa dibujada, cuando se recorre con un lector de pantalla, entonces se
  oye como texto con guion (`UIH-03D`) y, en un carro, también su ciudad; la placa nunca se
  comunica solo con el dibujo, y sus caracteres cumplen el contraste de la auditoría del proyecto.
- **CA-29** — Dado un cliente encontrado por placa en «Clientes» (CA-19), cuando se mira la fila,
  entonces la placa que coincidió se ve con los mismos colores, en una sola línea (`UIH-03D`) y
  sin ciudad ni «COLOMBIA», para que quepa en la fila.
- **CA-30** — Dado el formulario de vehículo, cuando el tipo es Carro, entonces aparece «Ciudad de
  la placa» con «Bogotá, D.C.» ya elegida (al editar, la que tiene el carro); al abrir la lista,
  las tres primeras opciones son Bogotá, D.C., La Calera y Funza, y después el resto de municipios
  de Colombia en orden alfabético; al escribir se filtra sin distinguir mayúsculas ni tildes
  («medellin» encuentra «Medellín»), y un municipio cuyo nombre se repite en otro departamento se
  distingue por su departamento. La lista muestra como máximo 50 ciudades a la vez (las tres
  fijadas primero, y la ciudad elegida siempre entre ellas) y, si hay más, «Escribe para ver más
  ciudades.»; escribiendo se encuentra cualquiera de las 1.104. Con Motocicleta o Bicicleta el
  campo no aparece.
- **CA-31** — Dado un carro, cuando se registra o se corrige con una ciudad que no está en la
  lista (RF-07), entonces no se guarda y se ve el error junto al campo; y una motocicleta o una
  bicicleta nunca se guardan con ciudad de la placa, por ninguna vía.

## Requisitos funcionales

- **RF-01** — Un vehículo pertenece a un solo cliente (con o sin cuenta). Un cliente puede tener
  cero o más vehículos.
- **RF-02** — El tipo de vehículo es uno de: Motocicleta, Bicicleta o Carro. Un carro es además de
  una clase, Automóvil o Camioneta, y una bicicleta, Montaña o Ruta. Estas listas son fijas en
  esta versión.
- **RF-03** — El catálogo se entrega precargado con, como mínimo, las marcas más vendidas en
  Colombia de cada tipo y las líneas más comunes de las marcas principales de motocicleta y carro
  (por ejemplo, Suzuki → GSX-R600). La lista concreta y su fuente quedan en el plan.
- **RF-04** — El catálogo de marcas es por tipo (una marca como Suzuki puede estar en Motocicleta
  y en Carro) y el de líneas es por marca dentro de un tipo.
- **RF-05** — Cualquier persona que puede registrar un vehículo (personal o cliente) amplía el
  catálogo con una marca o línea nueva al registrarlo (CA-13).
- **RF-06** — En la ficha del cliente, el personal ve los vehículos vigentes y, aparte, los
  retirados con su fecha de retiro.
- **RF-07** — La lista de municipios de Colombia para la ciudad de la placa se entrega precargada
  con los nombres oficiales (fuente en el plan) y es fija en esta versión: a diferencia de las
  marcas y líneas, nadie la amplía al registrar un vehículo.

## Reglas de negocio

- **RN-01** — Solo el personal (operador y administrador) gestiona los vehículos de cualquier
  cliente; un cliente con cuenta gestiona solo los suyos. Nadie pasa un vehículo de un cliente a
  otro: se retira y se registra en el nuevo dueño.
- **RN-02** — Motocicletas y carros llevan placa; las bicicletas no.
- **RN-03** — Formatos de placa colombiana (se aceptan minúsculas, espacios y guiones, y se
  guarda en mayúsculas y sin separadores; se lee con un guion tras las tres letras y se dibuja
  como en CA-27):
  - Motocicleta: tres letras, dos números y una letra (`UIH03D` → `UIH-03D`), o tres letras y dos
    números en las placas antiguas (`JWJ07` → `JWJ-07`).
  - Carro: tres letras y tres números (`ABC123` → `ABC-123`).
- **RN-04** — Una placa identifica a un solo vehículo vigente en toda la app. Los retirados no
  cuentan.
- **RN-05** — Colores disponibles: Negro, Blanco, Gris, Plata, Rojo, Vinotinto, Azul, Verde,
  Amarillo, Naranja, Café, Beige, Dorado, Morado, Rosado y Multicolor. Cada vehículo tiene uno.
- **RN-06** — Una marca o línea es la misma si su nombre coincide sin distinguir mayúsculas,
  tildes, espacios ni guiones; el catálogo no admite duplicados así.
- **RN-07** — Los vehículos no se borran: se retiran, para conservar su relación con el historial
  de servicios futuro. Un retiro no se deshace.
- **RN-08** — Los mensajes de placa repetida no revelan a qué cliente pertenece el vehículo.
- **RN-09** — El cilindraje solo aplica a las motocicletas: es opcional y, si se da, es un número
  entero de centímetros cúbicos entre 50 y 2.500. Se muestra como «600 cc».
- **RN-10** — La clase aplica a carros (Automóvil o Camioneta) y bicicletas (Montaña o Ruta), y en
  ellos es obligatoria; las motocicletas no tienen clase. El catálogo de marcas y líneas es por
  tipo, el mismo para todas sus clases.
- **RN-11** — La ciudad de expedición de la placa solo aplica a los carros, y en ellos es
  obligatoria: es un municipio de Colombia de la lista de RF-07, y por defecto Bogotá, D.C. Las
  motocicletas no tienen ciudad (su placa muestra siempre «COLOMBIA») y las bicicletas no tienen
  placa.

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Vehículo | cliente, tipo, clase (carro o bicicleta), marca, línea, cilindraje (moto), color, placa, ciudad de la placa (carro), fecha de registro, fecha de retiro | Vigente si no tiene fecha de retiro. Placa única entre los vigentes. |
| Marca | tipo, nombre | Precargada o añadida al registrar un vehículo. Única por tipo (RN-06). |
| Línea | marca, nombre | Precargada o añadida al registrar un vehículo. Única por marca (RN-06). |
| Municipio | departamento, nombre | Precargado con los nombres oficiales y fijo (RF-07). |

## Requisitos no funcionales

- **Privacidad**: la placa es un dato personal; el personal ve las de todos los clientes y cada
  cliente solo las suyas. Los catálogos de marcas y líneas no son datos personales y los ve
  cualquiera con sesión.
- **Accesibilidad**: el formulario se completa solo con teclado (incluidas las sugerencias de
  marca y línea y el selector de color), los errores se asocian a su campo y las pantallas pasan
  la auditoría automática del proyecto.
- **Dispositivos**: «Mis vehículos» se piensa primero para el móvil; la ficha del cliente es usable
  en el computador del punto de atención y en un móvil.
- **Rendimiento**: las sugerencias de marca y línea y la búsqueda por placa responden en menos de
  un segundo.

## Fuera de alcance

- Administrar el catálogo (renombrar, unir duplicados o borrar marcas y líneas) y añadir tipos de
  vehículo.
- Año, número de motor o de chasis, serial de la bicicleta y fotos del vehículo.
- Pasar un vehículo de un cliente a otro conservando su historial (se retira y se registra de
  nuevo).
- Deshacer un retiro.
- Validar la placa contra el RUNT u otra fuente oficial.
- Placas especiales (diplomáticas, de remolque, de motocarro u otros formatos distintos de RN-03).
- Dibujar placas de otros servicios (público en blanco, oficial, diplomático): toda placa se dibuja
  como de servicio particular, en amarillo.
- La ciudad de expedición de las motocicletas, y buscar o filtrar clientes por la ciudad de la
  placa.
- Total de lavadas y últimas lavadas del cliente (llegan con la orden de trabajo).
- Mostrar los vehículos en la lista de clientes salvo la placa que coincide en una búsqueda
  (CA-19).

## Suposiciones

- La **línea** es obligatoria en motocicleta y carro, y opcional en bicicleta (muchas no la
  tienen a la vista).
- El **cilindraje** es opcional (RN-09): las motos eléctricas no tienen y no siempre se conoce.
  No se deduce de la línea (una GSX-R600 no rellena 600 sola).
- La **clase** no viene preseleccionada: se elige siempre, para no registrar una camioneta como
  automóvil (o una de ruta como de montaña) por descuido.
- Otras bicicletas (urbanas, BMX, eléctricas) se registran con la clase más cercana; ampliar la
  lista queda para más adelante.
- Los nombres nuevos se guardan en el catálogo tal como se escribieron, sin espacios al principio
  ni al final y con los espacios internos reducidos a uno; la primera forma escrita es la que
  verán los demás.
- Los vehículos de un **cliente desactivado** (spec 004) se ven en su ficha pero no se agregan,
  editan ni retiran hasta que se reactive.
- Los vehículos de un cliente sin cuenta los gestiona solo el personal; si luego crea su cuenta y
  se une a su ficha (spec 004, CA-28), los ve en «Mis vehículos».
- La lista de colores de RN-05 cubre los casos habituales; un color no listado se aproxima al más
  cercano o se usa «Multicolor».
- La lista de la **ciudad de la placa** trae todos los municipios de Colombia de la división
  oficial del DANE (incluido Bogotá, D.C.), no solo los que tienen organismo de tránsito: es una
  fuente oficial y completa, y ninguna placa real queda fuera (las «áreas no municipalizadas» no
  son municipios y quedan fuera). Los nombres conservan la ortografía y las tildes de esa fuente;
  en la lista van con mayúsculas iniciales («Bogotá, D.C.», «La Calera») y en la placa dibujada,
  en mayúsculas.
- Los carros registrados antes de este cambio (solo existen en local: aún no hay despliegue)
  quedan con Bogotá, D.C. como ciudad de la placa.
- El amarillo de la placa es la única excepción a la paleta neutra del sistema visual (spec 003):
  reproduce un objeto real y no comunica un estado.

## Cambios que esta spec introduce en otras specs

- **Spec 004, CA-16**: la búsqueda de «Clientes» encuentra también por la placa de un vehículo
  vigente (CA-17 a CA-19 de esta spec).
- **Spec 004, HU-03**: «Mi perfil» incluye «Mis vehículos» (HU-06 de esta spec).

## Preguntas abiertas

Ninguna. Decisiones tomadas con el usuario el 2026-11-19: el personal gestiona los vehículos de
cualquier cliente y el cliente los suyos desde «Mi perfil»; la placa se valida por tipo (moto
`ABC12D` o `ABC12`, carro `ABC123`, bicicleta sin placa); la marca y la línea se eligen de un
catálogo precargado que sugiere mientras se escribe y, si de verdad son nuevas, se añaden solas
para próximas veces; un vehículo que deja de ser del cliente se retira, no se borra, y su placa
queda libre.

Cambio del 2026-11-19 (HU-07), decidido con el usuario: la placa se dibuja como la colombiana; la
ciudad de expedición solo la tienen los carros, es obligatoria y se elige de la lista de
municipios con Bogotá, D.C. por defecto y el orden Bogotá, D.C., La Calera, Funza y luego
alfabético; las motos no tienen el campo (ni en el formulario) y su placa dice «COLOMBIA».

## Checklist de calidad de la spec

- [x] No menciona tecnologías, librerías, tablas ni componentes.
- [x] Cada historia tiene prioridad y criterios Dado/Cuando/Entonces con ID.
- [x] Cada criterio es verificable por una prueba.
- [x] No quedan marcas `[NECESITA ACLARACIÓN]`.
- [x] El alcance (y lo que queda fuera) está explícito.
- [x] La P1 sola aporta valor y se puede desplegar (HU-01 a HU-03: el personal registra los
      vehículos de un cliente con catálogo y colores, y los ve en su ficha).

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Creación (borrador). |
| 2026-11-19 | Se añaden, a petición del usuario, el cilindraje de las motocicletas (RN-09), la clase de los carros (Automóvil o Camioneta) y la de las bicicletas (Montaña o Ruta) (RF-02, RN-10). |
| 2026-11-19 | Aprobada por el usuario, con las suposiciones tal como están. |
| 2026-11-19 | Plan técnico aprobado. |
| 2026-11-19 | Implementada (bloques A y B) y verificada en local: 229 pgTAP (89 nuevas), 418 unitarias, 30 sandbox y 60 E2E en verde, lint, tipos y build en verde. Cada prueba nueva se vio fallar, escrita antes que el código o por mutación (ver el Historial del plan). Pendiente: el despliegue (T064). |
| 2026-11-19 | `/verificar`: 23 de 26 criterios ✅ al empezar. Corregidos: CA-07 (el formulario muestra junto a su campo los errores de clase y de cilindraje) y RF-05 (un cliente también amplía el catálogo), con pruebas vistas fallar por mutación. Se precisa la suposición de los nombres nuevos (los espacios internos se reducen a uno). Todo ✅: verificada en local. Pendiente: el despliegue (T064). |
| 2026-11-19 | Cambio en borrador, a petición del usuario: HU-07 (P2), la placa dibujada como la colombiana y la ciudad de expedición de los carros (CA-27 a CA-31, RF-07, RN-11); se ajustan CA-02, CA-03, CA-07, CA-09, CA-20 y RN-03. Vuelve a `borrador` hasta que se apruebe. |
| 2026-11-19 | Cambio HU-07 aprobado por el usuario, con las suposiciones tal como están. |
| 2026-11-19 | Plan del cambio HU-07 aprobado. |
| 2026-11-19 | Tareas del cambio HU-07 (bloque C, T070–T091) aprobadas. |
| 2026-11-19 | CA-27, a petición del usuario durante la implementación: la placa de moto se dibuja igual que la de carro (una fila con guion), con «COLOMBIA» debajo, en lugar de dos filas. |
| 2026-11-19 | Cambio HU-07 implementado en local: 262 pgTAP, 462 unitarias, 30 sandbox y 69 E2E en verde; lint, tipos y build en verde. Pendiente: `/verificar` del bloque C y el despliegue (T064). |
| 2026-11-19 | `/verificar` del bloque C: CA-27 a CA-31, RF-07, RN-11 y los criterios ajustados ✅. Se precisa CA-30 (como máximo 50 ciudades a la vez, con «Escribe para ver más ciudades.») y se alinean plan y tareas con el código (`plate_city_code`, lista sin virtualizar). Verificada en local. Pendiente: el despliegue (T064). |
| 2026-11-24 | Spec 018: el catálogo de marcas y líneas ya se administra (renombrar, unir, pasar líneas, registrar y revisar); lo que se escribe al registrar un vehículo entra «Por revisar», y un nombre unido o renombrado lleva a la marca o línea que quedó. |
