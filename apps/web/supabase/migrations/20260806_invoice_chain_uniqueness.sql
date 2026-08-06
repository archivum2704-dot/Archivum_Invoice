-- No two invoices may claim the same predecessor in the Verifactu chain.
--
-- Issuing reads the last huella of the organization and then inserts an invoice
-- pointing at it. Those are two separate statements in two separate requests,
-- so two invoices issued at the same moment both read the same head and both
-- chain onto it. The chain forks — which is precisely the thing the huella
-- exists to make impossible — and nothing complains, because until now nothing
-- checked. It corrupts silently.
--
-- A unique index makes the second writer fail instead. issueInvoice() catches
-- that failure, re-reads the now-advanced head and recomputes the huella,
-- keeping the invoice number it already took so the series stays gap-free.
--
-- Scoped to rows that carry a huella: drafts have none and must not collide
-- with each other. COALESCE gives the first record in a chain ('' predecessor)
-- a real value, so two "first records" collide as they should.
--
-- Before applying: if a chain has already forked, creating the index fails.
-- This lists any organization where two invoices share a predecessor, so the
-- damage can be looked at before it is locked out:
--
--   SELECT organization_id, COALESCE(huella_anterior, '') AS predecessor,
--          count(*), array_agg(full_number ORDER BY issued_at)
--   FROM public.invoices
--   WHERE huella IS NOT NULL
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- An empty result means the chain is intact and the index can go on as is.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_chain
  ON public.invoices (organization_id, COALESCE(huella_anterior, ''))
  WHERE huella IS NOT NULL;
