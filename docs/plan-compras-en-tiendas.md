# Plan: cobrar las suscripciones con Apple (iOS) y Google Play (Android)

> Estado: **propuesta, sin empezar**. Decisión del 25 de noviembre de 2026: la primera versión
> se publica en las dos tiendas **gratis y sin compras dentro de la app**; las cuentas se
> contratan en archivum.es con Stripe, como hasta ahora. Este documento es lo que haría falta
> para añadir después las compras de cada tienda, sin quitar la web.

## Por qué no ahora

- La app ya cumple las normas de las tiendas tal cual: no vende nada dentro y no enlaza al pago
  de la web (`BillingNotice`). Apple lo admite para servicios multiplataforma (norma 3.1.3(b)).
- Las compras de las tiendas son un proyecto con builds nativas nuevas en iOS y Android, trabajo
  de servidor y configuración en dos consolas.
- Las tiendas cobran comisión: **15 %** (Programa para Pequeñas Empresas de Apple, que hay que
  solicitar, y suscripciones de Google Play) y hasta **30 %** en algunos casos. Stripe en la web
  se queda mucho menos.

## Cómo quedaría

```
Web (archivum.es)  ── Stripe ──────────────┐
App iOS            ── App Store (Apple) ───┼──► servidor ──► organizations.subscription_plan
App Android        ── Google Play ─────────┘      (un solo sitio decide el plan)
```

Una organización tiene **una sola suscripción activa**, venga de donde venga. El plan se sigue
guardando en `organizations` (`subscription_plan`, `subscription_status`, `trial_ends_at`…), y
`resolveEntitlements` / `org_plan_limits()` no cambian: solo cambia **quién** escribe el plan.

## Herramienta recomendada: RevenueCat

Un solo SDK (`react-native-purchases`, compatible con Expo) para las dos tiendas, que valida los
recibos y avisa a nuestro servidor por webhook de cada compra, renovación, cancelación o
reembolso. Gratis hasta 2.500 $ de ingresos mensuales por tiendas; después, un 1 %.

La alternativa sin intermediario (`expo-iap` / `react-native-iap` y validar recibos contra Apple
y Google a mano) es más barata a largo plazo, pero bastante más código y más fácil de romper.

## Productos

Precios de la web hoy (sin IVA): Starter 14,99 €, Business 19,99 €, Pro 24,99 €; usuario extra
4,99 €/mes; bono de 250 documentos 4,99 € (pago único).

| Producto | Tipo en Apple | Tipo en Google | ID propuesto |
|---|---|---|---|
| Starter mensual | Suscripción con renovación automática | Suscripción | `archivum.starter.mensual` |
| Business mensual | Suscripción con renovación automática | Suscripción | `archivum.business.mensual` |
| Pro mensual | Suscripción con renovación automática | Suscripción | `archivum.pro.mensual` |
| Bono 250 documentos | **Consumible** | Producto in-app (consumible) | `archivum.bono.250docs` |

Las tres suscripciones van en **un mismo grupo de suscripciones** en Apple («Archivum»), para que
cambiar de plan sea subir o bajar dentro del grupo.

⚠️ **Decisiones de precio que tenéis que tomar:**

1. **IVA.** En las tiendas el precio que se pone es **con IVA incluido** (lo paga el cliente y lo
   ingresa la tienda). En la web los precios son sin IVA + 21 %. Si en la app se cobra 24,99 €,
   Archivum recibe menos que en la web (IVA y comisión dentro). Opciones: mismo precio final que
   la web (30,24 € con IVA para Pro), o algo más alto en la app para cubrir la comisión.
2. **Escalones de Apple.** Apple solo deja elegir entre sus escalones de precio; el más cercano a
   la cifra que decidáis.
3. **Usuarios extra.** En la web son una cantidad variable dentro de la misma suscripción. En las
   tiendas eso no existe tal cual: o se venden como suscripciones aparte («+1 usuario», «+2
   usuarios»…), o los usuarios extra se siguen contratando solo en la web. Lo más sencillo es lo
   segundo.
4. **Prueba de 30 días.** Hoy la da Archivum al registrarse, sin tarjeta. Con las tiendas se
   mantiene igual (no hace falta la oferta de prueba de Apple/Google); al acabar, la app ofrece
   contratar con la tienda.

## Trabajo por partes

### En las consolas (lo hacéis vosotros, con guía)

- **App Store Connect**: firmar el acuerdo de **apps de pago** (Negocio → Acuerdos), rellenar
  datos bancarios y fiscales, solicitar el Programa para Pequeñas Empresas, crear el grupo de
  suscripciones y los productos de la tabla, con nombre y descripción en español.
- **Play Console**: perfil de pagos, crear las suscripciones (con su plan base mensual) y el
  producto del bono.
- **RevenueCat**: crear el proyecto, conectar las dos tiendas (clave de App Store Connect y
  cuenta de servicio de Google) y definir los «entitlements» `starter`, `business`, `pro`.

### En el código

1. **App móvil**
   - Añadir `react-native-purchases`. Es nativo: **build nueva en iOS y en Android** (no basta
     una OTA).
   - Pantalla de planes en el móvil con los precios **que devuelve la tienda** (no los de
     `lib/pricing.ts`, que son sin IVA), botón de contratar y «Restaurar compras» (Apple lo exige).
   - Identificar al comprador con el **id de la organización** (`Purchases.logIn(orgId)`), para
     que la compra se asocie a la organización y no al teléfono.
   - Hoy el móvil tiene un botón de cancelar suscripción que llama a `/api/billing/cancel`
     (Stripe). Si la suscripción es de una tienda, ese botón debe abrir la gestión de
     suscripciones de Apple o Google, porque solo se puede cancelar allí.
   - Quitar `BillingNotice` donde se ofrezca comprar.
2. **Servidor (web)**
   - Ruta nueva `POST /api/billing/revenuecat` para el webhook de RevenueCat, protegida con su
     secreto. En cada evento escribe el plan en `organizations`, igual que hace hoy el webhook de
     Stripe (con `archivum.internal_billing_write`, porque `protect_billing_columns` bloquea el
     resto de escrituras).
   - Recargar el cupo de documentos al contratar y en cada renovación, como hace el webhook de
     Stripe desde el 16 de noviembre; el bono suma 250 al comprarlo.
   - Columna nueva `organizations.billing_source` (`stripe` / `app_store` / `play_store`) y el id
     de la suscripción de la tienda.
3. **Casos cruzados**
   - Quien ya paga en la web y abre la app: la app muestra su plan y **no** le ofrece comprar.
   - Quien paga en la app y entra en la web: la web muestra su plan y, en lugar de «Gestionar
     facturación» (portal de Stripe), le explica que se gestiona en la App Store o Google Play.
   - Que nadie pueda tener dos suscripciones a la vez (web + tienda): comprobarlo antes de dejar
     contratar en cualquiera de los dos sitios.
   - Fin de la prueba sin pagar: igual que hoy (el cron diario la pasa a Gratuito).
4. **Textos legales**: el aviso legal y las condiciones de contratación hablan de Stripe y de
   precios sin IVA. Las compras en tienda tienen sus propias condiciones (las de Apple y Google
   para pagos, reembolsos y cancelación). Hay que pasarlo por el abogado y subir `LEGAL_VERSION`.

### Pruebas

- Apple: cuentas de *sandbox* en App Store Connect y TestFlight.
- Google: pista de prueba interna con *testers* con licencia.
- Probar: compra, renovación (en sandbox las renovaciones son de minutos), cambio de plan,
  cancelación, reembolso, restaurar compras en otro teléfono, y los casos cruzados con la web.

## Orden propuesto

1. Decidir precios en tienda (IVA, comisión) y qué se vende en la app (¿solo los tres planes, o
   también el bono?).
2. Configurar las consolas y RevenueCat.
3. Servidor: webhook, columna `billing_source` y casos cruzados (se puede probar antes de tener
   builds nuevas).
4. App: pantalla de planes y compras; builds nuevas de iOS y Android.
5. Pruebas en sandbox / pista interna.
6. Revisión del abogado y publicación.

**Estimación**: una o dos semanas de desarrollo y pruebas, más lo que tarden las consolas
(acuerdos, datos fiscales) y la revisión de cada tienda.
