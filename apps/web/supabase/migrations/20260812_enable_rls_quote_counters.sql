-- ============================================================
-- quote_counters had RLS disabled entirely while anon/authenticated held
-- full table-level grants (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) — the same
-- default grants its sibling invoice_counters has, but without RLS to make
-- them moot. Anyone on the internet, unauthenticated, could tamper with or
-- wipe any organization's quote/delivery-note numbering counters via the
-- public REST API.
--
-- Mirrors invoice_counters exactly: RLS enabled, no policies, so PostgREST
-- access is denied for anon/authenticated while next_quote_number()
-- (SECURITY DEFINER, owned by postgres) keeps working — table owners bypass
-- RLS regardless of policies.
-- ============================================================

ALTER TABLE public.quote_counters ENABLE ROW LEVEL SECURITY;
