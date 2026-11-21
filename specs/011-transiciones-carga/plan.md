---
spec: "011"
estado: aprobado
actualizado: 2026-11-20
---

# Plan técnico — 011 Transiciones y estados de carga

## Resumen

Todo con las piezas del propio Next 16 y CSS, sin dependencias:

- **Esqueletos:** un `loading.tsx` por pantalla con datos (Suspense de la ruta) que compone
  esqueletos genéricos de `core`. Aparece con un retardo de 300 ms en CSS, así una carga rápida no
  lo muestra (CA-02).
- **Transición:** un `template.tsx` en el área con sesión y otro en el acceso. Se vuelven a montar en
  cada navegación, y su contenido entra con un fundido y una subida corta, solo con
  `motion-safe:`.
- **Barra de progreso:** un componente cliente en el layout. Arranca al pulsar un enlace interno o
  al ir atrás, se ve a partir de unos 120 ms y termina cuando cambia la ruta.
- **Momento de marca:** al acertar las credenciales, el inicio de sesión ya no redirige desde el
  servidor: devuelve el destino. El formulario muestra el logo de marca mientras navega a él, y el
  logo desaparece al montarse el inicio.

## Verificación contra la constitución

| Principio | Cumple | Notas |
|---|---|---|
| I. Spec como fuente de verdad | ✅ | Spec 011 aprobada. |
| II. Qué antes que cómo | ✅ | `loading.tsx`, `template.tsx` y los retardos están aquí, no en la spec. |
| III. Criterios verificables | ✅ | E2E con la red ralentizada (CDP) para ver esqueletos, barra y logo; unitarias para la accesibilidad y el arranque de la barra. |
| IV. Ambigüedad explícita | ✅ | Sin preguntas abiertas. |
| V. Simplicidad y stack | ✅ | Sin librerías de animación ni de barra de progreso: unas 60 líneas propias y CSS. |
| VI. Seguridad y datos personales | ✅ | Sin datos. La acción de inicio de sesión sigue validando y limpiando el destino (`sanitizeNextPath`) en el servidor. |
| VII. Trazabilidad | ✅ | Rama `feature/011-transiciones-carga`. |
| VIII. Incrementos pequeños | ✅ | HU-01 (esqueletos) se despliega sola; barra, transición y momento de marca se apoyan en ella. |

## Base de datos (packages/supabase)

Sin cambios.

## Aplicación (apps/web)

### Esqueletos (HU-01)

- `core/components/skeleton.component.tsx`: el bloque básico.
  - `rounded-medium bg-default-200`, que sigue el tema (CA-04).
  - Pulso suave solo con `motion-safe:animate-pulse`.
- `core/components/page-skeleton.component.tsx`: formas de pantalla.
  - Variantes: `home`, `list`, `detail`, `form` y `profile`.
  - Cada una con un título, tarjetas o filas aproximadas, y el mismo ancho y relleno que la página
    real, para que nada salte ni se desborde (CA-05).
  - Accesible (CA-03):
    - un contenedor `role="status"` con un `sr-only` «Cargando…» y `aria-busy`;
    - las formas van `aria-hidden`.
  - Retardo (CA-02): el contenedor arranca invisible y aparece a los 300 ms. Usa
    `animation: skeleton-in 150ms ease-out 300ms both`, y con «reducir movimiento» la misma espera
    sin fundido (`steps(1)`). Es CSS puro: no hay temporizadores ni estado.
- Un `loading.tsx` por ruta (CA-01), cada uno con una sola línea que elige la variante:

  | Ruta | Variante |
  |---|---|
  | `(app)/` (inicio) | `home` |
  | `orders` | `list` |
  | `orders/[id]` | `detail` |
  | `orders/new` | `form` |
  | `customers` | `list` |
  | `customers/[id]` | `detail` |
  | `services` | `list` |
  | `employees` | `list` |
  | `admin/users` | `list` |
  | `profile` | `profile` |

- Mensajes: `core.loading.label` «Cargando…».

### Barra de progreso (HU-02)

- `core/components/navigation-progress.component.tsx` (`'use client'`), en el layout con sesión
  y en el del acceso, en el borde superior de la pantalla (como en la mayoría de las apps; el acceso
  no tiene encabezado). Se dibuja así: `fixed inset-x-0 top-0 h-0.5 bg-foreground/70`, con
  `aria-hidden`; la carga la anuncia el esqueleto.
- **Arranca:** con un clic (en captura) sobre un `<a>` interno a otra dirección (sin
  Ctrl/⌘/Shift/clic central ni `target="_blank"`), y con `popstate` (atrás o adelante).
- **Termina:** cuando cambian `usePathname()` o `useSearchParams()`. Llega al 100 % y se desvanece.
- **Retardo:** la barra aparece a los 120 ms (`animation-delay`); una navegación instantánea no la
  muestra (CA-07).
- **Avance:** crece en CSS hasta el 80 % mientras espera. Con «reducir movimiento» queda quieta y a
  ancho completo (CA-08).
- **Fuera de alcance:** las navegaciones por código (`router.push` tras guardar). Ahí el botón ya
  muestra su estado de carga.

### Transición entre pantallas (HU-03)

- `src/app/(app)/template.tsx`: un `<div className="motion-safe:animate-page-in">` que envuelve
  la página. El layout (encabezado y menú) queda fuera: no se anima (CA-09).
- `globals.css`: `--animate-page-in: page-in 200ms ease-out`, que va de `opacity: 0;
  translateY(6px)` a `opacity: 1; translateY(0)`. Con «reducir movimiento» no hay animación
  (CA-10).
- **Atrás (CA-11):** la misma transición de 200 ms. Next restaura el desplazamiento y no se añade
  ninguna espera.
- `src/app/auth/template.tsx`: solo fundido (`motion-safe:animate-fade-in`), para entrar al acceso
  al cerrar sesión (CA-13).

### Momento de marca (HU-04)

- `auth/actions/auth.actions.ts`:
  - **`signIn`:** al acertar devuelve `{ ok: true, destination }` en lugar de `redirect()`. El
    destino se calcula igual en el servidor (`destinationAfterSignIn` y `sanitizeNextPath`). Con
    error, igual que hoy.
  - **`signOut`:** no cambia; sigue redirigiendo.
- `login-form`: con `ok`, muestra `BrandMoment` y hace `router.replace(destination)` dentro de una
  transición. El logo se ve solo mientras se navega y desaparece al desmontarse el acceso
  (CA-12, RN-01).
- `core/components/brand-moment.component.tsx`:
  - capa a pantalla completa, `bg-zinc-950`, con `BrandOrnaments` y `BrandRingLogo` centrado;
  - `role="status"` con «Entrando…» para el lector de pantalla;
  - el brillo y los destellos ya son `motion-safe` (CA-14).
- El inicio con Google vuelve por `/auth/callback` (redirección del servidor) y no pasa por el
  formulario. Ahí se ve el esqueleto del inicio, no el logo. Queda anotado como límite.

### Ajustes durante la implementación

- **Barra:** el origen de la navegación es la ruta que se está mostrando, no la barra de
  direcciones. En «atrás», el navegador ya cambió la dirección cuando llega `popstate`, y sin esto
  la barra no terminaba; lo cubre la prueba de «atrás». La barra termina en cuanto la pantalla
  nueva aparece, sea su esqueleto o su contenido; a partir de ahí la carga la indica el
  esqueleto.
- **Tiempo:** devolver el destino desde `signIn` no hace el inicio de sesión más lento. Medido en
  desarrollo: unos 550 ms frente a unos 900 ms con la redirección del servidor.
- **Pruebas reforzadas por sus mutaciones:**
  - «atrás» comprueba la posición también pasado un momento;
  - en el iPhone, además de que la página no se desplace, que ninguna forma del esqueleto se
    salga de la pantalla, porque el `overflow-x-clip` del contenedor ocultaría el fallo.
- **Título mientras carga:** Next 16 envía los metadatos aparte en las páginas dinámicas, y con
  el esqueleto a la vista la pestaña quedaba sin `<title>` (axe `document-title`, WCAG 2.4.2).
  `htmlLimitedBots: /.*/` los pone en el `<head>` desde el principio. Solo son el nombre traducido
  de la app y se resuelven al instante, así que no cuesta nada.
- **Pruebas con red lenta:** esperan a que la página esté lista (`networkidle`) antes de
  ralentizar la red. Un toque antes de la hidratación es una carga de página completa, sin barra
  ni transición, y bajo carga daba falsos fallos.
- **Desarrollo:** Turbopack no recarga en caliente los `@keyframes` nuevos de `globals.css`; hay
  que reiniciar `pnpm dev` borrando `.next`, como ya dice `CLAUDE.md`.

## Estrategia de pruebas

| Criterio | Tipo | Archivo de prueba |
|---|---|---|
| CA-01 | E2E con la red ralentizada (CDP `Network.emulateNetworkConditions`, unos 1,5 s de latencia): al abrir «Órdenes», un detalle, «Clientes» y una ficha, se ve el estado «Cargando…» con su forma y luego el contenido; cobertura: toda `page.tsx` de `(app)` tiene su `loading.tsx` con la variante de la tabla | `e2e/loading.spec.ts`, `__test__/src/app/loading-coverage.test.ts` |
| CA-02 | componente: el esqueleto tiene un retardo de 300 ms (`animation-delay`), también con «reducir movimiento»; E2E: con red normal, el estilo calculado del contenedor tiene `animation-delay: 0.3s` | `page-skeleton.component.test.tsx`, `e2e/loading.spec.ts` |
| CA-03 | componente: un solo `status` «Cargando…» y las formas ocultas al lector; axe con el esqueleto a la vista (claro y oscuro) | `page-skeleton.component.test.tsx`, `e2e/a11y.spec.ts` |
| CA-04 | E2E oscuro y lento: las formas usan el color del tema; con «reducir movimiento», `animation-name: none` en las formas | `e2e/loading.spec.ts` |
| CA-05 | E2E iPhone lento: sin desplazamiento lateral con el esqueleto ni con el contenido | `e2e/ui.spec.ts` |
| CA-06 | componente: un clic en un enlace interno arranca la barra y el cambio de ruta la termina; E2E lento: la barra se ve en el borde superior y luego desaparece | `navigation-progress.component.test.tsx`, `e2e/loading.spec.ts` |
| CA-07 | componente: Ctrl o clic central, `_blank`, enlaces externos y la misma dirección no la arrancan; E2E: la barra tiene `animation-delay: 0.12s` | `navigation-progress.component.test.tsx`, `e2e/loading.spec.ts` |
| CA-08 | E2E con «reducir movimiento»: la barra sin animación | `e2e/loading.spec.ts` |
| CA-09 | E2E: al navegar, el contenedor de la página tiene `animation-name: page-in` y el encabezado no está dentro | `e2e/loading.spec.ts` |
| CA-10 | E2E con «reducir movimiento»: `animation-name: none` | `e2e/loading.spec.ts` |
| CA-11 | E2E: «atrás» desde un detalle muestra la lista en su sitio (desplazamiento conservado) | `e2e/loading.spec.ts` |
| CA-12 | unitarias de la acción: `signIn` devuelve el destino limpio; componente: con `ok`, el logo «Entrando…» a la vista y `router.replace(destino)`; con error, sin logo; E2E lento: se ve el logo y luego el inicio | `auth.actions.test.ts`, `login-form.component.test.tsx`, `e2e/loading.spec.ts` |
| CA-13 | E2E: tras cerrar sesión, el acceso tiene `animation-name: fade-in` | `e2e/loading.spec.ts` |
| CA-14 | E2E con «reducir movimiento»: el logo sin animaciones (brillo y destellos `none`) | `e2e/loading.spec.ts` |

Además, se ajustan las pruebas que esperaban la redirección del servidor en `signIn`:
`auth.actions.test.ts` y `auth-login.spec.ts`, cuyo destino final sigue igual.

## Archivos afectados

**Nuevos:**
- en `core`: `skeleton`, `page-skeleton`, `navigation-progress` y `brand-moment`;
- 10 `loading.tsx`;
- `(app)/template.tsx` y `auth/template.tsx`;
- `e2e/loading.spec.ts` y las pruebas de componentes.

**Modificados:**
- `globals.css` (`page-in`, `skeleton-in`, `progress`);
- los layouts con sesión y del acceso (la barra);
- `auth.actions.ts`, `login-form`;
- `core/messages/es.json`;
- E2E de `a11y` y `ui`;
- `CLAUDE.md`, con la regla «una pantalla nueva con datos lleva su `loading.tsx`».

## Dependencias nuevas

Ninguna.

## Riesgos y decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| `template.tsx` + CSS para la transición | `<ViewTransition>` de React | El proyecto usa React 19.2 estable, que no lo trae (llega en 19.3). Además depende de la API de View Transitions del navegador. El `template` funciona en todos y se prueba con el estilo calculado. |
| Retardo de 300 ms en CSS | Un temporizador en JS | Sin estado ni efectos; funciona aunque el JS aún no se haya hidratado (el primer `loading` llega en el HTML). |
| `signIn` devuelve el destino | Mostrar el logo mientras «envía» | Mientras envía todavía no se sabe si las credenciales son correctas: el logo saldría también con un error. Devolviendo el destino, el logo sale solo al acertar (RN-01). |
| Barra propia | `nextjs-toploader`, NProgress | Son unas 60 líneas y sin dependencia; las librerías parchean `history` y no respetan «reducir movimiento» como queremos. |

Riesgo: con `loading.tsx`, una carga rápida deja hasta 300 ms el área de contenido vacía antes del
contenido, en vez de un parpadeo del esqueleto. Es la contrapartida de CA-02. El encabezado sigue
a la vista y la barra indica la navegación.

## Despliegue

Solo app, sin migraciones ni variables.
