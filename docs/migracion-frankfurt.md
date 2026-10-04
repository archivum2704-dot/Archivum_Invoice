# Migración de Supabase a Frankfurt (UE)

Guion para mover Archivum de `us-east-1` (proyecto `ddlvrycexamzznwtmchd`) a un
proyecto nuevo en `eu-central-1`, y las funciones de Vercel de `iad1` a `fra1`.
Decidido el 1 de octubre de 2026 para cuando se contratara Supabase Pro, que ya
está contratado.

**No se puede ejecutar desde las sesiones de Claude en la nube**: el MCP de
Supabase no tiene permiso sobre el proyecto, y la base de datos no es
accesible desde ese entorno. Hace falta un equipo con `psql`, la CLI de
Supabase y acceso al dashboard.

## Qué se mueve y qué no

| | Cómo |
|---|---|
| Esquema, funciones, triggers, RLS | Volcado `schema` |
| Datos de `public` | Volcado `data` |
| Usuarios (`auth.users`, contraseñas, factores MFA) | Volcado `data` (incluye el esquema `auth`). Las contraseñas se conservan |
| Filas de `storage.objects` | Volcado `data` |
| **Ficheros de Storage** (PDF, logos) | **No van en el volcado.** `apps/web/scripts/migrate-storage.ts` |
| Ajustes de Auth (URLs de redirección, SMTP, plantillas de correo, MFA) | A mano en el dashboard nuevo, copiando del viejo |
| Sesiones abiertas | **Se pierden**: el proyecto nuevo firma con otra clave. Todos vuelven a iniciar sesión una vez |

No hay edge functions, ni `pg_cron`, ni el identificador del proyecto escrito
en el código: solo cambian las variables de entorno.

## Antes de empezar

1. Avisar a los usuarios de una ventana de mantenimiento (unos 30-60 minutos)
   y de que tendrán que volver a iniciar sesión.
2. Comprobar que la copia diaria de Pro del proyecto viejo existe
   (Database → Backups) y está reciente.
3. Durante la ventana, nadie debe emitir facturas: una factura emitida en el
   proyecto viejo después del volcado se perdería, y la cadena VERI\*FACTU
   saltaría. Lo más simple es hacerlo de noche y, si se puede, poner la web en
   mantenimiento.

## Pasos

### 1. Crear el proyecto nuevo

Dashboard → New project → región **Central EU (Frankfurt) `eu-central-1`**, en
la organización con Pro. Apuntar la contraseña de la base de datos.

### 2. Volcar el proyecto viejo

Cadenas de conexión en Project Settings → Database (usar la «Session pooler» o
la directa, no la «Transaction»).

```bash
OLD="postgresql://postgres.[ref-viejo]:[pass]@[host-viejo]:5432/postgres"
supabase db dump --db-url "$OLD" -f roles.sql --role-only
supabase db dump --db-url "$OLD" -f schema.sql
supabase db dump --db-url "$OLD" -f data.sql --use-copy --data-only
```

### 3. Restaurar en el nuevo

```bash
NEW="postgresql://postgres.[ref-nuevo]:[pass]@[host-nuevo]:5432/postgres"
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW"
```

`session_replication_role = replica` desactiva los triggers durante la carga.
Es imprescindible: si no, los de inalterabilidad (`protect_issued_invoice`,
`verifactu_chain_links`…) rechazarían las facturas emitidas, y los de cuota y
stock volverían a sumar lo que ya está sumado.

### 4. Copiar los ficheros de Storage

```bash
cd apps/web
SRC_URL=https://[ref-viejo].supabase.co SRC_SERVICE_KEY=... \
DST_URL=https://[ref-nuevo].supabase.co DST_SERVICE_KEY=... \
npx tsx scripts/migrate-storage.ts          # ensayo: cuenta ficheros y MB
# … y si cuadra:
npx tsx scripts/migrate-storage.ts --apply
```

Crea los buckets que falten con los mismos límites y tipos permitidos, y sube
cada fichero con la misma ruta. Se puede repetir sin riesgo.

### 5. Comprobar el proyecto nuevo antes de cambiar nada

En el SQL Editor del nuevo, comparar con el viejo:

```sql
select
  (select count(*) from auth.users)            as usuarios,
  (select count(*) from public.organizations)  as organizaciones,
  (select count(*) from public.invoices)       as facturas,
  (select count(*) from public.documents)      as documentos,
  (select count(*) from public.verifactu_chain_links) as eslabones,
  (select count(*) from storage.objects)       as ficheros;
```

Y pasar el Security Advisor del dashboard: debe dar lo mismo que el viejo.

### 6. Ajustes de Auth

Copiar del proyecto viejo al nuevo (Authentication → …): Site URL y Redirect
URLs (`https://www.archivum.es/**`, el esquema de la app móvil), SMTP
personalizado si lo hay, plantillas de correo y MFA (TOTP) activado.

### 7. Cambiar las variables

**Vercel** (Production, y Preview si se usa):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` → las del proyecto nuevo.
- Settings → Functions → **Function Region: `fra1` (Frankfurt)**.
- Redesplegar.

`VERIFACTU_CERT_KEY` **no cambia**: los certificados se copian cifrados con
ella en el volcado. Si se cambiara, habría que volver a subirlos todos.

**Móvil** (EAS, entornos `preview` y `production`):

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` → las nuevas.
- Publicar una OTA en los dos canales. Las `EXPO_PUBLIC_*` van dentro del
  paquete JS, así que basta una OTA y no hace falta build nativo.

### 8. Probar

- Iniciar sesión (web y móvil) con una cuenta existente, también una con MFA.
- Abrir un documento de la Biblioteca (comprueba Storage) y el logo de la
  organización.
- Emitir una factura en la organización de pruebas y comprobar que encadena
  con la anterior (la cadena VERI\*FACTU tiene que seguir donde se quedó).
- Lanzar «Enviar ahora a la AEAT» en Ajustes → VERI\*FACTU.

### 9. Después

- Volver a poner en la landing «Datos en Europa» (se quitó el 1 de octubre).
- Actualizar `CLAUDE.md` (proyecto, región) y el DPA.
- Dejar el proyecto viejo **pausado, no borrado**, unas semanas como red de
  seguridad. Borrarlo después: mientras exista, hay datos personales en EE. UU.
