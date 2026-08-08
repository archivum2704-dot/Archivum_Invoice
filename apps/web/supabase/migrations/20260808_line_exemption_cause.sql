-- Why a line is exempt (lista L10, Orden HAC/1177/2024).
--
-- A line at 0% VAT is exempt, and the record must say under which article.
-- There is no safe default: declaring an export (art. 21) as an article 20
-- exemption misstates the operation. The column is only meaningful when the
-- rate is 0, which is what the check enforces.

ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS exemption_cause TEXT;

ALTER TABLE public.invoice_lines
  DROP CONSTRAINT IF EXISTS invoice_lines_exemption_cause_check;
ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_exemption_cause_check
  CHECK (exemption_cause IS NULL OR exemption_cause IN ('E1','E2','E3','E4','E5','E6'));

ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS exemption_cause TEXT;

ALTER TABLE public.quote_lines
  DROP CONSTRAINT IF EXISTS quote_lines_exemption_cause_check;
ALTER TABLE public.quote_lines
  ADD CONSTRAINT quote_lines_exemption_cause_check
  CHECK (exemption_cause IS NULL OR exemption_cause IN ('E1','E2','E3','E4','E5','E6'));

COMMENT ON COLUMN public.invoice_lines.exemption_cause IS
  'AEAT L10: E1 art.20, E2 art.21, E3 art.22, E4 arts.23-24, E5 art.25, E6 otras. NULL when the line is not exempt.';
