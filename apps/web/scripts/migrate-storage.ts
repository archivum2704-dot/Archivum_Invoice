/**
 * Copia los ficheros de Storage de un proyecto Supabase a otro, para la
 * migración a Frankfurt (docs/migracion-frankfurt.md, paso 4).
 *
 * El volcado de la base de datos trae las filas de `storage.objects`, pero NO
 * los ficheros: esos viven aparte y hay que copiarlos uno a uno. Este script
 * recorre cada bucket del origen, descarga cada fichero y lo sube al destino
 * con la misma ruta, así las rutas guardadas en la base de datos
 * (`documents.file_url`, logos…) siguen siendo válidas.
 *
 * Es seguro repetirlo: sube con upsert, así que volver a ejecutarlo solo
 * vuelve a copiar. No se fía de lo que «lista» el destino para saltarse
 * ficheros, porque tras restaurar la base de datos `storage.objects` ya trae
 * las filas de todos aunque los ficheros todavía no estén.
 * Por defecto solo cuenta (ensayo); con --apply copia de verdad.
 *
 *   SRC_URL=https://<viejo>.supabase.co  SRC_SERVICE_KEY=...  \
 *   DST_URL=https://<nuevo>.supabase.co  DST_SERVICE_KEY=...  \
 *   npx tsx scripts/migrate-storage.ts [--apply]
 *
 * Las claves son las service_role de cada proyecto (Project Settings → API).
 * No las pegues en ningún fichero del repositorio.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const apply = process.argv.includes("--apply")

function env(name: string): string {
  const v = process.env[name]
  if (!v) { console.error(`Falta la variable ${name}`); process.exit(1) }
  return v
}

const src = createClient(env("SRC_URL"), env("SRC_SERVICE_KEY"), { auth: { persistSession: false } })
const dst = createClient(env("DST_URL"), env("DST_SERVICE_KEY"), { auth: { persistSession: false } })

type Obj = { path: string; size: number }

/** Every file under `prefix`, recursing into folders (list() is one level). */
async function listAll(client: SupabaseClient, bucket: string, prefix = ""): Promise<Obj[]> {
  const out: Obj[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    if (!data?.length) break
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      // Folders come back without an id or metadata.
      if (!item.id) out.push(...await listAll(client, bucket, path))
      else out.push({ path, size: Number((item.metadata as any)?.size ?? 0) })
    }
    if (data.length < 1000) break
  }
  return out
}

async function main() {
  const { data: buckets, error } = await src.storage.listBuckets()
  if (error) throw error
  console.log(apply ? "COPIANDO (--apply)" : "ENSAYO: no se copia nada; añade --apply para copiar")

  let copied = 0, failed = 0
  for (const b of buckets ?? []) {
    // The bucket must exist in the destination with the same settings.
    const { data: existing } = await dst.storage.getBucket(b.id)
    if (!existing) {
      console.log(`· bucket ${b.id}: no existe en destino${apply ? ", se crea" : ""}`)
      if (apply) {
        const { error: cErr } = await dst.storage.createBucket(b.id, {
          public: b.public,
          fileSizeLimit: b.file_size_limit ?? undefined,
          allowedMimeTypes: b.allowed_mime_types ?? undefined,
        })
        if (cErr) throw new Error(`crear bucket ${b.id}: ${cErr.message}`)
      }
    }

    const srcObjs = await listAll(src, b.id)
    const bytes = srcObjs.reduce((n, o) => n + o.size, 0)
    console.log(`· bucket ${b.id}: ${srcObjs.length} ficheros (${(bytes / 1048576).toFixed(1)} MB)`)

    for (const o of srcObjs) {
      if (!apply) { copied++; continue }
      const { data: blob, error: dErr } = await src.storage.from(b.id).download(o.path)
      if (dErr || !blob) { failed++; console.error(`  ✗ ${b.id}/${o.path}: ${dErr?.message}`); continue }
      const { error: uErr } = await dst.storage.from(b.id).upload(o.path, blob, {
        upsert: true, contentType: blob.type || undefined,
      })
      if (uErr) { failed++; console.error(`  ✗ ${b.id}/${o.path}: ${uErr.message}`); continue }
      copied++
    }
  }

  console.log(`${apply ? "Copiados" : "Se copiarían"}: ${copied} · fallos: ${failed}`)
  if (failed) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
