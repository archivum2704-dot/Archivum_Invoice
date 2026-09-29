-- ============================================================
-- CIF/NIF obligatorio y único por cliente dentro de cada organización.
--
-- Hasta ahora el CIF era opcional y nada impedía dar de alta dos veces la
-- misma empresa, lo que permite facturar al registro equivocado o partir el
-- historial de un cliente en dos (WEB-004). La aplicación ya lo exige y
-- avisa; esto lo garantiza en la base de datos, para cualquier vía de
-- entrada (importación Excel, móvil, API).
--
-- 1. Único: dos clientes de la misma organización no pueden compartir CIF.
--    Se compara normalizado — sin espacios, puntos, guiones ni barras, y en
--    mayúsculas —, así que «B-12.345.678» y «b12345678» son el mismo.
--    ⚠️ Si ya hay duplicados, el CREATE UNIQUE INDEX falla y no se aplica
--    nada. Antes de ejecutar esto, comprobar con:
--
--      SELECT organization_id,
--             upper(regexp_replace(cif, '[\s./-]', '', 'g')) AS cif_norm,
--             count(*), array_agg(name)
--      FROM public.companies
--      WHERE cif IS NOT NULL AND btrim(cif) <> ''
--      GROUP BY 1, 2 HAVING count(*) > 1;
--
--    y unificar o corregir los que salgan.
--
-- 2. Obligatorio: un cliente nuevo no se puede crear sin CIF, y a uno que ya
--    lo tiene no se le puede borrar. Los clientes antiguos que se crearon sin
--    CIF siguen existiendo y se pueden suspender o reactivar; al editarlos
--    desde la aplicación se pide el CIF. Se hace con un trigger y no con un
--    CHECK para no romper esas filas antiguas.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_org_cif
  ON public.companies (organization_id, upper(regexp_replace(cif, '[\s./-]', '', 'g')))
  WHERE cif IS NOT NULL AND btrim(cif) <> '';

CREATE OR REPLACE FUNCTION public.require_company_cif()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF (NEW.cif IS NULL OR btrim(NEW.cif) = '')
     AND (TG_OP = 'INSERT' OR NEW.cif IS DISTINCT FROM OLD.cif) THEN
    RAISE EXCEPTION 'El CIF/NIF del cliente es obligatorio.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS require_company_cif ON public.companies;
CREATE TRIGGER require_company_cif
  BEFORE INSERT OR UPDATE OF cif ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.require_company_cif();
