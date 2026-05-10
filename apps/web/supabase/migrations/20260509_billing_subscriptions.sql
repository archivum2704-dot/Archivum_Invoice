-- ── Subscription state on organizations ────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing','active','past_due','canceled','unpaid','incomplete','paused'
    )),
  ADD COLUMN IF NOT EXISTS trial_ends_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_users_quantity     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_docs_quantity      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_count           INTEGER NOT NULL DEFAULT 0;

-- ── Billing events log (audit / idempotency) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer
  ON public.organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_subscription
  ON public.organizations(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ── Document count trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_document_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.organizations SET document_count = document_count + 1 WHERE id = NEW.organization_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.organizations SET document_count = GREATEST(document_count - 1, 0) WHERE id = OLD.organization_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_document_count ON public.documents;
CREATE TRIGGER trg_sync_document_count
  AFTER INSERT OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.sync_document_count();

-- ── Backfill existing orgs ──────────────────────────────────────────────────
UPDATE public.organizations o
  SET document_count = (SELECT COUNT(*) FROM public.documents d WHERE d.organization_id = o.id);
