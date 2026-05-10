# Email Inbox — Setup

Auto-importa facturas, recibos y albaranes reenviados a una dirección única
de cada organización. Funciona con **cualquier proveedor de correo** del
usuario final (Gmail, Outlook, dominio propio, etc.) — basta con que reenvíe
o ponga en copia los emails a la dirección que le mostramos en su panel.

## Arquitectura

```
Usuario reenvía email ─→ Tu MX (inbox.archivum.app) ─→ Proveedor inbound (Resend / Postmark / Mailgun)
                                                              │
                                                              ▼
                                          POST /api/inbox/webhook  (Archivum)
                                                              │
                              ┌──────────────────────────────┴──────────────────┐
                              ▼                                                  ▼
                  org = lookup by inbox_token                       email_inbox_log row
                              ▼
                  attachments → Supabase Storage
                  documents row (status='pending')
                              ▼
                  AI extraction pipeline (existente)
```

## 1. Aplicar la migración SQL

Ejecuta en el SQL editor de Supabase el archivo:
`supabase/migrations/20260510_email_inbox_alias.sql`

Esto:
- añade `inbox_token TEXT UNIQUE NOT NULL` a `organizations` (con backfill para las orgs existentes)
- añade un trigger que asigna token automáticamente al insertar nuevas orgs
- crea la tabla `email_inbox_log` para auditoría e idempotencia

## 2. Configurar variables de entorno

En Vercel (`/apps/web`):

```
NEXT_PUBLIC_INBOX_DOMAIN=inbox.archivum.app
INBOX_WEBHOOK_SECRET=<genera-un-secret-largo-aleatorio>
```

`INBOX_WEBHOOK_SECRET` es opcional pero recomendado: se valida en el header
`x-archivum-webhook-secret`.

## 3. Configurar DNS para tu dominio inbox

Crea un subdominio dedicado (recomendado: `inbox.archivum.app`).

**Importante:** no uses tu dominio principal porque los providers inbound
toman control de los registros MX.

Añade en Cloudflare/Route53/donde lleves el DNS:

```
TIPO   NOMBRE                  VALOR                          PRIORIDAD
MX     inbox.archivum.app      <provider-mx>                  10
TXT    inbox.archivum.app      v=spf1 include:<provider> ~all
```

## 4. Elegir y configurar el proveedor

El endpoint `/api/inbox/webhook` auto-detecta el formato. Elige uno:

### Opción A — Resend Inbound  (recomendado si ya usas Resend)

> Requiere plan **Pro** ($20/mes). Mismo dashboard que para envío.

1. Resend Dashboard → **Domains** → añade `inbox.archivum.app`
2. Configura los registros MX que te dé Resend
3. Resend Dashboard → **Inbound** → New endpoint:
   - URL: `https://archivum2704-dot.vercel.app/api/inbox/webhook`
   - Match: `*@inbox.archivum.app`
   - Custom header: `x-archivum-webhook-secret: <tu-secret>`
4. Verifica enviando un email a `cualquiercosa@inbox.archivum.app`. Debe
   aparecer en `email_inbox_log` con `status='processed'`.

### Opción B — Postmark Inbound  ($15/mes)

1. Postmark Dashboard → **Servers** → New Server (Inbound)
2. Te asigna una dirección tipo `<hash>@inbound.postmarkapp.com`
3. Apunta tu MX a Postmark **o** configura un forward desde tu inbox a la
   dirección de Postmark
4. Postmark Server → Settings → Inbound webhook URL:
   `https://archivum2704-dot.vercel.app/api/inbox/webhook`
5. Activa "Include raw email content" — **no necesario** (el endpoint
   funciona con el JSON parseado)
6. Custom header: añade `x-archivum-webhook-secret` en la pestaña Advanced

### Opción C — Mailgun Routes  ($35/mes)

1. Mailgun Dashboard → Sending → Domains → añade `inbox.archivum.app`
2. Configura los MX records que te dé Mailgun
3. Mailgun → Receiving → Routes → Create Route:
   - Expression: `match_recipient(".*@inbox.archivum.app")`
   - Action: `forward("https://archivum2704-dot.vercel.app/api/inbox/webhook")`
   - Action: `stop()`
4. Headers personalizados: Mailgun no soporta header custom en routes, así
   que omite `INBOX_WEBHOOK_SECRET` o usa una URL con query string secreta
   (`?secret=...`) y modifica el endpoint para aceptarla.

### Opción D — Cloudflare Email Workers  (gratis hasta 10k emails/día)

1. Cloudflare Dashboard → tu dominio → **Email** → Routing → Enable
2. Cloudflare te genera registros MX automáticamente
3. Email Routing → Email Workers → crea un worker que haga POST a tu webhook:

```js
export default {
  async email(message, env) {
    const formData = new FormData()
    formData.append("from", message.from)
    formData.append("recipient", message.to)
    formData.append("subject", message.headers.get("subject") ?? "")
    formData.append("Message-Id", message.headers.get("message-id") ?? "")

    const stream = message.raw
    const blob = new Blob([await new Response(stream).arrayBuffer()])
    formData.append("attachment-1", blob, "email.eml")
    formData.append("attachment-count", "1")

    await fetch("https://archivum2704-dot.vercel.app/api/inbox/webhook", {
      method: "POST",
      headers: { "x-archivum-webhook-secret": env.INBOX_WEBHOOK_SECRET },
      body: formData,
    })
  },
}
```

> Nota: los workers reciben el email completo en formato `eml`, no parseado.
> Para extraer adjuntos en Cloudflare habría que añadir un parser MIME al
> worker — más complejo. Recomendado solo si te encaja gratis-or-bust.

## 5. Probar la integración

```bash
# Health check
curl https://archivum2704-dot.vercel.app/api/inbox/webhook
# → {"ok":true,"endpoint":"inbox/webhook"}

# Simular un email entrante (formato Resend)
curl -X POST https://archivum2704-dot.vercel.app/api/inbox/webhook \
  -H "Content-Type: application/json" \
  -H "x-archivum-webhook-secret: $INBOX_WEBHOOK_SECRET" \
  -d '{
    "type": "email.received",
    "data": {
      "from": "supplier@example.com",
      "to":   ["abc123token@inbox.archivum.app"],
      "subject": "Factura #2025-001",
      "message_id": "<test-1@example.com>",
      "attachments": [{
        "filename": "factura.pdf",
        "contentType": "application/pdf",
        "content": "JVBERi0xLjQKJa..."
      }]
    }
  }'
```

Deberías ver en `email_inbox_log` una fila con `status='processed'` y en
`documents` un nuevo registro con `status='pending'`.

## Troubleshooting

| Síntoma                                          | Causa probable                                      |
| ------------------------------------------------ | --------------------------------------------------- |
| `status: 'failed'`, error `org_not_found`        | El token en el local-part no existe en `organizations` |
| `status: 'failed'`, error `no_token`             | La dirección de destino no tiene local-part válido  |
| `status: 'skipped'`, error `no_attachments`      | Email sin PDFs ni imágenes — comportamiento esperado |
| Webhook devuelve 401                             | `INBOX_WEBHOOK_SECRET` no coincide con el header    |
| Email llega pero no entra al webhook             | DNS / MX no propagados todavía (espera ~30 min)     |

Logs de procesamiento en Vercel: Dashboard → Project → Logs, filtrar
`/api/inbox/webhook`.
