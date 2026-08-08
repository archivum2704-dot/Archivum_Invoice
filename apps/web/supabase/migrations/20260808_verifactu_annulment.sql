-- Registro de facturación de anulación (art. 11 RD 1007/2023).
--
-- An anulación record annuls an alta record that was generated in error. It is
-- not an invoice and does not belong in `invoices`: it has no client, no
-- lines, no amounts. It is a record about a record.
--
-- The hard part is the chain. Alta and anulación records share ONE chain per
-- organization — an anulación links to whatever record came last, alta or
-- anulación — so the chain head can no longer be "the last issued invoice".
-- verifactu_chain_links is that single chain: every record of either kind
-- takes a link in it, and the unique index there is what makes forking
-- impossible across both tables rather than within one.

CREATE TABLE IF NOT EXISTS public.verifactu_annulments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id           UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  issuer_nif           TEXT NOT NULL,
  annulled_full_number TEXT NOT NULL,
  annulled_issue_date  DATE NOT NULL,
  reason               TEXT,
  huella               TEXT NOT NULL,
  huella_anterior      TEXT,
  registro_anulacion   JSONB NOT NULL,
  generated_at         TIMESTAMPTZ NOT NULL,
  verifactu_status     TEXT NOT NULL DEFAULT 'generated'
    CHECK (verifactu_status IN ('generated','sent','error')),
  aeat_csv             TEXT,
  aeat_response        JSONB,
  submitted_at         TIMESTAMPTZ,
  aeat_attempts        INTEGER NOT NULL DEFAULT 0,
  aeat_last_attempt_at TIMESTAMPTZ,
  aeat_error           TEXT,
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_annulment_per_invoice
  ON public.verifactu_annulments (invoice_id) WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_annulments_pending_aeat
  ON public.verifactu_annulments (organization_id, generated_at)
  WHERE verifactu_status IN ('generated','error');

CREATE TABLE IF NOT EXISTS public.verifactu_chain_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('alta','anulacion')),
  invoice_id      UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  annulment_id    UUID REFERENCES public.verifactu_annulments(id) ON DELETE SET NULL,
  full_number     TEXT,
  issue_date      DATE,
  huella          TEXT NOT NULL,
  huella_anterior TEXT,
  generated_at    TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The guarantee: no two records of any kind may claim the same predecessor.
CREATE UNIQUE INDEX IF NOT EXISTS uq_chain_links_predecessor
  ON public.verifactu_chain_links (organization_id, COALESCE(huella_anterior, ''));

CREATE INDEX IF NOT EXISTS idx_chain_links_head
  ON public.verifactu_chain_links (organization_id, generated_at DESC);

INSERT INTO public.verifactu_chain_links
  (organization_id, kind, invoice_id, full_number, issue_date, huella, huella_anterior, generated_at)
SELECT i.organization_id, 'alta', i.id, i.full_number, i.issue_date,
       i.huella, i.huella_anterior, COALESCE(i.issued_at, i.created_at)
FROM public.invoices i
WHERE i.huella IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.verifactu_chain_links l WHERE l.invoice_id = i.id)
ORDER BY i.issued_at;

CREATE OR REPLACE FUNCTION public.verifactu_chain_head(p_org UUID)
RETURNS TABLE (huella TEXT, full_number TEXT, issue_date DATE)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT l.huella, l.full_number, l.issue_date
  FROM public.verifactu_chain_links l
  WHERE l.organization_id = p_org
  ORDER BY l.generated_at DESC, l.created_at DESC
  LIMIT 1;
$$;

ALTER TABLE public.verifactu_annulments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifactu_chain_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annulments_select ON public.verifactu_annulments;
CREATE POLICY annulments_select ON public.verifactu_annulments
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS chain_links_select ON public.verifactu_chain_links;
CREATE POLICY chain_links_select ON public.verifactu_chain_links
  FOR SELECT USING (public.is_org_member(organization_id));

-- Immutability triggers for both tables live in 20260808_tighten_immutability.sql.
CREATE OR REPLACE FUNCTION public.protect_chain_link()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La cadena Verifactu no se puede modificar ni borrar.';
END; $$;

DROP TRIGGER IF EXISTS trg_protect_chain_link ON public.verifactu_chain_links;
CREATE TRIGGER trg_protect_chain_link
  BEFORE UPDATE OR DELETE ON public.verifactu_chain_links
  FOR EACH ROW EXECUTE FUNCTION public.protect_chain_link();

DROP TRIGGER IF EXISTS trg_protect_annulment ON public.verifactu_annulments;
CREATE TRIGGER trg_protect_annulment
  BEFORE UPDATE OR DELETE ON public.verifactu_annulments
  FOR EACH ROW EXECUTE FUNCTION public.protect_annulment();
