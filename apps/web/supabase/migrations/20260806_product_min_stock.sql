-- Minimum stock, so running low is visible before it is a problem.
--
-- Stock is only ever decremented — issuing an invoice takes the lines off the
-- products they are linked to — and nothing said anything until it hit zero,
-- by which point the sale is already refused. A per-product floor lets the
-- inventory flag "running low" while there is still time to reorder.
--
-- Null means no floor set, which is the existing behaviour and stays the
-- default: only products someone deliberately sets a minimum on are watched.
-- The column is meaningless without track_stock, and the UI hides it there.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS min_stock NUMERIC;

COMMENT ON COLUMN public.products.min_stock IS
  'Reorder floor. When track_stock and stock_qty <= min_stock the product is flagged as low. NULL = not watched.';
