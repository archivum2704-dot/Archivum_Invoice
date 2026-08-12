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
base imponible y cuota repercutida. La **clave de régimen** se toma del
obligado tributario (`organizations.verifactu_clave_regimen`); por defecto `01`,
régimen general. Un valor que el esquema no admita cae al régimen general en
lugar de enviarse tal cual: un código inválido hace que la AEAT rechace el
registro entero, y una factura rechazada es peor que una presentada bajo el
régimen general que su titular puede corregir después.

Las operaciones a tipo cero se declaran
como exentas, no como tipo cero, por ser figuras distintas: las líneas exentas
se agrupan **por causa de exención** (lista L10, códigos E1 a E6), que el
usuario indica al marcar la línea como exenta.

**Destinatario.** Un cliente español se identifica por NIF. Un cliente no
residente se identifica mediante el bloque `IDOtro` (código de país según
ISO 3166-1 alfa-2, tipo de documento según la lista L7 de la AEAT, e
identificador). El sistema no permite consignar un identificador extranjero en
el campo NIF.

**Sistema informático.** Se declaran razón social y NIF del productor, nombre e
identificador del sistema, versión, número de instalación (identificador de la
organización), y los indicadores de uso: el sistema opera exclusivamente en
modo VERI\*FACTU y da servicio a varios obligados tributarios.

### 2.3.1 Moneda

El esquema de VeriFactu (`SuministroInformacion.xsd`) **no tiene campo de
moneda**: `CuotaTotal`, `ImporteTotal`, el desglose y la huella se calculan y
se remiten siempre en euros.

Presupuestos, albaranes y facturas pueden emitirse en EUR, USD o GBP
(`quotes.currency` / `invoices.currency`). Al elegir una moneda distinta de
EUR, el usuario introduce a mano un tipo de cambio (`exchange_rate`,
`invoices.exchange_rate` / `quotes.exchange_rate`) — euros por 1 unidad de la
moneda extranjera, tal y como lo escribe — que el Reglamento de Facturación
(RD 1619/2012, art. 6.1.j) exige indicar en el propio documento cuando no está
en euros.

`lib/invoice-issue.ts` conserva la factura (fila, líneas, PDF) en la moneda
elegida, y solo convierte a euros los importes que entran en
`computeHuella`/`buildRegistroAlta`/`buildQrUrl` — línea por línea, para que el
desglose por tipo también quede en euros. `app/api/invoices/rectify` hereda la
moneda y el tipo de cambio de la factura que rectifica. La conversión no es
automática ni por API externa: el tipo de cambio lo fija el usuario en el
momento de emitir, y queda guardado junto al registro para que sea
reproducible.

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
(`TipoHuella = 01`). La cadena se codifica en UTF-8 antes de aplicar el
algoritmo.

Los importes se normalizan a dos decimales con separador `.`; las fechas a
`DD-MM-AAAA`; la marca temporal en ISO-8601 con desplazamiento horario
explícito. Los valores se consignan sin espacios al principio ni al final. Un
campo ausente o vacío aparece igualmente en la cadena, con su nombre y el signo
`=` sin valor a continuación.

**Contrastado contra los ejemplos oficiales.** El documento de la AEAT
«Detalle de las especificaciones técnicas para generación de la huella o hash
de los registros de facturación» (v0.1.2, 27/08/2024) publica en su apartado 6
tres casos con su huella resultante. Los tres se ejecutan en cada cambio
(`npm run verifactu:check`) y los tres coinciden. No es una interpretación de
la norma: es el valor que la AEAT dice que debe salir.

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

### 5.3 Destino de la remisión

La AEAT atiende los certificados de **representante** y los de **sello** en
hosts distintos. No es un detalle de configuración: presentar un certificado de
sello en el host de representante hace fallar la remisión.

| Entorno | Representante | Sello |
|---|---|---|
| Pruebas | `prewww1.aeat.es` | `prewww10.aeat.es` |
| Producción | `www1.agenciatributaria.gob.es` | `www10.agenciatributaria.gob.es` |

Ruta en todos los casos:
`/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`. Las cuatro direcciones
son las de los puertos `SistemaVerifactu`, `SistemaVerifactuSello` y sus
variantes `Pruebas` del WSDL publicado por la AEAT.

El tipo de certificado se determina al subirlo, leyendo el sujeto del propio
certificado: los de representante identifican además a la persona física que lo
posee (nombre y apellidos), los de sello identifican solo a la entidad. Se
guarda en `org_certificates.cert_kind`.

Las cuatro son parametrizables por variable de entorno, porque son direcciones
de la AEAT y ya se han movido antes.

### 5.4 Momento y reintentos

La remisión se intenta **en el mismo acto de expedición**. Un barrido programado
recoge después los registros que no hayan llegado a la AEAT por indisponibilidad
del servicio, caducidad del certificado o fallo de red. Ese barrido se ejecuta
hoy una vez al día, por la misma limitación del plan de alojamiento que afecta
al resumen de eventos.

Ningún registro se descarta jamás. Un rechazo se anota contra la factura, con
el código y la descripción devueltos por la AEAT, y queda visible para su
revisión. Un fallo de transporte deja el registro pendiente y se reintenta.

### 5.5 Control de flujo

El tiempo de espera que la AEAT devuelve en cada respuesta se almacena por
organización y se respeta antes de la siguiente remisión.

### 5.6 Criterio de confirmación

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

## 7. Registro de facturación de anulación

*(art. 11 del Reglamento)*

La anulación de una factura genera su propio registro, encadenado en la misma
cadena que los registros de alta. Contiene el identificador de la factura
anulada (emisor, número y fecha de expedición), el encadenamiento con el
registro anterior, el sistema informático, la marca temporal y su huella,
calculada sobre el conjunto de campos que fija el artículo 13.1.b de la Orden.

Cuando la factura anulada nunca llegó a remitirse a la AEAT, el registro
declara `SinRegistroPrevio`. El sistema rechaza anular una factura que ya está
anulada, que ya ha sido rectificada, o que no ha llegado a expedirse.

---

## 8. Conservación, descarga y volcado

*(art. 8.2.c del Reglamento)*

Los registros de facturación se conservan en PostgreSQL con copias de seguridad
gestionadas por el proveedor de base de datos. Al no existir vía de borrado
para una factura expedida, los registros permanecen íntegros durante toda la
vida de la cuenta.

El sistema dispone además de una **exportación de los registros de facturación**
por período, a fichero electrónico legible, descargable desde la propia
aplicación. Cada exportación queda anotada en el registro de eventos.

La **exportación de los registros de evento** es una operación distinta, con su
propia descarga y su propio tipo de evento (09), conforme al artículo 9.1.i de
la Orden. Admite acotar el período. Ambas exportaciones verifican la cadena que
están exportando y dejan constancia si encuentran una ruptura.

---

## 9. Registro de eventos

*(art. 8.3 del Reglamento y art. 9 de la Orden)*

El sistema registra automáticamente, en el momento en que se producen, los
sucesos que la Orden exige y los propios de la operación: generación de
registros de alta y de anulación, remisiones a la AEAT y su resultado, alta y
baja de certificados, lanzamiento de las detecciones de anomalías, anomalías
encontradas, exportaciones y restauraciones.

Los eventos forman **su propia cadena**, con una huella calculada sobre los
ocho campos que fija el artículo 13.1.c de la Orden. Son **consultables desde
el propio sistema** en Ajustes → Veri\*Factu → Eventos.

Registrar un evento nunca interrumpe la operación que lo provoca: un fallo al
anotar se reporta y se traga, porque una factura que no se pudiera expedir por
no haber podido escribir su línea de registro sería peor resultado que la línea
ausente. Ningún evento generado por el propio sistema se atribuye a un usuario.

### 9.1 Detección de anomalías

*(art. 9.1.c-f de la Orden)*

Se verifican dos cosas distintas, porque fallan de forma distinta:

- **Trazabilidad**: que el predecesor declarado por cada registro sea la huella
  del registro anterior. Detecta una cadena rota o bifurcada.
- **Integridad**: que la huella almacenada en cada registro sea la que su propio
  contenido produce al recalcularla. Detecta un registro editado en su sitio,
  donde la cadena seguiría cuadrando pero la huella ya no cubriría lo que dice
  cubrir.

Se deja constancia tanto del **lanzamiento** de cada comprobación como de su
resultado: así, la ausencia de hallazgos es prueba de que alguien miró.

### 9.2 Códigos de `TipoEvento`

El esquema `EventosSIF.xsd` no admite texto libre: `TipoEvento` es un código.

| Código | Evento |
|---|---|
| 03 / 04 | Lanzamiento y hallazgo de anomalías en registros de facturación |
| 05 / 06 | Lanzamiento y hallazgo de anomalías en registros de evento |
| 07 | Restauración de copia de seguridad |
| 08 / 09 | Exportación de registros de facturación / de evento |
| 10 | Registro resumen de eventos |
| 90 | Otros, a registrar voluntariamente por el productor |

Los códigos 01 y 02 (inicio y fin de funcionamiento como NO VERI\*FACTU) no se
emiten nunca: Archivum solo opera como VERI\*FACTU, y anunciar el otro modo
sería falso.

Los eventos propios del sistema —generación de registros, remisiones, alta y
baja de certificados— se registran como **90**, con su nombre descriptivo en
`OtrosDatosEvento`. La aplicación conserva ese nombre en su propia tabla, que
es lo que ve el usuario en la pantalla de consulta.

### 9.3 Registro resumen de eventos

*(art. 9.2 de la Orden)*

Se genera un resumen de lo ocurrido desde el resumen anterior, incluso cuando
no ha ocurrido nada — la circunstancia de que no haya actividad es justamente
lo que el resumen atestigua.

⚠ **PENDIENTE.** El artículo exige un resumen **por cada seis horas** de
funcionamiento. Hoy se genera **una vez al día**, porque el plan de alojamiento
contratado no admite más de una tarea programada diaria. **El sistema incumple
el artículo 9.2 hasta que se amplíe el plan.**

Los registros se conservan en JSONB con **los nombres de elemento del esquema**
`EventosSIF.xsd`, y se serializan a **XML UTF-8** conforme al anexo 5 al
exportarlos, de modo que el almacenamiento y el formato exigido no divergen.

⚠ **La serialización omite `ds:Signature`**, que el esquema declara
obligatorio. En VERI\*FACTU no existe firma electrónica expresa de los
registros —quedan firmados al remitirse con el certificado del obligado—, así
que no hay nada que serializar ahí; emitir un elemento vacío afirmaría una
firma inexistente. La exportación lo hace constar en el propio fichero.
Pendiente de confirmar con la AEAT, que publica este esquema como definición
del registro de eventos «para sistemas **no** VERI\*FACTU».

---

## 10. Control de acceso

- Autenticación mediante Supabase Auth.
- Autorización mediante **seguridad a nivel de fila** en PostgreSQL: un usuario
  solo alcanza los datos de las organizaciones a las que pertenece.
- Roles: propietario, administrador, miembro y visor. El rol visor es de solo
  lectura, impuesto también por políticas de base de datos.
- La expedición de facturas requiere rol de administrador o propietario.

---

### 10.1 Disociación de accesos

*(art. 8.4 del Reglamento)*

⚠ **PENDIENTE de revisión.** El Reglamento exige que el acceso a la información
con trascendencia tributaria esté disociado del acceso a información
confidencial de carácter no patrimonial, de forma que la Administración pueda
acceder directamente a la consulta de los registros de facturación y de
eventos. Archivum separa por roles y por organización, pero **no dispone de una
vía de acceso específica para la Administración tributaria**.

---

## 11. Verificación

El repositorio incluye un conjunto de comprobaciones automáticas
(`npm run verifactu:check`: los tres vectores oficiales de la AEAT más 95 comprobaciones) que verifican:

- que las bases del desglose suman la base imponible total y las cuotas suman
  la cuota total;
- que la huella se mantiene estable — **cualquier cambio la invalidaría, y con
  ella todas las cadenas ya emitidas**;
- que los elementos del XML salen en el orden que exige el esquema, que es de
  secuencia: un registro correcto en orden incorrecto es rechazado;
- que un cliente extranjero se identifica por `IDOtro` y nunca por NIF;
- que una respuesta ilegible o un SOAP Fault nunca se interpretan como envío
  correcto.

Los registros ya generados se recalcularon además **en la propia base de datos**,
con una implementación independiente de la del programa, y coincidieron uno a
uno. Al alterar deliberadamente una copia, la comprobación dejó de coincidir.

---

## 12. Requisitos pendientes

Relación honesta de lo que el sistema **todavía no cumple**:

| Requisito | Artículo | Estado |
|---|---|---|
| Firma `ds:Signature` del registro de evento | Anexo 5 | ⚠ No aplicable en VERI\*FACTU; a confirmar |
| Registro resumen cada seis horas | Orden 9.2 | ⚠ Diario: lo impide el plan de alojamiento |
| Descripciones de las claves de régimen | Orden L8A / L8B | ⚠ Códigos admitidos; faltan las etiquetas |
| Disociación de accesos para la Administración | RD 8.4 / 14 | ⚠ Pendiente de implementar (el criterio ya se conoce) |
| Verificación contra preproducción de la AEAT | — | ⚠ Nunca realizada |
| Identidad del productor configurada | RD 10.1.f | ⚠ Pendiente |
| Redacción y firma de la Declaración Responsable | RD 13 | ⚠ Pendiente (asesoría jurídica) |

### Formatos: ya contrastados

El artículo 13.2 de la Orden remite el **algoritmo y la codificación** de la
huella a un documento técnico de la sede de la AEAT. Ese documento (v0.1.2) se
obtuvo el 10 de agosto de 2026 y se conserva en `docs/aeat/`.

| | Campos | Formato |
|---|---|---|
| Huella de alta (13.1.a) | ✅ confirmados | ✅ contrastado con dos vectores oficiales |
| Huella de anulación (13.1.b) | ✅ confirmados | ✅ contrastado con un vector oficial |
| Huella de evento (13.1.c) | ✅ confirmados | ✅ nueve campos según el apartado 3.c (la AEAT no publica vector) |
| Endpoints SOAP | — | ✅ los cuatro, del WSDL |
| Códigos de error de la AEAT | — | ✅ los 247, en `lib/verifactu-error-codes.ts` |

Un formato equivocado produce una huella de aspecto válido que la AEAT rechaza
—marcándola como «Aceptado con errores», según el apartado 7 del documento—.
Por eso los vectores oficiales se ejecutan en cada cambio. **Si la AEAT publica
una versión nueva del documento, hay que volver a pasarlos.**

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
| Registro de anulación | `apps/web/lib/verifactu-annul.ts` |
| Registro de eventos | `apps/web/lib/verifactu-events.ts` |
| Detección de anomalías y resumen | `apps/web/lib/verifactu-integrity.ts` |
| Exportación de registros | `apps/web/app/api/verifactu/export/route.ts` |
| Causas de exención (L10) | `apps/web/lib/exemption-causes.ts` |
| Identificación fiscal extranjera (L7) | `apps/web/lib/tax-id-types.ts` |
| Serialización XML | `apps/web/lib/verifactu-xml.ts` |
| Transporte mTLS | `apps/web/lib/verifactu-client.ts` |
| Remisión y reintentos | `apps/web/lib/verifactu-submit.ts` |
| Cifrado de certificados | `apps/web/lib/crypto-vault.ts` |
| Declaración responsable | `apps/web/lib/declaracion-responsable.ts` |
| QR y representación de la factura | `apps/web/lib/invoice-pdf.ts` |
| Inalterabilidad | `apps/web/supabase/migrations/20260628_inventory_invoicing.sql` y `20260808_tighten_immutability.sql` |
| No bifurcación de la cadena | `apps/web/supabase/migrations/20260806_invoice_chain_uniqueness.sql` |
| Comprobaciones | `apps/web/scripts/verifactu-check.ts` |
