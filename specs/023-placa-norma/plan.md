---
spec: "023"
estado: implementado
actualizado: 2026-11-25
---

# Plan técnico — 023 Placa según la norma colombiana

## Resumen

La placa pasa a ser un dibujo vectorial (SVG) con las medidas de la norma en milímetros: carro
`viewBox 0 0 330 160`, moto `0 0 235 105`.
- **Caracteres:** son trazos sobre la cuadrícula de los planos oficiales (Res. 3257 de 2018, Anexos 1
  y 2), dibujados con el grosor de la norma, sin ninguna fuente.
- **Posiciones:** marco, caracteres, círculo central y leyenda salen de una utilidad pura que hace las
  cuentas de la norma.
- **Tamaño:** se fija por ancho y el alto sigue la proporción. Así dos placas del mismo tamaño miden
  siempre lo mismo.
- **Base de datos:** los municipios ganan «expide placas» (los del listado del RUNT) y una leyenda
  opcional que solo el administrador cambia. La guarda de vehículos exige una ciudad que expida
  placas al elegirla o cambiarla.
- **Pantalla nueva** del administrador para las leyendas: «Ciudades de placa».

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 023 `aprobada`; enmienda la 005 (HU-07, CA-27 a CA-31, RF-07, RN-11) y la 019 (CA-12, el relieve) al implementarla. |
| II. Qué antes que cómo | ✅ | |
| III. Criterios verificables | ✅ | Cada CA con pgTAP, Vitest o Playwright (tabla abajo). Las medidas se prueban sobre la utilidad de trazado (sumas exactas en mm). |
| IV. Ambigüedad explícita | ✅ | Sin marcas abiertas; las medidas por analogía, en las suposiciones de la spec. |
| V. Simplicidad y stack | ✅ | Sin dependencias: SVG a mano, sin fuentes ni librerías de dibujo. |
| VI. Seguridad y datos personales | ✅ | La leyenda solo la cambia el admin, en Postgres (`set_plate_legend`, `security definer`); la regla de la ciudad, en la guarda de vehículos. |
| VII. Trazabilidad | ✅ | Pruebas citan `spec 023, CA-xx`; las medidas citan la fuente en el código. |
| VIII. Incrementos pequeños | ✅ | HU-01 y HU-04 (dibujo), HU-02 (ciudades) y HU-03 (leyendas) se pueden desplegar por separado. |

## Base de datos (packages/supabase)

- **Migración** `<timestamp>_plate_norm.sql`:
  - **`municipalities`:**
    - `issues_plates boolean not null default false`;
    - `plate_legend text` con
      `check (plate_legend is null or plate_legend ~ '^[A-ZÑ0-9 .,-]{1,17}$')`: mayúsculas sin tildes
      y como mucho 17 caracteres, lo que cabe con la letra de la norma (RN-05).
  - **Datos, repetibles:**
    - `update … set issues_plates = true where code in (…)`, con los códigos DANE de las sedes del
      listado de organismos de tránsito del RUNT;
    - la lista se arma al implementar, cruzando nombre y departamento del listado con la tabla, y
      queda en la migración (existe en todo entorno; no es un seed).
  - **`public.set_plate_legend(p_code text, p_legend text)`** (`security definer`, solo
    administrador):
    - *hint* `plate_admin_only` si no es admin, `plate_city_not_issuing` si el municipio no expide
      placas, `plate_legend_invalid` si la leyenda no cumple;
    - `null` o vacío quita la leyenda.
  - **`vehicles_guard`:** se recrea desde su última versión (`vehicle_catalog_admin`). Al insertar,
    o al cambiar `plate_city_code`, el municipio debe tener `issues_plates`; si no,
    `vehicle_plate_city_not_issuing`. Un carro que conserva su ciudad no se toca (CA-08).
  - **Vista `work_order_summaries`:** añade `plate_city_legend` junto a `plate_city_name`.
  - **Permisos:**
    - el `select` de `municipalities` sigue igual (todo usuario con sesión lee nombre y leyenda);
    - nadie la escribe directamente;
    - `revoke` a `anon` de la función nueva.
- **Seeds:** `-- seeds: unchanged`, si las ciudades de los seeds expiden placas (Bogotá, D.C. y
  Medellín). Si una no, se cambia en `03_vehicles.sql`.
- **pgTAP** `tests/20_plate_norm.test.sql`:
  - columnas y `check`;
  - cuántos municipios expiden placas (el número del listado), y que estén Bogotá, D.C. y Medellín;
  - `set_plate_legend`: el admin la pone y la quita; un operador o un cliente, no; un municipio que no
    expide, no; leyendas inválidas (minúsculas, tildes, 13 caracteres);
  - la guarda rechaza registrar un carro con una ciudad que no expide, y deja corregir otro campo de
    un carro que ya la tenía;
  - la vista lleva la leyenda;
  - privilegios de la función.

## Aplicación (apps/web)

- **`vehicles/constants/plate-glyphs.constants.ts`:** el trazo (línea central) de cada carácter
  sobre la cuadrícula de los planos.
  - **Caracteres de carro** (A–Z, 0–9): celda de 40 × 80, trazo 10.
  - **Caracteres de moto** (A–Z, 0–9): celda de 28 × 54, trazo 7, de su propio plano.
  - **Leyenda** (A–Z, Ñ, 0–9, «.», «,», «-», espacio): celda de 12 × 22, trazo 3 para el carro; de
    10,5 × 5 para «COLOMBIA» de la moto.
  - Cada glifo cita su lámina. Se dibujan con `stroke` (extremos y uniones redondeados como en el
    plano), no con contornos.
- **`vehicles/utils/plate-layout.utils.ts`** (pura): para un tipo, la caja, el marco, la posición de
  cada carácter, el círculo central y la leyenda, en mm.
  - **Carro, en horizontal:** `4 + 4 + 8 + (40 + 8) × 2 + 40 + 26 + 40 + (8 + 40) × 2 + 8 + 4 + 4 = 330`.
  - **Leyenda:** ancho `17 · n − 5` (carro). Si no cabe en su franja, un único factor de escala la
    reduce lo justo (CA-09).
  - **Vertical:** las cotas del plano, ajustadas para centrar sin la palabra ANTIGUO o CLÁSICO.
- **`vehicles/utils/plate-legend.utils.ts`:** `plateLegend(name, legend)`. Devuelve la leyenda propia
  o el nombre en mayúsculas, sin tildes y conservando la Ñ («BOGOTA, D.C.»).
- **`vehicles/components/atoms/plate-label.component.tsx`** (se reescribe):
  - **Envoltorio:** el de hoy (`data-plate`, el metal y los destellos de la spec 019), con el radio de
    la norma en proporción.
  - **Dentro, un `<svg>`:** el marco (`rect` con trazo), los caracteres, el círculo y la leyenda.
  - **Relieve:** filtro SVG con luz arriba y sombra abajo; reemplaza el `text-shadow` (enmienda
    spec 019, CA-12).
  - **Tamaños:** `md` y `sm`, con ancho fijo por tamaño (`w-[5rem]` y `w-[4.5rem]`, ajustados con el
    usuario en el navegador) y alto por proporción. Desaparece la versión de una línea (CA-12).
  - **Legibilidad (RN-06):** con los px por mm de cada tamaño, la leyenda crece hacia 5 px de alto,
    como mucho 1,4× (`plateLayout(…, { grow })`, sin quitar el hueco y con al menos medio margen); los
    trazos finos, al menos 1 px; el relieve no se aplica a la leyenda.
  - **Lector de pantalla:** el SVG va `aria-hidden` y un `sr-only` lee «UIH-03D» y, en un carro, su
    ciudad (CA-06).
  - **Props:** `plate`, `city` y `legend`.
- **Consultas que traen la ciudad:** llevan `plate_legend`:
  - `vehicles.server` (`plate_city:municipalities(name, plate_legend)`);
  - la vista de órdenes;
  - `searchCustomers` (spec 022);
  - el listado de «Clientes» (que hoy no trae la ciudad de la placa que coincidió).
- **`customers-table`:** la placa completa a escala, sin «Placa» a la vista, con `sr-only` (CA-12).
- **Formulario de vehículo:** «Ciudad de la placa» lista solo los municipios con `issues_plates`
  (`fetchMunicipalities` filtra). Bogotá, D.C. sigue por defecto, y las fijadas se conservan si
  expiden placas. Un carro con una ciudad que ya no está en la lista abre el campo vacío y pide
  elegir (CA-08).
- **Módulo nuevo `plate-cities`** (o dentro de `vehicles`):
  - **Ruta:** `/admin/plate-cities`, «Ciudades de placa» en `NAV_LINKS` (grupo `admin`, con ícono y
    textos en `auth.header`).
  - **Pantalla:** búsqueda, lista de los municipios que expiden placas, con su placa de muestra
    (`ABC123` y su leyenda) y «Leyenda propia».
  - **Diálogo** para ponerla o quitarla:
    - vista previa en vivo;
    - el esquema Zod repite el `check`;
    - `callAction` y `notify`.
  - **Esqueleto:** `loading.tsx` con `PageSkeleton list`.
  - **Acceso:** solo admin (`getStaffForPage` con rol; acción con `getActiveAdmin`).
- **Mensajes** en `es.json` de cada módulo.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01, CA-02 | unit | `plate-layout.utils.test.ts` (sumas exactas en mm de carro y moto, posiciones de caracteres, círculo y leyenda, marco) |
| CA-03 | unit + e2e | `plate-label.component.test.tsx` (mismo ancho y `viewBox` para UIH-03D y WMW-88W); `style.spec.ts` (dos placas miden lo mismo en px) |
| CA-04 | unit | `plate-glyphs.test.ts` (los 36 caracteres de carro y de moto y los de la leyenda existen y caben en su celda; O ≠ 0) |
| CA-05 | e2e | `theme.spec.ts` / `style.spec.ts` (amarillo y negro en claro y oscuro; metal y destello) |
| CA-06 | componente + e2e | `plate-label.component.test.tsx` (texto para el lector; SVG oculto); `a11y.spec.ts` |
| CA-07 | pgTAP + componente | `20_plate_norm.test.sql`; `vehicle-form.component.test.tsx` (solo ciudades que expiden) |
| CA-08 | pgTAP + componente | guarda: corregir otro campo sin cambiar la ciudad; formulario: ciudad fuera de lista → vacía y obligatoria |
| CA-09 | unit | `plate-legend.utils.test.ts` (sin tildes, Ñ, signos); `plate-layout` (escala de la leyenda que no cabe) |
| CA-10 | pgTAP + componente + e2e | `set_plate_legend`; pantalla y diálogo de «Ciudades de placa»; e2e: el admin pone «STFE DE BOGOTA» y la ficha de Valentina lo muestra |
| CA-11 | pgTAP + e2e | un operador no puede (función y página) |
| CA-12 | componente + e2e | `customers-table` (placa completa, sin «Placa» visible); buscador; `ui.spec.ts` iPhone sin desplazamiento lateral |

## Archivos afectados

- **Nuevos:**
  - migración y `tests/20_plate_norm.test.sql`;
  - `plate-glyphs.constants.ts`, `plate-layout.utils.ts`, `plate-legend.utils.ts` y sus pruebas;
  - módulo y ruta de «Ciudades de placa» con sus pruebas y E2E.
- **Modificados:**
  - `plate-label.component.tsx`;
  - consultas de vehículos, órdenes, clientes y buscador;
  - `customers-table`;
  - formulario de vehículo y su lista de ciudades;
  - `NAV_LINKS`;
  - `globals.css` (el bloque de la placa de la spec 019: radio y relieve);
  - `style.spec.ts` y `theme.spec.ts` (relieve y medidas);
  - tipos generados;
  - specs 005 y 019 (enmiendas);
  - `CLAUDE.md`.

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Caracteres como trazos SVG trazados de los planos. | Una fuente libre parecida; texto con `font-family`. | Decisión del usuario: fiel a la norma; el SVG escala exacto y no carga fuentes. |
| Glifos por línea central y `stroke` del grosor de la norma. | Contornos rellenos. | Los planos los definen como trazo uniforme sobre una cuadrícula: es más fiel y mucho más simple de trazar y revisar. |
| Ancho fijo por tamaño; alto por proporción. | Alto fijo. | Una lista de placas queda alineada a la derecha; carro y moto conservan su proporción real. |
| «Expide placas» como columna marcada por migración. | Una tabla aparte de organismos de tránsito. | Basta saber qué municipios expiden; el organismo no se usa en la app. |
| La guarda solo valida al elegir o cambiar la ciudad. | Validar siempre. | Los carros registrados con otra ciudad no quedan bloqueados (CA-08). |
| Leyenda limitada a 17 caracteres. | Medir el ancho real. | Con la letra de la norma (17 · n − 5 mm) caben 17 dentro del marco; una regla clara en la base y en el formulario. |

**Riesgo principal:** trazar a mano 36 caracteres por tipo, más la leyenda, desde planos escaneados.
Se mitiga así:
- una cuadrícula fija;
- revisión visual de cada glifo contra la lámina, con capturas;
- pruebas que comprueban que cada glifo cabe en su celda.

**Riesgo de datos:** cruzar el listado del RUNT (nombres de sede) con los códigos DANE. Se mitiga
revisando a mano los que no crucen solos, y con una prueba del total.

## Despliegue

Migración primero: añade columnas, datos y la regla de la guarda; la app de hoy ignora las columnas
nuevas. Luego la app. Sin variables nuevas.
