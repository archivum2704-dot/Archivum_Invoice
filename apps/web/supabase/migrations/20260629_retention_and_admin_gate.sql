-- ============================================================
-- 1) Platform admins can use paid features (inventory/invoicing)
--    on any organization, regardless of plan.
-- 2) Retención (IRPF) on invoices.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.org_has_paid_plan(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id
      AND subscription_plan <> 'free'
      AND subscription_status NOT IN ('canceled', 'unpaid', 'incomplete')
  );
$$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS retention_pct    DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS retention_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
