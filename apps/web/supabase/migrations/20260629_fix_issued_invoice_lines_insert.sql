-- ============================================================
-- Fix: issuing an invoice failed with
--   "Las líneas de una factura emitida son inmutables."
--
-- The invoice is created (state = 'issued') before its lines are
-- inserted, so the immutability trigger rejected the line INSERTs.
-- Lines must stay frozen once issued, but the initial INSERT during
-- creation is legitimate — so we skip the check on INSERT and keep
-- blocking UPDATE/DELETE on lines of an already-issued invoice.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_issued_invoice_lines()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_state invoice_state;
BEGIN
  -- Allow the initial insertion of lines while the invoice is being created.
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

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
