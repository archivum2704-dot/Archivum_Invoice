-- ============================================================
-- Fix: verifactu_status check constraint rejects 'not_applicable'
--
-- 20260810_verifactu_obligado.sql added organizations.verifactu_obligado
-- and lib/invoice-issue.ts started writing verifactu_status = 'not_applicable'
-- for organizations that opted out, but the original CHECK constraint on
-- invoices.verifactu_status (20260628_inventory_invoicing.sql) was never
-- widened to allow that value. Every invoice issued from such an
-- organization — including converting an albarán to factura — failed with:
--   new row for relation "invoices" violates check constraint
--   "invoices_verifactu_status_check"
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_verifactu_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_verifactu_status_check
  CHECK (verifactu_status IN ('pending','generated','sent','error','exempt','not_applicable'));
