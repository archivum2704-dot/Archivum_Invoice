-- Proveedores (15 de octubre de 2026).
--
-- Hasta ahora `companies` solo eran clientes: la factura de compra elegía a su
-- proveedor de la lista de clientes, y no había dónde ver los proveedores.
-- Un mismo contribuyente puede ser las dos cosas (le vendes y le compras), y
-- el CIF/NIF es único por organización (uq_companies_org_cif), así que no son
-- dos tablas sino una columna:
--
--   client    solo cliente (lo de siempre; valor por defecto)
--   supplier  solo proveedor
--   both      cliente y proveedor
--
-- Las ventas (pedidos, albaranes, facturas emitidas) eligen entre client/both;
-- las facturas recibidas, entre supplier/both. Lo decide la app
-- (lib/company-kind.ts, web y móvil), no la base de datos: una factura antigua
-- puede apuntar a una empresa que ya no tenga ese papel, y no debe romperse.
--
-- Idempotente: se puede ejecutar varias veces.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'client';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_kind_check' AND conrelid = 'public.companies'::regclass
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_kind_check CHECK (kind IN ('client', 'supplier', 'both'));
  END IF;
END $$;

-- Lo ya registrado: quien figura como proveedor de una factura recibida es
-- proveedor; si además se le ha vendido algo (o tiene otros documentos), es
-- ambas cosas. Solo toca filas que siguen en 'client', así que volver a
-- ejecutarlo no deshace lo que alguien haya cambiado a mano.
WITH purchases AS (
  SELECT DISTINCT company_id AS id
  FROM public.documents
  WHERE document_type = 'invoice_received' AND company_id IS NOT NULL
),
sales AS (
  SELECT client_company_id AS id FROM public.invoices WHERE client_company_id IS NOT NULL
  UNION
  SELECT client_company_id FROM public.quotes WHERE client_company_id IS NOT NULL
  UNION
  SELECT company_id FROM public.documents
  WHERE company_id IS NOT NULL AND document_type <> 'invoice_received'
)
UPDATE public.companies c
SET kind = CASE WHEN EXISTS (SELECT 1 FROM sales s WHERE s.id = c.id) THEN 'both' ELSE 'supplier' END
WHERE c.kind = 'client'
  AND c.id IN (SELECT id FROM purchases);

-- El límite de clientes del plan cuenta clientes: un proveedor no lo consume.
CREATE OR REPLACE FUNCTION public.enforce_company_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF public.bypasses_plan_limits() THEN RETURN NEW; END IF;
  IF NEW.kind = 'supplier' THEN RETURN NEW; END IF;

  SELECT max_companies INTO v_max FROM public.org_plan_limits(NEW.organization_id);
  SELECT count(*) INTO v_count FROM public.companies
  WHERE organization_id = NEW.organization_id AND kind <> 'supplier';

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de clientes de tu plan (%)', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Pasar un proveedor a cliente (o a ambos) también consume un cliente del plan.
CREATE OR REPLACE FUNCTION public.enforce_company_limit_on_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF public.bypasses_plan_limits() THEN RETURN NEW; END IF;
  IF NOT (OLD.kind = 'supplier' AND NEW.kind <> 'supplier') THEN RETURN NEW; END IF;

  SELECT max_companies INTO v_max FROM public.org_plan_limits(NEW.organization_id);
  SELECT count(*) INTO v_count FROM public.companies
  WHERE organization_id = NEW.organization_id AND kind <> 'supplier' AND id <> NEW.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de clientes de tu plan (%)', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_company_limit_on_kind ON public.companies;
CREATE TRIGGER enforce_company_limit_on_kind
  BEFORE UPDATE OF kind ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_limit_on_kind();

CREATE INDEX IF NOT EXISTS idx_companies_org_kind ON public.companies (organization_id, kind);
