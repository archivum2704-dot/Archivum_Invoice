-- ============================================================
-- Inventory + Invoicing (Verifactu-ready) — paid plans only
--
-- Adds:
--   • province column to organizations and companies
--   • products (inventory) table
--   • invoices + invoice_lines (Verifactu-compliant issued invoices)
--   • invoice_counters + next_invoice_number() for atomic numbering
--   • org_has_paid_plan() helper for plan-gating at the data layer
--   • immutability protection for issued invoices
--
-- RLS reuses the existing is_org_member() / is_org_admin() helpers
-- (defined in 002_rls_policies.sql), which already cover platform admins.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── Province on emisor (org) and clients (companies) ────────
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.companies     ADD COLUMN IF NOT EXISTS province TEXT;

-- ── Plan gate helper: TRUE when org is on any non-free plan ──
CREATE OR REPLACE FUNCTION public.org_has_paid_plan(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id
      AND subscription_plan <> 'free'
      AND subscription_status NOT IN ('canceled', 'unpaid', 'incomplete')
  );
$$;

-- ╔════════════════════════════════════════════════════════════╗
-- ║  INVENTORY                                                 ║
-- ╚════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sku             TEXT,
  description     TEXT,
  unit            TEXT NOT NULL DEFAULT 'ud',          -- ud, kg, h, m, ...
  unit_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate        DECIMAL(5,2)  NOT NULL DEFAULT 21.00,
  track_stock     BOOLEAN NOT NULL DEFAULT TRUE,
  stock_qty       DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_name_nonempty CHECK (char_length(trim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_org_sku
  ON public.products(organization_id, sku) WHERE sku IS NOT NULL;

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_products"
  ON public.products FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "paid_admins_can_insert_products"
  ON public.products FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

CREATE POLICY "paid_admins_can_update_products"
  ON public.products FOR UPDATE
  USING (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

CREATE POLICY "paid_admins_can_delete_products"
  ON public.products FOR DELETE
  USING (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

-- ╔════════════════════════════════════════════════════════════╗
-- ║  INVOICING (Verifactu-ready)                               ║
-- ╚════════════════════════════════════════════════════════════╝
DO $$ BEGIN
  CREATE TYPE invoice_kind   AS ENUM ('ordinary', 'simplified', 'rectifying');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE invoice_state  AS ENUM ('draft', 'issued', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_company_id  UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  -- Numbering (immutable once issued)
  series             TEXT NOT NULL DEFAULT 'FAC',
  number             INTEGER,
  full_number        TEXT,                  -- e.g. FAC-2026-0001
  kind               invoice_kind  NOT NULL DEFAULT 'ordinary',
  state              invoice_state NOT NULL DEFAULT 'draft',

  -- Dates
  issue_date         DATE,
  operation_date     DATE,
  due_date           DATE,

  -- Amounts
  currency           TEXT NOT NULL DEFAULT 'EUR',
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
  total              DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Emisor snapshot (frozen at issue time)
  issuer_name        TEXT, issuer_cif TEXT, issuer_address TEXT,
  issuer_city        TEXT, issuer_postal_code TEXT, issuer_province TEXT,
  -- Receptor snapshot
  client_name        TEXT, client_cif TEXT, client_address TEXT,
  client_city        TEXT, client_postal_code TEXT, client_province TEXT,

  notes              TEXT,

  -- Verifactu registro de alta
  huella             TEXT,         -- SHA-256 of this record (+ previous huella)
  huella_anterior    TEXT,         -- previous record's huella (chain)
  qr_url             TEXT,         -- AEAT cotejo URL embedded in the QR
  registro_alta      JSONB,        -- canonical registro de alta payload
  verifactu_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (verifactu_status IN ('pending','generated','sent','error','exempt')),
  issued_at          TIMESTAMPTZ,  -- FechaHoraHusoGenRegistro

  -- Payment + library link
  payment_status     document_status DEFAULT 'pending',
  document_id        UUID REFERENCES public.documents(id) ON DELETE SET NULL,

  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_org    ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_state  ON public.invoices(state);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_fullnumber
  ON public.invoices(organization_id, full_number) WHERE full_number IS NOT NULL;

CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

-- ── Atomic per (org, series, year) invoice numbering ────────
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  series          TEXT NOT NULL,
  year            INTEGER NOT NULL,
  last_number     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, series, year)
);

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_org UUID, p_series TEXT, p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next INTEGER;
BEGIN
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.invoice_counters AS c (organization_id, series, year, last_number)
  VALUES (p_org, p_series, p_year, 1)
  ON CONFLICT (organization_id, series, year)
  DO UPDATE SET last_number = c.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END; $$;

-- ── Immutability: issued invoices cannot be deleted or have ──
--    their legal/Verifactu fields altered (corrections → rectifying).
CREATE OR REPLACE FUNCTION public.protect_issued_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN
      RAISE EXCEPTION 'Una factura emitida no se puede eliminar; emite una factura rectificativa.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE on an already-issued invoice: only payment_status,
  -- verifactu_status, document_id and updated_at may change.
  IF OLD.state = 'issued' AND NEW.state = 'issued' THEN
    IF (NEW.series, NEW.number, NEW.full_number, NEW.kind, NEW.issue_date,
        NEW.operation_date, NEW.subtotal, NEW.tax_amount, NEW.total,
        NEW.huella, NEW.huella_anterior, NEW.client_cif, NEW.issuer_cif)
       IS DISTINCT FROM
       (OLD.series, OLD.number, OLD.full_number, OLD.kind, OLD.issue_date,
        OLD.operation_date, OLD.subtotal, OLD.tax_amount, OLD.total,
        OLD.huella, OLD.huella_anterior, OLD.client_cif, OLD.issuer_cif)
    THEN
      RAISE EXCEPTION 'Una factura emitida es inmutable (Verifactu).';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_issued_invoice ON public.invoices;
CREATE TRIGGER trg_protect_issued_invoice
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_issued_invoice();

-- Lines of an issued invoice are frozen.
CREATE OR REPLACE FUNCTION public.protect_issued_invoice_lines()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_state invoice_state;
BEGIN
  SELECT state INTO v_state FROM public.invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_state = 'issued' THEN
    RAISE EXCEPTION 'Las líneas de una factura emitida son inmutables.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_protect_issued_invoice_lines ON public.invoice_lines;
CREATE TRIGGER trg_protect_issued_invoice_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.protect_issued_invoice_lines();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_invoices"
  ON public.invoices FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "paid_admins_can_insert_invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

CREATE POLICY "paid_admins_can_update_invoices"
  ON public.invoices FOR UPDATE
  USING (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

CREATE POLICY "paid_admins_can_delete_invoices"
  ON public.invoices FOR DELETE
  USING (public.is_org_admin(organization_id) AND public.org_has_paid_plan(organization_id));

CREATE POLICY "org_members_can_view_invoice_lines"
  ON public.invoice_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id AND public.is_org_member(i.organization_id)
  ));

CREATE POLICY "paid_admins_can_manage_invoice_lines"
  ON public.invoice_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.is_org_admin(i.organization_id)
      AND public.org_has_paid_plan(i.organization_id)
  ));

-- invoice_counters: managed exclusively through next_invoice_number()
-- (SECURITY DEFINER). No direct client policies → default deny.
