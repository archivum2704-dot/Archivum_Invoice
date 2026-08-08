-- Bookkeeping for AEAT submission.
--
-- aeat_csv / aeat_response / submitted_at already record a success. What was
-- missing is everything about a submission that has not succeeded yet: how
-- many times it has been tried, when, and why it failed. Without that a sweep
-- cannot tell a record it has never seen from one the AEAT keeps rejecting,
-- and would retry a permanently invalid record forever.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS aeat_attempts        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aeat_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aeat_error           TEXT;

-- Flow control. The AEAT answers each submission with how long to wait before
-- the next one; ignoring it gets the caller throttled, so it is stored per
-- organization and honoured by the sweep.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS verifactu_retry_after TIMESTAMPTZ;

-- The sweep looks for records that are generated but not sent, oldest first.
CREATE INDEX IF NOT EXISTS idx_invoices_pending_aeat
  ON public.invoices (organization_id, issued_at)
  WHERE verifactu_status IN ('generated', 'error');

COMMENT ON COLUMN public.invoices.aeat_attempts IS
  'How many times submission to the AEAT has been attempted. Used to back off, not to give up: an unsent record stays a legal obligation.';
