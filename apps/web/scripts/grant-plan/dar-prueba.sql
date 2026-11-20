-- Dar la prueba de 30 días de Pro a las organizaciones que ya existían.
--
-- La migración 20261120_signup_trial.sql da la prueba a las organizaciones que
-- se creen a partir de ahora. Las que se registraron antes (los testers de la
-- Play Store, por ejemplo) nacieron en el plan Gratuito; este script les da
-- los 30 días que les faltan, contados desde hoy.
--
-- Solo toca organizaciones en plan Gratuito, sin suscripción de Stripe, que no
-- hayan tenido ya una prueba (trial_ends_at vacío) y que sigan activas. Así no
-- se regala una segunda prueba a nadie ni se toca a quien ya paga.
--
-- Pegar ENTERO en una pestaña nueva del SQL Editor de Supabase y pulsar Run.
-- Primero en ensayo (v_aplicar := false): lista lo que haría en la pestaña de
-- mensajes. Si cuadra, pon v_aplicar := true y vuelve a ejecutarlo.
-- Para limitarlo a las creadas desde una fecha, rellena v_desde.

DO $$
DECLARE
  v_aplicar boolean := false;   -- ← true para aplicar los cambios
  v_desde   date    := NULL;    -- p. ej. '2026-11-01'; NULL = todas
  r   record;
  v_n int := 0;
BEGIN
  IF v_aplicar THEN
    PERFORM set_config('archivum.internal_billing_write', 'on', true);
  END IF;

  FOR r IN
    SELECT o.id, o.name, o.created_at::date AS alta,
           (SELECT u.email FROM public.organization_members m
              JOIN auth.users u ON u.id = m.user_id
             WHERE m.organization_id = o.id AND m.role = 'owner' LIMIT 1) AS owner_email
    FROM public.organizations o
    WHERE coalesce(o.subscription_plan, 'free') = 'free'
      AND o.stripe_subscription_id IS NULL
      AND o.trial_ends_at IS NULL
      AND coalesce(o.is_active, true)
      AND (v_desde IS NULL OR o.created_at >= v_desde)
    ORDER BY o.created_at
  LOOP
    v_n := v_n + 1;
    RAISE NOTICE '«%» (alta %, %) → Pro en prueba hasta %',
      r.name, r.alta, coalesce(r.owner_email, 'sin propietario'), (now() + interval '30 days')::date;
    IF v_aplicar THEN
      UPDATE public.organizations
         SET subscription_plan   = 'pro',
             subscription_status = 'trialing',
             trial_ends_at       = now() + interval '30 days',
             doc_quota_pool      = GREATEST(coalesce(doc_quota_pool, 0), 450)
       WHERE id = r.id;
    END IF;
  END LOOP;

  RAISE NOTICE '% organizaciones %', v_n,
    CASE WHEN v_aplicar THEN 'pasan a Pro en prueba.' ELSE 'pasarían a Pro en prueba. Ensayo: no se ha cambiado nada.' END;
END $$;
