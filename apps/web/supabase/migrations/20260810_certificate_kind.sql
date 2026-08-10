-- ============================================================
-- Verifactu — tipo de certificado (representante o sello)
--
-- La AEAT atiende los certificados de sello en un host distinto del de los
-- certificados de representante. Confirmado por la propia AEAT (agosto de
-- 2026): pruebas en prewww1 para representante y prewww10 para sello. Enviar
-- al host equivocado no es un detalle de configuración: la remisión falla.
--
-- Se guarda por organización porque cada obligado sube el suyo.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.org_certificates
  ADD COLUMN IF NOT EXISTS cert_kind TEXT NOT NULL DEFAULT 'representante';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_certificates_cert_kind_check'
  ) THEN
    ALTER TABLE public.org_certificates
      ADD CONSTRAINT org_certificates_cert_kind_check
      CHECK (cert_kind IN ('representante', 'sello'));
  END IF;
END $$;

COMMENT ON COLUMN public.org_certificates.cert_kind IS
  'representante | sello. Decide a qué host de la AEAT se remite. Se deduce del '
  'propio certificado al subirlo: los de representante identifican a una persona '
  'física (nombre y apellidos), los de sello solo a la entidad.';
