-- ============================================================
-- Prueba de 30 días del plan Pro al registrarse, sin tarjeta.
--
-- Hasta hoy una organización nueva nacía en el plan Gratuito y la prueba solo
-- empezaba al contratar Pro en Stripe (con tarjeta). La decisión del cliente
-- para el lanzamiento es otra: quien se registra tiene Pro completo durante
-- 30 días; si no contrata, vuelve al Gratuito.
--
-- Cómo:
--   - Un trigger BEFORE INSERT pone a la organización nueva en
--     plan 'pro' / estado 'trialing' / trial_ends_at = ahora + 30 días, con el
--     cupo de documentos de un mes de Pro. Solo si nace en 'free' y sin
--     suscripción de Stripe: un alta hecha a mano con otro plan no se toca.
--   - Al acabar la prueba sin suscripción, el cron diario /api/cron/mark-overdue
--     la devuelve al plan Gratuito (subscription_plan = 'free').
--   - Si contrata durante la prueba, el checkout conserva los días que le
--     quedan (Stripe cobra al acabar), y el webhook pasa a gestionarla.
--
-- Las cifras (30 días, 450 documentos) son las de TRIAL_DAYS.pro y
-- PLANS.pro.docsPerMonth en apps/web/lib/pricing.ts: si cambian allí, aquí.
--
-- Aplicar a mano: Supabase Dashboard → SQL Editor → pegar entero → Run.
-- Idempotente. Solo afecta a las organizaciones que se creen a partir de ahora;
-- para las ya creadas está apps/web/scripts/grant-plan/dar-prueba.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_signup_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.subscription_plan, 'free') = 'free'
     AND NEW.stripe_subscription_id IS NULL
     AND NEW.trial_ends_at IS NULL
  THEN
    NEW.subscription_plan   := 'pro';
    NEW.subscription_status := 'trialing';
    NEW.trial_ends_at       := now() + interval '30 days';
    NEW.doc_quota_pool      := GREATEST(coalesce(NEW.doc_quota_pool, 0), 450);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_start_signup_trial ON public.organizations;
CREATE TRIGGER trg_start_signup_trial
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.start_signup_trial();
