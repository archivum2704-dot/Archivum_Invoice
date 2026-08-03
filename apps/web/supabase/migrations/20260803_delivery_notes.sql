-- Albaranes (delivery notes) between a quote and its invoice.
--
-- The flow becomes: presupuesto → albarán → factura. Creating a quote now also
-- opens a delivery note for it, and that note — not the quote — is what can be
-- turned into an invoice, so there is exactly one path to a bill and no way to
-- invoice the same work twice.
--
-- A delivery note carries exactly what a quote carries: a client, lines,
-- totals and a status. Rather than duplicate the table, its lines, its
-- counters and its policies, it lives in `quotes` behind a `kind`
-- discriminator, with its own series (ALB) and its own numbering.
-- Every query that means "presupuestos" must therefore filter on kind.

DO $$ BEGIN
  CREATE TYPE quote_kind AS ENUM ('quote', 'delivery_note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS kind quote_kind NOT NULL DEFAULT 'quote';

-- The quote a delivery note was opened from.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS source_quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE;

-- 'open' is the state a delivery note starts in: issued, not yet billed.
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'open';

CREATE INDEX IF NOT EXISTS idx_quotes_kind   ON public.quotes(kind);
CREATE INDEX IF NOT EXISTS idx_quotes_source ON public.quotes(source_quote_id);

-- One delivery note per quote.
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_source
  ON public.quotes(source_quote_id) WHERE source_quote_id IS NOT NULL;
