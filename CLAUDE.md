# Archivum — estado del proyecto

> **Léeme primero.** Este fichero es el punto de partida de cada sesión.
> Cuando cambies algo relevante, actualízalo en el mismo commit.
>
> Última actualización: **30 de agosto de 2026 (verificación en dos pasos, también en el móvil)**

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
la frecuencia que se quiera. Entonces conviene separar el cron de Verifactu
(envío más frecuente) del de integridad. **Nada de esto es obligatorio**: el
único motivo para subir a Pro sería que las facturas lleguen antes a la AEAT,
no cumplir el art. 9.2 (ver más abajo por qué no nos vincula).

### Skills instaladas en el repo

Están en `.claude/skills/` y **van versionadas en git**, así que cualquier sesión
que clone el repo las tiene. Se gestionan con `npx skills` (`skills-lock.json`).

`find-skills` sirve para descubrir e instalar skills nuevas.

⚠️ **`npx skills find` no funciona desde este entorno**: `skills.sh` está
bloqueado por el proxy de red y la CLI responde «No skills found» en lugar de
dar un error. Es decir, **una búsqueda vacía aquí no significa que no exista la
skill**, significa que no se pudo mirar. Instalar por nombre sí funciona,
porque eso descarga de GitHub:

```bash
npx skills add <owner>/<repo>@<skill>
```

Desde una máquina propia (o Codespaces) la búsqueda sí funciona.

### Trabajo diario

```bash
cd apps/web    && npx tsc --noEmit && npm run build
cd apps/mobile && npx tsc --noEmit && npx expo export --platform android
cd apps/web    && npm run verifactu:check     # vectores oficiales + 114 comprobaciones
```

Rama de trabajo: `claude/user-client-creation-kk6p58` → merge a `main`.

**Móvil**: si el cambio es solo JS, `npx eas-cli update --branch preview --environment preview`
(OTA, llega abriendo y cerrando la app). Un módulo nativo nuevo obliga a build.
⚠️ **La cuota de builds Android del plan gratuito se agotó; se repone el 1 de septiembre de 2026.**

---

## ⚠️ Lo que bloquea ahora mismo

| Qué | Quién | Por qué bloquea |
|---|---|---|
| **Certificado digital de producción** — solo hay certificados de pruebas de la AEAT | Cliente | Los de pruebas (`99999910G` / `A39200019`, recibidos el 13 de agosto) ya están subidos y sirven para probar contra preproducción. El 17 de agosto se recibió el **NIF provisional** de la sociedad (`J93941003`, ver más abajo), pero eso no es el certificado — para enviar de verdad a la AEAT sigue haciendo falta el certificado real de la empresa, que se emite una vez esté constituida del todo (hoy sigue "EN CONSTITUCIÓN") |
| **Declaración responsable** | Abogado | Sin ella no se puede distribuir legalmente |
| **Política de privacidad, cookies y términos de servicio** | Abogado | Páginas creadas el 13 de agosto (`/privacidad`, `/cookies`, `/terminos`, enlazadas desde Ajustes → Legal) pero con contenido placeholder — solo un índice de lo que cubrirán, no texto legal vigente. Sin el texto definitivo no cubren nada de verdad |
| **Decisión: apoderamiento vs certificado por cliente** | Cliente + gestor | Cambia el modelo de servicio. La AEAT admite las dos vías (ver abajo); es decisión de negocio, ya no técnica |


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
| **Detección de anomalías** (traza + integridad) | Orden art. 9.1.c-f | `lib/verifactu-integrity.ts`, cron diario |
| **Registro resumen de eventos** | Orden art. 9.2 | Una vez al día. **No incumple**: el registro de eventos es voluntario para un SIF «SOLO VERI\*FACTU» (ver abajo) |
| **Causas de exención E1-E6 por línea** | Orden L10 | `lib/exemption-causes.ts`; el desglose agrupa por causa, no solo por tipo |
| **Huella contrastada con los vectores oficiales** | Doc. AEAT v0.1.2 | `scripts/verifactu-vectors.ts` |
| **Códigos de error traducidos** (247) | — | `lib/verifactu-error-codes.ts`; distingue rechazo de envío, de registro y subsanable |
| **Eventos en XML según el anexo 5** | Orden art. 9.4 | `lib/verifactu-events-xml.ts`; sin `ds:Signature`, ver abajo |
| **Exportación de eventos como operación propia** | Orden art. 9.1.i | `api/verifactu/export/eventos` |
| **Causa de exención en presupuestos** | Orden L10 | Web y móvil; el servidor la exige al cerrar el presupuesto, no al convertirlo |
| **Régimen distinto del general** | Orden L8A | `lib/regimen-codes.ts`, columna `organizations.verifactu_clave_regimen` |
| **Organizaciones no obligadas en España** | RD ámbito | `organizations.verifactu_obligado`. Si es `false`: sin registro, sin huella, sin QR y sin envío. Lo marca el propio cliente en Ajustes |
| **Declaración responsable con la estructura oficial** | RD art. 13.4 | `lib/declaracion-responsable.ts`, apartados 1.a-1.l y anexo |

### Pendiente

| Requisito | Norma | Notas |
|---|---|---|
| **Disociación de accesos para la Administración** | RD art. 8.4 / 14 | Ya sabemos qué espera la AEAT: su propio ejemplo de declaración responsable (apartado 2.c) lo resuelve con una casilla en el acceso que limita la sesión a la información con trascendencia tributaria. **Falta implementarlo** |
| **Prueba real contra preproducción de la AEAT** | | Nunca ejecutada. Solo falta el certificado |
| Landing: «Conforme con VeriFactu» | | Sigue afirmándolo sin declaración responsable ni prueba contra la AEAT. **Pendiente de suavizar** |
| Etiquetas de las claves de régimen | Orden L8A / L8B | El código admite ya cualquier clave válida, pero las descripciones están en las listas L8A y L8B, que no vienen en `docs/aeat/`. Hasta tenerlas, la interfaz muestra el código y no una descripción inventada |
| Firma `ds:Signature` en el registro de evento | Anexo 5 | **Resuelto: no aplica.** El registro de eventos es voluntario en SOLO VERI\*FACTU y no hay firma expresa que serializar |

### ⚠️ La cadena se verifica siguiendo enlaces, NUNCA ordenando por fecha

`FechaHoraHusoGenRegistro` y `FechaHoraHusoGenEvento` tienen **precisión de un
segundo** — lo fija el art. 13 y no se puede ampliar. El barrido diario escribe
cuatro eventos dentro del mismo segundo, así que ordenar por esa hora los
devuelve en orden arbitrario.

El comprobador de anomalías hacía justo eso hasta el 10 de agosto, y **denunció
como cadena rota cuatro cadenas que estaban intactas**, dejando el aviso escrito
en un registro inmutable. `walkChain()` en `lib/verifactu-integrity.ts` recorre
ahora los enlaces (`huella_anterior` → `huella`), que no depende del reloj y
además detecta bifurcaciones, predecesores inexistentes y registros huérfanos.

**Si alguna vez ves un `.order('generated_at')` u `.order('occurred_at')`
alimentando una verificación de cadena, es un fallo.**

### ⚠️ No todas las organizaciones están obligadas

El RD 1007/2023 obliga a quien está sujeto a las obligaciones de facturación
**españolas**. Una empresa extranjera sin esas obligaciones no está en el
ámbito: no es que desactive Verifactu, es que no le aplica.

`organizations.verifactu_obligado` (por defecto `true`) lo decide. En `false`,
`invoice-issue.ts` no genera registro de alta ni huella ni QR, no encadena, no
registra el evento y no remite nada; la factura conserva su numeración
correlativa y su inalterabilidad. `verifactu_status` queda en
`not_applicable`, que el barrido diario no recoge.

**El criterio no es la nacionalidad** sino si hay obligaciones de facturación
en España, y eso el código no puede deducirlo. Por eso se pregunta al cliente
en Ajustes en vez de mirar el país.

⚠️ **Antes de firmar la declaración responsable**: su apartado 1.e declara que
el sistema opera exclusivamente como VERI\*FACTU. Eso sigue siendo cierto —
para quien está obligado no hay otro modo— pero conviene que lo confirme el
abogado ahora que existen organizaciones sin registro.

### ⚠️ El registro de eventos es VOLUNTARIO para nosotros

**Antes de tocar nada del registro de eventos, lee esto.** Las FAQ de
desarrolladores de la AEAT (4 de diciembre de 2025, `docs/aeat/FAQs-Desarrolladores.pdf`,
apartado 15, NOTA 1) dicen literalmente:

> El productor de un SIF que solo puede actuar exclusivamente en modo
> VERI\*FACTU («SOLO VERI\*FACTU»), **no está obligado a implementar en él un
> registro de eventos**, pero puede hacerlo voluntariamente, si así lo desea.

Lo mismo vale para las funcionalidades de detección de anomalías. Archivum es
SOLO VERI\*FACTU (así se declara en el apartado 1.e de la declaración
responsable), luego:

- El **registro de eventos** no es obligatorio. Lo mantenemos por decisión propia.
- El **resumen cada 6 horas** del art. 9.2 tampoco: forma parte de ese registro.
  Se genera **una vez al día** y eso es suficiente.
- La **detección de anomalías** no tiene que estar ejecutándose constantemente;
  basta con que se pueda lanzar. La nuestra corre a diario, que es más de lo exigido.
- La firma `ds:Signature` del anexo 5 tampoco aplica.

**Esto deja de ser cierto si algún día se añade un modo NO VERI\*FACTU.** Ahí
todo lo anterior pasa a ser obligatorio, incluida la cadencia de 6 horas.

### Multi-obligado: las dos vías que admite la AEAT

De las mismas FAQ (apartado 16). Remitir en nombre de terceros se puede:

| Vía | Qué exige |
|---|---|
| **Colaboración social** | Convenio con la AEAT. Se solicita a `comunicacion.sepri@correo.aeat.es` o a la Delegación del domicilio fiscal, con estatutos, representante y datos de contacto. Para VERI\*FACTU valen los convenios 001, 002 (intermediarios) y **017** (empresas de software) |
| **Apoderamiento** | El obligado otorga la representación con el **Anexo II** de la Resolución de 18 de diciembre de 2024 (BOE 31-12-2024), modelo no obligatorio |

Hoy el sistema usa el certificado de cada obligado, que es una tercera vía y no
necesita ninguno de los dos trámites. Elegir entre ellas es decisión de negocio.

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
| `VERIFACTU_PRODUCER_NAME` / `_NIF` | ✅ (provisional) | `ARCHIVUM. VV S.C. (EN CONSTITUCIÓN)` / `J93941003` — NIF provisional (tarjeta AEAT del 17 de agosto), cargadas en Vercel y redesplegadas el 21 de agosto. Cambiar cuando llegue el NIF/certificado definitivo |
| `VERIFACTU_PRODUCER_ADDRESS` | ✅ (provisional) | `Calle Bajada al Molino, 10, Planta 3, Puerta A, 09400 Aranda de Duero (Burgos)` — de la tarjeta de NIF del 17 de agosto |
| `VERIFACTU_PRODUCER_WEBSITE` | ✅ | `https://archivum.es` |
| `VERIFACTU_PRODUCER_EMAIL` | ❌ | Declaración responsable, apartado 2.a |
| `VERIFACTU_DECLARATION_PLACE` / `_DATE` / `_ISSUED` | ❌ | Idem |
| `VERIFACTU_SYSTEM_ID` | opcional | Por defecto `AR`. **No cambiar una vez en producción** |
| `VERIFACTU_ENDPOINT_PROD` / `_TEST` | opcional | Sobrescriben las URLs de la AEAT (certificado de representante) |
| `VERIFACTU_ENDPOINT_TEST_SELLO` / `_PROD_SELLO` | opcional | Certificado de sello: `prewww10` y `www10`. Los cuatro endpoints salen del WSDL |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | ❌ | Monitorización de errores (`@sentry/nextjs`). Mismo DSN en las dos; falta configurarlas en Vercel |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | opcional | Subida de source maps en el build. Sin `SENTRY_AUTH_TOKEN` el build funciona igual, solo que las trazas en Sentry salen minificadas |

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
- **Sistema de diseño del móvil**: tokens en `apps/mobile/lib/{typography,spacing,radius,shadows}.ts`
  y componentes en `apps/mobile/components/ui/` (`Button`, `Card`, `Badge`, `Input`,
  `EmptyState`, `Skeleton`) más `DocRow`/`UploadFab` en `components/`. Antes cada
  pantalla reinventaba sus propios `fontSize`/`fontWeight`, radios y sombras, y
  `DocRow` estaba copiado tal cual en dashboard, biblioteca y buscar. Antes de
  añadir un botón, tarjeta o fila de documento a mano, mirar aquí primero.

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
| 30 ago | **Verificación en dos pasos también en el móvil.** La entrada del 25 de agosto de aquí abajo decía que el móvil se quedaba fuera a propósito — ya no. Mismo mecanismo nativo de Supabase Auth (`supabase.auth.mfa.*`), sin tabla nueva. `signInEmpresa`/`signInUsuario` (`apps/mobile/context/auth-context.tsx`) comprueban `getAuthenticatorAssuranceLevel()` justo después del login con contraseña: si hay un factor TOTP verificado y la sesión se queda en `aal1`, en vez de ir al dashboard se manda a la nueva pantalla `app/(auth)/mfa.tsx` (código de 6 dígitos, `mfa.challengeAndVerify`). Su firma cambió de `Promise<string \| null>` a `Promise<{ error, mfaRequired }>` — únicos consumidores eran login.tsx, ya actualizado. `app/index.tsx` y `(app)/_layout.tsx` repiten la misma comprobación como cierre, para cubrir reabrir la app con una sesión `aal1` ya persistida en disco, no solo el login recién hecho. `/api/*` en la web sigue sin pedirlo — se autentica con Bearer token, ajeno a esta comprobación de sesión de cliente — así que nada cambia ahí |
| 25 ago | **Verificación en dos pasos (TOTP), opcional, solo web por ahora.** Usa el MFA nativo de Supabase Auth (`supabase.auth.mfa.*`) en vez de una implementación propia — los factores viven en el esquema `auth` de Supabase, no hay tabla nueva. Cada usuario la activa desde Ajustes → Seguridad → `/configuracion/seguridad` (`security-settings-view.tsx`): escanea un QR con su app de autenticación (Google Authenticator, Authy, 1Password...) y confirma con un código de 6 dígitos antes de quedar activada. El corazón está en `lib/supabase/proxy.ts` (middleware): tras iniciar sesión con contraseña, quien tenga un factor TOTP verificado se queda en `aal1` — `getAuthenticatorAssuranceLevel()` lo detecta y redirige a `/auth/mfa` (nueva pantalla, fuera de `(protected)`) antes de dejar pasar a ninguna ruta protegida; sin factor activado, nada cambia. El móvil se queda fuera de esta sesión a petición explícita — `/api/*` sigue respondiendo tal cual para no romper la app |
| 25 ago | **Corregido: el tutorial de Panel Principal (y cualquier otro que algún día conviva con `.animate-slide-up-fade`) se salía de la pantalla** en vez de aparecer centrado con fondo oscuro. Causa real, no de caché: esa clase de animación usaba `animation: ... both`, así que su keyframe final (`transform: translateY(0); filter: blur(0)`) se quedaba aplicado al elemento **para siempre** después de terminar — y cualquier `transform`/`filter` distinto de `none`, aunque sea la identidad, convierte a ese elemento en el *containing block* de sus descendientes `position: fixed`. El diálogo del tutorial (que es `fixed inset-0`) quedaba entonces atrapado dentro de la cajita de la cabecera del Panel (la única vista que usa esa clase justo alrededor del botón de ayuda), no en el viewport — de ahí que solo esa sección se viera rota. Reproducido y verificado con capturas antes/después (`app/globals.css`): cambiado el `fill-mode` de `both` a `backwards`, visualmente idéntico (el estado final ya era el mismo que el de por defecto) pero sin dejar el transform/filter colgado tras el fin de la animación |
| 25 ago | **El tutorial por sección deja de ser un salto dentro del carrusel completo y pasa a ser un recorrido aislado**. `TutorialModal` acepta ahora `slideKeys?: SlideKey[]`: si se pasa, el carrusel se restringe a esas diapositivas y solo a ellas — "Siguiente" ya no puede derivar hacia un tema ajeno a la sección, y el botón final dice "Entendido" en vez de "Comenzar". `TutorialHelpButton` construye siempre ese array a partir de su prop `slide` (acepta una clave suelta o una lista). Pedidos y Albaranes, al ser un mismo flujo partido en dos pantallas, ahora abren un tutorial de 2 pasos (`["quotes","deliveryNotes"]` y a la inversa) en vez de cada uno mostrar solo su propia diapositiva suelta. Motivado por que el diseño anterior (heredado de la sesión paralela, ver entrada de abajo) no se sentía "personalizado por pestaña" — corrección directa a petición del cliente. De paso, añadido a las diapositivas de Clientes e Inventario el paso que faltaba: la importación masiva desde Excel (plantilla descargable, validación fila a fila) que ya existía en el código pero no estaba documentada en ningún tutorial |
| 21 ago | **Completado el tutorial por sección** (empezado en paralelo por otra sesión con `TutorialHelpButton`/`initialSlide`: salta a la diapositiva de esa sección dentro del carrusel completo, no lo aísla — ese diseño se mantuvo tal cual, era el ya en producción). Añadidas las 4 secciones que faltaban: Panel, Pedidos, Albaranes y Ajustes — las tres primeras no tenían tutorial en absoluto, y el circuito Pedido → Albarán → Factura no aparecía en ningún sitio pese a ser el flujo principal. Facturación actualizado con moneda, rectificativas y anulación. De paso, corregido contenido desactualizado: el rol decía "Gestor" en español desde que se renombró a "Colaborador", y "Manager" en inglés cuando la interfaz siempre ha dicho "Member" |
| 21 ago | **Tutorial por sección + importación de clientes/inventario desde Excel**. El tutorial de Ajustes (`components/tutorial-modal.tsx`) ahora acepta `initialSlide`, y cada sección (Clientes, Subir, Biblioteca, Inventario, Facturación, Buscador, Usuarios) tiene un botón «?» que lo abre directamente en su diapositiva (`components/tutorial-help-button.tsx`). La diapositiva de bienvenida muestra el logo de Archivum en vez del icono genérico. Nuevo `components/import-excel-button.tsx`: plantilla `.xlsx` descargable con columnas fijas, validación fila a fila (nombre obligatorio, email, país, números) y alta masiva en `companies`/`products`; añadido en Clientes e Inventario. Reutiliza la librería `xlsx` ya instalada (antes solo para exportar) |
| 21 ago | **`VERIFACTU_PRODUCER_ADDRESS`/`_WEBSITE` cargadas en Vercel y redesplegadas**: dirección fiscal de la tarjeta de NIF (`Calle Bajada al Molino, 10, Planta 3, Puerta A, 09400 Aranda de Duero (Burgos)`) y `https://archivum.es` como sitio web. Sigue faltando `VERIFACTU_PRODUCER_EMAIL` |
| 21 ago | **`VERIFACTU_PRODUCER_NAME`/`_NIF` cargadas en Vercel y redesplegadas**, con los valores provisionales del NIF recibido el 17 de agosto (ver entrada siguiente). Cambiar cuando llegue el NIF/certificado definitivo |
| 21 ago | **Recibido el NIF provisional de la sociedad**: tarjeta de identificación fiscal de la AEAT (Delegación de Burgos), fechada el 17 de agosto de 2026. `ARCHIVUM. VV S.C. (EN CONSTITUCIÓN)`, NIF **`J93941003`** (provisional), domicilio fiscal/social en Calle Bajada al Molino 10, planta 3, puerta A, 09400 Aranda de Duero (Burgos). **No es el certificado digital** — es solo la tarjeta de NIF; sigue faltando el certificado real de producción, que se emite cuando la sociedad termine de constituirse. La AEAT puede pedir documentación adicional (escrituras/estatutos) en el plazo de 1 a 6 meses |
| 19 ago | **Sentry instalado en la web** (`@sentry/nextjs`, errores + tracing, sin Session Replay/Logging/Profiling todavía). `instrumentation-client.ts`, `sentry.server.config.ts`/`sentry.edge.config.ts` (comparten opciones vía `sentry.options.ts`), `instrumentation.ts` y `app/global-error.tsx`. `next.config.mjs` envuelto con `withSentryConfig` (`tunnelRoute: '/monitoring'`, excluido del matcher del middleware). **Faltan las variables de entorno en Vercel** (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` y, para source maps legibles, `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) y verificar en real que un error llega al dashboard — no se pudo confirmar en esta sesión por un fallo previo del entorno de pruebas (`tailwindcss` v4 sin resolver con Turbopack, ajeno a Sentry) |
| 19 ago | **Aviso por correo al añadir una cuenta ya existente a otra organización** (caso típico: una gestoría que trabaja con varios clientes nuestros, mismo correo, distinto rol en cada uno). Antes `/api/members/create` insertaba la membresía y no avisaba a nadie del código de empresa nuevo — ni por correo ni en pantalla. Ahora manda un correo (`buildAddedToOrgEmail`) con el nombre de la organización, el rol y el código de acceso, aclarando que debe entrar con el mismo correo y contraseña de siempre. El panel de "usuario creado" en Ajustes → Usuarios también cubre este caso (sin mostrar contraseña, que no cambia) |
| 13 ago | **Páginas legales placeholder**: `/privacidad`, `/cookies`, `/terminos` (públicas, enlazadas desde Ajustes → Legal). No llevan texto legal — son un índice de qué cubrirá cada una cuando el abogado lo redacte, con un aviso visible de que no es texto vigente. Se creó `components/legal-placeholder.tsx` para las tres. Detectado al revisar que la app no tenía ninguna de las tres pese a tratar datos personales reales |
| 13 ago | **Corregido: `cert_kind` (representante/sello) siempre salía "sello"**. En `/api/verifactu/certificate`, `cert.subject.getField('2.5.4.42')` pasaba el OID como string — node-forge lo interpreta entonces como búsqueda por `shortName`, no por OID, así que nunca encontraba nada y `givenName`/`surname` quedaban siempre vacíos. El mismo fallo hacía que el NIF se guardara con el `CN` completo en vez del campo limpio. Corregido pasando `{ type: oid }`. Detectado al subir el certificado de pruebas de persona física de la AEAT: quedó mal clasificado como sello, lo que habría mandado la remisión SOAP al host equivocado (`prewww10` en vez de `prewww1`) |
| 13 ago | **Corregido: no se podía emitir ninguna factura** (`new row violates row-level security policy for table "verifactu_chain_links"`). Esa tabla tiene RLS activo desde que se creó el 8 de agosto pero nunca tuvo política de `INSERT` — solo de lectura. `insertChainedInvoice()` inserta ahí con el cliente del propio usuario justo después de insertar en `invoices`, así que necesitaba una política, calcada de la que ya rige `INSERT` en `invoices` (`is_org_admin` + plan de pago). Migración `20260813_verifactu_chain_links_insert_policy.sql`, aplicada directamente en producción vía MCP |
| 13 ago | **Certificados de pruebas de la AEAT recibidos** (persona física `99999910G` y persona jurídica `A39200019`, formato `.pfx`/`.p12`). Verificados como contenedores PKCS#12 v3 válidos; quedan por subir a través de la app con su contraseña, que no se comparte por chat |
| 13 ago | **Corregido: `/configuracion/verifactu` (certificado + estado) no tenía ninguna entrada en el menú** — solo se llegaba por un enlace pequeño dentro de Facturación o escribiendo la URL a mano. Añadida una tarjeta visible en Ajustes → sección «VERI\*FACTU», junto a la de Declaración responsable |
| 13 ago | **Quitada de Ajustes la tarjeta «Importación por correo»**. `inbox.archivum.app` no tiene registros MX (no resuelve) y no hay proveedor de correo entrante contratado, así que la dirección que se mostraba no recibía nada — `email_inbox_log` seguía en 0 filas. Se decidió no pagar un proveedor por ahora. El endpoint `/api/inbox/webhook`, la columna `organizations.inbox_token` y la tabla `email_inbox_log` se dejan tal cual (inertes) por si se retoma más adelante — ver `Docs/email-inbox-setup.md` para lo que falta: DNS + proveedor (Resend Inbound Pro, Postmark, Mailgun o Cloudflare Email Routing) |
| 12 ago | **Revisión de seguridad (4ª pasada, advisor de seguridad de Supabase)**: nada de esto lo detecta `tsc` ni el build porque vive en la base de datos, no en el código de la app. El único ERROR del linter: `quote_counters` tenía RLS **desactivado por completo** (a diferencia de `invoice_counters`, que sí lo tiene) con `anon`/`authenticated` con permisos de tabla completos — cualquiera en internet, sin sesión, podía alterar o borrar el contador de numeración de presupuestos/albaranes de cualquier organización. Corregido igualando a `invoice_counters` (RLS activo, sin políticas). Más grave todavía: la función `update_member_role()` (RPC llamada desde `users-view.tsx`/`equipo.tsx`) solo comprobaba `is_org_admin()` y no restringía qué rol se podía asignar — **la escalada de privilegios de la 2ª pasada seguía abierta por esta vía**, sin pasar por `/api/members/create`. Corregido: exige ser `owner` para asignar `owner`. De paso, fijado `search_path` en las 32 funciones que el linter marcó como mutable (varias son `SECURITY DEFINER` que deciden acceso — `is_org_admin`, `can_access_company`...; no explotable hoy porque `anon`/`authenticated` no tienen `CREATE` en `public`, pero es el endurecimiento estándar). Las tres cosas se aplicaron directamente en producción vía MCP y quedaron versionadas en migraciones |
| 12 ago | **Revisión de seguridad (3ª pasada, con MCP de Supabase)**: comprobado directamente contra el proyecto (`ddlvrycexamzznwtmchd`) qué `allowed_mime_types` tienen los buckets de Storage — el bucket `documents` ya excluía `image/svg+xml` a nivel de infraestructura (la duda sobre XSS por SVG en el webhook de inbox no era explotable en la práctica). El bucket `logos`, en cambio, no tenía ni `file_size_limit` ni `allowed_mime_types` propios pese a ser público — toda la restricción vivía solo en `/api/organizations/logo/route.ts`. Corregido con `UPDATE storage.buckets` (migración `20260812_restrict_logos_bucket.sql`, **ya aplicada directamente en producción** vía MCP): ahora el propio bucket exige `image/{png,jpeg,webp}` y ≤2MB, como defensa en profundidad si algún día algo escribe ahí sin pasar por esa ruta |
| 12 ago | **Revisión de seguridad (2ª pasada)**: el cierre de "sesión en otro dispositivo" (`active_session_id`) era cosmético — solo redirigía la pestaña vieja en su siguiente carga de página, pero el token de Supabase de esa sesión seguía siendo válido para llamadas directas a la API o al cliente de Supabase. Ahora, al iniciar sesión (web: `register-session` y `auth/callback`; móvil: `registerDeviceSession`), se llama a `supabase.auth.signOut({ scope: 'others' })`, que revoca de verdad el refresh token de cualquier otra sesión del mismo usuario en el servidor de Supabase. Relevante porque `members/create` manda contraseñas temporales por correo: si alguien más la usa antes que el destinatario, ahora sí se le corta el acceso al iniciar sesión el legítimo, no solo la próxima vez que cargue una página |
| 12 ago | **Revisión de seguridad**: corregida escalada de privilegios en `/api/members/create` (un admin de organización podía invitar a alguien con `role: 'owner'` sin que el dueño real lo aprobara — ahora solo un `owner` o super admin puede asignar `owner`, y el rol se valida contra una lista blanca). `INBOX_WEBHOOK_SECRET` pasa de opcional a obligatorio (fail-closed, como `CRON_SECRET`) — **hay que configurarlo en Vercel si no lo estaba, o el webhook de correo entrante dejará de aceptar nada**. `image/svg+xml` excluido de los adjuntos aceptados por ese webhook (un SVG puede llevar `<script>`, riesgo de XSS almacenado). Comparación de `CRON_SECRET` pasada a `timingSafeEqual`. Cabeceras de seguridad (`X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`) añadidas en `next.config.mjs`. HTML del email de invitación de `members/create` ahora escapa `displayName`/`orgName`/etc., igual que ya hacía `document-email.ts` |
| 12 ago | **Selector de moneda** en presupuestos, albaranes y facturas (EUR/USD/GBP, tipo de cambio manual — euros por unidad de moneda extranjera). El registro de alta, la huella y el QR de VeriFactu siguen yendo siempre en euros (su esquema no tiene campo de moneda): `lib/invoice-issue.ts` convierte con el tipo de cambio antes de construir el registro; la factura, sus líneas y el PDF se quedan en la moneda elegida. `lib/currency.ts` (web y móvil) centraliza la lista de monedas, el formateo y la conversión. Migración `20260812_invoice_currency.sql`, ya aplicada |
| 12 ago | **Corregido: no se podía facturar un albarán** (`invoices_verifactu_status_check` rechazaba `not_applicable`). El 10 de agosto se añadió `verifactu_obligado` y el código empezó a escribir `verifactu_status = 'not_applicable'` para quien lo desmarca, pero el CHECK de la tabla `invoices` seguía sin ese valor — migración `20260812_verifactu_status_not_applicable.sql`. **Pendiente de aplicar en el Dashboard de Supabase** (no se aplica sola) |
| 11 ago | La imagen de perfil de Ajustes (móvil) y la fila de usuario del sidebar (web) muestran el logo de la organización cuando existe, en vez de solo iniciales. Se actualiza en caliente al subir/quitar el logo |
| 11 ago | **Sistema de diseño para el móvil**: tokens de tipografía (Plus Jakarta Sans)/spacing/radio/sombras y componentes `Button`/`Card`/`Badge`/`Input`/`EmptyState`/`Skeleton` en `components/ui/`. Migradas las ~24 pantallas y componentes del móvil; de paso, `DocRow` dejó de estar copiado en tres sitios y se corrigió el patrón de `Chip`/`ActBtn` definidos dentro del componente en facturación/presupuestos, que remontaban en cada tecleo |
| 10 ago | **Corregida una falsa alarma**: el detector de anomalías ordenaba la cadena por hora, y con 4 eventos en el mismo segundo la daba por rota. Ahora sigue los enlaces |
| 10 ago | El móvil ya dice si la AEAT aceptó o rechazó el registro, en el detalle y en la lista. OTA al canal `preview` |
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
