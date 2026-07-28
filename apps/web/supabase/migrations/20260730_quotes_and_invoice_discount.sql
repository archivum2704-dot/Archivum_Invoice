-- Presupuestos (quotes) module + invoice-level discount
-- Mirrors the invoices/invoice_lines/invoice_counters design, minus Verifactu.

-- ── Quote status enum ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('draft','sent','accepted','rejected','converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── quotes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_company_id  UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  series             TEXT NOT NULL DEFAULT 'PRE',
  number             INTEGER,
  full_number        TEXT,                       -- e.g. PRE-2026-0001
  status             quote_status NOT NULL DEFAULT 'draft',

  issue_date         DATE,
  valid_until        DATE,

  currency           TEXT NOT NULL DEFAULT 'EUR',
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_pct       DECIMAL(5,2),
  discount_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
  retention_pct      DECIMAL(5,2),
  retention_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total              DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Emisor / receptor snapshots (frozen when the quote is finalized)
  issuer_name        TEXT, issuer_cif TEXT, issuer_address TEXT,
  issuer_city        TEXT, issuer_postal_code TEXT, issuer_province TEXT, issuer_logo_url TEXT,
  client_name        TEXT, client_cif TEXT, client_address TEXT,
  client_city        TEXT, client_postal_code TEXT, client_province TEXT,

  notes              TEXT,

  converted_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  document_id          UUID REFERENCES public.documents(id) ON DELETE SET NULL,

  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_org    ON public.quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON public.quotes(client_company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_fullnumber
  ON public.quotes(organization_id, full_number) WHERE full_number IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_quotes ON public.quotes;
CREATE TRIGGER set_updated_at_quotes
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── quote_lines ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  quantity      DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate      DECIMAL(5,2)  NOT NULL DEFAULT 21.00,
  discount_pct  DECIMAL(5,2)  NOT NULL DEFAULT 0,
  line_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_tax      DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total    DECIMAL(12,2) NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON public.quote_lines(quote_id);

-- ── Per (org, series, year) numbering ────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_counters (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  series          TEXT NOT NULL,
  year            INTEGER NOT NULL,
  last_number     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, series, year)
);

CREATE OR REPLACE FUNCTION public.next_quote_number(p_org UUID, p_series TEXT, p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next INTEGER;
BEGIN
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.quote_counters AS c (organization_id, series, year, last_number)
  VALUES (p_org, p_series, p_year, 1)
  ON CONFLICT (organization_id, series, year)
  DO UPDATE SET last_number = c.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END; $$;

-- ── RLS (mirrors invoices) ───────────────────────────────────────
ALTER TABLE public.quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_can_view_quotes ON public.quotes;
CREATE POLICY org_members_can_view_quotes ON public.quotes
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS paid_admins_can_insert_quotes ON public.quotes;
CREATE POLICY paid_admins_can_insert_quotes ON public.quotes
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

DROP POLICY IF EXISTS paid_admins_can_update_quotes ON public.quotes;
CREATE POLICY paid_admins_can_update_quotes ON public.quotes
  FOR UPDATE USING (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

DROP POLICY IF EXISTS paid_admins_can_delete_quotes ON public.quotes;
CREATE POLICY paid_admins_can_delete_quotes ON public.quotes
  FOR DELETE USING (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

DROP POLICY IF EXISTS org_members_can_view_quote_lines ON public.quote_lines;
CREATE POLICY org_members_can_view_quote_lines ON public.quote_lines
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_lines.quote_id AND public.is_org_member(q.organization_id)
  ));

DROP POLICY IF EXISTS paid_admins_can_manage_quote_lines ON public.quote_lines;
CREATE POLICY paid_admins_can_manage_quote_lines ON public.quote_lines
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_lines.quote_id
      AND public.is_org_admin(q.organization_id) AND public.org_has_paid_plan(q.organization_id)
  ));

-- ── Invoice-level discount ───────────────────────────────────────
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_pct    DECIMAL(5,2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
