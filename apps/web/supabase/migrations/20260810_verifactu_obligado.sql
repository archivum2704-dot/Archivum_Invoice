-- ============================================================
-- Verifactu — si la organización está obligada a declarar en España
--
-- El RD 1007/2023 obliga a quienes están sujetos a las obligaciones de
-- facturación españolas. Una empresa no establecida en España y sin esas
-- obligaciones no está en el ámbito de la norma: no es que pueda desactivar
-- VERI*FACTU, es que no le aplica.
--
-- Hasta ahora el sistema generaba el registro de alta, la huella y el QR de
-- cotejo de la AEAT para toda factura, sin mirar quién la emitía. Una empresa
-- extranjera habría emitido facturas con un QR que dice que son verificables
-- en la Agencia Tributaria española.
--
-- Por defecto TRUE: todas las organizaciones existentes siguen exactamente
-- igual. Solo cambia quien lo desmarque a conciencia.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS verifactu_obligado BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.verifactu_obligado IS
  'TRUE si la organización debe declarar sus facturas en España (RD 1007/2023). '
  'FALSE la exime de registro de facturación, huella, QR y remisión a la AEAT. '
  'Lo decide el titular: el criterio no es la nacionalidad sino si tiene '
  'obligaciones de facturación en España.';

-- Una factura sin obligación no lleva huella, y ya existía el índice parcial
-- (WHERE huella IS NOT NULL) que la deja fuera de la cadena. Este índice deja
-- constancia de la otra mitad: dentro de una organización obligada no puede
-- haber facturas emitidas sin huella.
--
-- No se impone como restricción porque las facturas anteriores a Verifactu
-- existen y son válidas; sirve para poder detectarlas.
CREATE INDEX IF NOT EXISTS idx_invoices_sin_huella
  ON public.invoices (organization_id)
  WHERE huella IS NULL AND state <> 'draft';
