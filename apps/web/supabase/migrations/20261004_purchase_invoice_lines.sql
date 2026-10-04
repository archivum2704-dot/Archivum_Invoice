-- Facturas de compra con líneas que suben el stock.
--
-- Una factura recibida (documents.document_type = 'invoice_received') puede
-- llevar líneas en document_items, cada una opcionalmente enlazada a un
-- producto. Mientras la factura exista y no esté anulada ni en borrador, la
-- cantidad de cada línea con producto de stock controlado está sumada a
-- products.stock_qty. Un borrador (p. ej. el que se guarda solo al salir de
-- Subir a medias) no mueve stock hasta que pasa a pendiente o pagada.
--
-- Todo el ajuste de stock vive aquí, en la base de datos, y no en la web ni en
-- el móvil: así las dos apps no pueden divergir, y borrar, anular o editar la
-- factura deshace exactamente lo que se sumó.
--
-- Cómo se sabe qué hay sumado: document_items.stock_applied. Un trigger
-- BEFORE en las líneas resta lo que tenía aplicado (OLD) y suma lo que toca
-- aplicar ahora (NEW). Cuando cambia el tipo o el estado de la factura, se
-- «tocan» sus líneas para que ese mismo trigger lo recalcule.

-- ── Columnas ────────────────────────────────────────────────────────────────
ALTER TABLE public.document_items
  ADD COLUMN IF NOT EXISTS product_id    uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_applied boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_document_items_document ON public.document_items(document_id);
CREATE INDEX IF NOT EXISTS idx_document_items_product  ON public.document_items(product_id)
  WHERE product_id IS NOT NULL;

-- ── Totales del documento a partir de sus líneas ────────────────────────────
-- La versión original usaba NEW también en DELETE, donde NEW es NULL: borrar
-- una línea no recalculaba nada.
CREATE OR REPLACE FUNCTION public.update_document_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_doc uuid := COALESCE(NEW.document_id, OLD.document_id);
BEGIN
  UPDATE public.documents
  SET subtotal   = (SELECT COALESCE(SUM(subtotal), 0) FROM public.document_items WHERE document_id = v_doc),
      tax_amount = (SELECT COALESCE(ROUND(SUM(subtotal * tax_rate / 100), 2), 0) FROM public.document_items WHERE document_id = v_doc),
      total      = (SELECT COALESCE(ROUND(SUM(subtotal * (1 + tax_rate / 100)), 2), 0) FROM public.document_items WHERE document_id = v_doc),
      updated_at = now()
  WHERE id = v_doc;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_item_subtotal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.subtotal := ROUND(NEW.quantity * NEW.unit_price, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calc_item_subtotal ON public.document_items;
CREATE TRIGGER calc_item_subtotal
  BEFORE INSERT OR UPDATE ON public.document_items
  FOR EACH ROW EXECUTE FUNCTION public.calculate_item_subtotal();

DROP TRIGGER IF EXISTS update_doc_totals ON public.document_items;
CREATE TRIGGER update_doc_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.document_items
  FOR EACH ROW EXECUTE FUNCTION public.update_document_totals();

-- ── Stock ───────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: un colaborador puede registrar una factura de compra
-- aunque las políticas de products solo dejen editar a los admins. Por eso se
-- comprueba aquí que el producto sea de la misma organización que la factura.
CREATE OR REPLACE FUNCTION public.apply_purchase_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Deshacer lo que esta línea tenía sumado.
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.stock_applied AND OLD.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock_qty = stock_qty - OLD.quantity
    WHERE id = OLD.product_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- 2. Sumar lo que toca ahora.
  NEW.stock_applied := NEW.product_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.products p ON p.id = NEW.product_id
    WHERE d.id = NEW.document_id
      AND d.document_type = 'invoice_received'
      AND COALESCE(d.status::text, 'pending') NOT IN ('draft', 'cancelled')
      AND p.organization_id = d.organization_id
      AND p.track_stock
  );

  IF NEW.stock_applied THEN
    UPDATE public.products
    SET stock_qty = stock_qty + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_item_stock ON public.document_items;
CREATE TRIGGER trg_purchase_item_stock
  BEFORE INSERT OR UPDATE OR DELETE ON public.document_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_item_stock();

-- Al anular la factura, sacarla de borrador, cambiarle el tipo o reactivarla, se vuelven a
-- evaluar sus líneas: el UPDATE vacío dispara trg_purchase_item_stock.
CREATE OR REPLACE FUNCTION public.reapply_purchase_stock_on_document_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.document_type, OLD.status) IS DISTINCT FROM (NEW.document_type, NEW.status) THEN
    UPDATE public.document_items
    SET stock_applied = stock_applied
    WHERE document_id = NEW.id AND product_id IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_purchase_stock ON public.documents;
CREATE TRIGGER trg_document_purchase_stock
  AFTER UPDATE OF document_type, status ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.reapply_purchase_stock_on_document_change();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Borrar líneas estaba reservado a admins, pero editar una factura de compra
-- las sustituye: cualquiera que pueda crearlas (no lector) puede borrarlas.
DROP POLICY IF EXISTS doc_items_delete ON public.document_items;
CREATE POLICY doc_items_delete ON public.document_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_items.document_id
      AND is_org_member(d.organization_id)
      AND NOT is_org_viewer(d.organization_id)
  )
);
