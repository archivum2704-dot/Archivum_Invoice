-- ============================================================
-- verifactu_chain_links has had RLS enabled since it was created
-- (20260808_verifactu_annulment.sql) but only ever got a SELECT policy.
-- insertChainedInvoice() (lib/invoice-chain.ts) inserts into this table with
-- the caller's own RLS-scoped client right after inserting into `invoices`,
-- in the same request — so it needs an INSERT policy mirroring exactly what
-- already governs INSERT on `invoices` itself: only a paid org's admin/owner
-- may take a link in the chain, same as they're the only one who may create
-- the invoice attached to it.
--
-- Without this, issuing any invoice failed with:
--   "new row violates row-level security policy for table verifactu_chain_links"
--
-- Annulments write chain links too (kind='anulacion'), but through the
-- service-role client in /api/invoices/annul, which bypasses RLS — so they
-- are unaffected by this policy either way.
-- ============================================================

CREATE POLICY chain_links_insert ON public.verifactu_chain_links
  FOR INSERT WITH CHECK (is_org_admin(organization_id) AND org_has_paid_plan(organization_id));
