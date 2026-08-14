-- ============================================================
-- Pins search_path on every function the Supabase security linter flagged as
-- mutable (function_search_path_mutable). Several are SECURITY DEFINER
-- functions that decide access (is_org_admin, is_org_member,
-- can_access_company...), so an unpinned search_path is the classic vector
-- for a privilege-escalation attack via schema/object shadowing.
--
-- Not exploitable today — neither anon nor authenticated has CREATE on the
-- public schema in this project — but this is the standard hardening
-- regardless of current exploitability. No behavior change: it only pins
-- name resolution to the schema these functions already exclusively use.
-- ============================================================

ALTER FUNCTION public.bypasses_plan_limits() SET search_path = public;
ALTER FUNCTION public.calculate_item_subtotal() SET search_path = public;
ALTER FUNCTION public.can_access_company(co_id uuid) SET search_path = public;
ALTER FUNCTION public.can_access_folder(fo_id uuid) SET search_path = public;
ALTER FUNCTION public.decrement_quota_pool() SET search_path = public;
ALTER FUNCTION public.enforce_company_limit() SET search_path = public;
ALTER FUNCTION public.enforce_doc_quota() SET search_path = public;
ALTER FUNCTION public.enforce_member_limit() SET search_path = public;
ALTER FUNCTION public.fn_set_inbox_token() SET search_path = public;
ALTER FUNCTION public.generate_org_access_code() SET search_path = public;
ALTER FUNCTION public.grant_company_creator_access() SET search_path = public;
ALTER FUNCTION public.increment_quota_pool() SET search_path = public;
ALTER FUNCTION public.is_org_admin(org_id uuid) SET search_path = public;
ALTER FUNCTION public.is_org_member(org_id uuid) SET search_path = public;
ALTER FUNCTION public.is_org_viewer(org_id uuid) SET search_path = public;
ALTER FUNCTION public.is_platform_admin() SET search_path = public;
ALTER FUNCTION public.next_invoice_number(p_org uuid, p_series text, p_year integer) SET search_path = public;
ALTER FUNCTION public.next_quote_number(p_org uuid, p_series text, p_year integer) SET search_path = public;
ALTER FUNCTION public.org_has_paid_plan(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.org_plan_limits(org_id uuid) SET search_path = public;
ALTER FUNCTION public.protect_annulment() SET search_path = public;
ALTER FUNCTION public.protect_billing_columns() SET search_path = public;
ALTER FUNCTION public.protect_chain_link() SET search_path = public;
ALTER FUNCTION public.protect_event() SET search_path = public;
ALTER FUNCTION public.protect_issued_invoice() SET search_path = public;
ALTER FUNCTION public.protect_issued_invoice_lines() SET search_path = public;
ALTER FUNCTION public.renew_doc_quota(p_org_id uuid, p_monthly_docs integer) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.sync_document_count() SET search_path = public;
ALTER FUNCTION public.update_document_totals() SET search_path = public;
ALTER FUNCTION public.verifactu_chain_head(p_org uuid) SET search_path = public;
ALTER FUNCTION public.verifactu_event_head(p_org uuid) SET search_path = public;
