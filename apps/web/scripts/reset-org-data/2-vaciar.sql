-- ============================================================================
-- Vaciar una cuenta de pruebas — PASO 2: VACIAR
-- ============================================================================
-- SOLO PARA CUENTAS DE PRUEBAS. Supabase está en plan Free: NO HAY COPIAS DE
-- SEGURIDAD. Lo que se borre aquí no se puede recuperar.
--
-- Pega ESTE fichero ENTERO en una pestaña nueva del SQL Editor (sin
-- seleccionar nada) y pulsa Run. Es una sola instrucción y es atómica: o se
-- aplica todo o nada.
--
--   · Con v_aplicar := false (ENSAYO, por defecto) no cambia nada: termina con
--     un error «ENSAYO — no se ha borrado nada» que lista lo que BORRARÍA.
--   · Si el resumen cuadra, cambia a v_aplicar := true y vuelve a ejecutarlo.
--     Luego ejecuta 1-revisar.sql para comprobar que todo está a 0.
--
-- Borra (de cada organización de la que la cuenta es owner/admin): facturas
-- (+ líneas), registros VERI*FACTU (cadena, eventos, anulaciones), pedidos y
-- albaranes (+ líneas), contadores de numeración, Biblioteca, carpetas,
-- etiquetas, clientes, productos, registro de actividad y log de correo.
--
-- Conserva: la cuenta, la organización, sus miembros, el certificado digital
-- (org_certificates) y la facturación del plan (billing_events).
--
-- Los triggers de inalterabilidad se desactivan solo dentro de esta
-- instrucción y se reactivan antes de terminar. Si la organización tiene
-- otros miembros, aborta sin tocar nada.
--
-- Los PDF del bucket `documents` (carpeta = id de la organización) hay que
-- borrarlos aparte desde Storage: el SQL no borra ficheros.
-- ============================================================================

DO $reset$
DECLARE
  v_email    text    := 'archivum2704@gmail.com';
  v_aplicar  boolean := false;   -- ← cambiar a true para borrar de verdad
  -- Tablas con organization_id que NO se tocan.
  v_keep     text[]  := ARRAY['organizations', 'organization_members',
                              'org_certificates', 'billing_events', 'profiles'];
  v_user     uuid;
  v_org      uuid;
  v_others   int;
  v_tbl      text;
  v_n        bigint;
  v_trg      record;
  v_disabled text[]  := '{}';
  v_resumen  text    := '';
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna cuenta con el correo %', v_email;
  END IF;

  -- Desactiva los triggers de usuario de public (inalterabilidad, cuotas…)
  -- recordando cuáles estaban activos, para reactivar exactamente esos.
  -- Los de claves foráneas son internos y siguen activos, así que los
  -- ON DELETE CASCADE (líneas de factura/pedido…) funcionan.
  FOR v_trg IN
    SELECT c.relname AS tbl, t.tgname AS trg
    FROM pg_trigger t
    JOIN pg_class c     ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', v_trg.tbl, v_trg.trg);
    v_disabled := v_disabled || format('ALTER TABLE public.%I ENABLE TRIGGER %I', v_trg.tbl, v_trg.trg);
  END LOOP;

  FOR v_org IN
    SELECT organization_id FROM public.organization_members
    WHERE user_id = v_user AND role IN ('owner', 'admin')
  LOOP
    SELECT count(*) INTO v_others FROM public.organization_members
    WHERE organization_id = v_org AND user_id <> v_user;
    IF v_others > 0 THEN
      RAISE EXCEPTION 'La organización % tiene % miembro(s) más. Abortado sin cambios: revisa que sea de pruebas.',
        v_org, v_others;
    END IF;

    v_resumen := v_resumen || format(E'\n== %s (%s)', v_org,
                   (SELECT name FROM public.organizations WHERE id = v_org));

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
      IF v_n > 0 THEN
        v_resumen := v_resumen || format(E'\n   %s: %s', v_tbl, v_n);
      END IF;
    END LOOP;

    -- Contadores de uso que mantenían los triggers desactivados.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
               AND table_name = 'organizations' AND column_name = 'storage_used_bytes') THEN
      EXECUTE 'UPDATE public.organizations SET storage_used_bytes = 0 WHERE id = $1' USING v_org;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
               AND table_name = 'organizations' AND column_name = 'document_count') THEN
      EXECUTE 'UPDATE public.organizations SET document_count = 0 WHERE id = $1' USING v_org;
    END IF;
  END LOOP;

  IF v_resumen = '' THEN
    RAISE EXCEPTION 'La cuenta % no es owner/admin de ninguna organización. Nada que hacer.', v_email;
  END IF;

  FOREACH v_tbl IN ARRAY v_disabled LOOP
    EXECUTE v_tbl;
  END LOOP;

  IF NOT v_aplicar THEN
    -- Deshace todo (borrados y cambios de triggers) y enseña el resumen.
    RAISE EXCEPTION E'ENSAYO — no se ha borrado nada. Se borraría:%\n\nPara aplicarlo, pon v_aplicar := true.', v_resumen;
  END IF;

  RAISE NOTICE E'Borrado aplicado:%', v_resumen;
END
$reset$;
