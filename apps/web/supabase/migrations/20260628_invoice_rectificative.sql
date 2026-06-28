-- ============================================================
-- Rectificative invoices (facturas rectificativas / notas de abono)
--
-- Adds a self-reference so a rectifying invoice points at the invoice
-- it corrects/annuls. The Verifactu link (FacturasRectificadas) is also
-- stored inside the registro_alta JSON of the rectifying invoice.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS rectifies_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_rectifies ON public.invoices(rectifies_invoice_id);
