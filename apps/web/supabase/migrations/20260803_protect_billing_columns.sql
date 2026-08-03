-- Keep an organization's billing columns out of its members' reach.
--
-- organizations_update lets any org admin write any column of their own row —
-- which is how they edit the fiscal data — and that includes subscription_plan.
-- An owner could therefore hand themselves the Pro plan. The user-creation
-- route defended against that by only honouring a plan backed by a Stripe
-- subscription, while the screens that *display* the limit did not, so a plan
-- granted by hand (as the testers' were) showed "1/2 usuarios" and then refused
-- the second one.
--
-- With the columns locked, the plan on the row is trustworthy on its own, and
-- every part of the app can read the same limit from it.

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Stripe's webhook and the admin tooling use the service role; platform
  -- admins grant plans by hand from the admin panel. Both are allowed.
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_platform_admin() THEN
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

DROP TRIGGER IF EXISTS protect_billing_columns ON public.organizations;
CREATE TRIGGER protect_billing_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_columns();
