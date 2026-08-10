-- ============================================================
-- Verifactu — clave de régimen del obligado tributario
--
-- Hasta ahora el desglose declaraba siempre ClaveRegimen = 01 (régimen
-- general). El esquema de la AEAT admite además 02-11, 14, 15 y 17-21.
--
-- Se guarda por organización porque el régimen es del obligado, no de la
-- factura. Por defecto 01, que es lo que se venía enviando: ninguna
-- organización existente cambia de comportamiento al aplicar esto.
--
-- ⚠ Las descripciones de cada código están en las listas L8A (IVA) y L8B
-- (IGIC) de la AEAT, que todavía no obran en nuestro poder. Por eso la
-- interfaz muestra el código y no una descripción inventada.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS verifactu_clave_regimen TEXT NOT NULL DEFAULT '01';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_clave_regimen_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_clave_regimen_check
      CHECK (verifactu_clave_regimen IN (
        '01','02','03','04','05','06','07','08','09','10','11',
        '14','15','17','18','19','20','21'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.verifactu_clave_regimen IS
  'ClaveRegimen (lista L8A) que se declara en el desglose de los registros de '
  'facturación. 01 = régimen general.';
