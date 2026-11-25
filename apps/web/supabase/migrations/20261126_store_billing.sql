-- ============================================================
-- Suscripciones compradas en la App Store o en Google Play.
--
-- Hasta ahora toda suscripción de pago venía de Stripe (la web). Las apps
-- venderán los tres planes y el bono de documentos con la tienda de cada
-- plataforma, a través de RevenueCat, que avisa a /api/billing/revenuecat.
--
--   billing_store                  'app_store' | 'play_store' | NULL
--                                  NULL = la suscripción de pago (si la hay)
--                                  es de Stripe, o no hay ninguna.
--   store_product_id               producto de la tienda vigente
--                                  (archivum.pro.mensual, …)
--   store_original_transaction_id  identificador estable de la suscripción en
--                                  la tienda, para soporte y reembolsos
--
-- El plan se sigue guardando en subscription_plan / subscription_status /
-- current_period_end, así que resolveEntitlements y org_plan_limits() no
-- cambian: solo cambia quién escribe.
--
-- Las columnas nuevas quedan protegidas como el resto de las de facturación:
-- solo las escribe el servidor (service_role) o el flag interno.
--
-- Aplicar a mano: Supabase Dashboard → SQL Editor → pegar entero → Run.
-- Idempotente.
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_store                 TEXT,
  ADD COLUMN IF NOT EXISTS store_product_id              TEXT,
  ADD COLUMN IF NOT EXISTS store_original_transaction_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_billing_store_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_billing_store_check
      CHECK (billing_store IS NULL OR billing_store IN ('app_store', 'play_store'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR public.is_platform_admin()
     OR coalesce(current_setting('archivum.internal_billing_write', true), 'off') = 'on'
  THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_plan       IS DISTINCT FROM OLD.subscription_plan
     OR NEW.subscription_status  IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id   IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.extra_users_quantity IS DISTINCT FROM OLD.extra_users_quantity
     OR NEW.extra_docs_quantity  IS DISTINCT FROM OLD.extra_docs_quantity
     OR NEW.extra_companies_quantity IS DISTINCT FROM OLD.extra_companies_quantity
     OR NEW.doc_quota_pool       IS DISTINCT FROM OLD.doc_quota_pool
     OR NEW.current_period_end   IS DISTINCT FROM OLD.current_period_end
     OR NEW.trial_ends_at        IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.deletion_scheduled_at IS DISTINCT FROM OLD.deletion_scheduled_at
     OR NEW.billing_store        IS DISTINCT FROM OLD.billing_store
     OR NEW.store_product_id     IS DISTINCT FROM OLD.store_product_id
     OR NEW.store_original_transaction_id IS DISTINCT FROM OLD.store_original_transaction_id
  THEN
    RAISE EXCEPTION 'Los datos de suscripción solo pueden modificarse desde la facturación';
  END IF;

  RETURN NEW;
END;
$$;
