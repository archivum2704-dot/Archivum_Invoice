# Documentación técnica del Sistema Informático de Facturación

**Archivum** · Conformidad con el Real Decreto 1007/2023 y la Orden HAC/1177/2024

| | |
|---|---|
| Sistema | Archivum |
| Versión documentada | 1.0 |
| Productor | *(pendiente: razón social y NIF — variables `VERIFACTU_PRODUCER_NAME` / `VERIFACTU_PRODUCER_NIF`)* |
| Modo de operación | VERI\*FACTU (remisión a la AEAT) |
| Fecha | Agosto de 2026 |

> **Estado de este documento.** Describe el funcionamiento real del sistema tal
> como está implementado, verificable contra el código fuente. Es la
> documentación técnica que el artículo 13 del RD 1007/2023 exige mantener al
> productor. **No es la Declaración Responsable**, que es un documento distinto
> y debe redactarla y firmarla un asesor jurídico.
>
> Los apartados marcados **⚠ PENDIENTE** describen requisitos que el sistema
> todavía no cumple. Se incluyen deliberadamente: una documentación técnica que
> omitiera lo que falta no serviría para lo que existe.

---

## 1. Descripción general

Archivum es un sistema informático de facturación multi-contribuyente, ofrecido
como servicio web (`archivum.es`) y como aplicación móvil para Android e iOS.
Cada organización dada de alta corresponde a un obligado tributario distinto y
constituye una **instalación** independiente a efectos del registro de
facturación.

**Arquitectura:**

| Capa | Tecnología |
|---|---|
| Aplicación web | Next.js (App Router), renderizado en servidor |
| Aplicación móvil | React Native / Expo |
| Base de datos | PostgreSQL gestionado (Supabase) |
| Lógica de facturación | Servidor exclusivamente; nunca en el cliente |

La generación del registro de facturación, el cálculo de la huella y la
remisión a la AEAT ocurren **íntegramente en el servidor**. Las aplicaciones
cliente no pueden generar, alterar ni suprimir un registro: solo solicitan
operaciones al servidor, que es quien las valida y ejecuta.

---

## 2. Generación del registro de facturación de alta

### 2.1 Momento de generación

El registro se genera **en el mismo acto de expedición** de la factura, dentro
de la operación que la crea. No existe ninguna vía en el sistema para expedir
una factura sin generar simultáneamente su registro.

### 2.2 Numeración

La numeración es correlativa por serie y ejercicio, y se asigna mediante una
función atómica en base de datos (`next_invoice_number`) que incrementa un
contador bajo el control de concurrencia del propio motor. Dos expediciones
simultáneas no pueden obtener el mismo número.

La función exige que quien la invoca sea administrador de la organización; un
usuario sin ese rol no puede obtener un número de factura.

### 2.3 Contenido del registro

Cada registro de alta contiene, en el orden que fija el esquema de la AEAT:

`IDVersion`, `IDFactura` (NIF del emisor, número de serie, fecha de
expedición), `NombreRazonEmisor`, `TipoFactura`, `TipoRectificativa` y
`FacturasRectificadas` cuando procede, `DescripcionOperacion`, `Destinatarios`,
`Desglose`, `CuotaTotal`, `ImporteTotal`, `Encadenamiento`,
`SistemaInformatico`, `FechaHoraHusoGenRegistro`, `TipoHuella` y `Huella`.

**Desglose.** Se agrupa por tipo impositivo, no por línea de factura. Cada
entrada declara impuesto, clave de régimen, calificación de la operación, tipo,
base imponible y cuota repercutida. Las operaciones a tipo cero se declaran
como exentas, no como tipo cero, por ser figuras distintas.

**Destinatario.** Un cliente español se identifica por NIF. Un cliente no
residente se identifica mediante el bloque `IDOtro` (código de país según
ISO 3166-1 alfa-2, tipo de documento según la lista L7 de la AEAT, e
identificador). El sistema no permite consignar un identificador extranjero en
el campo NIF.

**Sistema informático.** Se declaran razón social y NIF del productor, nombre e
identificador del sistema, versión, número de instalación (identificador de la
organización), y los indicadores de uso: el sistema opera exclusivamente en
modo VERI\*FACTU y da servicio a varios obligados tributarios.

### 2.4 Tipos de factura soportados

| Código | Tipo |
|---|---|
| F1 | Factura completa (ordinaria) |
| F2 | Factura simplificada |
| R1 | Factura rectificativa |

Las rectificativas se emiten **por diferencias** (`TipoRectificativa = I`): el
registro declara los importes que se retiran, con signo negativo, referenciando
la factura rectificada mediante emisor, número y fecha.

---

## 3. Encadenamiento

### 3.1 Algoritmo

La huella es un **SHA-256** calculado sobre la concatenación, con separador
`&`, de los campos obligatorios en el orden que fija la especificación de la
AEAT:

```
IDEmisorFactura={NIF}
&NumSerieFactura={número}
&FechaExpedicionFactura={DD-MM-AAAA}
&TipoFactura={F1|F2|R1}
&CuotaTotal={importe}
&ImporteTotal={importe}
&Huella={huella del registro anterior}
&FechaHoraHusoGenRegistro={ISO-8601 con huso}
```

El resultado se representa en hexadecimal de 64 caracteres en mayúsculas
(`TipoHuella = 01`).

Los importes se normalizan a dos decimales con separador `.`; las fechas a
`DD-MM-AAAA`; la marca temporal en ISO-8601 con desplazamiento horario
explícito.

### 3.2 Continuidad de la cadena

Cada registro incorpora la huella del registro inmediatamente anterior de la
misma organización. El primer registro de una cadena declara
`Encadenamiento/PrimerRegistro = S`.

### 3.3 Garantía de no bifurcación

La integridad de la cadena está garantizada **en la propia base de datos**, no
solo por la lógica de aplicación. Un índice único
(`uq_invoices_chain`) sobre `(organization_id, huella_anterior)` impide que dos
registros declaren el mismo predecesor.

Si dos expediciones concurrentes intentan encadenar sobre la misma huella, la
segunda es rechazada por el motor de base de datos; la aplicación vuelve a leer
el extremo de la cadena, recalcula la huella y reintenta, **conservando el
número de factura ya asignado** para que la serie no presente saltos.

Este es el punto donde un sistema de facturación puede corromperse en
silencio. Aquí la corrupción es imposible por construcción: no depende de que
el código sea correcto, sino de una restricción que el motor hace cumplir.

---

## 4. Inalterabilidad

La inalterabilidad se impone mediante **disparadores de base de datos**, no
mediante controles en la interfaz. Un usuario con acceso directo a la API de
datos está sujeto exactamente a las mismas restricciones que uno usando la
aplicación.

### 4.1 Facturas expedidas

El disparador `protect_issued_invoice`:

- **Impide el borrado** de cualquier factura que no esté en estado borrador.
  El mensaje devuelto indica que la corrección debe hacerse mediante factura
  rectificativa.
- **Impide la modificación** de serie, número, número completo, tipo, fechas de
  expedición y operación, base imponible, cuota, total, huella, huella anterior
  y NIF de emisor y destinatario.

Solo se permite actualizar campos que no forman parte del registro: estado de
cobro, estado de remisión a la AEAT, y el enlace al documento archivado.

### 4.2 Líneas de factura

El disparador `protect_issued_invoice_lines` impide insertar, modificar o
suprimir líneas de una factura ya expedida.

### 4.3 Consecuencia

Una vez expedida una factura, ni el usuario, ni un administrador de la
organización, ni un administrador de la plataforma pueden alterar su contenido
ni su huella a través de la aplicación o de su API. La única corrección posible
es la emisión de una factura rectificativa, que a su vez genera su propio
registro encadenado.

---

## 5. Remisión a la AEAT

### 5.1 Modo de operación

El sistema opera en modo **VERI\*FACTU**: remite los registros de facturación a
la Agencia Tributaria.

### 5.2 Autenticación

Mediante **TLS mutuo** con el certificado electrónico del obligado tributario.
El certificado se almacena cifrado con **AES-256-GCM**; la clave de cifrado
reside exclusivamente en el entorno del servidor y nunca en la base de datos.
La tabla de certificados tiene seguridad a nivel de fila activada **sin
políticas**, lo que deniega todo acceso desde cliente: solo el servidor, con
credenciales de servicio, puede leerla.

### 5.3 Momento y reintentos

La remisión se intenta **en el mismo acto de expedición**. Un barrido horario
recoge los registros que no hayan llegado a la AEAT por indisponibilidad del
servicio, caducidad del certificado o fallo de red.

Ningún registro se descarta jamás. Un rechazo se anota contra la factura, con
el código y la descripción devueltos por la AEAT, y queda visible para su
revisión. Un fallo de transporte deja el registro pendiente y se reintenta.

### 5.4 Control de flujo

El tiempo de espera que la AEAT devuelve en cada respuesta se almacena por
organización y se respeta antes de la siguiente remisión.

### 5.5 Criterio de confirmación

Un registro se marca como remitido **únicamente** cuando la AEAT lo confirma de
forma explícita. Se tratan como no confirmados, y por tanto se reintentan:

- una respuesta que el sistema no logra interpretar;
- una respuesta en la que la AEAT no se pronuncia sobre ese registro concreto.

Dar por remitido cualquiera de esos dos casos marcaría como presentado un
registro que podría no estarlo.

---

## 6. Representación gráfica de la factura

Toda factura expedida genera un PDF que incluye:

- El **código QR** de cotejo, con NIF del emisor, número de serie, fecha e
  importe total, apuntando a la sede electrónica de la AEAT.
- La leyenda **VERI\*FACTU** y el texto «Factura verificable en la Sede
  electrónica de la AEAT».
- La **huella** del registro.

El PDF se archiva automáticamente en el repositorio documental de la
organización.

---

## 7. Conservación, descarga y volcado

*(art. 8.2.c del Reglamento)*

Los registros de facturación se conservan en PostgreSQL con copias de seguridad
gestionadas por el proveedor de base de datos. Al no existir vía de borrado
para una factura expedida, los registros permanecen íntegros durante toda la
vida de la cuenta.

⚠ **PENDIENTE.** El artículo 8.2.c exige además que el sistema cuente con «un
procedimiento de descarga, volcado y archivo seguro de los registros de
facturación generados por él, que deberán poder ser exportados a un
almacenamiento externo en formato electrónico legible». Archivum **no dispone
todavía** de esa función de exportación.

---

## 8. Registro de eventos

*(art. 8.3 del Reglamento)*

⚠ **PENDIENTE — no implementado.** El Reglamento exige un registro de eventos
que recoja automáticamente, en el momento en que se producen, las
interacciones con el sistema, las operaciones realizadas y los sucesos
ocurridos durante su uso, y que **debe poder consultarse desde el propio
sistema informático**.

---

## 9. Control de acceso

- Autenticación mediante Supabase Auth.
- Autorización mediante **seguridad a nivel de fila** en PostgreSQL: un usuario
  solo alcanza los datos de las organizaciones a las que pertenece.
- Roles: propietario, administrador, miembro y visor. El rol visor es de solo
  lectura, impuesto también por políticas de base de datos.
- La expedición de facturas requiere rol de administrador o propietario.

---

### 9.1 Disociación de accesos

*(art. 8.4 del Reglamento)*

⚠ **PENDIENTE de revisión.** El Reglamento exige que el acceso a la información
con trascendencia tributaria esté disociado del acceso a información
confidencial de carácter no patrimonial, de forma que la Administración pueda
acceder directamente a la consulta de los registros de facturación y de
eventos. Archivum separa por roles y por organización, pero **no dispone de una
vía de acceso específica para la Administración tributaria**.

---

## 10. Verificación

El repositorio incluye un conjunto de comprobaciones automáticas
(`npm run verifactu:check`, 57 comprobaciones) que verifican:

- que las bases del desglose suman la base imponible total y las cuotas suman
  la cuota total;
- que la huella se mantiene estable — **cualquier cambio la invalidaría, y con
  ella todas las cadenas ya emitidas**;
- que los elementos del XML salen en el orden que exige el esquema, que es de
  secuencia: un registro correcto en orden incorrecto es rechazado;
- que un cliente extranjero se identifica por `IDOtro` y nunca por NIF;
- que una respuesta ilegible o un SOAP Fault nunca se interpretan como envío
  correcto.

---

## 11. Requisitos pendientes

Relación honesta de lo que el sistema **todavía no cumple**:

| Requisito | Artículo | Estado |
|---|---|---|
| Registro de facturación de anulación | 11 | ⚠ No implementado |
| Registro de eventos, consultable desde el sistema | 8.3 | ⚠ No implementado |
| Procedimiento de descarga, volcado y exportación | 8.2.c | ⚠ No implementado |
| Declaración responsable **visible en el propio sistema** | 13.2 | ⚠ No implementado |
| Disociación de accesos para la Administración | 8.4 / 14 | ⚠ Pendiente de revisión |
| Verificación contra preproducción de la AEAT | — | ⚠ No realizada |
| Identidad del productor configurada | 10.1.f | ⚠ Pendiente |
| Causas de exención distintas del artículo 20 | — | ⚠ Solo E1 |
| Regímenes distintos del general | — | ⚠ Solo clave 01 |
| Redacción de la Declaración Responsable | 13 | ⚠ Pendiente (asesoría jurídica) |

**Mientras estos puntos no estén resueltos, el sistema no puede declararse
conforme al RD 1007/2023, y no debe emitirse Declaración Responsable alguna.**

---

---

## Anexo A — Contenido exigido a la Declaración Responsable

*(art. 13 del Reglamento, para el asesor que la redacte)*

Corresponde **al productor** del sistema certificar mediante declaración
responsable que el sistema cumple el artículo 29.2.j de la Ley 58/2003, este
Reglamento y las especificaciones de la orden ministerial de desarrollo.

Debe contener:

1. Datos que identifiquen el sistema informático y permitan conocer su
   **tipología, composición y funcionalidades**.
2. Las **características de la instalación**.
3. **Datos identificativos y de localización del productor**.
4. **Fecha y lugar** de la firma.

Requisitos formales que afectan al producto, no solo al documento:

- Debe constar **por escrito y de modo visible en el propio sistema
  informático, en cada una de sus versiones** (art. 13.2). Esto obliga a que
  Archivum muestre la declaración dentro de la aplicación.
- Debe estar disponible **para el cliente y el comercializador en el momento de
  la adquisición**.
- El productor debe **guardar y conservar las declaraciones de todas las
  versiones** producidas o comercializadas (art. 13.3).

Los apartados 1 y 2 pueden redactarse a partir de este documento técnico.

---

## Referencias

- Real Decreto 1007/2023, de 5 de diciembre (texto consolidado del BOE).
  Artículos citados: 8 (requisitos), 9 y 10 (registro de alta), 11 (registro de
  anulación), 12 (huella), 13 (declaración responsable), 14 (verificación por
  la Administración), 15 y 16 (remisión y facturas verificables)
- Orden HAC/1177/2024, de 18 de octubre
- Sede electrónica de la AEAT — Sistemas Informáticos de Facturación y VERI\*FACTU
  <https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html>
- Consultas técnicas: `verifactu@correo.aeat.es`

### Correspondencia con el código

| Apartado | Fichero |
|---|---|
| Generación del registro, huella | `apps/web/lib/verifactu.ts` |
| Continuidad de la cadena | `apps/web/lib/invoice-chain.ts` |
| Expedición | `apps/web/lib/invoice-issue.ts` |
| Rectificativas | `apps/web/app/api/invoices/rectify/route.ts` |
| Serialización XML | `apps/web/lib/verifactu-xml.ts` |
| Transporte mTLS | `apps/web/lib/verifactu-client.ts` |
| Remisión y reintentos | `apps/web/lib/verifactu-submit.ts` |
| Cifrado de certificados | `apps/web/lib/crypto-vault.ts` |
| Inalterabilidad | `apps/web/supabase/migrations/20260628_inventory_invoicing.sql` |
| No bifurcación de la cadena | `apps/web/supabase/migrations/20260806_invoice_chain_uniqueness.sql` |
| Comprobaciones | `apps/web/scripts/verifactu-check.ts` |
