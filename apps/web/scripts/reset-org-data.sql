-- ============================================================================
-- Vaciar los datos de la(s) organización(es) de una cuenta
-- ============================================================================
--
-- SOLO PARA CUENTAS DE PRUEBAS. Supabase está en plan Free: NO HAY COPIAS DE
-- SEGURIDAD. Lo que se borre aquí no se puede recuperar.
--
-- Qué borra (de cada organización de la que la cuenta es owner/admin):
--   facturas (+ líneas), registros VERI*FACTU (cadena, eventos, anulaciones),
--   pedidos/albaranes (+ líneas), contadores de numeración, documentos de la
--   Biblioteca, carpetas, etiquetas, clientes, productos, registro de
--   actividad y log de correo entrante.
--
-- Qué conserva: la cuenta (auth.users + profiles), la organización, sus
--   miembros, el certificado digital (org_certificates) y la facturación del
--   plan (billing_events). Así se puede seguir entrando con el mismo usuario.
--
-- Las facturas emitidas están protegidas por triggers de inalterabilidad. El
-- script los desactiva SOLO dentro de esta transacción y los vuelve a activar
-- antes de terminar. No usar nunca sobre una organización con facturas reales:
-- hay obligación legal de conservarlas.
--
-- CÓMO USARLO (Supabase → SQL Editor):
--   1. Cambia v_email abajo si hace falta.
--   2. Ejecuta el PASO 1 solo (selecciona hasta la línea «FIN PASO 1»).
--      Es de solo lectura: muestra la cuenta, sus organizaciones y cuántas
--      filas se borrarían. Revisa que sea la organización correcta.
--   3. Ejecuta el PASO 2 tal cual: termina en ROLLBACK, así que no cambia nada
--      y solo muestra (en «Messages»/NOTICE) lo que habría borrado.
--   4. Si todo cuadra, cambia el ROLLBACK final por COMMIT y vuelve a ejecutar.
--   5. Borra los PDF del bucket `documents` (carpeta = id de la organización)
--      desde Storage en el dashboard; el SQL no borra ficheros.
-- ============================================================================


-- ── PASO 1: solo lectura ────────────────────────────────────────────────────
WITH u AS (
  SELECT id, email FROM auth.users WHERE lower(email) = lower('archivum2704@gmail.com')
)
SELECT u.email, u.id AS user_id, m.organization_id, m.role, o.name AS org_name,
       (SELECT count(*) FROM public.organization_members m2
         WHERE m2.organization_id = m.organization_id)          AS miembros,
       (SELECT count(*) FROM public.invoices i
         WHERE i.organization_id = m.organization_id)           AS facturas,
       (SELECT count(*) FROM public.invoices i
         WHERE i.organization_id = m.organization_id
           AND i.state <> 'draft')                              AS facturas_emitidas,
       (SELECT count(*) FROM public.quotes q
         WHERE q.organization_id = m.organization_id)           AS pedidos_albaranes,
       (SELECT count(*) FROM public.documents d
         WHERE d.organization_id = m.organization_id)           AS documentos,
       (SELECT count(*) FROM public.companies c
         WHERE c.organization_id = m.organization_id)           AS clientes,
       (SELECT count(*) FROM public.products p
         WHERE p.organization_id = m.organization_id)           AS productos
FROM u
LEFT JOIN public.organization_members m ON m.user_id = u.id
LEFT JOIN public.organizations o        ON o.id = m.organization_id;
-- ── FIN PASO 1 ──────────────────────────────────────────────────────────────


-- ── PASO 2: borrado (termina en ROLLBACK; cambiar a COMMIT para aplicar) ───
BEGIN;

DO $$
DECLARE
  v_email   text := 'archivum2704@gmail.com';
  -- Tablas con organization_id que NO se tocan.
  v_keep    text[] := ARRAY['organizations', 'organization_members',
                            'org_certificates', 'billing_events', 'profiles'];
  v_user    uuid;
  v_org     uuid;
  v_others  int;
  v_tbl     text;
  v_n       bigint;
  v_trg     record;
  v_disabled text[] := '{}';
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna cuenta con el correo %', v_email;
  END IF;

  -- Desactiva los triggers de usuario de public (inalterabilidad, cuotas…)
  -- recordando cuáles estaban activos, para reactivar exactamente esos.
  -- Los de claves foráneas son internos y siguen activos: los ON DELETE
  -- CASCADE (líneas de factura/pedido, etiquetas de documento…) funcionan.
  FOR v_trg IN
    SELECT c.relname AS tbl, t.tgname AS trg
    FROM pg_trigger t
    JOIN pg_class c     ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', v_trg.tbl, v_trg.trg);
    v_disabled := v_disabled || format('%I|%I', v_trg.tbl, v_trg.trg);
  END LOOP;

  FOR v_org IN
    SELECT organization_id FROM public.organization_members
    WHERE user_id = v_user AND role IN ('owner', 'admin')
  LOOP
    -- Salvaguarda: si hay más personas en la organización, puede no ser de
    -- pruebas. Se aborta todo.
    SELECT count(*) INTO v_others FROM public.organization_members
    WHERE organization_id = v_org AND user_id <> v_user;
    IF v_others > 0 THEN
      RAISE EXCEPTION 'La organización % tiene % miembro(s) más. Abortado: revisa que sea de pruebas.',
        v_org, v_others;
    END IF;

    RAISE NOTICE '== Organización % (%)', v_org,
      (SELECT name FROM public.organizations WHERE id = v_org);

    -- Primero las tablas VERI*FACTU y facturas, luego el resto.
    FOR v_tbl IN
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'organization_id'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name <> ALL (v_keep)
      ORDER BY CASE c.table_name
                 WHEN 'verifactu_chain_links' THEN 1
                 WHEN 'verifactu_events'      THEN 2
                 WHEN 'verifactu_annulments'  THEN 3
                 WHEN 'invoices'              THEN 4
                 WHEN 'quotes'                THEN 5
                 WHEN 'documents'             THEN 6
                 ELSE 9 END, c.table_name
    LOOP
      EXECUTE format('DELETE FROM public.%I WHERE organization_id = $1', v_tbl) USING v_org;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RAISE NOTICE '   % : % fila(s)', rpad(v_tbl, 26), v_n;
    END LOOP;

    -- Los contadores de uso los mantienen triggers que estaban desactivados.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
               AND table_name = 'organizations' AND column_name = 'storage_used_bytes') THEN
      UPDATE public.organizations SET storage_used_bytes = 0 WHERE id = v_org;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
               AND table_name = 'organizations' AND column_name = 'document_count') THEN
      UPDATE public.organizations SET document_count = 0 WHERE id = v_org;
    END IF;
  END LOOP;

  -- Reactiva exactamente los triggers que se desactivaron.
  FOREACH v_tbl IN ARRAY v_disabled LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE TRIGGER %s',
                   split_part(v_tbl, '|', 1), split_part(v_tbl, '|', 2));
  END LOOP;
  RAISE NOTICE 'Triggers reactivados: %', array_length(v_disabled, 1);
END $$;

-- Cambiar por COMMIT para aplicar de verdad.
ROLLBACK;
