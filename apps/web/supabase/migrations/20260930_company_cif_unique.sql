-- ============================================================
-- CIF/NIF obligatorio y único por cliente principal; establecimientos.
--
-- Un mismo contribuyente puede tener varios locales (p. ej. un autónomo con
-- dos tiendas): mismo NIF, distinta dirección de facturación. Por eso:
--
-- - Un cliente es *principal* o *establecimiento* de uno
--   (`parent_company_id` → el principal). Un solo nivel.
-- - El CIF/NIF es único entre los principales de cada organización. Un
--   establecimiento comparte el de su principal.
-- - Crear un cliente sin CIF, o borrárselo, no se permite.
--
-- Se compara el CIF normalizado — sin espacios, puntos, guiones ni barras, y
-- en mayúsculas —, así que «B-12.345.678» y «b12345678» son el mismo.
--
-- ⚠️ Si ya hay dos principales con el mismo CIF, el CREATE UNIQUE INDEX
-- falla y no se aplica nada. Comprobar antes con:
--
--   SELECT organization_id,
--          upper(regexp_replace(cif, '[\s./-]', '', 'g')) AS cif_norm,
--          count(*), array_agg(name), array_agg(id)
--   FROM public.companies
--   WHERE cif IS NOT NULL AND btrim(cif) <> '' AND parent_company_id IS NULL
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- y, para cada uno que sea un local del otro, convertirlo en establecimiento:
--   UPDATE public.companies SET parent_company_id = '<id principal>' WHERE id = '<id local>';
--
-- Los clientes antiguos sin CIF siguen existiendo y se pueden suspender o
-- reactivar; al editarlos desde la aplicación se pide el CIF. Se hace con un
-- trigger y no con un CHECK para no romper esas filas.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_org_cif
  ON public.companies (organization_id, upper(regexp_replace(cif, '[\s./-]', '', 'g')))
  WHERE cif IS NOT NULL AND btrim(cif) <> '' AND parent_company_id IS NULL;

CREATE OR REPLACE FUNCTION public.check_company_rules()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  p public.companies%ROWTYPE;
BEGIN
  -- CIF obligatorio al crear; no se puede borrar después.
  IF (NEW.cif IS NULL OR btrim(NEW.cif) = '')
     AND (TG_OP = 'INSERT' OR NEW.cif IS DISTINCT FROM OLD.cif) THEN
    RAISE EXCEPTION 'El CIF/NIF del cliente es obligatorio.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.parent_company_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.parent_company_id IS DISTINCT FROM OLD.parent_company_id
          OR NEW.cif IS DISTINCT FROM OLD.cif) THEN
    SELECT * INTO p FROM public.companies WHERE id = NEW.parent_company_id;
    IF NOT FOUND OR p.organization_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'El cliente principal del establecimiento no existe en esta organización.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF p.parent_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un establecimiento no puede tener establecimientos: elige el cliente principal.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF p.id = NEW.id THEN
      RAISE EXCEPTION 'Un cliente no puede ser establecimiento de sí mismo.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF upper(regexp_replace(coalesce(p.cif, ''), '[\s./-]', '', 'g'))
       <> upper(regexp_replace(coalesce(NEW.cif, ''), '[\s./-]', '', 'g')) THEN
      RAISE EXCEPTION 'Un establecimiento debe tener el mismo CIF/NIF que su cliente principal.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Un cliente con establecimientos no puede pasar a ser establecimiento.
  IF TG_OP = 'UPDATE' AND NEW.parent_company_id IS NOT NULL AND OLD.parent_company_id IS NULL
     AND EXISTS (SELECT 1 FROM public.companies c WHERE c.parent_company_id = NEW.id) THEN
    RAISE EXCEPTION 'Este cliente tiene establecimientos: no puede ser a su vez establecimiento de otro.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;

-- Replaces the first version of this migration, if it was applied.
DROP TRIGGER IF EXISTS require_company_cif ON public.companies;
DROP FUNCTION IF EXISTS public.require_company_cif();

DROP TRIGGER IF EXISTS check_company_rules ON public.companies;
CREATE TRIGGER check_company_rules
  BEFORE INSERT OR UPDATE OF cif, parent_company_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.check_company_rules();
