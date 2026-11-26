---
id: "023"
titulo: "Placa según la norma colombiana"
estado: implementada
creada: 2026-11-25
actualizada: 2026-11-25
---

# 023 — Placa según la norma colombiana

## Contexto y problema

La app dibuja la placa de los vehículos como una placa colombiana (spec 005, HU-07), pero con
tamaños elegidos a ojo. El ancho cambia con las letras (la spec 022 lo fijó de forma provisional),
los caracteres son de una letra cualquiera, y la ciudad de la placa se elige entre los 1.104
municipios, aunque solo los que tienen organismo de tránsito expiden placas. Un nombre largo se
achica o se corta, cuando en la placa real se abrevia.

El negocio reconoce los vehículos por su placa: el dibujo debe parecerse a la placa real, con las
proporciones de la norma del Ministerio de Transporte, no con medidas inventadas.

## Fuentes de la norma

- Ficha técnica MT 001 «Placa Única Nacional» (Ministerio de Transporte), en la copia publicada por
  el Instituto de Tránsito de Boyacá: medidas de la placa, marco, leyendas, colores y relieve.
- Resolución 4923 de 1994, transcrita en el concepto del Ministerio 20251341014701 (2025): caracteres
  y leyenda de la placa de moto.
- Resolución 3257 de 2018, Anexos 1 y 2 (hoy Anexos 49 y 50 de la Resolución 20223040045295 de 2022):
  planos con cotas de las placas de antiguos y clásicos, de la misma caja que la placa normal, con el
  dibujo de cada letra y número. De ellos salen, por analogía, las medidas que la ficha MT 001 no
  publica (caracteres de carro, separaciones, marco, leyenda de la ciudad).
- Listado de organismos de tránsito del RUNT (297 sedes).

## Usuarios y roles

| Rol | Qué necesita de esta funcionalidad |
|---|---|
| Personal y clientes | Reconocer un vehículo por su placa, dibujada como la real. |
| Administrador | Ajustar cómo se escribe en la placa el nombre de un municipio largo. |

## Historias de usuario

### HU-01 (P1) — La placa con las medidas de la norma

Como persona que reconoce los vehículos, quiero ver la placa con las proporciones de la placa
real, para identificarla de un vistazo.

**Criterios de aceptación**

- **CA-01** — Dada la placa de un carro, cuando se dibuja, entonces guarda las proporciones de la
  placa de 330 × 160 mm (RN-01): caracteres de 80 de alto por 40 de ancho con trazo de 10, separados
  8; entre las letras y los números, un hueco de 26 con un círculo pequeño en relieve (RN-03);
  debajo, la leyenda de la ciudad con letras de 22 de alto por 12 de ancho, separadas 5; un marco
  negro de unos 4 mm a unos 4 mm del borde y esquinas redondeadas (R12).
- **CA-02** — Dada la placa de una moto, cuando se dibuja, entonces guarda las proporciones de la
  placa de 235 × 105 mm (RN-01): caracteres de 54 de alto por 28 de ancho con trazo de 7, separados 5;
  el hueco de 26 con su círculo entre las letras y los números; debajo, «COLOMBIA» con letras de
  10,5 de alto por 5 de ancho, separadas 5; y su marco y esquinas según el plano.
- **CA-03** — Dadas dos placas del mismo tipo con letras distintas (UIH-03D y WMW-88W), cuando se ven
  juntas, entonces miden exactamente lo mismo: el ancho lo fija la norma, no el texto.
- **CA-04** — Dados los caracteres de una placa, cuando se dibujan, entonces cada letra y número es
  el dibujado en los planos de la norma (trazo uniforme, la O distinta del 0), no una tipografía
  cualquiera (RN-02).
- **CA-05** — Dada una placa, entonces sus colores son los de la norma: fondo amarillo (Pantone 124 C)
  y caracteres, círculo y marco negros, en claro y en oscuro (es un objeto, no cambia con el tema), y
  conserva el acabado metálico y el destello de la spec 019.
- **CA-06** — Dada una placa, cuando se recorre con un lector de pantalla, entonces se oye como hoy
  («UIH-03D» y, en un carro, su ciudad); el círculo y «COLOMBIA» son decoración y no se leen.

### HU-02 (P1) — Solo ciudades que expiden placas

Como persona que registra un carro, quiero elegir la ciudad de la placa solo entre las que la
expiden, para no registrar una ciudad imposible.

**Criterios de aceptación**

- **CA-07** — Dado el formulario de un carro, cuando se abre «Ciudad de la placa», entonces solo
  ofrece los municipios con organismo de tránsito (RN-04), con el mismo orden de hoy (Bogotá, D.C. por
  defecto y primero, spec 005, CA-30) y la misma búsqueda.
- **CA-08** — Dado un carro ya registrado con una ciudad que no tiene organismo de tránsito, cuando se
  ve, entonces su placa sigue mostrando esa ciudad; cuando se corrige, entonces hay que elegir una de
  la lista.

### HU-03 (P2) — Leyenda de la ciudad en la placa

Como administrador, quiero indicar cómo se escribe en la placa el nombre de un municipio largo, para
que se vea como en la calle.

**Criterios de aceptación**

- **CA-09** — Dado un municipio sin leyenda propia (como todos al empezar), cuando su placa se dibuja,
  entonces muestra su nombre completo en mayúsculas y sin tildes («BOGOTA, D.C.», RN-05); si no cabe
  en el ancho de la leyenda,
  su letra se reduce lo justo para que quepa entero, sin cortarlo.
- **CA-10** — Dado un administrador, cuando le pone a un municipio una leyenda para la placa (p. ej.
  «STFE DE BOGOTA»), entonces todas las placas de ese municipio la muestran con la letra de la norma;
  la app no acepta una leyenda que no quepa en ese ancho (RN-05). Puede quitarla y vuelve el nombre
  completo.
- **CA-11** — Dado un operador o un cliente, entonces no puede cambiar la leyenda de ningún municipio.

### HU-04 (P2) — La placa en listas apretadas

Como persona que busca un cliente por placa, quiero ver la placa completa también en las listas, para
reconocerla igual que en la ficha.

**Criterios de aceptación**

- **CA-12** — Dada la tabla de «Clientes» o el buscador de clientes de «Nueva orden» y «Nueva
  reserva», cuando un resultado muestra su placa, entonces es la placa completa a escala, con las
  mismas proporciones (CA-01, CA-02), su ciudad o «COLOMBIA», solo un poco más pequeña y a la derecha
  del nombre y el correo. Ya no hay una versión de una sola línea (enmienda la spec 005, CA-29). No
  lleva la palabra «Placa» a la vista: el dibujo ya lo dice; quien usa un lector de pantalla sigue
  oyendo «Placa» antes de los caracteres.

## Requisitos funcionales

- **RF-01** — Toda placa de la app (ficha del cliente, «Mis vehículos», órdenes, buscador de clientes,
  tabla de «Clientes») se dibuja con las mismas reglas y proporciones.
- **RF-02** — La lista de ciudades de placa es la de los municipios con organismo de tránsito.
- **RF-03** — Cada municipio de esa lista puede tener una leyenda para la placa, que solo el
  administrador cambia.

## Reglas de negocio

- **RN-01** — Las proporciones son las de la norma (ver «Fuentes»): carro 330 × 160 mm, moto
  235 × 105 mm, con sus caracteres, separaciones, leyenda, marco y esquinas. La app dibuja la placa a
  escala, sin estirarla ni achicarla en un solo sentido. Todas las placas de un tamaño miden el mismo
  ancho en pantalla (la de moto, más baja por su proporción); en las fichas, unos 35–39 px de alto, como
  antes de esta spec, y un poco menos en las listas de clientes.
- **RN-06** — En pantalla, una leyenda que a escala no se leería (por debajo de unos 5 px de alto, como
  «COLOMBIA» en la moto) crece lo justo para leerse, como mucho 1,4 veces la de la norma, sin quitar el
  hueco que la separa de los caracteres; el conjunto se vuelve a centrar en el marco. Ningún trazo
  (marco, círculo, leyenda) se dibuja más fino de 1 px. La ciudad de un carro queda a su tamaño de
  norma.
- **RN-02** — Los caracteres se trazan de los planos de la norma (no nombra una tipografía): letras de
  la A a la Z y números del 0 al 9 para carro y moto, y las letras de la leyenda.
- **RN-03** — En el hueco entre letras y números va un círculo discreto, no el logo del Ministerio de
  Transporte: la app no usa emblemas oficiales.
- **RN-04** — Expiden placas los municipios con organismo de tránsito del listado del RUNT.
- **RN-05** — La leyenda de la ciudad es, por defecto, el nombre del municipio en mayúsculas y sin
  tildes (la «Ñ» se conserva); un
  administrador puede darle a un municipio una leyenda propia que quepa dentro del marco con la letra
  de la norma: como mucho 17 caracteres (17 · n − 5 mm, unos 298 mm útiles).

## Datos (vista conceptual)

| Entidad | Atributos relevantes | Notas |
|---|---|---|
| Municipio | Nombre, departamento, si tiene organismo de tránsito, leyenda para la placa (opcional) | La lista de 1.104 sigue existiendo; la ciudad de la placa se elige solo entre los que tienen organismo. |

## Requisitos no funcionales

- **Accesibilidad**: los caracteres cumplen el contraste AA; la placa se lee como texto (CA-06).
- **Móvil**: la placa a su tamaño cabe en 360 px y en el iPhone sin desplazamiento lateral.
- **Rendimiento**: el dibujo de los caracteres no carga una fuente externa ni retrasa la pantalla.

## Fuera de alcance

- Placas de servicio público, oficiales, diplomáticas, de remolque o de antiguos y clásicos.
- El logo oficial, hologramas, troqueles y elementos de seguridad de la placa real.
- Validar que una placa corresponda a la ciudad (las series por organismo de tránsito).

## Suposiciones

- Las medidas que la ficha MT 001 no publica (caracteres de carro, separaciones, marco, leyenda) se
  toman de los planos de antiguos y clásicos, que tienen la misma caja; la posición vertical exacta de
  los caracteres de carro se ajusta para centrarlos, porque esos planos llevan además la palabra
  ANTIGUO o CLÁSICO arriba.
- El municipio de la placa es el de la sede del organismo de tránsito (la norma dice «el municipio
  donde está radicada la cuenta del vehículo»).
- La leyenda por defecto quita las tildes (como en las placas reales) y conserva los demás signos
  del nombre («BOGOTA, D.C.»); una leyenda propia puede quitarlos («BOGOTA D.C.»).
- La leyenda propia se edita en «Marcas y líneas», en una pestaña «Ciudades de placa» con la lista
  de los municipios con organismo de tránsito (decisión del usuario: así el inicio no gana un
  mosaico).

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
| 2026-11-25 | Creación, a pedido del usuario, a partir de la investigación de la norma. Decisiones del usuario: un círculo discreto en vez del logo; caracteres trazados de los planos de la norma; ciudad solo de municipios con organismo de tránsito; leyenda de la ciudad configurable por municipio y vacía por defecto. Enmienda la spec 005 (HU-07, CA-27 a CA-31, RF-07, RN-11). |
| 2026-11-25 | Decisión del usuario tras verlo en el navegador: en las listas, la placa completa a escala (CA-12), sin la versión de una línea. |
| 2026-11-25 | A pedido del usuario: en las listas, sin la palabra «Placa» junto a la placa (CA-12); se conserva para el lector de pantalla. |
| 2026-11-25 | Decisión del usuario: la leyenda por defecto va sin tildes. Aprobada por el usuario. |
| 2026-11-25 | Plan aprobado: estado `planificada`. |
| 2026-11-25 | Tareas aprobadas: estado `lista`; empieza la implementación (`en-progreso`). |
| 2026-11-25 | Corrección aprobada por el usuario al implementar: la leyenda propia admite hasta 17 caracteres, lo que cabe dentro del marco («STFE DE BOGOTA», de placas reales, tiene 14); el «unos 12» era una estimación. |
| 2026-11-25 | Decisión del usuario al implementar: «Ciudades de placa» es una pestaña de «Marcas y líneas», no una sección nueva. |
| 2026-11-25 | Decisiones del usuario al verla en el navegador: la placa de las fichas con el alto de antes (unos 35–39 px), un poco más pequeña en las listas de clientes y, en «Clientes», a la derecha del nombre y el correo (CA-12); la leyenda crece en pantalla solo lo justo para leerse, como mucho 1,4×, sin quitarle el hueco a los caracteres, y la ciudad de un carro a su tamaño de norma (RN-06). Corregida la M del calco (la V llega en punta al centro de la base, como en el plano). |
| 2026-11-25 | Implementada: estado `implementada`. |
