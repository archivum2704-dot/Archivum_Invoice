# Archivum — estado del proyecto

> **Léeme primero.** Este fichero es el punto de partida de cada sesión.
> Cuando cambies algo relevante, actualízalo en el mismo commit.
>
> Última actualización: **8 de agosto de 2026**

---

## Qué es

SaaS español de facturación y gestión documental.

| | |
|---|---|
| Web | `archivum.es` — Next.js 16 (App Router), next-intl (es/en), Tailwind v4, SWR |
| Móvil | Expo SDK 55 / RN 0.83 — Android e iOS, expo-router, react-i18next |
| Datos | Supabase (PostgreSQL 17) — proyecto `ddlvrycexamzznwtmchd` |
| Despliegue | Vercel desde `main` (web) · EAS (móvil) |
| Correo | Resend |

**Monorepo pnpm**: `apps/web`, `apps/mobile`.

### Trabajo diario

```bash
cd apps/web    && npx tsc --noEmit && npm run build
cd apps/mobile && npx tsc --noEmit && npx expo export --platform android
cd apps/web    && npm run verifactu:check     # 78 comprobaciones
```

Rama de trabajo: `claude/user-client-creation-kk6p58` → merge a `main`.

**Móvil**: si el cambio es solo JS, `npx eas-cli update --branch preview --environment preview`
(OTA, llega abriendo y cerrando la app). Un módulo nativo nuevo obliga a build.
⚠️ **La cuota de builds Android del plan gratuito se agotó; se repone el 1 de septiembre de 2026.**

---

## ⚠️ Lo que bloquea ahora mismo

| Qué | Quién | Por qué bloquea |
|---|---|---|
| **Certificado digital** — 0 subidos | Cliente | Sin él no se puede enviar nada a la AEAT |
| `VERIFACTU_PRODUCER_NAME` / `_NIF` | Cliente | Sin ellos el registro está incompleto |
| **Documento técnico de la AEAT** (formato de huella, endpoints, códigos de error) | Cliente | Varias cosas están implementadas "según la norma" pero sin poder contrastar el formato exacto |
| **Declaración responsable** | Abogado | Sin ella no se puede distribuir legalmente |
| **Decisión: apoderamiento vs certificado por cliente** | Cliente + gestor | Cambia el modelo de servicio; decidirlo antes de programar más |

---

## Verifactu — estado detallado

Modo de operación: **VERI\*FACTU** (con remisión). Todo el detalle técnico está en
[`docs/documentacion-tecnica-verifactu.md`](docs/documentacion-tecnica-verifactu.md).

### Hecho y verificado

| Requisito | Norma | Dónde |
|---|---|---|
| Registro de alta completo (desglose, descripción, sistema informático) | RD art. 10 | `lib/verifactu.ts` |
| Huella SHA-256 encadenada | Orden art. 13.1.a | `lib/verifactu.ts` |
| No bifurcación de la cadena, garantizada en BD | RD art. 8.2.b | `verifactu_chain_links` |
| Inalterabilidad por triggers | RD art. 8.2.a | migración `20260808_tighten_immutability` |
| Rectificativas por diferencias | | `api/invoices/rectify` |
| **Registro de anulación** | RD art. 11 | `lib/verifactu-annul.ts` |
| **Registro de eventos** + pantalla de consulta | RD art. 8.3 | `lib/verifactu-events.ts` |
| **Exportación de registros** | RD art. 8.2.c | `api/verifactu/export` |
| Remisión SOAP con mTLS + reintentos + control de flujo | RD art. 15-16 | `lib/verifactu-client.ts`, `-submit.ts` |
| QR (ISO 18004, nivel M, 31,75 mm) + leyenda | Orden art. 21 | `lib/invoice-pdf.ts` |
| Clientes extranjeros por `IDOtro` | Orden L7 | `lib/tax-id-types.ts` |
| **Declaración responsable visible en el sistema** | RD art. 13.2 | `/declaracion-responsable` (pública) |

### Pendiente

| Requisito | Norma | Notas |
|---|---|---|
| **Proceso de detección de anomalías** | Orden art. 9.1.c-f | Los tipos de evento existen; falta el proceso que los dispara. Debe verificar la cadena de facturación y la de eventos periódicamente |
| **Registro resumen cada 6 horas** | Orden art. 9.2 | Aunque no haya pasado nada. Y uno antes de apagar el sistema. Es un cron |
| **Eventos en XML/UTF-8 según el anexo 5** | Orden art. 9.4 | Hoy se guardan como JSONB |
| Exportación de eventos como operación propia | Orden art. 9.1.i | Hoy van dentro de la exportación de facturación |
| Causas de exención distintas de E1 | Orden L10 | E1 art. 20, E2 art. 21, E3 art. 22, E4 arts. 23-24, E5 art. 25, E6 otras. Falta un selector por línea. **Pendiente confirmar con el gestor qué casos aplican** |
| Regímenes distintos del general | Orden L8 | Hoy `ClaveRegimen` fijo a `01` |
| Disociación de accesos para la Administración | RD art. 8.4 / 14 | Pendiente de revisión |
| Prueba real contra preproducción de la AEAT | | Nunca ejecutada |

### ⚠️ Marcado en el código: formatos sin confirmar

El artículo 13.2 de la Orden remite el **algoritmo y la codificación** de la huella
a un documento técnico de la sede de la AEAT que **todavía no tenemos**. Los
conjuntos de campos sí están confirmados; el formato de concatenación no.

- Huella de **alta**: campos confirmados (art. 13.1.a) ✅
- Huella de **anulación**: campos confirmados (art. 13.1.b) ✅
- Huella de **evento**: campos confirmados (art. 13.1.c) ✅, **formato sin confirmar** ⚠️
- **Endpoints SOAP y espacios de nombres**: sin confirmar ⚠️ (configurables por env)
- **Códigos de error de la AEAT**: sin lista, no se traducen a castellano ⚠️

Un formato equivocado produce una huella de aspecto válido que la AEAT rechaza.
**Es lo primero que hay que contrastar** cuando llegue la documentación técnica.

### Fuentes

- RD 1007/2023 y Orden HAC/1177/2024 — leídos del BOE consolidado
- Documentación técnica AEAT: `sede.agenciatributaria.gob.es` → «Sistemas Informáticos de
  Facturación y VERI\*FACTU» → Documentación técnica
- Consultas: `verifactu@correo.aeat.es`

---

## Variables de entorno

### Web (Vercel)

| Variable | Estado | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ✅ | Cliente Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Rutas de servidor |
| `RESEND_API_KEY` | ✅ | Correo |
| `RESEND_FROM` | ✅ | `Archivum <facturas@archivum.es>` — dominio verificado |
| `CRON_SECRET` | ✅ | Protege los crons. **Rotarla exige redesplegar** |
| `VERIFACTU_CERT_KEY` | ✅ | AES-256-GCM de los certificados. **Si se pierde, hay que resubirlos todos** |
| `VERIFACTU_ENV` | ⚠️ `test` | Ponerla a `prod` antes de producción |
| `VERIFACTU_PRODUCER_NAME` / `_NIF` | ❌ | Identidad del productor en el registro |
| `VERIFACTU_PRODUCER_ADDRESS` / `_EMAIL` / `_WEBSITE` | ❌ | Declaración responsable |
| `VERIFACTU_DECLARATION_PLACE` / `_DATE` / `_ISSUED` | ❌ | Idem |
| `VERIFACTU_SYSTEM_ID` | opcional | Por defecto `AR`. **No cambiar una vez en producción** |
| `VERIFACTU_ENDPOINT_PROD` / `_TEST` | opcional | Sobrescriben las URLs de la AEAT |

### Móvil

`EXPO_PUBLIC_APP_URL` (por defecto `https://www.archivum.es`), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

---

## Cómo está construido (lo que hay que saber antes de tocar)

### Reglas que se rompen si se duplican

Esta base de código ha tenido el mismo fallo varias veces: **una regla implementada
en varios sitios acaba divergiendo**. Por eso:

- **Permisos**: tabla única en `lib/permissions.ts`, espejada en `apps/mobile/lib/permissions.ts`.
- **Planes y límites**: `lib/pricing.ts` (`resolveEntitlements`) y su gemelo SQL
  `org_plan_limits()`. **Deben coincidir.**
- **Formulario de cliente**: un solo componente por app (`new-client-modal.tsx` /
  `NewClientModal.tsx`). Antes eran cuatro copias y ninguna pedía el correo.
- **Tipos de identificación fiscal**: `lib/tax-id-types.ts`, copiado a móvil.

### Trampas conocidas

- **`INSERT ... RETURNING` en `companies` falla para todos, incluido el owner.**
  `companies_select` usa `can_access_company(id)`, que busca la fila en la tabla —
  y durante la comprobación del RETURNING la fila aún no existe. Por eso el id se
  genera en la app y no se lee de vuelta.
- **El middleware no debe redirigir `/api`.** Redirigía las llamadas con Bearer a la
  página de login, y el móvil recibía HTML donde esperaba JSON.
- **Storage no acepta el cliente del usuario**: subir al bucket `documents` requiere
  el cliente de servicio.
- **RN Modal y el teclado**: usar siempre `KeyboardModal`, no `Modal`.
- **Componentes definidos dentro de componentes** remontan en cada tecleo y cierran
  el teclado tras un carácter. Sacarlos a nivel de módulo.

### Flujo de facturación

```
Presupuesto  →  Albarán (se abre solo, estado «Abierto»)  →  Factura
```

Solo el albarán se factura. `quotes.kind` discrimina presupuesto de albarán;
**toda consulta de presupuestos debe filtrar por `kind`**.

---

## Verdades incómodas que hay que mantener

Cosas que la aplicación **no** hace y que no deben volver a afirmarse:

- **No hay extracción por IA.** Los textos que lo decían se quitaron.
- **Conformidad Verifactu**: la web sigue diciendo «Conforme con VeriFactu» en la
  landing y en los planes. **Hoy eso no se sostiene** — falta la declaración
  responsable y nunca se ha probado contra la AEAT. Pendiente de suavizar.
- Los avisos de stock mínimo son **dentro de la app**, no por correo ni push.

---

## Historial reciente

| Fecha | Qué |
|---|---|
| 8 ago | Registro de anulación, registro de eventos, exportación, declaración responsable en el sistema, clientes internacionales |
| 8 ago | Corregido: `protect_issued_invoice` permitía reescribir una factura emitida en dos pasos |
| 8 ago | Corregido: el cron aceptaba `Bearer undefined` si faltaba el secreto |
| 6 ago | Remisión SOAP a la AEAT; registro de alta completado; cadena protegida contra bifurcación |
| 6 ago | Stock mínimo con aviso; barra de acciones que partía el texto |
| 6 ago | Envío de documentos por correo; formulario de cliente completo |
| 3 ago | Albaranes entre presupuesto y factura |
