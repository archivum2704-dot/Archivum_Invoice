-- ============================================================
-- Verifactu — AEAT digital certificate storage + submission tracking
--
-- The .p12/.pfx certificate and its password are stored ENCRYPTED at rest
-- (AES-256-GCM, app-side, key in env VERIFACTU_CERT_KEY). Clients never read
-- this table directly: all access goes through server routes using the
-- service role. RLS therefore denies all client access (no policies).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_certificates (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  cert_cipher     TEXT NOT NULL,
  cert_iv         TEXT NOT NULL,
  cert_tag        TEXT NOT NULL,
  pass_cipher     TEXT NOT NULL,
  pass_iv         TEXT NOT NULL,
  pass_tag        TEXT NOT NULL,
  subject         TEXT,
  nif             TEXT,
  valid_until     TIMESTAMPTZ,
  uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on, no policies → deny all direct client access (server uses service role)
ALTER TABLE public.org_certificates ENABLE ROW LEVEL SECURITY;

-- AEAT submission outcome on each invoice
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS aeat_csv      TEXT,
  ADD COLUMN IF NOT EXISTS aeat_response JSONB,
  ADD COLUMN IF NOT EXISTS submitted_at  TIMESTAMPTZ;
