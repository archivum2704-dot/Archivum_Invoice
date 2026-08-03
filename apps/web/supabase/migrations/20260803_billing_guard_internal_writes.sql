-- Let the app's own bookkeeping through the billing guard.
--
-- protect_billing_columns blocked more than it should: uploading a document
-- fires decrement_quota_pool, deleting one fires increment_quota_pool, and a
-- renewal calls renew_doc_quota — all of which adjust doc_quota_pool while
-- running as the member. The guard saw a member writing a billing column and
-- refused, so no document could be uploaded or deleted at all.
--
-- These three now announce themselves with a transaction-local flag the guard
-- honours. Members still cannot touch the columns directly.

CREATE OR REPLACE FUNCTION public.decrement_quota_pool()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM set_config('archivum.internal_billing_write', 'on', true);
  UPDATE public.organizations
    SET doc_quota_pool = GREATEST(doc_quota_pool - 1, 0)
  WHERE id = NEW.organization_id;
  PERFORM set_config('archivum.internal_billing_write', 'off', true);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_quota_pool()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM set_config('archivum.internal_billing_write', 'on', true);
  UPDATE public.organizations
    SET doc_quota_pool = doc_quota_pool + 1
  WHERE id = OLD.organization_id;
  PERFORM set_config('archivum.internal_billing_write', 'off', true);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_doc_quota(p_org_id uuid, p_monthly_docs integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM set_config('archivum.internal_billing_write', 'on', true);
  UPDATE public.organizations
    SET doc_quota_pool        = doc_quota_pool + p_monthly_docs,
        expiry_notified_at    = NULL,
        deletion_scheduled_at = NULL
  WHERE id = p_org_id;
  PERFORM set_config('archivum.internal_billing_write', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  THEN
    RAISE EXCEPTION 'Los datos de suscripción solo pueden modificarse desde la facturación';
  END IF;

  RETURN NEW;
END;
$$;
