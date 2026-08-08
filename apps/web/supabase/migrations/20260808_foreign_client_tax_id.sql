-- Identifying a client who is not Spanish.
--
-- The registro de alta identifies the recipient by NIF, which only exists for
-- Spanish taxpayers. Everyone else has to go in the AEAT's IDOtro block: a
-- country, a type of identification, and the identifier itself. Without these
-- columns a foreign client could only be sent as if they held a Spanish NIF,
-- which is a false declaration rather than an approximation.
--
-- Defaults keep every existing client Spanish, which is what they are: an
-- unset tax_id_type means "identified by NIF" and nothing changes for them.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'ES',
  ADD COLUMN IF NOT EXISTS tax_id_type  TEXT;

-- The AEAT's L7 list. NULL means the Spanish NIF path.
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_tax_id_type_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_tax_id_type_check
  CHECK (tax_id_type IS NULL OR tax_id_type IN ('02','03','04','05','06','07'));

-- Invoices snapshot the client, because a record must keep describing the
-- client as they were when it was issued even if the client record changes.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_country_code TEXT,
  ADD COLUMN IF NOT EXISTS client_tax_id_type  TEXT;

COMMENT ON COLUMN public.companies.tax_id_type IS
  'AEAT L7 identification type for a non-Spanish client: 02 NIF-IVA, 03 pasaporte, 04 documento oficial del pais de residencia, 05 certificado de residencia fiscal, 06 otro documento probatorio, 07 no censado. NULL = Spanish NIF.';
