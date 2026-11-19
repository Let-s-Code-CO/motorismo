---
spec: "003"
estado: aprobado
actualizado: 2026-11-19
---

# Plan técnico — 003 Rediseño visual

## Sistema visual

- **Tipografía**: Geist (`next/font/google`, variable `--font-geist`), tracking ajustado en títulos.
- **Color**: base neutra (zinc). Primario casi negro (`#18181b`) como el logo; colores semánticos
  solo para estados (éxito, aviso, peligro). Fondo `#fafafa`, superficies blancas.
- **Forma**: radios de 8/12/16 px, bordes de 1 px, sombras muy suaves; foco visible de HeroUI.
- **Iconos**: `lucide-react`, siempre decorativos (`aria-hidden`); los botones solo-icono llevan
  `aria-label`.
- Tema configurado en `src/app/hero.ts` (plugin de HeroUI) y `globals.css` (`@theme`).

## Pantallas

| Pantalla | Cambio |
|---|---|
| Acceso (login, recuperar, crear contraseña, enlace no válido) | Layout dividido: panel de marca oscuro con patrón sutil (≥ lg) + formulario; inputs con etiqueta fuera, iconos y mostrar/ocultar contraseña; avisos con `Alert`. |
| Cabecera | Fija, translúcida con desenfoque; logo; menú con estado activo (`usePathname`); avatar con iniciales, nombre, rol y botón de salir. |
| Inicio | Saludo, rol y tarjetas: «Usuarios» (admin) y «Muy pronto» (clientes y órdenes). |
| Usuarios | Encabezado con descripción, resumen por estado, tabla con avatar + nombre + correo, menú de acciones por fila, invitación con tarjetas de rol descritas. |
| Sin permiso | Icono, mensaje y botón al inicio. |

## Dependencias nuevas

| Dependencia | Para qué | Alternativa descartada |
|---|---|---|
| `lucide-react` | Iconos consistentes, tree-shakable | SVG a mano (inconsistente, más código) |
| `@axe-core/playwright` (dev) | Auditoría de accesibilidad en E2E (CA-04) | Revisión manual (no repetible) |

## Pruebas

| CA | Prueba |
|---|---|
| CA-01 | Todas las suites de la spec 002 (unit, sandbox, E2E), adaptando solo selectores |
| CA-02 | E2E `ui.spec.ts` a 360 px: `scrollWidth - innerWidth = 0` |
| CA-03 | E2E `ui.spec.ts`: panel de marca visible en 1280 px y oculto en 360 px |
| CA-04 | E2E `a11y.spec.ts` con axe (WCAG 2.1 A/AA) en acceso, inicio y usuarios |
| CA-05 | Unit `password-input.component.test.tsx` |
| CA-06 | Unit `nav-links.component.test.tsx` (`aria-current="page"`) |
| CA-07 | Unit `users-admin.component.test.tsx` (resumen y menú de acciones) |
| CA-08 | Unit `site-footer.component.test.tsx` (enlace, pestaña nueva, `rel`) |
