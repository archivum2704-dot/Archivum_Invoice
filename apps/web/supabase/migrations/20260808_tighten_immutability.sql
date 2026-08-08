-- Two corrections to inalterabilidad (art. 8.2.a).
--
-- 1. An annulment that never made it onto the chain does not exist as a
--    record, so removing it is cleanup rather than tampering. Once it holds a
--    link it is as immutable as any other record.
--
-- 2. protect_issued_invoice only checked when the state was 'issued' both
--    before and after. Moving an invoice to 'cancelled' therefore skipped the
--    check, and every update afterwards skipped it too — so a two-step edit
--    could rewrite an issued invoice's amounts, huella and NIFs. The
--    protection now applies to anything that has left draft.

CREATE OR REPLACE FUNCTION public.protect_annulment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.verifactu_chain_links l WHERE l.annulment_id = OLD.id) THEN
      RAISE EXCEPTION 'Un registro de anulación encadenado no se puede eliminar.';
    END IF;
    RETURN OLD;
  END IF;

  IF (NEW.huella, NEW.huella_anterior, NEW.annulled_full_number, NEW.annulled_issue_date,
      NEW.issuer_nif, NEW.registro_anulacion, NEW.generated_at)
     IS DISTINCT FROM
     (OLD.huella, OLD.huella_anterior, OLD.annulled_full_number, OLD.annulled_issue_date,
      OLD.issuer_nif, OLD.registro_anulacion, OLD.generated_at)
  THEN
    RAISE EXCEPTION 'Un registro de anulación es inmutable (Verifactu).';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_issued_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN
      RAISE EXCEPTION 'Una factura emitida no se puede eliminar; emite una factura rectificativa.';
    END IF;
    RETURN OLD;
  END IF;

  -- Anything that has left draft is frozen, whatever it moves to next.
  -- Checking only 'issued' -> 'issued' left a two-step route around this:
  -- flip the state to 'cancelled', then edit freely.
  IF OLD.state <> 'draft' THEN
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
