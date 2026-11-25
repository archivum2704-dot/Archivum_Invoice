# Ficha de Archivum en la App Store

Textos para App Store Connect → Apps → Archivum. Los límites de caracteres son los de Apple;
`python3` comprobó que todos caben (ver al final).

> **Lo que no se dice, a propósito** (mismas reglas que la web y Google Play): nada de IA, nada de
> «conforme con VeriFactu» (solo «preparado»), nada de «datos en Europa». Y **ni precios ni planes ni
> «contrata en la web»**: Apple (norma 3.1.1 / 3.1.3) rechaza apps que animan a pagar fuera de su
> sistema de compras. La app ya cumple esto por dentro (`BillingNotice`).

## Información de la app

| Campo | Texto |
|---|---|
| Nombre (máx. 30) | `Archivum` |
| Subtítulo (máx. 30) | `Facturas y documentos en orden` |
| Categoría principal | Empresa |
| Categoría secundaria | Finanzas |
| URL de la política de privacidad | `https://www.archivum.es/privacidad` |
| Clasificación por edades | Responder «No» a todo el cuestionario → 4+ |
| Copyright | `2026 ARCHIVUM. VV, S.C.` |

## Versión 1.0.1

**Texto promocional** (máx. 170; se puede cambiar sin nueva revisión):

```
Factura, archiva tus tickets y facturas de compra y compártelo todo con tu gestoría desde el móvil. Preparado para VeriFactu.
```

**Palabras clave** (máx. 100, separadas por comas, sin espacios):

```
facturación,facturas,verifactu,albaranes,pedidos,gestoría,autónomos,gastos,tickets,clientes,stock
```

**Descripción** (máx. 4000):

```
Archivum reúne la facturación y los documentos de tu negocio en un solo lugar, en orden y listos para tu gestoría. Pensado para autónomos y pequeños negocios que quieren dejar atrás el Excel, las carpetas y los papeles.

FACTURA DESDE EL MÓVIL
• Crea pedidos, conviértelos en albaranes y factúralos sin volver a teclear nada.
• Cada factura queda conectada con su pedido y su albarán.
• Envía facturas y documentos por correo desde la propia app.
• Marca qué está cobrado, pendiente o vencido de un vistazo.

PREPARADO PARA VERIFACTU
• Cada factura emitida genera su registro con huella encadenada y código QR de cotejo.
• Remisión a la AEAT con tu certificado digital, que se guarda cifrado.

TUS DOCUMENTOS, SIEMPRE A MANO
• Fotografía tickets y facturas de compra o súbelos desde archivos.
• Biblioteca separada en ventas y compras, con carpetas y filtros por fecha, tipo y estado.
• Buscador para encontrar cualquier documento por número, empresa o importe.

CLIENTES, PROVEEDORES E INVENTARIO
• Clientes y proveedores en un mismo sitio, con sus datos fiscales y condiciones de pago.
• Productos con stock y aviso cuando bajan del mínimo.
• Las facturas de compra suben el stock automáticamente.

TRABAJA CON TU EQUIPO Y TU GESTORÍA
• Invita a tu equipo con distintos permisos.
• Da a tu gestor acceso de solo lectura a las carpetas que tú elijas.

SEGURIDAD
• Verificación en dos pasos opcional.
• Una sesión abierta por cuenta: al entrar en otro dispositivo se cierra la anterior.
• Puedes eliminar tu cuenta desde Ajustes en cualquier momento.

Archivum también funciona en el navegador, en archivum.es, con la misma cuenta.
```

| Campo | Texto |
|---|---|
| URL de soporte | `https://www.archivum.es` |
| URL de marketing | `https://www.archivum.es` |

## Información para la revisión de App Review

- **Iniciar sesión**: la cuenta de demostración creada para Google Play (correo y contraseña; no se escriben aquí).
- **Notas** (en inglés):

```
Archivum is an invoicing and document management service for small businesses in Spain.

Sign in with the demo account provided above (use the "Empresa" tab on the login screen).

The app does not sell anything: there are no in-app purchases and no links to external purchases. Accounts and their plans are managed by the business outside the app, as with other multiplatform business services (guideline 3.1.3(b)).

Account deletion: Settings (Ajustes) → Danger zone → Delete account.
```

## Privacidad de la app (cuestionario)

¿Recopilas datos de esta app? **Sí.** Para cada tipo: uso **Funcionalidad de la app**,
**vinculado a la identidad del usuario**, **no se usa para rastrear**.

| Tipo de dato | Qué es en Archivum |
|---|---|
| Información de contacto → Nombre | Nombre y apellidos del usuario |
| Información de contacto → Correo electrónico | Correo de la cuenta |
| Información de contacto → Teléfono | Teléfono de clientes y proveedores (opcional) |
| Contenido del usuario → Otro contenido del usuario | Facturas, documentos y fotos que se suben |
| Contenido del usuario → Fotos o vídeos | Fotos de tickets tomadas con la cámara |
| Información financiera → Otra información financiera | Importes de facturas y datos fiscales |
| Identificadores → ID de usuario | Identificador de la cuenta |

No marcar: ubicación, contactos del teléfono, historial de navegación, datos de uso con fines
publicitarios, diagnósticos (la app no lleva Sentry ni analítica).

## Capturas

`capturas/` — 5 imágenes de **1320 × 2868** (iPhone de 6,9"), en este orden:

1. `01-inicio.png` — Tus cobros y documentos de un vistazo
2. `02-subir.png` — Fotografía o sube facturas y tickets
3. `03-biblioteca.png` — Tu archivo, separado en ventas y compras
4. `04-clientes.png` — Clientes y proveedores en un solo sitio
5. `05-buscador.png` — Encuentra cualquier documento al momento

Si App Store Connect rechaza el tamaño («las dimensiones del archivo no son válidas»), hay las mismas imágenes en `capturas-6.7/` (1290 × 2796, iPhone de 6,7") y `capturas-6.5/` (1242 × 2688, iPhone de 6,5"). Se suben en **Distribución → versión → Vista previa y capturas de pantalla de la app**, en la pestaña del tamaño correspondiente.

Son las mismas pantallas que las de Google Play (`docs/play-store/capturas/`), con marco de
iPhone y la barra de estado de iOS en lugar de la de Android. Apple las reescala para los
demás tamaños de iPhone. No hacen falta capturas de iPad: `supportsTablet` es `false`.
