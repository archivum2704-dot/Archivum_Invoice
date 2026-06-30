-- ============================================================
-- Inventory categories: products can be grouped/filtered by an
-- optional free-text category.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products(organization_id, category);
