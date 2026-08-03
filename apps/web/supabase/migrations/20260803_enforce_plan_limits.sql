-- Enforce the plan limits in the database.
--
-- Until now they were only advisory. Clients and documents are written straight
-- from the apps with no server route in between, and an org admin can insert a
-- member directly too, so every limit was a message in the interface rather
-- than a boundary — a free-plan organization could hold fifty clients.
--
-- org_plan_limits() is the SQL counterpart of resolveEntitlements() in
-- apps/web/lib/pricing.ts. The two must agree; there is a parity check for them
-- in the repository. Keep the plan table below in step with PLANS.

CREATE OR REPLACE FUNCTION public.org_plan_limits(org_id uuid)
RETURNS TABLE (max_users int, max_docs int, max_companies int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_plan   text;
  v_status text;
  v_users  int;
  v_docs   int;
  v_comps  int;
  v_base_users int;
  v_base_docs  int;
  v_active boolean;
BEGIN
  SELECT coalesce(subscription_plan, 'free'), coalesce(subscription_status, ''),
         coalesce(extra_users_quantity, 0), coalesce(extra_docs_quantity, 0),
         coalesce(extra_companies_quantity, 0)
    INTO v_plan, v_status, v_users, v_docs, v_comps
  FROM public.organizations WHERE id = org_id;

  -- An unknown plan name is treated as free, never as unlimited.
  IF v_plan NOT IN ('free', 'starter', 'business', 'pro') THEN
    v_plan := 'free';
  END IF;

  v_active := v_plan <> 'free' AND v_status IN ('active', 'trialing');

  IF NOT v_active THEN
    -- Mirrors the free allowance the app falls back to.
    RETURN QUERY SELECT 1, 250, 1;
    RETURN;
  END IF;

  v_base_users := CASE v_plan WHEN 'free' THEN 1 ELSE 2 END;
  v_base_docs  := CASE v_plan
                    WHEN 'starter'  THEN 900
                    WHEN 'business' THEN 2400
                    WHEN 'pro'      THEN 5400
                    ELSE 250
                  END;

  RETURN QUERY SELECT
    v_base_users + v_users,
    v_base_docs  + v_docs * 250,   -- each bono is 250 documents
    20 + v_comps;                  -- paid plans start at 20 clients
END;
$$;

-- Trusted callers: our own server code (service role) and platform admins.
CREATE OR REPLACE FUNCTION public.bypasses_plan_limits()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN coalesce(auth.role(), '') = 'service_role' OR public.is_platform_admin();
END;
$$;

-- ── Clients ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_company_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF public.bypasses_plan_limits() THEN RETURN NEW; END IF;

  SELECT max_companies INTO v_max FROM public.org_plan_limits(NEW.organization_id);
  SELECT count(*) INTO v_count FROM public.companies WHERE organization_id = NEW.organization_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de clientes de tu plan (%)', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_company_limit ON public.companies;
CREATE TRIGGER enforce_company_limit
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_limit();

-- ── Members ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF public.bypasses_plan_limits() THEN RETURN NEW; END IF;

  SELECT max_users INTO v_max FROM public.org_plan_limits(NEW.organization_id);
  SELECT count(*) INTO v_count FROM public.organization_members WHERE organization_id = NEW.organization_id;

  -- The owner's own membership is created with the organization; without this
  -- a brand-new free organization could not be founded at all.
  IF v_count = 0 THEN RETURN NEW; END IF;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de usuarios de tu plan (%)', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_member_limit ON public.organization_members;
CREATE TRIGGER enforce_member_limit
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_limit();

-- ── Documents ────────────────────────────────────────────────────────────────
-- Documents run off a pool that is topped up per period rather than a flat cap,
-- so the check is simply that the organization has allowance left.
CREATE OR REPLACE FUNCTION public.enforce_doc_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_pool int;
BEGIN
  IF public.bypasses_plan_limits() THEN RETURN NEW; END IF;

  SELECT coalesce(doc_quota_pool, 0) INTO v_pool
  FROM public.organizations WHERE id = NEW.organization_id;

  IF v_pool <= 0 THEN
    RAISE EXCEPTION 'Has agotado los documentos incluidos en tu plan'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_doc_quota ON public.documents;
CREATE TRIGGER enforce_doc_quota
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_doc_quota();
