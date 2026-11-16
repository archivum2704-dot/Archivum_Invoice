-- Dar un plan de pago a mano a la organización de un usuario.
-- Pegar ENTERO en una pestaña nueva del SQL Editor de Supabase y pulsar Run.
-- Cambia solo las tres líneas de "Datos". Es lo mismo que hace el panel de
-- administración (/admin-dashboard → Organizaciones → Editar).
--
-- El usuario tiene que haberse registrado antes en archivum.es (y creado su
-- organización); si no, el bloque avisa y no cambia nada.

DO $$
DECLARE
  -- ── Datos ──────────────────────────────────────────────
  v_email  text := 'correo@ejemplo.com';
  v_plan   text := 'pro';            -- starter | business | pro
  v_hasta  date := NULL;             -- NULL = sin fecha de fin
  -- ───────────────────────────────────────────────────────
  v_user uuid;
  v_docs int;
  v_n    int;
  r      record;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna cuenta con el correo %. Tiene que registrarse primero en archivum.es.', v_email;
  END IF;

  -- protect_billing_columns solo deja tocar el plan a la facturación o a un
  -- administrador; desde el SQL Editor se habilita solo en esta transacción.
  PERFORM set_config('archivum.internal_billing_write', 'on', true);

  -- Documentos al mes de cada plan: los mismos que PLANS en lib/pricing.ts.
  v_docs := CASE v_plan WHEN 'starter' THEN 75 WHEN 'business' THEN 200 WHEN 'pro' THEN 450 END;
  IF v_docs IS NULL THEN
    RAISE EXCEPTION 'Plan % desconocido: usa starter, business o pro.', v_plan;
  END IF;

  -- doc_quota_pool es la bolsa de documentos que se gasta al subir y que
  -- bloquea las subidas al llegar a 0. Sin recargarla, el plan de pago se
  -- quedaba con los 20 del Gratuito. GREATEST: ejecutar el script dos veces
  -- no suma dos meses, y no se quita nada a quien ya tenía más.
  UPDATE public.organizations o
  SET subscription_plan   = v_plan,
      subscription_status = 'active',
      current_period_end  = v_hasta,
      doc_quota_pool      = GREATEST(coalesce(o.doc_quota_pool, 0), v_docs)
  WHERE o.id IN (SELECT organization_id FROM public.organization_members
                 WHERE user_id = v_user AND role = 'owner');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'La cuenta % existe pero no es dueña de ninguna organización (no terminó el alta).', v_email;
  END IF;

  FOR r IN SELECT o.name, o.subscription_plan, o.subscription_status, o.doc_quota_pool
           FROM public.organizations o
           JOIN public.organization_members m ON m.organization_id = o.id
           WHERE m.user_id = v_user AND m.role = 'owner'
  LOOP
    RAISE NOTICE 'Listo: «%» → plan %, estado %, % documentos disponibles', r.name, r.subscription_plan, r.subscription_status, r.doc_quota_pool;
  END LOOP;
END $$;
