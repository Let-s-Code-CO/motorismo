---
spec: "003"
actualizado: 2026-11-19
---

# Tareas — 003 Rediseño visual

- [x] T001 Dependencias (`lucide-react`, `@axe-core/playwright`), fuente Geist y tema HeroUI
- [x] T002 [P] Pruebas en rojo: `password-input` (CA-05), `nav-links` (CA-06), resumen y menú de
      acciones de usuarios (CA-07), `ui.spec.ts` (CA-02, CA-03), `a11y.spec.ts` (CA-04)
- [x] T003 Pantallas de acceso: layout dividido, formularios, `PasswordInput`, avisos
- [x] T004 Cabecera, menú activo, menú de usuario, inicio y «sin permiso»
- [x] T005 Gestión de usuarios: encabezado, resumen, tabla, menú de acciones, invitación
- [x] T006 Adaptar selectores de pruebas de la spec 002 sin cambiar lo que verifican (CA-01)
- [x] T007 Revisión visual con capturas en escritorio y móvil
- [x] T008 Definición de terminado completa

## Filtro por estado — CA-09

- [x] T010 Pruebas en rojo: utilidades de filtro, resumen como filtro (`aria-pressed`), barra con
      «Ver todos», E2E con recarga
- [x] T011 Filtro en la URL (`?status=`), resumen pulsable, barra de filtro y vacío filtrado
- [x] T012 Definición de terminado y revisión visual

**Registro (2026-11-19)**: lint ✅ · `ts:check` ✅ · 144 unit ✅ · 12 sandbox ✅ · build ✅ ·
19 E2E ✅ (incluye `ui.spec.ts` y la auditoría axe de `a11y.spec.ts`) · pgTAP 57 ✅.
Mutaciones vistas fallar y revertidas: contraseña siempre oculta → CA-05; `aria-current` ausente →
CA-06; resumen que cuenta todos → CA-07; `rel` sin `noreferrer` → CA-08.
CA-09 (2026-11-19): 164 unit ✅ · 20 E2E ✅ (filtro, recarga y axe) · build ✅. Mutaciones vistas
fallar: `parseStatusFilter` acepta cualquier valor → 4 casos; el resumen no se desmarca → CA-09;
«Ver todos» nunca aparece → CA-09. La auditoría axe detectó que el `aria-label` de las tarjetas no
coincidía con el texto visible (WCAG 2.5.3); ahora el nombre sale del contenido.
