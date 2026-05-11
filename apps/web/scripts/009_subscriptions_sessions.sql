-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  009 — Subscription plans, document quota pool, single-device sessions  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Single-device session tracking ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_session
  ON public.profiles(active_session_id)
  WHERE active_session_id IS NOT NULL;

-- ── Subscription plan + quota on organizations ───────────────────────────────
ALTER TABLE public.organizations
  -- Which plan the org is on (default free)
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_plan IN ('free', 'starter', 'pro')),

  -- Cumulative document allowance pool.
  -- Unused monthly quota carries over to next month.
  -- Bonus packs add directly to this pool (no expiry).
  -- Each uploaded document decrements this by 1.
  -- Free plan starts with 20; billing webhook tops it up on renewal.
  ADD COLUMN IF NOT EXISTS doc_quota_pool INTEGER NOT NULL DEFAULT 20,

  -- Timestamp when the 15-day deletion warning was first shown to the owner.
  ADD COLUMN IF NOT EXISTS expiry_notified_at TIMESTAMPTZ,

  -- Computed when subscription expires: expiry_date + 15 days.
  -- A scheduled job deletes org data once NOW() > deletion_scheduled_at.
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.doc_quota_pool IS
  'Rolling document allowance. Accrues monthly (unused quota carries over). Bonus packs add directly. Each upload decrements by 1.';

-- ── Trigger: decrement quota on each document INSERT ────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_quota_pool()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.organizations
    SET doc_quota_pool = GREATEST(doc_quota_pool - 1, 0)
  WHERE id = NEW.organization_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_quota ON public.documents;
CREATE TRIGGER trg_decrement_quota
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.decrement_quota_pool();

-- ── Trigger: return 1 slot when a document is hard-deleted ──────────────────
CREATE OR REPLACE FUNCTION public.increment_quota_pool()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.organizations
    SET doc_quota_pool = doc_quota_pool + 1
  WHERE id = OLD.organization_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_quota ON public.documents;
CREATE TRIGGER trg_increment_quota
  AFTER DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.increment_quota_pool();

-- ── Helper: top up org quota on plan renewal (called by Stripe webhook) ──────
-- Pass the organization_id and the plan's monthly_docs value.
CREATE OR REPLACE FUNCTION public.renew_doc_quota(
  p_org_id       UUID,
  p_monthly_docs INTEGER
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.organizations
    SET doc_quota_pool    = doc_quota_pool + p_monthly_docs,
        expiry_notified_at   = NULL,
        deletion_scheduled_at = NULL
  WHERE id = p_org_id;
END;
$$;

-- ── Seed existing free-plan orgs with 20 free docs (minus what they've used) ─
UPDATE public.organizations o
  SET doc_quota_pool = GREATEST(20 - COALESCE(document_count, 0), 0)
WHERE subscription_plan = 'free'
  AND doc_quota_pool = 20;
