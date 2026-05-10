-- Email forwarding alias — auto-import documents from emails forwarded to a unique address.
--
-- Each organization gets a unique 12-char token. Forwarding emails to
-- "<token>@inbox.<your-domain>" causes any PDF/image attachments to be
-- ingested as documents and processed by the existing AI extraction pipeline.
--
-- The address is computed by the app (token + domain), so no double-write to
-- a derived column. We just store the raw token.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS inbox_token TEXT;

-- Backfill any existing rows with random tokens
UPDATE public.organizations
SET inbox_token = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
WHERE inbox_token IS NULL;

-- Enforce uniqueness + non-null going forward
ALTER TABLE public.organizations
  ALTER COLUMN inbox_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_inbox_token_key
  ON public.organizations (inbox_token);

-- Auto-generate token on insert when not supplied
CREATE OR REPLACE FUNCTION public.fn_set_inbox_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inbox_token IS NULL THEN
    NEW.inbox_token := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizations_set_inbox_token ON public.organizations;
CREATE TRIGGER trg_organizations_set_inbox_token
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_inbox_token();

-- Audit table for incoming emails (debugging + idempotency)
CREATE TABLE IF NOT EXISTS public.email_inbox_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider        TEXT,                       -- 'resend' | 'postmark' | 'mailgun' | etc.
  message_id      TEXT,                       -- email Message-ID header for dedup
  from_address    TEXT,
  to_address      TEXT,
  subject         TEXT,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  documents_created INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'received', -- received | processed | failed | skipped
  error_message   TEXT,
  raw_payload     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_inbox_log_org_id_idx ON public.email_inbox_log (organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS email_inbox_log_message_id_key
  ON public.email_inbox_log (provider, message_id)
  WHERE message_id IS NOT NULL;
