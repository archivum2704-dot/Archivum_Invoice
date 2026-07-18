# Archivum Mobile — Registro de correcciones

Archivo de tracking para no trabajar doble. Cada fix incluye archivo, problema y commit.

---

## Sesion anterior (debug TS)

| # | Archivo | Problema | Fix | Commit |
|---|---------|----------|-----|--------|
| 1 | `subir.tsx` (x3) | `FileSystem.EncodingType.Base64` eliminado en expo-file-system v55 | Reemplazado por string literal `'base64'` | `e22a754` |
| 2 | `subir.tsx` | `FileSystem.cacheDirectory` eliminado en v55 | Cambiado a `FileSystem.Paths.cache.uri` | `e22a754` |
| 3 | `equipo.tsx` | Cast inseguro `as Member[]` en join de Supabase | Cambiado a `as unknown as Member[]` | `e22a754` |

---

## Sesion actual — Funcionalidad

### Commit `cebfa05` — fix(mobile): align DB column names and fix functional issues

| # | Archivo | Severidad | Problema | Fix |
|---|---------|-----------|----------|-----|
| 4 | `dashboard.tsx` | CRITICO | Selecciona `amount` que no existe en la BD | Cambiado a `total` (select + KPIs + DocRow) |
| 5 | `biblioteca.tsx` | CRITICO | Selecciona `amount` que no existe en la BD | Cambiado a `total` (select + DocRow) |
| 6 | `buscar.tsx` | CRITICO | Selecciona `amount`, ordena por `amount` | Cambiado a `total` (select + sort + DocRow) |
| 7 | `documento/[id].tsx` | CRITICO | Lee `doc.amount`, `doc.taxable_base`, `doc.vat_rate` — columnas incorrectas | Cambiado a `doc.total`, `doc.subtotal`, `doc.tax_rate`, `doc.tax_amount` |
| 8 | `editar/[id].tsx` | CRITICO | Lee/escribe `amount`, `taxable_base`, `vat_rate` | Cambiado a `total`, `subtotal`, `tax_rate`, `tax_amount`; calcula `tax_amount` automaticamente |
| 9 | `subir.tsx` | MEDIO | Solo enviaba `total` y `tax_rate`, faltaban `subtotal` y `tax_amount` | Ahora calcula y envia los 4 campos financieros |
| 10 | `ajustes.tsx` | MEDIO | `Clipboard` de react-native deprecado desde RN 0.73 | Instalado `expo-clipboard`, usando `setStringAsync` |
| 11 | `login.tsx` | MEDIO | Boton "Olvidaste tu contrasena?" sin `onPress` | Ahora llama `supabase.auth.resetPasswordForEmail()` con feedback al usuario |
| 12 | `ajustes.tsx` | MEDIO | Fetch a `/api/billing/cancel` sin token de auth (siempre 401) | Agregado header `Authorization: Bearer <token>` |
| 13 | `login.tsx` | BAJO | Directiva `'use client'` innecesaria (solo Next.js) | Eliminada |

### Columnas correctas de la tabla `documents` (referencia)

```
total           — importe total (antes se usaba "amount" incorrectamente)
subtotal        — base imponible (antes se usaba "taxable_base" incorrectamente)
tax_rate        — porcentaje de IVA (antes se usaba "vat_rate" incorrectamente)
tax_amount      — importe del IVA calculado
currency        — moneda (EUR por defecto)
issue_date      — fecha de emision
due_date        — fecha de vencimiento
payment_date    — fecha de pago
document_number — numero de documento
document_type   — tipo (invoice_issued, invoice_received, delivery_note, order, receipt, payroll, contract, quote, tax, other)
status          — estado (draft, pending, paid, overdue, cancelled)
file_url        — ruta en Storage
file_name       — nombre del archivo
file_size       — tamano en bytes
file_type       — MIME type
notes           — notas internas
description     — descripcion
```

---

### Fix — SafeArea & layout adaptation for mobile

| # | Archivo | Severidad | Problema | Fix |
|---|---------|-----------|----------|-----|
| 14 | `_layout.tsx` (root) | CRITICO | Faltaba `SafeAreaProvider` — sin él, `SafeAreaView` no detecta los insets del sistema (notch, barra de navegación) | Agregado `SafeAreaProvider` de `react-native-safe-area-context` envolviendo toda la app |
| 15 | `(app)/_layout.tsx` | CRITICO | Tab bar con `height: 60` y `paddingBottom: 8` fijos — en Android la barra queda tapada por los botones de navegación | Ahora usa `useSafeAreaInsets()` para calcular `height: 60 + insets.bottom` y `paddingBottom: 8 + insets.bottom` |
| 16 | 6 pantallas tab (dashboard, biblioteca, buscar, empresas, equipo, ajustes) | MEDIO | `SafeAreaView` aplicaba padding en los 4 bordes — el bottom duplicaba el padding del tab bar | Agregado `edges={["top", "left", "right"]}` para excluir el borde inferior (ya lo maneja el tab bar) |
| 17 | `(app)/_layout.tsx` | MEDIO | useEffect de onboarding con `[]` deps causaba loop infinito tras completar onboarding (React 19) | Cambiado a `[pathname]` para re-evaluar cuando cambia la ruta |

---

### Fix — Teclado, edge-to-edge y alta de clientes (feedback de usuario)

Contexto: con Expo SDK 55 Android corre siempre en modo *edge-to-edge*: la ventana ya
no se redimensiona al abrir el teclado (`adjustResize` no aplica) y el contenido se
dibuja bajo la barra de navegación del sistema si no se aplican los insets.

| # | Archivo | Severidad | Problema | Fix |
|---|---------|-----------|----------|-----|
| 18 | `components/Sheet.tsx` (nuevo) | CRITICO | Todos los modales tipo hoja duplicaban el mismo patrón sin manejo de teclado ni safe-area inferior | Componente reutilizable: `KeyboardAvoidingView` (padding), `paddingBottom: insets.bottom`, overlay que cierra al tocar fuera, `navigationBarTranslucent` |
| 19 | `inventario.tsx` | CRITICO | El teclado tapaba los campos del modal "Nuevo producto"; el botón Guardar quedaba bajo la barra de navegación | Modal migrado a `Sheet`; `filtered`/`categories` memoizados con `useMemo` |
| 20 | `facturacion.tsx` | CRITICO | Teclado tapaba inputs del modal de factura y del picker de clientes; contenido bajo la barra de navegación | Modal de factura con `edges={["top","bottom"]}` + `KeyboardAvoidingView`; picker migrado a `Sheet` |
| 21 | `facturacion.tsx` | MEDIO | Al buscar un cliente inexistente solo se mostraba "Ningún cliente coincide", sin vía clara para crearlo | CTA "Crear cliente «X»" en el estado vacío que precarga el nombre buscado en el alta inline (claves i18n `invoicing.createFromSearch`) |
| 22 | `empresas.tsx`, `equipo.tsx`, `biblioteca.tsx`, `buscar.tsx` | MEDIO | 8 modales hoja sin manejo de teclado ni inset inferior | Migrados a `Sheet` |
| 23 | `ajustes.tsx` | MEDIO | Modal de organización sin `KeyboardAvoidingView` ni safe-area inferior | `edges={["top","bottom"]}` + `KeyboardAvoidingView` |
| 24 | `subir.tsx`, `editar/[id].tsx`, `login.tsx`, `register.tsx` | MEDIO | `KeyboardAvoidingView` con `behavior="height"` en Android — no funciona con edge-to-edge | Cambiado a `behavior="padding"` en ambas plataformas |
| 25 | `facturacion.tsx` | BAJO | Componente `Chip` definido dentro del render — se remonta en cada re-render | Movido a nivel de módulo |
| 26 | `app.json` | BAJO | Permiso `RECORD_AUDIO` duplicado | Deduplicado |

---

## Pendiente de revisar

- [ ] Pantalla `buscar.tsx`: la busqueda solo filtra por `document_number.ilike`, aunque el placeholder dice "numero, empresa, tipo..."
- [ ] No hay pantalla de detalle de empresa al hacer tap en una empresa (solo menu de acciones)
- [ ] El greeting del dashboard ("Buenos dias") es estatico, no cambia segun la hora
- [ ] No hay validacion de formato de fecha en `editar/[id].tsx` (el usuario escribe texto libre "2025-01-15")
- [ ] No hay feedback visual cuando se elimina un documento desde `documento/[id].tsx`
- [ ] La pantalla `onboarding.tsx` siempre se muestra la primera vez aunque el usuario ya tenga datos
