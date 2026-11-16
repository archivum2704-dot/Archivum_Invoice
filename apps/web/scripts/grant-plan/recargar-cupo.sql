-- Recargar el cupo de documentos de las organizaciones de pago que se
-- quedaron sin él.
--
-- Hasta el 16 de noviembre de 2026 nada recargaba organizations.doc_quota_pool:
-- ni contratar en Stripe, ni las renovaciones, ni dar un plan a mano. Toda
-- organización arrastraba los 20 documentos iniciales del plan Gratuito, y el
-- trigger enforce_doc_quota bloquea las subidas al llegar a 0, aunque pagase Pro.
--
-- Pegar ENTERO en una pestaña nueva del SQL Editor de Supabase y pulsar Run.
-- Primero se ejecuta en ensayo (v_aplicar := false): solo lista lo que haría.
-- Revisa la lista en la pestaña de mensajes, pon v_aplicar := true y vuelve a
-- ejecutarlo.
--
-- Qué hace: a cada organización con plan de pago activo o en prueba le deja al
-- menos los documentos de un mes de su plan (75 / 200 / 450, los de PLANS en
-- lib/pricing.ts). No resta nada a quien ya tenga más. Se puede repetir sin
-- que sume dos veces.

DO $$
DECLARE
  v_aplicar boolean := false;   -- ← true para aplicar los cambios
  r      record;
  v_docs int;
  v_n    int := 0;
BEGIN
  IF v_aplicar THEN
    PERFORM set_config('archivum.internal_billing_write', 'on', true);
  END IF;

  FOR r IN
    SELECT id, name, subscription_plan, subscription_status, coalesce(doc_quota_pool, 0) AS pool, document_count
    FROM public.organizations
    WHERE subscription_plan IN ('starter', 'business', 'pro')
      AND subscription_status IN ('active', 'trialing')
    ORDER BY name
  LOOP
    v_docs := CASE r.subscription_plan WHEN 'starter' THEN 75 WHEN 'business' THEN 200 ELSE 450 END;
    IF r.pool < v_docs THEN
      v_n := v_n + 1;
      RAISE NOTICE '«%» (% · %): % → % documentos disponibles (tiene % subidos)',
        r.name, r.subscription_plan, r.subscription_status, r.pool, v_docs, r.document_count;
      IF v_aplicar THEN
        UPDATE public.organizations SET doc_quota_pool = v_docs WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '% organizaciones %', v_n,
    CASE WHEN v_aplicar THEN 'recargadas.' ELSE 'se recargarían. Ensayo: no se ha cambiado nada.' END;
END $$;
