-- ============================================================
-- Cuándo y a quién se envió una factura por correo (WEB-014).
--
-- Hasta ahora enviar una factura desde Archivum no dejaba rastro: la factura
-- seguía diciendo «Emitida» y no había forma de saber si el cliente la tenía.
-- `/api/documents/email` rellena estas columnas al enviarla, y la interfaz
-- muestra «Enviada» mientras no esté cobrada.
--
-- No afectan a la inalterabilidad: `protect_issued_invoice` solo congela
-- numeración, fechas de expedición y operación, importes, huellas y NIF.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to TEXT;
