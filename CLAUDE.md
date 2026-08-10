# Archivum — estado del proyecto

> **Léeme primero.** Este fichero es el punto de partida de cada sesión.
> Cuando cambies algo relevante, actualízalo en el mismo commit.
>
> Última actualización: **10 de agosto de 2026**

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

### ⚠️ Límites del plan Hobby de Vercel — rompen el despliegue en silencio

**Antes de tocar rutas o crons, lee esto.** El proyecto vive en una cuenta
**Hobby**. Pasarse de estos límites **no falla en tiempo de ejecución: falla la
compilación**, y en la lista de Deployments el filtro de estado puede estar
ocultando los fallidos, así que parece que «no se despliega nada».

| Límite | Hobby | Consecuencia si te pasas |
|---|---|---|
| `export const maxDuration` | **60 s** | El build falla entero |
| Número de cron jobs | **2** | El build falla entero |
| Frecuencia de los crons | **1 vez al día** | El build falla entero |

Ya pasó una vez: el 8 de agosto se añadieron rutas con `maxDuration = 120/300`
y un tercer cron horario; **siete merges seguidos a `main` no se desplegaron** y
producción se quedó anclada en el commit anterior sin que nada lo avisara.

**Cómo diagnosticarlo:** en Deployments, quita el filtro de **Status** (suele
estar en 6/7, ocultando los `Error`). Ahí aparecen los builds fallidos con el
mensaje real.

Si algún día se sube a Pro: `maxDuration` hasta 300 s, crons ilimitados y con
la frecuencia que se quiera. Entonces conviene volver a separar el cron de
Verifactu (envío horario) del de integridad (cada 6 h).

### Trabajo diario

```bash
cd apps/web    && npx tsc --noEmit && npm run build
cd apps/mobile && npx tsc --noEmit && npx expo export --platform android
cd apps/web    && npm run verifactu:check     # vectores oficiales + 106 comprobaciones
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
| **Declaración responsable** | Abogado | Sin ella no se puede distribuir legalmente |
| **Decisión: apoderamiento vs certificado por cliente** | Cliente + gestor | Cambia el modelo de servicio; decidirlo antes de programar más |
| **Plan Hobby de Vercel** | Cliente | El resumen de eventos cada 6 h (art. 9.2) no se puede cumplir con 1 cron diario. Requiere Pro |

---

## Verifactu — estado detallado

Modo de operación: **VERI\*FACTU** (con remisión). Todo el detalle técnico está en
[`docs/documentacion-tecnica-verifactu.md`](docs/documentacion-tecnica-verifactu.md).

Para hablar con la AEAT o con un gestor hay un informe en PDF listo para imprimir:
[`docs/Archivum-Verifactu-Estado-y-Consultas-AEAT.pdf`](docs/Archivum-Verifactu-Estado-y-Consultas-AEAT.pdf).
Se regenera con `python3 docs/generar-informe-aeat.py` (requiere `reportlab`).
**Si cambia el estado de conformidad, hay que regenerarlo**: el PDF no se
actualiza solo y un informe desfasado en manos de un tercero es peor que ninguno.

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
| **Detección de anomalías** (traza + integridad) | Orden art. 9.1.c-f | `lib/verifactu-integrity.ts`, cron cada 6 h |
| **Registro resumen de eventos** | Orden art. 9.2 | ⚠️ Se genera **una vez al día**, no cada 6 h: el plan Hobby no permite más. **Incumple el art. 9.2 hasta que se suba a Pro** |
| **Causas de exención E1-E6 por línea** | Orden L10 | `lib/exemption-causes.ts`; el desglose agrupa por causa, no solo por tipo |
| **Huella contrastada con los vectores oficiales** | Doc. AEAT v0.1.2 | `scripts/verifactu-vectors.ts` |
| **Códigos de error traducidos** (247) | — | `lib/verifactu-error-codes.ts`; distingue rechazo de envío, de registro y subsanable |
| **Eventos en XML según el anexo 5** | Orden art. 9.4 | `lib/verifactu-events-xml.ts`; sin `ds:Signature`, ver abajo |
| **Exportación de eventos como operación propia** | Orden art. 9.1.i | `api/verifactu/export/eventos` |
| **Causa de exención en presupuestos** | Orden L10 | Web y móvil; el servidor la exige al cerrar el presupuesto, no al convertirlo |
| **Régimen distinto del general** | Orden L8A | `lib/regimen-codes.ts`, columna `organizations.verifactu_clave_regimen` |
| **Declaración responsable con la estructura oficial** | RD art. 13.4 | `lib/declaracion-responsable.ts`, apartados 1.a-1.l y anexo |

### Pendiente

| Requisito | Norma | Notas |
|---|---|---|
| **Disociación de accesos para la Administración** | RD art. 8.4 / 14 | Ya sabemos qué espera la AEAT: su propio ejemplo de declaración responsable (apartado 2.c) lo resuelve con una casilla en el acceso que limita la sesión a la información con trascendencia tributaria. **Falta implementarlo** |
| **Prueba real contra preproducción de la AEAT** | | Nunca ejecutada. Solo falta el certificado |
| Etiquetas de las claves de régimen | Orden L8A / L8B | El código admite ya cualquier clave válida, pero las descripciones están en las listas L8A y L8B, que no vienen en `docs/aeat/`. Hasta tenerlas, la interfaz muestra el código y no una descripción inventada |
| Firma `ds:Signature` en el registro de evento | Anexo 5 | El esquema la exige; en VERI\*FACTU no hay firma expresa que serializar. Ligado a la consulta de si el registro de eventos nos aplica |

### Respuesta de la AEAT — 10 de agosto de 2026

Contestaron a las tres primeras consultas del informe. Lo confirmado:

| Qué | Dato |
|---|---|
| Documento de la huella | «Detalle de las especificaciones técnicas para la generación de la huella o hash de los registros» **v0.1.2**, en la página de desarrolladores |
| WSDL y esquemas | Sede de la AEAT → Información técnica → *WSDL de los servicios web* / *Esquemas* |
| Endpoint de pruebas, certificado de **representante** | `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| Endpoint de pruebas, certificado de **sello** | `https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| Requisito para probar | **Solo el certificado electrónico.** No hace falta alta previa |
| Certificado de pruebas para desarrolladores | `catentidades@correo.aeat.es` |
| NIF de pruebas, persona física | `99999910G` (CERTIFICADO FISICA PRUEBAS) |
| NIF de pruebas, persona jurídica | `A39200019` (CERTIFICADO ENTIDAD PRUEBAS) |

**Lo que esto cambió en el código**: representante y sello van a **hosts
distintos**, y enviar al equivocado hace fallar la remisión. El tipo de
certificado se deduce al subirlo (`cert_kind` en `org_certificates`) y decide el
endpoint. Las cuatro direcciones salen del WSDL:

| | Representante | Sello |
|---|---|---|
| Pruebas | `prewww1.aeat.es` | `prewww10.aeat.es` |
| Producción | `www1.agenciatributaria.gob.es` | `www10.agenciatributaria.gob.es` |

El 10 de agosto el cliente descargó toda la documentación y está en
[`docs/aeat/`](docs/aeat/). Con ella se resolvieron también, sin necesidad de
preguntar, las consultas **4** (códigos de error) y **5** (estructura del
registro de eventos, `EventosSIF.xsd`).

Sin contestar todavía: consultas **6 a 11** (modelo multi-obligado, número de
instalación, regímenes, resumen cada 6 h, acceso de la Administración,
declaración responsable — aunque para esta última hay
`docs/aeat/EjemplosDeclaracionResponsable.pdf`, que aún no se ha revisado).

### ✅ Huella validada contra los vectores oficiales

**Ya no hay nada que adivinar aquí.** La documentación técnica de la AEAT está en
[`docs/aeat/`](docs/aeat/) (los dominios de la AEAT están bloqueados desde este
entorno, por eso se guarda en el repo).

`npm run verifactu:check` ejecuta primero
[`scripts/verifactu-vectors.ts`](apps/web/scripts/verifactu-vectors.ts), que
comprueba los **tres ejemplos oficiales** del apartado 6 del documento v0.1.2:

| | Estado |
|---|---|
| Huella de **alta**, primer registro | ✅ coincide con el vector oficial |
| Huella de **alta**, encadenada | ✅ coincide con el vector oficial |
| Huella de **anulación** | ✅ coincide con el vector oficial |
| Huella de **evento** | ✅ corregida; el documento no publica vector, se comprueba la cadena de los 9 campos |
| Endpoints SOAP | ✅ los cuatro, leídos del WSDL |
| Códigos de error | ✅ los 247, en `lib/verifactu-error-codes.ts` |

⚠️ **Lo que estaba mal**: la huella de evento usaba 8 campos con nombres
inventados (`IDProductor`, `NIFObligado`, `Huella`, `FechaHoraHusoEvento`).
El apartado 3.c exige **9 campos**, dos de ellos llamados ambos `NIF`, y el
octavo es `HuellaEvento`. **Todas las huellas de evento generadas antes del 10
de agosto son inválidas.** `computeEventHuellaLegacy` se conserva solo para que
la detección de anomalías pueda seguir verificando esos eventos antiguos sin
denunciarlos como manipulados.

⚠️ **`TipoEvento` es un código, no texto.** El esquema admite `01`–`10` y `90`.
Los eventos propios van como `90` («otros a registrar voluntariamente»), con
nuestro nombre descriptivo en `OtrosDatosEvento`. La columna `event_type` de la
base de datos conserva el nombre largo, que es lo que ve el usuario.

**Si aparece una versión nueva del documento de la huella, vuelve a pasar los
vectores antes de tocar nada.**

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
| `VERIFACTU_ENDPOINT_PROD` / `_TEST` | opcional | Sobrescriben las URLs de la AEAT (certificado de representante) |
| `VERIFACTU_ENDPOINT_TEST_SELLO` / `_PROD_SELLO` | opcional | Certificado de sello: `prewww10` y `www10`. Los cuatro endpoints salen del WSDL |

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
| 10 ago | Cerrado el bloque «depende de nosotros»: eventos en XML del anexo 5, exportación de eventos propia, causa de exención en presupuestos y claves de régimen. Declaración responsable con la estructura oficial de la AEAT |
| 10 ago | **Huella validada contra los vectores oficiales de la AEAT.** Alta y anulación eran correctas; la de evento estaba mal y se corrigió. 247 códigos de error, `TipoEvento` como código, documentación de la AEAT guardada en `docs/aeat/` |
| 10 ago | **La AEAT contesta**: endpoints, NIF de pruebas y dónde está el documento de la huella. Separados los hosts de representante y sello |
| 9 ago | Informe en PDF del estado de Verifactu para la AEAT; documentación técnica puesta al día (decía que anulación, eventos y exportación no estaban hechos) |
| 8 ago | **Arreglado: 7 merges sin desplegar** por `maxDuration` y crons por encima de los límites de Hobby |
| 8 ago | Detección de anomalías, resumen de eventos, causas de exención por línea |
| 8 ago | Registro de anulación, registro de eventos, exportación, declaración responsable en el sistema, clientes internacionales |
| 8 ago | Corregido: `protect_issued_invoice` permitía reescribir una factura emitida en dos pasos |
| 8 ago | Corregido: el cron aceptaba `Bearer undefined` si faltaba el secreto |
| 6 ago | Remisión SOAP a la AEAT; registro de alta completado; cadena protegida contra bifurcación |
| 6 ago | Stock mínimo con aviso; barra de acciones que partía el texto |
| 6 ago | Envío de documentos por correo; formulario de cliente completo |
| 3 ago | Albaranes entre presupuesto y factura |
